import { getSupabaseClient, STORAGE_BUCKET } from './supabase';
import {
  Assignment,
  AssignmentBackup,
  AssignmentNote,
  AssignmentQueryParams,
  AssignmentQueryResult,
  CCodeFile,
  NoteType,
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
 * Fetch assignments with optional search, pagination, and sorting.
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

  // Fetch notes count mapping for these assignments
  const rawList = data || [];
  const assignmentIds = rawList.map((r: Record<string, unknown>) => Number(r.id)).filter(Boolean);
  const notesCountMap: Record<number, number> = {};

  if (assignmentIds.length > 0) {
    try {
      const { data: notesData } = await supabase
        .from('assignment_notes')
        .select('assignment_id');
      if (notesData) {
        notesData.forEach((n: { assignment_id: number }) => {
          notesCountMap[n.assignment_id] = (notesCountMap[n.assignment_id] || 0) + 1;
        });
      }
    } catch {
      // Non-blocking if table is being created
    }
  }

  const assignments: Assignment[] = rawList.map((row: Record<string, unknown>) => {
    let parsedCFiles: CCodeFile[] = [];
    if (Array.isArray(row.c_files)) {
      parsedCFiles = row.c_files as CCodeFile[];
    } else if (typeof row.c_code === 'string' && row.c_code.trim()) {
      parsedCFiles = [{ name: 'main.c', code: row.c_code }];
    }

    const id = Number(row.id);
    return {
      id,
      title: String(row.title || ''),
      file_path: row.file_path ? String(row.file_path) : null,
      file_name: row.file_name ? String(row.file_name) : null,
      file_size: row.file_size ? Number(row.file_size) : null,
      c_code: row.c_code ? String(row.c_code) : null,
      c_files: parsedCFiles,
      notes_count: notesCountMap[id] || 0,
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
 * Upload a new assignment with optional ZIP and C files.
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
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }
  }

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
    throw new Error(`Failed to save assignment record: ${rpcError.message}`);
  }

  const assignment: Assignment = {
    ...(rpcData as Assignment),
    c_files: validCFiles,
    notes_count: 0,
  };

  saveUploaderToken(assignment.id, secretToken);

  return {
    assignment,
    secretToken,
  };
}

/**
 * Public Collaborative Editing:
 * Allows ANY visitor to edit any assignment's title, replace/remove ZIP, or edit C files.
 * Automatically backed up in Supabase for 30 days via trigger!
 */
export async function editAssignment(
  id: number,
  data: {
    title: string;
    newZipFile?: File | null;
    removeZip?: boolean;
    cFiles: CCodeFile[];
    currentFilePath?: string | null;
    currentFileName?: string | null;
    currentFileSize?: number | null;
  }
): Promise<Assignment> {
  const titleVal = validateTitle(data.title);
  if (!titleVal.valid) {
    throw new Error(titleVal.error || 'Invalid title');
  }

  const validCFiles: CCodeFile[] = data.cFiles
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

  const supabase = getSupabaseClient();

  let targetFilePath: string | null = data.currentFilePath || null;
  let targetFileName: string | null = data.currentFileName || null;
  let targetFileSize: number | null = data.currentFileSize || null;

  if (data.removeZip) {
    targetFilePath = null;
    targetFileName = null;
    targetFileSize = null;
  } else if (data.newZipFile) {
    const val = await validateZipFile(data.newZipFile);
    if (!val.valid) {
      throw new Error(val.error || 'Invalid replacement ZIP file');
    }
    const uniqueId = generateSecureToken().slice(0, 16);
    const timestamp = Date.now();
    targetFilePath = `assignments/${uniqueId}-${timestamp}.zip`;
    targetFileName = data.newZipFile.name;
    targetFileSize = data.newZipFile.size;

    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(targetFilePath, data.newZipFile, {
        contentType: 'application/zip',
        cacheControl: '3600',
        upsert: false,
      });

    if (storageError) {
      throw new Error(`Failed to upload replacement ZIP: ${storageError.message}`);
    }
  }

  // Try RPC first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('edit_assignment', {
      p_id: id,
      p_title: data.title.trim(),
      p_file_path: targetFilePath,
      p_file_name: targetFileName,
      p_file_size: targetFileSize,
      p_c_files: validCFiles,
    });

    if (!rpcError && rpcData) {
      return {
        ...(rpcData as Assignment),
        c_files: validCFiles,
      };
    }
  } catch (rpcErr) {
    console.warn('RPC edit_assignment failed, falling back to direct table update:', rpcErr);
  }

  // Fallback direct table update
  const { data: updateData, error: updateError } = await supabase
    .from('assignments')
    .update({
      title: data.title.trim(),
      file_path: targetFilePath,
      file_name: targetFileName,
      file_size: targetFileSize,
      c_files: validCFiles,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    console.error('Update error:', updateError);
    throw new Error(`Failed to update assignment: ${updateError.message}`);
  }

  return {
    ...(updateData as Assignment),
    c_files: validCFiles,
  };
}

/**
 * Delete an assignment securely:
 * Calls delete_assignment RPC. The database hashes the provided secret_token
 * and verifies it against the private assignment_secrets table before deleting.
 * Automatically saves a complete backup snapshot in Supabase for 30 days!
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

  removeUploaderToken(id);
}

/**
 * Rename assignment title and/or filename.
 */
export async function renameAssignment(
  id: number,
  newTitle: string,
  newFileName?: string
): Promise<Assignment> {
  return editAssignment(id, {
    title: newTitle,
    cFiles: [],
    currentFileName: newFileName,
  });
}

