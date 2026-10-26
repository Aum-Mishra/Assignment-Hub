import React from 'react';
import { FolderGit2, BookOpen, Layers } from 'lucide-react';

interface HeaderProps {
  totalCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ totalCount }) => {
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-brand-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <FolderGit2 className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Assignment <span className="text-brand-600">Hub</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200/60">
                  Public
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden md:block">
                Upload. Share. Learn Together.
              </p>
            </div>
          </div>

          {/* Right Navigation & Assignment Count */}
          <nav className="flex items-center space-x-3 sm:space-x-6" aria-label="Main Navigation">
            <a
              href="#assignments-section"
              onClick={(e) => scrollToSection(e, 'assignments-section')}
              className="text-sm font-semibold text-slate-600 hover:text-brand-600 transition-colors flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-50"
            >
              <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-brand-600" />
              <span>Assignments</span>
            </a>

            {typeof totalCount === 'number' && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                <Layers className="w-3.5 h-3.5 text-brand-600" />
                <span>
                  {totalCount} {totalCount === 1 ? 'assignment' : 'assignments'}
                </span>
              </div>
            )}

            <a
              href="#upload-section"
              onClick={(e) => scrollToSection(e, 'upload-section')}
              className="inline-flex items-center justify-center text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 px-4 py-2 rounded-lg shadow-sm shadow-brand-500/20 transition-all hover:shadow"
            >
              Share File
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
};
