import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  resultCount?: number;
  isSearching?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onQueryChange,
  resultCount,
  isSearching,
}) => {
  return (
    <div className="w-full max-w-xl">
      <div className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search assignments by title..."
          className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-all text-sm shadow-2xs"
          aria-label="Search assignments by title"
        />

        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {query.trim().length > 0 && typeof resultCount === 'number' && (
        <div className="flex items-center justify-between mt-2 px-1 text-xs text-slate-500">
          <span>
            {isSearching ? (
              'Searching...'
            ) : (
              <>
                Found <span className="font-semibold text-slate-700">{resultCount}</span>{' '}
                {resultCount === 1 ? 'assignment' : 'assignments'} matching{' '}
                <span className="font-semibold text-brand-700">"{query.trim()}"</span>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="text-brand-600 hover:text-brand-800 font-medium"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
};
