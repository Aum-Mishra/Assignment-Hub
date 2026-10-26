import React from 'react';
import { UploadCloud, ArrowDown, FileArchive, ShieldCheck, Users } from 'lucide-react';

export const Hero: React.FC = () => {
  const scrollToUpload = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById('upload-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToBrowse = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById('assignments-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-20 bg-gradient-to-b from-brand-50/70 via-white to-slate-50 border-b border-slate-200/60">
      {/* Subtle background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 left-1/4 w-96 h-96 bg-brand-200/30 rounded-full blur-3xl" />
        <div className="absolute top-12 right-1/4 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-brand-200/80 shadow-sm text-xs font-semibold text-brand-700 mb-6">
          <span className="flex h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
          Open Access Knowledge Repository
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15] mb-6">
          Share Your <span className="bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 bg-clip-text text-transparent">Assignments</span>
        </h1>

        {/* Supporting text */}
        <p className="max-w-2xl mx-auto text-lg sm:text-xl text-slate-600 leading-relaxed mb-8 sm:mb-10">
          Upload your assignment ZIP files and make them available to everyone.
          Discover and download resources shared by other students.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 mb-12">
          <a
            href="#upload-section"
            onClick={scrollToUpload}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-base font-semibold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 rounded-xl shadow-lg shadow-brand-500/25 hover:shadow-brand-500/35 transition-all transform hover:-translate-y-0.5"
          >
            <UploadCloud className="w-5 h-5" />
            <span>Upload Assignment ZIP</span>
          </a>

          <a
            href="#assignments-section"
            onClick={scrollToBrowse}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300/80 rounded-xl shadow-sm transition-all hover:text-slate-900"
          >
            <ArrowDown className="w-4 h-4 text-slate-500" />
            <span>Browse All Files</span>
          </a>
        </div>

        {/* Value Proposition Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/70 shadow-sm flex items-start gap-3">
            <div className="p-2 rounded-lg bg-brand-50 text-brand-600 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">No Sign Up Required</h2>
              <p className="text-xs text-slate-500 mt-0.5">Instant access for any student to share and download.</p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/70 shadow-sm flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              <FileArchive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">ZIP Archives</h2>
              <p className="text-xs text-slate-500 mt-0.5">Bundle your code, documents, and reports up to 25 MB.</p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/70 shadow-sm flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Direct Downloads</h2>
              <p className="text-xs text-slate-500 mt-0.5">Files served directly from cloud storage without delay.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
