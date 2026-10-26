import { getSupabaseClient, STORAGE_BUCKET } from './supabase';
import { Assignment, AssignmentQueryParams, AssignmentQueryResult } from '../types/assignment';
import { validateTitle, validateZipFile } from './validation';

/**
 * Generate a cryptographically random unique identifier safe for filenames.
 */
function generateUniqueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Fetch assignments with optional case-insensitive search, pagination, and sorting (newest first).
 */
export async function getAssignments(
  params: AssignmentQueryParams = {}
): Promise<AssignmentQueryResult> {
  const supabase = getSupabaseClient();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, params.pageSize || 12);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const searchQuery = params.searchQuery?.trim();

  // Query filtered items with count
  let query = supabase
    .from('assignments')
    .select('id, title, file_path, file_name, file_size, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchQuery) {
    // Supabase ilike supports case-insensitive pattern matching
    query = query.ilike('title', `%${searchQuery}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching assignments:', error);
    throw new Error(`Failed to load assignments: ${error.message}`);
  }

  const filteredCount = count ?? 0;

  // If there's an active search query, also fetch total count of the table for UI badges
  let totalCount = filteredCount;
  if (searchQuery) {
    const totalRes = await supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true });
    if (!totalRes.error && totalRes.count !== null) {
      totalCount = totalRes.count;
    }
  }

  const assignments: Assignment[] = data || [];
  const hasMore = to + 1 < filteredCount;

  return {
    assignments,
    totalCount,
    filteredCount,
    hasMore,
    page,
    pageSize,
  };
}

/**
 * Upload an assignment:
 * 1. Validates inputs.
 * 2. Uploads the ZIP file to Supabase Storage with a safe, unique path.
 * 3. Inserts the assignment metadata into PostgreSQL.
 * 4. Rolls back the storage upload if database insertion fails.
 */
export async function uploadAssignment(
  title: string,
  file: File,
  _onProgress?: (progressPercent: number) => void
): Promise<Assignment> {
  // 1. Validation
  const titleValidation = validateTitle(title);
  if (!titleValidation.valid) {
    throw new Error(titleValidation.error || 'Invalid title');
  }

  const fileValidation = await validateZipFile(file);
  if (!fileValidation.valid) {
    throw new Error(fileValidation.error || 'Invalid file');
  }

  const supabase = getSupabaseClient();

  // Generate safe storage path: assignments/<unique-id>-<timestamp>.zip
  const uniqueId = generateUniqueId();
  const timestamp = Date.now();
  const storageFilePath = `assignments/${uniqueId}-${timestamp}.zip`;

  // 2. Storage upload
  // Note: Official supabase-js storage client standard upload does not emit byte-level progress in standard fetch,
  // so callers should display an honest indeterminate loading state.
  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storageFilePath, file, {
      contentType: 'application/zip',
      cacheControl: '3600',
      upsert: false,
    });

  if (storageError) {
    console.error('Supabase Storage upload error:', storageError);
    if (storageError.message.includes('Bucket not found')) {
      throw new Error(
        `Storage bucket "${STORAGE_BUCKET}" does not exist. Please run the setup SQL in the Supabase SQL Editor.`
      );
    }
    if (storageError.message.includes('exceeded') || storageError.message.includes('Payload too large')) {
      throw new Error('Upload failed: File exceeds the maximum allowed storage size.');
    }
    throw new Error(`Storage upload failed: ${storageError.message}`);
  }

  // 3. Database record insertion
  const trimmedTitle = title.trim();
  const { data: dbData, error: dbError } = await supabase
    .from('assignments')
    .insert([
      {
        title: trimmedTitle,
        file_path: storageFilePath,
        file_name: file.name,
        file_size: file.size,
      },
    ])
    .select('id, title, file_path, file_name, file_size, created_at')
    .single();

  // 4. Rollback handling if database insertion fails
  if (dbError) {
    console.error('Database insert error:', dbError);

    // Attempt to remove the orphaned file from storage
    try {
      const { error: cleanupError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([storageFilePath]);

      if (cleanupError) {
        console.warn(
          `Orphaned file cleanup warning: could not remove "${storageFilePath}". Clean up manually if needed.`,
          cleanupError
        );
      }
    } catch (cleanupCatchErr) {
      console.warn('Orphaned file cleanup exception:', cleanupCatchErr);
    }

    throw new Error(`Failed to save assignment record: ${dbError.message}`);
  }

  return dbData as Assignment;
}

/**
 * Download an assignment ZIP file.
 * Retrieves the public URL, fetches the blob, and triggers browser download with the original filename.
 */
export async function downloadAssignment(assignment: Assignment): Promise<void> {
  const supabase = getSupabaseClient();

  if (!assignment.file_path || !assignment.file_path.startsWith('assignments/')) {
    throw new Error('Invalid or unverified file path for this assignment.');
  }

  // 1. Get public URL from Supabase Storage
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(assignment.file_path);

  if (!data?.publicUrl) {
    throw new Error('Failed to generate download URL from Supabase Storage.');
  }

  try {
    // 2. Fetch the file blob to force the download with the original human-readable filename
    const response = await fetch(data.publicUrl);
    if (!response.ok) {
      throw new Error(
        `Download failed with HTTP ${response.status} (${response.statusText}). File may have been removed.`
      );
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = assignment.file_name.endsWith('.zip')
      ? assignment.file_name
      : `${assignment.file_name}.zip`;
    document.body.appendChild(link);
    link.click();

    // Cleanup object URL
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    }, 200);
  } catch (err: unknown) {
    console.error('Download error:', err);
    // If CORS or direct blob fetch fails, fallback to direct window download
    if (data.publicUrl) {
      const fallbackLink = document.createElement('a');
      fallbackLink.href = data.publicUrl;
      fallbackLink.target = '_blank';
      fallbackLink.rel = 'noopener noreferrer';
      fallbackLink.download = assignment.file_name;
      document.body.appendChild(fallbackLink);
      fallbackLink.click();
      document.body.removeChild(fallbackLink);
      return;
    }
    throw new Error(
      err instanceof Error ? err.message : 'An error occurred while downloading the file.'
    );
  }
}
