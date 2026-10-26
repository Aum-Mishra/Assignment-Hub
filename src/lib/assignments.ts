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

  // On first page load without search, automatically clean up any orphaned DB records whose files were deleted from Storage
  if (page === 1 && !searchQuery) {
    try {
      await supabase.rpc('clean_orphaned_assignments');
    } catch {
      // Non-blocking if function not yet applied
    }
  }

  let query = supabase
    .from('assignments')
    .select('id, title, file_path, file_name, file_size, c_code, created_at', { count: 'exact' })
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
 * Accepts:
 * - title (required)
 * - file (optional ZIP archive)
 * - cCode (optional C source code)
 * At least one of file or cCode must be provided.
 */
export async function uploadAssignment(
  title: string,
  file?: File | null,
  cCode?: string | null
): Promise<UploadAssignmentResult> {
  const titleValidation = validateTitle(title);
  if (!titleValidation.valid) {
    throw new Error(titleValidation.error || 'Invalid title');
  }

  const cleanCCode = cCode?.trim() || null;
  const hasFile = Boolean(file);
  const hasCCode = Boolean(cleanCCode && cleanCCode.length > 0);

  if (!hasFile && !hasCCode) {
    throw new Error('Please provide either a ZIP file, C source code, or both.');
  }

  let storageFilePath: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;

  if (file) {
    const fileValidation = await validateZipFile(file);
    if (!fileValidation.valid) {
      throw new Error(fileValidation.error || 'Invalid file');
    }
    const uniqueId = generateSecureToken().slice(0, 16);
    const timestamp = Date.now();
    storageFilePath = `assignments/${uniqueId}-${timestamp}.zip`;
    fileName = file.name;
    fileSize = file.size;
  }

  const supabase = getSupabaseClient();
  const secretToken = generateSecureToken();

  // If ZIP file provided, upload to Supabase Storage
  if (file && storageFilePath) {
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
  }

  // Register assignment metadata and hash secret via secure RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc('create_assignment', {
    p_title: title.trim(),
    p_file_path: storageFilePath,
    p_file_name: fileName,
    p_file_size: fileSize,
    p_c_code: cleanCCode,
    p_secret_token: secretToken,
  });

  if (rpcError) {
    console.error('create_assignment RPC error:', rpcError);
    // Cleanup orphaned storage file if it was uploaded
    if (storageFilePath) {
      try {
        await supabase.storage.from(STORAGE_BUCKET).remove([storageFilePath]);
      } catch (cleanupErr) {
        console.warn('Storage cleanup warning:', cleanupErr);
      }
    }
    throw new Error(`Failed to save assignment record: ${rpcError.message}`);
  }

  const assignment = rpcData as Assignment;

  // Save deletion token in local storage
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
 * the database record. If a ZIP file existed, removes it from Supabase Storage.
 */
export async function deleteAssignment(id: number, secretToken: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('delete_assignment', {
    p_id: id,
    p_secret_token: secretToken.trim(),
  });

  if (error) {
    console.error('Delete assignment RPC error:', error);
    throw new Error(error.message || 'Unauthorized or invalid deletion key.');
  }

  // If a ZIP file was associated with this assignment, remove it from storage
  const filePath = (data as { file_path?: string })?.file_path;
  if (filePath) {
    const normalized = filePath.replace(/^assignments\//, '');
    const pathsToRemove = [filePath, normalized];
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(pathsToRemove);

    if (storageError) {
      console.warn('Storage removal warning:', storageError);
    }
  }

  // Remove local token once deleted
  removeUploaderToken(id);
}

/**
 * Rename an assignment's title and/or filename.
 */
export async function renameAssignment(
  id: number,
  newTitle: string,
  newFileName?: string
): Promise<Assignment> {
  const titleVal = validateTitle(newTitle);
  if (!titleVal.valid) {
    throw new Error(titleVal.error || 'Invalid title');
  }

  let cleanFileName = newFileName?.trim();
  if (cleanFileName) {
    if (!cleanFileName.toLowerCase().endsWith('.zip')) {
      cleanFileName = `${cleanFileName}.zip`;
    }
  }

  const supabase = getSupabaseClient();

  // Try RPC first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('rename_assignment', {
      p_id: id,
      p_new_title: newTitle.trim(),
      p_new_file_name: cleanFileName || null,
    });

    if (!rpcError && rpcData) {
      return rpcData as Assignment;
    }
  } catch (rpcErr) {
    console.warn('RPC rename_assignment call failed, trying direct update:', rpcErr);
  }

  // Fallback: direct table update
  const payload: { title: string; file_name?: string } = {
    title: newTitle.trim(),
  };
  if (cleanFileName) {
    payload.file_name = cleanFileName;
  }

  const { data, error } = await supabase
    .from('assignments')
    .update(payload)
    .eq('id', id)
    .select('id, title, file_path, file_name, file_size, c_code, created_at')
    .single();

  if (error) {
    console.error('Rename error:', error);
    throw new Error(error.message || 'Failed to rename assignment.');
  }

  return data as Assignment;
}

/**
 * Download an assignment ZIP file from Supabase Storage.
 */
export async function downloadAssignment(assignment: Assignment): Promise<void> {
  const supabase = getSupabaseClient();

  if (!assignment.file_path || !assignment.file_path.startsWith('assignments/')) {
    throw new Error('This assignment does not have a ZIP archive available for download.');
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
    const downloadName = assignment.file_name || 'assignment.zip';
    link.download = downloadName.endsWith('.zip') ? downloadName : `${downloadName}.zip`;
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
      fallbackLink.download = assignment.file_name || 'assignment.zip';
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

/**
 * Download C source code as a .c file, preserving line breaks, indentation, and formatting.
 * Uses a meaningful filename derived from assignment title (e.g. linked_list.c).
 */
export function downloadCCode(assignment: Assignment): void {
  if (!assignment.c_code) {
    throw new Error('This assignment does not have C source code available.');
  }

  const blob = new Blob([assignment.c_code], { type: 'text/plain;charset=utf-8' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;

  // Sanitize title to create a readable filename like "socket_programming.c"
  const safeBaseName = assignment.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'source_code';

  link.download = `${safeBaseName}.c`;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }, 200);
}
