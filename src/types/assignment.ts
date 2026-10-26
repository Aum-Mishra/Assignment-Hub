export interface Assignment {
  id: number;
  title: string;
  file_path: string;
  file_name: string;
  file_size: number;
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
