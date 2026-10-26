import React from 'react';
import { FolderGit2, AlertCircle, ShieldAlert } from 'lucide-react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-10 border-b border-slate-800">
          {/* Brand & Purpose */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Assignment <span className="text-brand-400">Hub</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Assignment Hub is an open, community-driven platform for students to share, discover,
              and download assignment ZIP archives.
            </p>
            <p className="text-xs text-brand-400 font-medium">
              Tagline: Upload. Share. Learn Together.
            </p>
          </div>

          {/* Public Sharing Notice */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Public File Sharing Notice
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              All files uploaded to Assignment Hub are immediately accessible to anyone with an internet connection.
              Do not upload confidential data, personal identification, private API keys, or copyrighted materials.
            </p>
          </div>

          {/* Security & Responsibility */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-brand-400" />
              Safety & Verification
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Downloaded archives are created by independent users. Always scan downloaded ZIP files with antivirus software and verify code before execution.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            &copy; {currentYear} Assignment Hub. All rights reserved. Open assignment sharing platform.
          </p>
          <p className="text-slate-500">
            Powered by Vite, React, Tailwind CSS, and Supabase.
          </p>
        </div>
      </div>
    </footer>
  );
};
