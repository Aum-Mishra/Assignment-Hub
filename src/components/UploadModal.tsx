import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { X, Upload, FileArchive, Loader2, AlertCircle, Check, Copy } from 'lucide-react';
import { uploadAssignment } from '../lib/assignments';
import {
  validateTitle,
  validateZipFile,
  formatBytes,
  MAX_FILE_SIZE_MB
} from '../lib/validation';
import { Assignment } from '../types/assignment';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newAssignment: Assignment) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (selected: File) => {
    setErrorMessage(null);
    const val = await validateZipFile(selected);
    if (!val.valid) {
      setErrorMessage(val.error || 'Invalid file');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(selected);

    // Auto-fill title from filename if empty
    if (!title.trim()) {
      const derived = selected.name.replace(/\.zip$/i, '').replace(/[_-]/g, ' ').trim();
      if (derived) setTitle(derived.slice(0, 150));
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      await handleFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const titleVal = validateTitle(title);
    if (!titleVal.valid) {
      setErrorMessage(titleVal.error || 'Invalid title');
      return;
    }

    if (!file) {
      setErrorMessage('Please select a ZIP file to upload.');
      return;
    }

    try {
      setIsUploading(true);
      const result = await uploadAssignment(title, file);
      setCreatedSecret(result.secretToken);
      onUploadSuccess(result.assignment);
    } catch (err: unknown) {
      console.error('Upload error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setIsUploading(false);
    }
  };

  const handleCopySecret = () => {
    if (createdSecret) {
      navigator.clipboard.writeText(createdSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDone = () => {
    setTitle('');
    setFile(null);
    setCreatedSecret(null);
    setErrorMessage(null);
    setIsUploading(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-md overflow-hidden text-sm">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="font-semibold text-slate-800 text-base">
            {createdSecret ? 'Assignment Uploaded' : 'Upload Assignment'}
          </h2>
          {!isUploading && (
            <button
              type="button"
              onClick={handleDone}
              className="text-slate-400 hover:text-slate-600 p-1 rounded"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {createdSecret ? (
          /* Success & Deletion Secret Display */
          <div className="p-5 space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md">
              <p className="font-semibold text-emerald-900 text-sm">Upload Successful!</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Your assignment has been published and is visible to everyone.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Your Secret Deletion Key:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdSecret}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-100 border border-slate-300 rounded text-slate-800 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-medium text-slate-700 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                This key has been automatically saved in this browser so you can delete your assignment with one click. Save it if you wish to delete it from another device.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleDone}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-xs"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Upload Form */
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {errorMessage && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            <div>
              <label htmlFor="modal-title" className="block text-xs font-semibold text-slate-700 mb-1">
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="modal-title"
                type="text"
                required
                maxLength={150}
                disabled={isUploading}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Computer Networks Lab 3"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 disabled:bg-slate-100 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ZIP Archive <span className="text-rose-500">*</span>
              </label>

              {!file ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-md p-5 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <FileArchive className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                  <p className="text-xs font-medium text-slate-700">
                    Click to select or drag and drop a ZIP file
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Max size: {MAX_FILE_SIZE_MB} MB (.zip only)
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-slate-800 truncate">{file.name}</p>
                    <p className="text-slate-500 text-[11px]">{formatBytes(file.size)}</p>
                  </div>
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 rounded hover:bg-slate-200"
                    >
                      Change
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleDone}
                disabled={isUploading}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || !title.trim() || !file}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
