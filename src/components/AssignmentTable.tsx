import React, { useState } from 'react';
import {
  Download,
  Trash2,
  Edit2,
  Search,
  X,
  FileArchive,
  Code2,
  Copy,
  Loader2,
  RotateCcw,
  Calendar,
  FileText,
  History
} from 'lucide-react';
import { Assignment } from '../types/assignment';
import { formatBytes } from '../lib/validation';
import {
  downloadAssignment,
  downloadAllCFiles,
  getAssignmentCFiles,
  getStoredTokens
} from '../lib/assignments';

interface AssignmentTableProps {
  assignments: Assignment[];
  totalCount: number;
  filteredCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenDelete: (assignment: Assignment) => void;
  onOpenEdit: (assignment: Assignment) => void;
  onOpenNotes: (assignment: Assignment) => void;
  onOpenHistory: (assignment: Assignment) => void;
  onOpenViewCode: (assignment: Assignment) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  onRetry: () => void;
  errorMessage: string | null;
}

export const AssignmentTable: React.FC<AssignmentTableProps> = ({
  assignments,
  totalCount,
  filteredCount,
  isLoading,
  isLoadingMore,
  searchQuery,
  onSearchChange,
  onOpenDelete,
  onOpenEdit,
  onOpenNotes,
  onOpenHistory,
  onOpenViewCode,
  onLoadMore,
  hasMore,
  onRetry,
  errorMessage,
}) => {
  const [downloadingZipId, setDownloadingZipId] = useState<number | null>(null);
  const [downloadingCId, setDownloadingCId] = useState<number | null>(null);
  const myTokens = getStoredTokens();

  const handleDownloadZip = async (assignment: Assignment) => {
    try {
      setDownloadingZipId(assignment.id);
      await downloadAssignment(assignment);
    } catch (err) {
      console.error('Download error:', err);
      alert(err instanceof Error ? err.message : 'ZIP download failed.');
    } finally {
      setDownloadingZipId(null);
    }
  };

  const handleDownloadCFiles = async (assignment: Assignment) => {
    try {
      setDownloadingCId(assignment.id);
      await downloadAllCFiles(assignment);
    } catch (err) {
      console.error('C download error:', err);
      alert(err instanceof Error ? err.message : 'C source download failed.');
    } finally {
      setDownloadingCId(null);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(d);
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3">
      {/* Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-md border border-slate-200">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search assignments by title..."
            className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 flex items-center justify-between sm:justify-end gap-3">
          {searchQuery.trim() ? (
            <span>
              Found <strong className="text-slate-700">{filteredCount}</strong> of {totalCount}
            </span>
          ) : (
            <span>Total: <strong className="text-slate-700">{totalCount}</strong></span>
          )}
        </div>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={onRetry}
            className="text-rose-700 font-semibold underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-2xs">
        {isLoading && assignments.length === 0 ? (
          /* Skeletons */
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-3 animate-pulse flex items-center justify-between gap-4">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-4 bg-slate-100 rounded w-1/5 hidden sm:block" />
                <div className="h-4 bg-slate-100 rounded w-16" />
                <div className="h-7 bg-slate-200 rounded w-24" />
              </div>
            ))}
          </div>
        ) : assignments.length === 0 ? (
          /* Empty State */
          <div className="p-10 text-center text-slate-500">
            <FileArchive className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">
              {searchQuery ? 'No matching assignments found' : 'No assignments yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery
                ? 'Try a different search term or clear the filter.'
                : 'Click "Upload Assignment" in the top bar to share the first assignment.'}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear search</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Compact Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4 w-4/12">Assignment Title</th>
                    <th className="py-2.5 px-3 w-3/12">Available Files</th>
                    <th className="py-2.5 px-3 w-2/12">Uploaded</th>
                    <th className="py-2.5 px-4 w-3/12 text-right">Downloads & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map((assignment) => {
                    const isMine = Boolean(myTokens[assignment.id]);
                    const hasZip = Boolean(assignment.file_path);
                    const cFiles = getAssignmentCFiles(assignment);
                    const hasCFiles = cFiles.length > 0;
                    const isDownloadingZip = downloadingZipId === assignment.id;
                    const isDownloadingC = downloadingCId === assignment.id;

                    return (
                      <tr
                        key={assignment.id}
                        id={`assignment-${assignment.id}`}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Title */}
                        <td className="py-2.5 px-4 align-middle">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-sm leading-snug break-words">
                              {assignment.title}
                            </span>
                            {isMine && (
                              <span className="inline-block text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                Yours
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Available File Indicators */}
                        <td className="py-2.5 px-3 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {hasZip && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px]"
                                title={assignment.file_name || 'ZIP Archive'}
                              >
                                <FileArchive className="w-3 h-3 text-blue-600" />
                                <span>ZIP</span>
                                {assignment.file_size ? (
                                  <span className="text-slate-400">({formatBytes(assignment.file_size)})</span>
                                ) : null}
                              </span>
                            )}

                            {hasCFiles && (
                              <button
                                type="button"
                                onClick={() => onOpenViewCode(assignment)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-mono text-[11px] transition-colors"
                                title="Click to view & copy C code"
                              >
                                <Code2 className="w-3 h-3 text-emerald-600" />
                                <span>
                                  {cFiles.length === 1 ? cFiles[0].name : `${cFiles.length} C Files`}
                                </span>
                              </button>
                            )}

                            {/* Notes Tab badge/button */}
                            <button
                              type="button"
                              onClick={() => onOpenNotes(assignment)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-mono text-[11px] transition-colors"
                              title="Click to view & manage notes"
                            >
                              <FileText className="w-3 h-3 text-amber-600" />
                              <span>{assignment.notes_count ? `${assignment.notes_count} Notes` : 'Notes'}</span>
                            </button>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-2.5 px-3 text-slate-500 text-xs align-middle whitespace-nowrap">
                          {formatDate(assignment.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-4 text-right align-middle whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Download ZIP button (only if ZIP exists) */}
                            {hasZip && (
                              <button
                                type="button"
                                onClick={() => handleDownloadZip(assignment)}
                                disabled={isDownloadingZip}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors disabled:opacity-50"
                                title="Download ZIP Archive"
                              >
                                {isDownloadingZip ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3" />
                                )}
                                <span>Download ZIP</span>
                              </button>
                            )}

                            {/* Download C Files button (only if C files exist) */}
                            {hasCFiles && (
                              <button
                                type="button"
                                onClick={() => handleDownloadCFiles(assignment)}
                                disabled={isDownloadingC}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors disabled:opacity-50"
                                title={cFiles.length === 1 ? `Download ${cFiles[0].name}` : `Download all ${cFiles.length} separate .c files`}
                              >
                                {isDownloadingC ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3" />
                                )}
                                <span>Download C Files</span>
                              </button>
                            )}

                            {/* Copy/View Code button */}
                            {hasCFiles && (
                              <button
                                type="button"
                                onClick={() => onOpenViewCode(assignment)}
                                className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                                title="View & Copy C Code"
                                aria-label="View & Copy C Code"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Notes button */}
                            <button
                              type="button"
                              onClick={() => onOpenNotes(assignment)}
                              className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                              title="Notes (Text, Image, PDF)"
                              aria-label="Notes"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            {/* 30-Day Version History */}
                            <button
                              type="button"
                              onClick={() => onOpenHistory(assignment)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="30-Day Version History & Restore"
                              aria-label="30-Day Version History"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit (Public) */}
                            <button
                              type="button"
                              onClick={() => onOpenEdit(assignment)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit assignment (public)"
                              aria-label="Edit assignment"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => onOpenDelete(assignment)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title={isMine ? 'Delete your assignment' : 'Delete assignment (requires deletion key)'}
                              aria-label="Delete assignment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Rows */}
            <div className="md:hidden divide-y divide-slate-100">
              {assignments.map((assignment) => {
                const isMine = Boolean(myTokens[assignment.id]);
                const hasZip = Boolean(assignment.file_path);
                const cFiles = getAssignmentCFiles(assignment);
                const hasCFiles = cFiles.length > 0;
                const isDownloadingZip = downloadingZipId === assignment.id;
                const isDownloadingC = downloadingCId === assignment.id;

                return (
                  <div
                    key={assignment.id}
                    id={`mobile-assignment-${assignment.id}`}
                    className="p-3.5 space-y-2 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug break-words">
                        {assignment.title}
                      </h3>
                      {isMine && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                          Yours
                        </span>
                      )}
                    </div>

                    {/* Metadata & Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {hasZip && (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          <FileArchive className="w-3 h-3 text-blue-600" />
                          <span>ZIP</span>
                          {assignment.file_size ? <span>({formatBytes(assignment.file_size)})</span> : null}
                        </span>
                      )}

                      {hasCFiles && (
                        <button
                          type="button"
                          onClick={() => onOpenViewCode(assignment)}
                          className="inline-flex items-center gap-1 font-mono text-[11px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-800"
                        >
                          <Code2 className="w-3 h-3 text-emerald-600" />
                          <span>{cFiles.length === 1 ? cFiles[0].name : `${cFiles.length} C Files`}</span>
                        </button>
                      )}

                      {/* Notes Badge on Mobile */}
                      <button
                        type="button"
                        onClick={() => onOpenNotes(assignment)}
                        className="inline-flex items-center gap-1 font-mono text-[11px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-amber-800"
                      >
                        <FileText className="w-3 h-3 text-amber-600" />
                        <span>{assignment.notes_count ? `${assignment.notes_count} Notes` : 'Notes'}</span>
                      </button>

                      <span className="flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatDate(assignment.created_at)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {hasZip && (
                          <button
                            type="button"
                            onClick={() => handleDownloadZip(assignment)}
                            disabled={isDownloadingZip}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded"
                          >
                            {isDownloadingZip ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            <span>Download ZIP</span>
                          </button>
                        )}

                        {hasCFiles && (
                          <button
                            type="button"
                            onClick={() => handleDownloadCFiles(assignment)}
                            disabled={isDownloadingC}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded"
                          >
                            {isDownloadingC ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            <span>Download C Files</span>
                          </button>
                        )}

                        {hasCFiles && (
                          <button
                            type="button"
                            onClick={() => onOpenViewCode(assignment)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Code</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenNotes(assignment)}
                          className="p-1 text-slate-400 hover:text-amber-600 rounded"
                          title="Notes"
                          aria-label="Notes"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenHistory(assignment)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                          title="30-Day Version History"
                          aria-label="30-Day Version History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEdit(assignment)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded"
                          title="Edit (Public)"
                          aria-label="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDelete(assignment)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Load More */}
      {hasMore && !isLoading && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Loading more...</span>
              </>
            ) : (
              <span>Load More Assignments</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
