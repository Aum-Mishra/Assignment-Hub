import React from 'react';
import {
  AlertTriangle,
  RotateCcw,
  ChevronDown,
  Layers
} from 'lucide-react';
import { Assignment } from '../types/assignment';
import { AssignmentCard } from './AssignmentCard';
import { SearchBar } from './SearchBar';
import { EmptyState } from './EmptyState';

interface AssignmentListProps {
  assignments: Assignment[];
  totalCount: number;
  filteredCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  errorMessage: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
}

export const AssignmentList: React.FC<AssignmentListProps> = ({
  assignments,
  totalCount,
  filteredCount,
  isLoading,
  isLoadingMore,
  errorMessage,
  searchQuery,
  onSearchChange,
  onRetry,
  onLoadMore,
  hasMore,
}) => {
  const isSearchActive = searchQuery.trim().length > 0;

  const scrollToUpload = () => {
    const el = document.getElementById('upload-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section id="assignments-section" className="py-12 sm:py-16 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                All Assignments
              </h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
                <Layers className="w-3.5 h-3.5" />
                {totalCount} Total
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Browse public assignment submissions or search by title.
            </p>
          </div>

          {/* Search bar */}
          <SearchBar
            query={searchQuery}
            onQueryChange={onSearchChange}
            resultCount={filteredCount}
            isSearching={isLoading && isSearchActive}
          />
        </div>

        {/* Error state */}
        {errorMessage && (
          <div className="my-8 p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 max-w-2xl mx-auto text-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold mb-1">Failed to Load Assignments</h3>
            <p className="text-sm text-rose-700 mb-4">{errorMessage}</p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry Request</span>
            </button>
          </div>
        )}

        {/* Initial Loading Skeletons */}
        {isLoading && assignments.length === 0 && !errorMessage && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-8">
            {[1, 2, 3, 4, 5, 6].map((key) => (
              <div
                key={key}
                className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="h-6 w-24 bg-slate-200 rounded-md" />
                  <div className="h-4 w-20 bg-slate-100 rounded-md" />
                </div>
                <div className="h-6 w-3/4 bg-slate-200 rounded-md" />
                <div className="h-10 w-full bg-slate-100 rounded-lg" />
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="h-9 w-full bg-slate-200 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty States */}
        {!isLoading && assignments.length === 0 && !errorMessage && (
          <EmptyState
            isSearch={isSearchActive}
            searchQuery={searchQuery}
            onClearSearch={() => onSearchChange('')}
            onUploadClick={scrollToUpload}
          />
        )}

        {/* Assignment Grid */}
        {assignments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-8">
            {assignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && !isLoading && (
          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-xs transition-all disabled:opacity-60"
            >
              {isLoadingMore ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin text-brand-600" />
                  <span>Loading more assignments...</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                  <span>Load More Assignments</span>
                </>
              )}
            </button>
            <p className="text-xs text-slate-400 mt-2">
              Showing {assignments.length} of {filteredCount} assignments
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
