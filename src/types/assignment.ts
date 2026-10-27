export interface CCodeFile {
  name: string;
  code: string;
}

export type NoteType = 'text' | 'image' | 'pdf';

export interface AssignmentNote {
  id: number;
  assignment_id: number;
  title: string;
  note_type: NoteType;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentBackup {
  id: number;
  assignment_id: number;
  action_type: 'EDIT' | 'DELETE';
  title: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  c_files: CCodeFile[];
  notes: AssignmentNote[];
  created_at: string;
  expires_at: string;
}

export interface Assignment {
  id: number;
  title: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  c_code?: string | null;
  c_files?: CCodeFile[] | null;
  notes_count?: number;
  created_at: string;
}

export interface UploadAssignmentResult {
  assignment: Assignment;
  secretToken: string;
}

export interface AssignmentQueryParams {
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

export interface AssignmentQueryResult {
  assignments: Assignment[];
  totalCount: number;
  filteredCount: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}
