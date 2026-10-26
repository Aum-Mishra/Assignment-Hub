import React from 'react';
import { FolderGit2, Plus } from 'lucide-react';

interface NavbarProps {
  totalCount: number;
  onOpenUpload: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ totalCount, onOpenUpload }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <FolderGit2 className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
            Assignment Hub
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">
            {totalCount} {totalCount === 1 ? 'assignment' : 'assignments'}
          </span>
        </div>

        {/* Upload Action */}
        <button
          type="button"
          onClick={onOpenUpload}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-md transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Assignment</span>
        </button>
      </div>
    </header>
  );
};