/**
 * Download assignment ZIP file.
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
    }, 400);
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
 * Download All C Files as separate .c files directly.
 */
export async function downloadAllCFiles(assignment: Assignment): Promise<void> {
  const cFiles = getAssignmentCFiles(assignment);
  if (cFiles.length === 0) {
    throw new Error('This assignment does not contain any C source code files.');
  }

  for (let i = 0; i < cFiles.length; i++) {
    const file = cFiles[i];
    const blob = new Blob([file.code], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.name.endsWith('.c') ? file.name : `${file.name}.c`;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    }, 400);

    if (i < cFiles.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
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

// ==============================================================================
// Assignment Notes API
// ==============================================================================

/**
 * Fetch all notes for an assignment.
 */
export async function getAssignmentNotes(assignmentId: number): Promise<AssignmentNote[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assignment_notes')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching notes:', error);
    throw new Error(`Failed to load notes: ${error.message}`);
  }

  return (data || []) as AssignmentNote[];
}

/**
 * Create a new note (text, image, or PDF).
 */
export async function createAssignmentNote(payload: {
  assignmentId: number;
  title: string;
  noteType: NoteType;
  content?: string;
  file?: File;
}): Promise<AssignmentNote> {
  const trimmedTitle = payload.title.trim();
  if (!trimmedTitle) {
    throw new Error('Note title is required.');
  }

  const supabase = getSupabaseClient();
  let filePath: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;

  if (payload.file) {
    const ext = payload.file.name.split('.').pop() || 'dat';
    const uniqueId = generateSecureToken().slice(0, 16);
    const timestamp = Date.now();
    filePath = `notes/${uniqueId}-${timestamp}.${ext}`;
    fileName = payload.file.name;
    fileSize = payload.file.size;

    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, payload.file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (storageError) {
      throw new Error(`Failed to upload note file: ${storageError.message}`);
    }
  }

  const { data, error } = await supabase
    .from('assignment_notes')
    .insert([
      {
        assignment_id: payload.assignmentId,
        title: trimmedTitle,
        note_type: payload.noteType,
        content: payload.content || null,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
      },
    ])
    .select('*')
    .single();

  if (error) {
    console.error('Error inserting note:', error);
    throw new Error(`Failed to save note: ${error.message}`);
  }

  return data as AssignmentNote;
}

/**
 * Update an existing note.
 */
export async function updateAssignmentNote(
  noteId: number,
  payload: {
    title: string;
    content?: string;
    file?: File;
  }
): Promise<AssignmentNote> {
  const trimmedTitle = payload.title.trim();
  if (!trimmedTitle) {
    throw new Error('Note title is required.');
  }

  const supabase = getSupabaseClient();
  const updateData: Record<string, unknown> = {
    title: trimmedTitle,
    updated_at: new Date().toISOString(),
  };

  if (typeof payload.content !== 'undefined') {
    updateData.content = payload.content;
  }

  if (payload.file) {
    const ext = payload.file.name.split('.').pop() || 'dat';
    const uniqueId = generateSecureToken().slice(0, 16);
    const timestamp = Date.now();
    const filePath = `notes/${uniqueId}-${timestamp}.${ext}`;

    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, payload.file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (storageError) {
      throw new Error(`Failed to upload replacement note file: ${storageError.message}`);
    }

    updateData.file_path = filePath;
    updateData.file_name = payload.file.name;
    updateData.file_size = payload.file.size;
  }

  const { data, error } = await supabase
    .from('assignment_notes')
    .update(updateData)
    .eq('id', noteId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update note: ${error.message}`);
  }

  return data as AssignmentNote;
}

/**
 * Delete a note (the file is kept for 30-day recovery backups).
 */
export async function deleteAssignmentNote(noteId: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('assignment_notes').delete().eq('id', noteId);
  if (error) {
    throw new Error(`Failed to delete note: ${error.message}`);
  }
}

/**
 * Get public download/preview URL for a note file.
 */
export function getNoteFileUrl(filePath: string): string {
  const supabase = getSupabaseClient();
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data?.publicUrl || '';
}

/**
 * Download a note (text note downloads as .txt, file note downloads original).
 */
export async function downloadNote(note: AssignmentNote): Promise<void> {
  if (note.note_type === 'text') {
    const blob = new Blob([note.content || ''], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    const safeTitle = note.title.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || 'note';
    link.download = `${safeTitle}.txt`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    }, 400);
    return;
  }

  if (!note.file_path) {
    throw new Error('This note does not contain an attached file.');
  }

  const url = getNoteFileUrl(note.file_path);
  if (!url) {
    throw new Error('Could not generate download URL for this note.');
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = note.file_name || 'note_attachment';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    }, 400);
  } catch (err) {
    console.warn('Direct blob download failed, falling back to window open:', err);
    window.open(url, '_blank');
  }
}

// ==============================================================================
// 30-Day Backup & Recovery API
// ==============================================================================

/**
 * Fetch available historical versions (backups within 30-day retention).
 */
export async function getAssignmentBackups(assignmentId?: number): Promise<AssignmentBackup[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('assignment_backups')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (assignmentId) {
    query = query.eq('assignment_id', assignmentId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching backups:', error);
    return [];
  }

  return (data || []) as AssignmentBackup[];
}

/**
 * Restore an assignment to a previous backup version.
 */
export async function restoreAssignmentBackup(backupId: number): Promise<Assignment> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('restore_assignment_version', {
    p_backup_id: backupId,
  });

  if (error) {
    console.error('Restore version RPC error:', error);
    throw new Error(`Failed to restore version: ${error.message}`);
  }

  return data as Assignment;
}
