import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import {
  X,
  Edit2,
  FileArchive,
  Code2,
  FileText,
  History,
  Plus,
  Trash2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Assignment, CCodeFile } from '../types/assignment';
import { editAssignment, getAssignmentCFiles } from '../lib/assignments';
import { formatBytes, MAX_FILE_SIZE_MB, validateZipFile } from '../lib/validation';

interface EditModalProps {
  assignment: Assignment | null;
  isOpen: boolean;
  onClose: () => void;
  onEditSuccess: (updated: Assignment) => void;
  onOpenNotes: (assignment: Assignment) => void;
  onOpenHistory: (assignment: Assignment) => void;
}

interface CFileDraft {
  id: string;
  name: string;
  code: string;
}

export const EditModal: React.FC<EditModalProps> = ({
  assignment,
  isOpen,
  onClose,
  onEditSuccess,
  onOpenNotes,
  onOpenHistory,
}) => {
  const [title, setTitle] = useState('');
  const [newZipFile, setNewZipFile] = useState<File | null>(null);
  const [removeZip, setRemoveZip] = useState(false);
  const [cFiles, setCFiles] = useState<CFileDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (assignment && isOpen) {
      setTitle(assignment.title);
      setNewZipFile(null);
      setRemoveZip(false);
      setErrorMessage(null);

      const existingCFiles = getAssignmentCFiles(assignment);
      if (existingCFiles.length > 0) {
        setCFiles(
          existingCFiles.map((f, idx) => ({
            id: String(idx + 1),
            name: f.name,
            code: f.code,
          }))
        );
      } else {
        setCFiles([]);
      }
    }
  }, [assignment, isOpen]);

  if (!isOpen || !assignment) return null;

  const handleZipChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selected = e.target.files[0];
      const val = await validateZipFile(selected);
      if (!val.valid) {
        setErrorMessage(val.error || 'Invalid ZIP file');
        return;
      }
      setNewZipFile(selected);
      setRemoveZip(false);
    }
  };

  const handleAddCFile = () => {
    setCFiles((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: `file_${prev.length + 1}.c`,
        code: '',
      },
    ]);
  };

  const handleRemoveCFile = (id: string) => {
    setCFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCFileNameChange = (id: string, name: string) => {
    setCFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name } : item))
    );
  };

  const handleCCodeChange = (id: string, code: string) => {
    setCFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, code } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Assignment title is required.');
      return;
    }

    const validCFiles: CCodeFile[] = cFiles
      .filter((f) => f.code.trim().length > 0)
      .map((f, idx) => {
        let cleanName = f.name.trim() || `file_${idx + 1}.c`;
        if (!cleanName.toLowerCase().endsWith('.c')) {
          cleanName = `${cleanName}.c`;
        }
        return {
          name: cleanName,
          code: f.code,
        };
      });

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const updated = await editAssignment(assignment.id, {
        title: title.trim(),
        newZipFile,
        removeZip,
        cFiles: validCFiles,
        currentFilePath: assignment.file_path,
        currentFileName: assignment.file_name,
        currentFileSize: assignment.file_size,
      });

      onEditSuccess(updated);
      onClose();
    } catch (err: unknown) {
      console.error('Edit error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasCurrentZip = Boolean(assignment.file_path) && !removeZip;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-sm my-auto">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="min-w-0 pr-3">
            <h2 className="font-semibold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
              <Edit2 className="w-4 h-4 text-blue-600" />
              <span>Edit Assignment</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Publicly editable by anyone • Backups automatically preserved for 30 days.
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

        {/* Error Alert */}
        {errorMessage && (
          <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Shortcuts bar */}
        <div className="px-5 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
          <button
            type="button"
            onClick={() => onOpenNotes(assignment)}
            className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-medium"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Manage Notes ({assignment.notes_count || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenHistory(assignment)}
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium"
          >
            <History className="w-3.5 h-3.5 text-blue-600" />
            <span>30-Day Version History</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assignment Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs sm:text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* ZIP File Management */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
            <label className="block text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FileArchive className="w-3.5 h-3.5 text-blue-600" />
                <span>ZIP Archive</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Max {MAX_FILE_SIZE_MB} MB</span>
            </label>

            {hasCurrentZip && !newZipFile ? (
              <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded border border-slate-200">
                <div className="min-w-0 pr-2 font-mono">
                  <p className="font-semibold text-slate-800 truncate">{assignment.file_name}</p>
                  <p className="text-slate-400 text-[11px]">
                    {assignment.file_size ? formatBytes(assignment.file_size) : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoveZip(true)}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : newZipFile ? (
              <div className="flex items-center justify-between text-xs bg-blue-50 p-2.5 rounded border border-blue-200">
                <div className="min-w-0 pr-2">
                  <p className="font-semibold text-blue-900 truncate">New file: {newZipFile.name}</p>
                  <p className="text-blue-700 text-[11px]">{formatBytes(newZipFile.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewZipFile(null)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded border border-slate-200">
                <span className="text-slate-400 italic">No ZIP file attached</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Upload ZIP
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={handleZipChange}
              className="hidden"
            />
          </div>

          {/* Multiple C Files Management */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Code2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>C Source Code Files ({cFiles.length})</span>
              </label>
              <button
                type="button"
                onClick={handleAddCFile}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-0.5 rounded hover:bg-blue-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another C File</span>
              </button>
            </div>

            {cFiles.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded text-center text-xs text-slate-400">
                No C files attached. Click "Add Another C File" to add one.
              </div>
            ) : (
              cFiles.map((cFile, index) => (
                <div key={cFile.id} className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1 max-w-xs">
                      <span className="text-[11px] text-slate-400 font-medium">#{index + 1}</span>
                      <input
                        type="text"
                        value={cFile.name}
                        onChange={(e) => handleCFileNameChange(cFile.id, e.target.value)}
                        placeholder="e.g. main.c"
                        className="w-full px-2 py-1 font-mono text-xs border border-slate-300 rounded bg-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCFile(cFile.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded"
                      title="Remove this C file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={cFile.code}
                    onChange={(e) => handleCCodeChange(cFile.id, e.target.value)}
                    placeholder={`// Paste source code for ${cFile.name}`}
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500 resize-y"
                    spellCheck={false}
                  />
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
