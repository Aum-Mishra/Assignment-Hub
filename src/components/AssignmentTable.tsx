import React, { useState } from 'react';
import {
  Download,
  Trash2,
  Edit2,
  Search,
  X,
  FileArchive,
  Loader2,
  RotateCcw,
  Calendar,
  HardDrive
} from 'lucide-react';
import { Assignment } from '../types/assignment';
import { formatBytes } from '../lib/validation';
import { downloadAssignment, getStoredTokens } from '../lib/assignments';

interface AssignmentTableProps {
  assignments: Assignment[];
  totalCount: number;
  filteredCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenDelete: (assignment: Assignment) => void;
  onOpenRename: (assignment: Assignment) => void;
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
  onOpenRename,
  onLoadMore,
  hasMore,
  onRetry,
  errorMessage,
}) => {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const myTokens = getStoredTokens();

  const handleDownload = async (assignment: Assignment) => {
    try {
      setDownloadingId(assignment.id);
      await downloadAssignment(assignment);
    } catch (err) {
      console.error('Download error:', err);
      alert(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloadingId(null);
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

      {/* Main Table / List Container */}
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
                : 'Click "Upload Assignment" in the top bar to share the first file.'}
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
                    <th className="py-2.5 px-4 w-5/12">Assignment Title</th>
                    <th className="py-2.5 px-3 w-3/12">ZIP Filename</th>
                    <th className="py-2.5 px-3 w-1/12">Size</th>
                    <th className="py-2.5 px-3 w-1/12">Date</th>
                    <th className="py-2.5 px-4 w-2/12 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map((assignment) => {
                    const isMine = Boolean(myTokens[assignment.id]);
                    const isDownloading = downloadingId === assignment.id;

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
                              <span className="inline-block text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                Yours
                              </span>
                            )}
                          </div>
                        </td>

                        {/* File Name */}
                        <td className="py-2.5 px-3 font-mono text-slate-600 text-xs align-middle">
                          <div className="flex items-center gap-1.5 truncate max-w-xs" title={assignment.file_name}>
                            <FileArchive className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{assignment.file_name}</span>
                          </div>
                        </td>

                        {/* File Size */}
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-xs align-middle whitespace-nowrap">
                          {formatBytes(assignment.file_size)}
                        </td>

                        {/* Upload Date */}
                        <td className="py-2.5 px-3 text-slate-500 text-xs align-middle whitespace-nowrap">
                          {formatDate(assignment.created_at)}
                        </td>

                        {/* Actions: Download + Delete */}
                        <td className="py-2.5 px-4 text-right align-middle whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDownload(assignment)}
                              disabled={isDownloading}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors disabled:opacity-50"
                              title="Download ZIP archive"
                            >
                              {isDownloading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Download className="w-3 h-3" />
                              )}
                              <span>Download</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenRename(assignment)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Rename assignment"
                              aria-label="Rename assignment"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

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

            {/* Mobile Compact Rows */}
            <div className="md:hidden divide-y divide-slate-100">
              {assignments.map((assignment) => {
                const isMine = Boolean(myTokens[assignment.id]);
                const isDownloading = downloadingId === assignment.id;

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

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="font-mono flex items-center gap-1 truncate max-w-[200px]" title={assignment.file_name}>
                        <FileArchive className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{assignment.file_name}</span>
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <HardDrive className="w-3 h-3 text-slate-400" />
                        {formatBytes(assignment.file_size)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatDate(assignment.created_at)}
                      </span>
                    </div>

                    <div className="pt-1 flex items-center justify-between border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleDownload(assignment)}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded"
                      >
                        {isDownloading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>Download ZIP</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenRename(assignment)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Rename</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenDelete(assignment)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
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

      {/* Load More Button */}
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

