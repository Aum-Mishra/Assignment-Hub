import React, { useState, useEffect } from 'react';
import { X, Trash2, Loader2, AlertCircle, Key } from 'lucide-react';
import { Assignment } from '../types/assignment';
import { deleteAssignment, getUploaderToken } from '../lib/assignments';

interface DeleteModalProps {
  assignment: Assignment | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteSuccess: (deletedId: number) => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  assignment,
  isOpen,
  onClose,
  onDeleteSuccess,
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (assignment) {
      const stored = getUploaderToken(assignment.id);
      if (stored) {
        setTokenInput(stored);
        setHasStoredKey(true);
      } else {
        setTokenInput('');
        setHasStoredKey(false);
      }
      setErrorMessage(null);
    }
  }, [assignment]);

  if (!isOpen || !assignment) return null;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setErrorMessage('Please provide the secret deletion key.');
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMessage(null);
      await deleteAssignment(assignment.id, tokenInput.trim());
      onDeleteSuccess(assignment.id);
      onClose();
    } catch (err: unknown) {
      console.error('Delete error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to delete assignment.';
      setErrorMessage(msg);
    } finally {
      setIsDeleting(false);
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
          <h2 className="font-semibold text-rose-700 text-sm flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" />
            <span>Delete Assignment</span>
          </h2>
          {!isDeleting && (
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

        <form onSubmit={handleDelete} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="flex-1">{errorMessage}</span>
            </div>
          )}

          <div>
            <p className="text-xs text-slate-600 mb-1">
              Are you sure you want to permanently delete:
            </p>
            <p className="font-semibold text-slate-900 text-sm bg-slate-50 p-2 rounded border border-slate-200 break-words">
              {assignment.title}
            </p>
          </div>

          {hasStoredKey ? (
            <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
              <p className="font-medium">Uploader verified</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Your browser contains the matching deletion secret for this upload.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="delete-token-input" className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>Enter Deletion Key:</span>
              </label>
              <input
                id="delete-token-input"
                type="text"
                required
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Enter 32-character key"
                className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono text-xs focus:outline-none focus:border-rose-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Only the person with this key can delete this assignment.
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDeleting || !tokenInput.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Confirm Delete</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

