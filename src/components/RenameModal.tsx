import React, { useState, useEffect } from 'react';
import { X, Edit2, Loader2, AlertCircle } from 'lucide-react';
import { Assignment } from '../types/assignment';
import { renameAssignment } from '../lib/assignments';

interface RenameModalProps {
  assignment: Assignment | null;
  isOpen: boolean;
  onClose: () => void;
  onRenameSuccess: (updated: Assignment) => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  assignment,
  isOpen,
  onClose,
  onRenameSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (assignment) {
      setTitle(assignment.title);
      setFileName(assignment.file_name || '');
      setErrorMessage(null);
    }
  }, [assignment]);

  if (!isOpen || !assignment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Assignment title is required.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      const updated = await renameAssignment(assignment.id, title, fileName);
      onRenameSuccess(updated);
      onClose();
    } catch (err: unknown) {
      console.error('Rename error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to rename assignment.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-sm overflow-hidden text-sm">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
            <Edit2 className="w-4 h-4 text-blue-600" />
            <span>Rename Assignment</span>
          </h2>
          {!isSaving && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="flex-1">{errorMessage}</span>
            </div>
          )}

          <div>
            <label htmlFor="rename-title" className="block text-xs font-semibold text-slate-700 mb-1">
              Assignment Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="rename-title"
              type="text"
              required
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Operating Systems Lab 2"
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="rename-filename" className="block text-xs font-semibold text-slate-700 mb-1">
              ZIP Filename
            </label>
            <input
              id="rename-filename"
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="e.g. os_lab2.zip"
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Must end with <code>.zip</code> (will be added automatically if omitted).
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

