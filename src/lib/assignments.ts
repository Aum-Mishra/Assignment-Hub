import { getSupabaseClient, STORAGE_BUCKET } from './supabase';
import {
  Assignment,
  AssignmentQueryParams,
  AssignmentQueryResult,
  UploadAssignmentResult
} from '../types/assignment';
import { validateTitle, validateZipFile } from './validation';

const LOCAL_STORAGE_TOKENS_KEY = 'assignment_hub_uploader_tokens';

/**
 * Generate a cryptographically secure 32-character hex secret token.
 */
export function generateSecureToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[x]/g, () =>
    ((Math.random() * 16) | 0).toString(16)
  );
}

/**
 * Local storage management for anonymous uploader tokens.
 */
export function getStoredTokens(): Record<number, string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TOKENS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveUploaderToken(assignmentId: number, token: string): void {
  try {
    const current = getStoredTokens();
    current[assignmentId] = token;
    localStorage.setItem(LOCAL_STORAGE_TOKENS_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Failed to save uploader token to localStorage', err);
  }
}

export function getUploaderToken(assignmentId: number): string | null {
  const current = getStoredTokens();
  return current[assignmentId] || null;
}

export function removeUploaderToken(assignmentId: number): void {
  try {
    const current = getStoredTokens();
    delete current[assignmentId];
    localStorage.setItem(LOCAL_STORAGE_TOKENS_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Failed to remove uploader token from localStorage', err);
  }
}

/**
 * Fetch assignments with optional case-insensitive search, pagination, and sorting (newest first).
 */
export async function getAssignments(
  params: AssignmentQueryParams = {}
): Promise<AssignmentQueryResult> {
  const supabase = getSupabaseClient();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, params.pageSize || 25);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const searchQuery = params.searchQuery?.trim();

  let query = supabase
    .from('assignments')
    .select('id, title, file_path, file_name, file_size, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchQuery) {
    query = query.ilike('title', `%${searchQuery}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching assignments:', error);
    throw new Error(`Failed to load assignments: ${error.message}`);
  }

  const filteredCount = count ?? 0;
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
 * 1. Validates title & ZIP archive.
 * 2. Generates a secure random 32-character uploader secret token.
 * 3. Uploads ZIP file to Supabase Storage.
 * 4. Calls create_assignment RPC function to store metadata & SHA-256 hash.
 * 5. Saves deletion token in browser localStorage for 1-click verified deletion.
 */
export async function uploadAssignment(
  title: string,
  file: File
): Promise<UploadAssignmentResult> {
  const titleValidation = validateTitle(title);
  if (!titleValidation.valid) {
    throw new Error(titleValidation.error || 'Invalid title');
  }

  const fileValidation = await validateZipFile(file);
  if (!fileValidation.valid) {
    throw new Error(fileValidation.error || 'Invalid file');
  }

  const supabase = getSupabaseClient();
  const uniqueId = generateSecureToken().slice(0, 16);
  const timestamp = Date.now();
  const storageFilePath = `assignments/${uniqueId}-${timestamp}.zip`;
  const secretToken = generateSecureToken();

  // Upload ZIP file to Supabase Storage
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
        `Storage bucket "${STORAGE_BUCKET}" does not exist. Please run setup.sql in the Supabase SQL Editor.`
      );
    }
    throw new Error(`Storage upload failed: ${storageError.message}`);
  }

  // Register assignment metadata and hash secret via secure RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc('create_assignment', {
    p_title: title.trim(),
    p_file_path: storageFilePath,
    p_file_name: file.name,
    p_file_size: file.size,
    p_secret_token: secretToken,
  });

  if (rpcError) {
    console.error('create_assignment RPC error:', rpcError);
    // Cleanup orphaned storage file
    try {
      await supabase.storage.from(STORAGE_BUCKET).remove([storageFilePath]);
    } catch (cleanupErr) {
      console.warn('Storage cleanup warning:', cleanupErr);
    }
    throw new Error(`Failed to save assignment record: ${rpcError.message}`);
  }

  const assignment = rpcData as Assignment;

  // Save the deletion token in local storage so the original uploader can delete it seamlessly
  saveUploaderToken(assignment.id, secretToken);

  return {
    assignment,
    secretToken,
  };
}

/**
 * Delete an assignment securely:
 * Calls delete_assignment RPC. The database hashes the provided secret_token
 * and verifies it against the private assignment_secrets table before deleting
 * the storage object and database record.
 */
export async function deleteAssignment(id: number, secretToken: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.rpc('delete_assignment', {
    p_id: id,
    p_secret_token: secretToken.trim(),
  });

  if (error) {
    console.error('Delete assignment RPC error:', error);
    throw new Error(error.message || 'Unauthorized or invalid deletion key.');
  }

  // Remove local token once deleted
  removeUploaderToken(id);
}

/**
 * Download an assignment ZIP file.
 */
export async function downloadAssignment(assignment: Assignment): Promise<void> {
  const supabase = getSupabaseClient();

  if (!assignment.file_path || !assignment.file_path.startsWith('assignments/')) {
    throw new Error('Invalid or unverified file path for this assignment.');
  }

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(assignment.file_path);

  if (!data?.publicUrl) {
    throw new Error('Failed to generate download URL from Supabase Storage.');
  }

  try {
    const response = await fetch(data.publicUrl);
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}.`);
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

    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    }, 200);
  } catch (err: unknown) {
    console.error('Download error:', err);
    if (data.publicUrl) {
      const fallbackLink = document.createElement('a');
      fallbackLink.href = data.publicUrl;
      fallbackLink.download = assignment.file_name;
      document.body.appendChild(fallbackLink);
      fallbackLink.click();
      document.body.removeChild(fallbackLink);
      return;
    }
    throw new Error(
      err instanceof Error ? err.message : 'Could not download assignment file.'
    );
  }
}
