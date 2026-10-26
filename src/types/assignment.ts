export interface Assignment {
  id: number;
  title: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  c_code: string | null;
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
