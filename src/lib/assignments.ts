import JSZip from 'jszip';
import { getSupabaseClient, STORAGE_BUCKET } from './supabase';
import {
  Assignment,
  AssignmentQueryParams,
  AssignmentQueryResult,
  CCodeFile,
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
 * Helper to safely extract all C code files from an assignment record.
 * Supports both modern multiple c_files JSONB and legacy single c_code string.
 */
export function getAssignmentCFiles(assignment: Assignment): CCodeFile[] {
  if (Array.isArray(assignment.c_files) && assignment.c_files.length > 0) {
    return assignment.c_files
      .filter((f) => f && f.name && typeof f.code === 'string' && f.code.trim().length > 0)
      .map((f) => ({
        name: f.name.endsWith('.c') ? f.name : `${f.name}.c`,
        code: f.code,
      }));
  }

  if (assignment.c_code && assignment.c_code.trim().length > 0) {
    const base = assignment.title
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return [{ name: base ? `${base}.c` : 'main.c', code: assignment.c_code }];
  }

  return [];
}

/**
 * Fetch assignments with optional case-insensitive search, pagination, and sorting (newest first).
 * Uses select('*') so it never throws a 'column does not exist' error if columns vary across migrations.
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

  // Select all columns safely
  let query = supabase
    .from('assignments')
    .select('*', { count: 'exact' })
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

  // Normalize assignment rows to guarantee consistent structure
  const rawList = data || [];
  const assignments: Assignment[] = rawList.map((row: Record<string, unknown>) => {
    let parsedCFiles: CCodeFile[] = [];
    if (Array.isArray(row.c_files)) {
      parsedCFiles = row.c_files as CCodeFile[];
    } else if (typeof row.c_code === 'string' && row.c_code.trim()) {
      parsedCFiles = [{ name: 'main.c', code: row.c_code }];
    }

    return {
      id: Number(row.id),
      title: String(row.title || ''),
      file_path: row.file_path ? String(row.file_path) : null,
      file_name: row.file_name ? String(row.file_name) : null,
      file_size: row.file_size ? Number(row.file_size) : null,
      c_code: row.c_code ? String(row.c_code) : null,
      c_files: parsedCFiles,
      created_at: String(row.created_at || ''),
    };
  });

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
 * - cFiles (optional list of multiple C source code files with names)
 * At least one of file or cFiles must be provided.
 */
export async function uploadAssignment(
  title: string,
  file?: File | null,
  cFiles?: CCodeFile[]
): Promise<UploadAssignmentResult> {
  const titleValidation = validateTitle(title);
  if (!titleValidation.valid) {
    throw new Error(titleValidation.error || 'Invalid title');
  }

  // Filter valid C files with non-empty code
  const validCFiles: CCodeFile[] = (cFiles || [])
    .filter((f) => f && f.code && f.code.trim().length > 0)
    .map((f, index) => {
      let rawName = f.name?.trim() || `file_${index + 1}.c`;
      if (!rawName.toLowerCase().endsWith('.c')) {
        rawName = `${rawName}.c`;
      }
      return {
        name: rawName,
        code: f.code,
      };
    });

  const hasFile = Boolean(file);
  const hasCFiles = validCFiles.length > 0;

  if (!hasFile && !hasCFiles) {
    throw new Error('Please provide either a ZIP archive, at least one C code file, or both.');
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
    p_c_code: validCFiles.length > 0 ? validCFiles[0].code : null,
    p_secret_token: secretToken,
    p_c_files: validCFiles,
  });

  if (rpcError) {
    console.error('create_assignment RPC error:', rpcError);
    if (storageFilePath) {
      try {
        await supabase.storage.from(STORAGE_BUCKET).remove([storageFilePath]);
      } catch (cleanupErr) {
        console.warn('Storage cleanup warning:', cleanupErr);
      }
    }
    throw new Error(`Failed to save assignment record: ${rpcError.message}`);
  }

  const assignment: Assignment = {
    ...(rpcData as Assignment),
    c_files: validCFiles,
  };

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
    .select('*')
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
 * Download All C Files:
 * - If 1 file: downloads directly as filename.c
 * - If multiple files: bundles all C files into a single ZIP archive and downloads automatically.
 */
export async function downloadAllCFiles(assignment: Assignment): Promise<void> {
  const cFiles = getAssignmentCFiles(assignment);
  if (cFiles.length === 0) {
    throw new Error('This assignment does not contain any C source code files.');
  }

  // Single C file: download directly
  if (cFiles.length === 1) {
    const single = cFiles[0];
    const blob = new Blob([single.code], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = single.name.endsWith('.c') ? single.name : `${single.name}.c`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    }, 200);
    return;
  }

  // Multiple C files: bundle into a ZIP archive using JSZip
  const zip = new JSZip();
  cFiles.forEach((file) => {
    const cleanName = file.name.endsWith('.c') ? file.name : `${file.name}.c`;
    zip.file(cleanName, file.code);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = window.URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = downloadUrl;

  const safeTitle = assignment.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'assignment';

  link.download = `${safeTitle}_c_files.zip`;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }, 200);
}

/**
 * Copy individual C source code to clipboard with error handling.
 */
export async function copyCCodeToClipboard(code: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(code);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard writeText failed, trying fallback:', err);
  }

  // Fallback for older browsers or restricted iframe environments
  try {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch {
    return false;
  }
}
