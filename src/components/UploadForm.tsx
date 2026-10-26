import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import {
  FileArchive,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
  Loader2,
  Info
} from 'lucide-react';
import { uploadAssignment } from '../lib/assignments';
import {
  validateTitle,
  validateZipFile,
  formatBytes,
  MAX_FILE_SIZE_MB
} from '../lib/validation';
import { Assignment } from '../types/assignment';

interface UploadFormProps {
  onUploadSuccess: (newAssignment: Assignment) => void;
}

export const UploadForm: React.FC<UploadFormProps> = ({ onUploadSuccess }) => {
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const validation = await validateZipFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid file');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setSelectedFile(file);

    // Auto-populate title if empty, derived from filename (minus .zip extension)
    if (!title.trim()) {
      const derived = file.name.replace(/\.zip$/i, '').replace(/[_-]/g, ' ').trim();
      if (derived) {
        setTitle(derived.slice(0, 150));
      }
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await processFile(file);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await processFile(file);
    }
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Client-side title validation
    const titleVal = validateTitle(title);
    if (!titleVal.valid) {
      setErrorMessage(titleVal.error || 'Please enter a valid assignment title.');
      return;
    }

    // 2. Client-side file validation
    if (!selectedFile) {
      setErrorMessage('Please select a ZIP file to upload.');
      return;
    }

    const fileVal = await validateZipFile(selectedFile);
    if (!fileVal.valid) {
      setErrorMessage(fileVal.error || 'Please provide a valid ZIP file.');
      return;
    }

    try {
      setIsUploading(true);
      const newAssignment = await uploadAssignment(title, selectedFile);

      // Successfully uploaded and saved in database
      setSuccessMessage(`"${newAssignment.title}" uploaded successfully!`);
      setTitle('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onUploadSuccess(newAssignment);
    } catch (err: unknown) {
      console.error('Upload submission error:', err);
      const errorMsg =
        err instanceof Error ? err.message : 'Upload failed due to an unexpected network error.';
      setErrorMessage(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const isFormValid = title.trim().length > 0 && selectedFile !== null && !isUploading;

  return (
    <section id="upload-section" className="py-12 bg-white border-b border-slate-200/80 scroll-mt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
          {/* Card Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-brand-50/40 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Upload className="w-5 h-5 text-brand-600" />
                Upload Assignment
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Share your assignment archive with classmates. Instant and public.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-600 font-medium shadow-2xs">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Public archive</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {/* Success Alert */}
            {successMessage && (
              <div
                role="status"
                aria-live="polite"
                className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 flex items-start gap-3 shadow-xs"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm flex-1">
                  <p className="font-semibold text-emerald-900">Upload Complete</p>
                  <p className="mt-0.5">{successMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessMessage(null)}
                  className="text-emerald-600 hover:text-emerald-800 p-1"
                  aria-label="Dismiss success message"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Error Alert */}
            {errorMessage && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-4 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-800 flex items-start gap-3 shadow-xs"
              >
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-sm flex-1">
                  <p className="font-semibold text-rose-900">Upload Error</p>
                  <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-600 hover:text-rose-800 p-1"
                  aria-label="Dismiss error message"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Title Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="assignment-title" className="block text-sm font-semibold text-slate-800">
                  Assignment Title <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs text-slate-400 font-mono">
                  {title.trim().length} / 150
                </span>
              </div>
              <input
                id="assignment-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                disabled={isUploading}
                placeholder="e.g., Computer Networks Lab 3 - Socket Programming"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 transition-colors disabled:bg-slate-50 disabled:text-slate-500 text-sm"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Give your assignment a clear, descriptive title so others can find it easily.
              </p>
            </div>

            {/* Drag & Drop File Zone */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Assignment File (.ZIP) <span className="text-rose-500">*</span>
              </label>

              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all ${
                    isDragging
                      ? 'border-brand-500 bg-brand-50/60 ring-4 ring-brand-500/10'
                      : 'border-slate-300 hover:border-brand-400 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  aria-label="Upload zone: Drag and drop your ZIP file here or click to browse"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading}
                    aria-hidden="true"
                  />

                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-100/70 text-brand-600 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                    <FileArchive className="w-8 h-8" />
                  </div>

                  <p className="text-base font-semibold text-slate-800 mb-1">
                    Drag and drop your ZIP file here.
                  </p>
                  <p className="text-sm text-slate-500 mb-3">
                    Or <span className="text-brand-600 font-semibold underline decoration-brand-300 underline-offset-2">click to browse</span> your device.
                  </p>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/60 text-slate-600 text-xs font-medium">
                    Maximum file size: {MAX_FILE_SIZE_MB} MB • Accepts .zip archives only
                  </div>
                </div>
              ) : (
                /* Selected File Card */
                <div className="p-4 sm:p-5 rounded-2xl border border-brand-200 bg-brand-50/40 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <FileCheck className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate" title={selectedFile.name}>
                        {selectedFile.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
                        <span>{formatBytes(selectedFile.size)}</span>
                        <span>•</span>
                        <span className="uppercase font-semibold text-brand-700">ZIP Archive</span>
                        <span>•</span>
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ready
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isUploading && (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-white/80 transition-colors"
                      title="Remove selected file"
                      aria-label="Remove selected file"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Upload Progress Status Indicator */}
            {isUploading && (
              <div className="p-4 rounded-xl bg-brand-50/70 border border-brand-100 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-brand-600 animate-spin shrink-0" />
                <div className="text-sm text-slate-700">
                  <p className="font-semibold text-brand-900">Uploading and saving assignment...</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sending archive to cloud storage and registering metadata. Please keep this tab open.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
              {selectedFile && !isUploading && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel Selection
                </button>
              )}

              <button
                type="submit"
                disabled={!isFormValid}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl shadow-md shadow-brand-500/20 hover:shadow-brand-500/30 transition-all"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload Assignment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
