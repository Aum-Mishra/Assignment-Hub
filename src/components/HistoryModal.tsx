import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  RotateCcw,
  FileArchive,
  Code2,
  FileText,
  Loader2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { Assignment, AssignmentBackup } from '../types/assignment';
import { getAssignmentBackups, restoreAssignmentBackup } from '../lib/assignments';

interface HistoryModalProps {
  assignment: Assignment | null;
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: (restored: Assignment) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  assignment,
  isOpen,
  onClose,
  onRestoreSuccess,
}) => {
  const [backups, setBackups] = useState<AssignmentBackup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchBackups = async (assignmentId?: number) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const list = await getAssignmentBackups(assignmentId);
      setBackups(list);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load version history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBackups(assignment?.id);
    }
  }, [isOpen, assignment]);

  if (!isOpen) return null;

  const handleRestore = async (backupId: number) => {
    if (!confirm('Are you sure you want to restore this previous version? Current data will be replaced by this backup snapshot.')) {
      return;
    }

    try {
      setRestoringId(backupId);
      const restored = await restoreAssignmentBackup(backupId);
      alert('Version restored successfully!');
      onRestoreSuccess(restored);
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to restore backup version.');
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(d);
    } catch {
      return 'Recently';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden text-sm my-auto">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="min-w-0 pr-3">
            <h2 className="font-semibold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
              <History className="w-4 h-4 text-blue-600" />
              <span>30-Day Version History & Recovery</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {assignment ? `Previous snapshots for "${assignment.title}"` : 'All recent backups and deleted assignments'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Notice */}
        <div className="px-5 py-2 bg-blue-50/70 border-b border-blue-100 text-blue-900 text-[11px] flex items-center gap-1.5 shrink-0">
          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Every edit and deletion is preserved for 30 days and can be restored with 1 click.</span>
        </div>

        {/* Backups List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {isLoading ? (
            <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Searching backups...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg p-6">
              <History className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
              <p className="font-semibold text-slate-700">No version history yet</p>
              <p className="mt-0.5">Snapshots are automatically recorded whenever an assignment is edited or deleted.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((b) => {
                const isRestoring = restoringId === b.id;
                const cFilesCount = Array.isArray(b.c_files) ? b.c_files.length : 0;
                const notesCount = Array.isArray(b.notes) ? b.notes.length : 0;

                return (
                  <div
                    key={b.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 hover:bg-slate-100/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                              b.action_type === 'DELETE'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : 'bg-blue-100 text-blue-800 border-blue-200'
                            }`}
                          >
                            {b.action_type} SNAPSHOT
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {formatDate(b.created_at)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-900 text-xs sm:text-sm mt-1">
                          {b.title}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRestore(b.id)}
                        disabled={isRestoring}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
                      >
                        {isRestoring ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>Restore</span>
                      </button>
                    </div>

                    {/* Snapshot contents */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/80 text-[11px] text-slate-600">
                      {b.file_path && (
                        <span className="inline-flex items-center gap-1 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          <FileArchive className="w-3 h-3 text-blue-600" />
                          <span>{b.file_name || 'ZIP Archive'}</span>
                        </span>
                      )}

                      {cFilesCount > 0 && (
                        <span className="inline-flex items-center gap-1 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-emerald-800">
                          <Code2 className="w-3 h-3 text-emerald-600" />
                          <span>{cFilesCount} {cFilesCount === 1 ? 'C File' : 'C Files'}</span>
                        </span>
                      )}

                      {notesCount > 0 && (
                        <span className="inline-flex items-center gap-1 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-blue-800">
                          <FileText className="w-3 h-3 text-blue-600" />
                          <span>{notesCount} {notesCount === 1 ? 'Note' : 'Notes'}</span>
                        </span>
                      )}

                      <span className="text-[10px] text-slate-400 ml-auto font-mono">
                        ID #{b.id}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
