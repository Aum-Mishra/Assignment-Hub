import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Image,
  FileCheck,
  Plus,
  Trash2,
  Edit2,
  Download,
  Loader2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Assignment, AssignmentNote, NoteType } from '../types/assignment';
import {
  getAssignmentNotes,
  createAssignmentNote,
  updateAssignmentNote,
  deleteAssignmentNote,
  downloadNote,
  getNoteFileUrl
} from '../lib/assignments';
import { formatBytes } from '../lib/validation';

interface NotesModalProps {
  assignment: Assignment | null;
  isOpen: boolean;
  onClose: () => void;
  onNotesUpdated?: () => void;
}

export const NotesModal: React.FC<NotesModalProps> = ({
  assignment,
  isOpen,
  onClose,
  onNotesUpdated,
}) => {
  const [notes, setNotes] = useState<AssignmentNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('text');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview state for image/pdf
  const [previewNote, setPreviewNote] = useState<AssignmentNote | null>(null);

  const fetchNotes = async (assignmentId: number) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const list = await getAssignmentNotes(assignmentId);
      setNotes(list);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load notes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && assignment) {
      fetchNotes(assignment.id);
      setIsAdding(false);
      setEditingNoteId(null);
      setPreviewNote(null);
    }
  }, [isOpen, assignment]);

  if (!isOpen || !assignment) return null;

  const resetForm = () => {
    setTitle('');
    setNoteType('text');
    setContent('');
    setFile(null);
    setIsAdding(false);
    setEditingNoteId(null);
    setErrorMessage(null);
  };

  const handleStartEdit = (note: AssignmentNote) => {
    setEditingNoteId(note.id);
    setTitle(note.title);
    setNoteType(note.note_type);
    setContent(note.content || '');
    setFile(null);
    setIsAdding(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Note title is required.');
      return;
    }

    if (noteType !== 'text' && !editingNoteId && !file) {
      setErrorMessage(`Please select a ${noteType.toUpperCase()} file to attach.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (editingNoteId) {
        await updateAssignmentNote(editingNoteId, {
          title: title.trim(),
          content: noteType === 'text' ? content : undefined,
          file: file || undefined,
        });
      } else {
        await createAssignmentNote({
          assignmentId: assignment.id,
          title: title.trim(),
          noteType,
          content: noteType === 'text' ? content : undefined,
          file: file || undefined,
        });
      }

      await fetchNotes(assignment.id);
      if (onNotesUpdated) onNotesUpdated();
      resetForm();
    } catch (err: unknown) {
      console.error('Note submit error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (noteId: number) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
      await deleteAssignmentNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (onNotesUpdated) onNotesUpdated();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete note.');
    }
  };

  const handleDownload = async (note: AssignmentNote) => {
    try {
      await downloadNote(note);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-sm my-auto">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="min-w-0 pr-3">
            <h2 className="font-semibold text-slate-900 text-sm sm:text-base truncate">
              Notes: {assignment.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Public notes, summaries, PDFs, and diagrams attached to this assignment.
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {/* Top toolbar */}
          {!isAdding && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                {notes.length} {notes.length === 1 ? 'Note' : 'Notes'} Available
              </span>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsAdding(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Note</span>
              </button>
            </div>
          )}

          {/* Note Form (Add / Edit) */}
          {isAdding && (
            <form onSubmit={handleSubmit} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-slate-800">
                  {editingNoteId ? 'Edit Note' : 'Create New Note'}
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Note Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chapter 4 Summary or Architecture Diagram"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              {!editingNoteId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Note Type
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    {(['text', 'image', 'pdf'] as NoteType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNoteType(t)}
                        className={`flex-1 py-1 px-2 rounded border font-medium uppercase text-[11px] transition-colors ${
                          noteType === t
                            ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {noteType === 'text' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Note Content
                  </label>
                  <textarea
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Type your notes or explanations here..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Upload {noteType === 'image' ? 'Image (PNG, JPG, WebP)' : 'PDF Document'}
                  </label>
                  <input
                    type="file"
                    accept={noteType === 'image' ? 'image/*' : 'application/pdf'}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1 border-t border-slate-200">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="px-3 py-1 border border-slate-300 rounded text-xs text-slate-700 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{editingNoteId ? 'Update Note' : 'Save Note'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Notes List */}
          {isLoading ? (
            <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Loading notes...</span>
            </div>
          ) : notes.length === 0 && !isAdding ? (
            <div className="py-10 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg p-6">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
              <p className="font-semibold text-slate-700">No notes attached yet</p>
              <p className="mt-0.5">Click "Add Note" above to attach text, diagrams, or PDFs.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notes.map((note) => {
                const isImg = note.note_type === 'image';
                const isPdf = note.note_type === 'pdf';
                const isTxt = note.note_type === 'text';

                return (
                  <div key={note.id} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-slate-50/50 p-2 rounded">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isTxt && <FileText className="w-4 h-4 text-blue-600 shrink-0" />}
                        {isImg && <Image className="w-4 h-4 text-emerald-600 shrink-0" />}
                        {isPdf && <FileCheck className="w-4 h-4 text-rose-600 shrink-0" />}

                        <span className="font-semibold text-slate-900 text-xs sm:text-sm break-words">
                          {note.title}
                        </span>

                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {note.note_type}
                        </span>
                      </div>

                      {/* Content or File preview */}
                      {isTxt && note.content && (
                        <p className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-2 rounded border border-slate-100 font-sans">
                          {note.content}
                        </p>
                      )}

                      {(isImg || isPdf) && note.file_path && (
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => setPreviewNote(note)}
                            className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-mono"
                          >
                            <span>{note.file_name || 'View file'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          {note.file_size ? (
                            <span className="text-[11px] text-slate-400">({formatBytes(note.file_size)})</span>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 pt-1 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleDownload(note)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded"
                        title="Download Note"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(note)}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded"
                        title="Edit Note"
                        aria-label="Edit Note"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Delete Note"
                        aria-label="Delete Note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* File Preview Submodal */}
        {previewNote && previewNote.file_path && (
          <div className="p-4 bg-slate-900/90 text-white border-t border-slate-700 flex flex-col items-center gap-2">
            <div className="w-full flex items-center justify-between text-xs">
              <span className="font-semibold truncate">{previewNote.file_name}</span>
              <button
                type="button"
                onClick={() => setPreviewNote(null)}
                className="text-slate-400 hover:text-white"
              >
                Close Preview
              </button>
            </div>
            {previewNote.note_type === 'image' ? (
              <img
                src={getNoteFileUrl(previewNote.file_path)}
                alt={previewNote.title}
                className="max-h-60 rounded border border-slate-700 object-contain"
              />
            ) : (
              <iframe
                src={getNoteFileUrl(previewNote.file_path)}
                title={previewNote.title}
                className="w-full h-60 rounded border border-slate-700 bg-white"
              />
            )}
          </div>
        )}

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
