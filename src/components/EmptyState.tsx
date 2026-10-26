import React from 'react';
import { FileArchive, SearchX, UploadCloud, RotateCcw } from 'lucide-react';

interface EmptyStateProps {
  isSearch: boolean;
  searchQuery?: string;
  onClearSearch?: () => void;
  onUploadClick?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  isSearch,
  searchQuery,
  onClearSearch,
  onUploadClick,
}) => {
  if (isSearch) {
    return (
      <div className="py-16 px-4 text-center bg-white rounded-2xl border border-slate-200/90 shadow-xs max-w-xl mx-auto my-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
          <SearchX className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">No assignments found</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
          We couldn't find any assignments matching <span className="font-semibold text-slate-700">"{searchQuery}"</span>.
        </p>
        {onClearSearch && (
          <button
            type="button"
            onClick={onClearSearch}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-xl transition-colors border border-brand-200"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Clear search filter</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="py-20 px-4 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-xs max-w-xl mx-auto my-6">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
        <FileArchive className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-1.5">No assignments uploaded yet</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
        Be the first student to share your work! Upload a ZIP file above to make it instantly accessible to everyone.
      </p>
      {onUploadClick && (
        <button
          type="button"
          onClick={onUploadClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload First Assignment</span>
        </button>
      )}
    </div>
  );
};
