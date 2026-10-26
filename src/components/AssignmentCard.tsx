import React, { useState } from 'react';
import {
  FileArchive,
  Download,
  Calendar,
  HardDrive,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Assignment } from '../types/assignment';
import { formatBytes } from '../lib/validation';
import { downloadAssignment } from '../lib/assignments';

interface AssignmentCardProps {
  assignment: Assignment;
}

export const AssignmentCard: React.FC<AssignmentCardProps> = ({ assignment }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const formattedDate = (() => {
    try {
      const date = new Date(assignment.created_at);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
    } catch {
      return 'Recently';
    }
  })();

  const handleDownload = async () => {
    try {
      setDownloadError(null);
      setIsDownloading(true);
      await downloadAssignment(assignment);
    } catch (err: unknown) {
      console.error('Download failed for assignment:', assignment.id, err);
      const message =
        err instanceof Error ? err.message : 'Could not download assignment file.';
      setDownloadError(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      id={`assignment-${assignment.id}`}
      className="group bg-white rounded-2xl border border-slate-200/90 hover:border-brand-300 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
    >
      <div>
        {/* Top bar: ZIP badge and Date */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200/50">
            <FileArchive className="w-3.5 h-3.5 text-brand-600" />
            <span>ZIP ARCHIVE</span>
          </span>

          <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formattedDate}</span>
          </span>
        </div>

        {/* Assignment Title (Large, clearly readable, no truncating away meaning) */}
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-brand-700 transition-colors leading-snug break-words mb-3">
          {assignment.title}
        </h3>

        {/* File metadata */}
        <div className="space-y-1.5 mb-5 text-xs text-slate-500">
          <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100 break-all">
            <span className="font-semibold text-slate-400 select-none">FILE:</span>
            <span className="truncate" title={assignment.file_name}>
              {assignment.file_name}
            </span>
          </div>

          <div className="flex items-center gap-4 pt-1 font-medium text-slate-500">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              <span>{formatBytes(assignment.file_size)}</span>
            </div>
            <span>•</span>
            <span className="text-slate-400">ID #{assignment.id}</span>
          </div>
        </div>
      </div>

      {/* Download Error Feedback */}
      {downloadError && (
        <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="flex-1">{downloadError}</span>
        </div>
      )}

      {/* Download Button */}
      <div className="pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          aria-label={`Download ZIP for ${assignment.title}`}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-brand-700 bg-brand-50 hover:bg-brand-600 hover:text-white active:bg-brand-700 rounded-xl transition-all border border-brand-200/80 hover:border-transparent group/btn disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-brand-600 group-hover/btn:text-white" />
              <span>Downloading ZIP...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-brand-600 group-hover/btn:text-white transition-colors" />
              <span>Download ZIP</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
