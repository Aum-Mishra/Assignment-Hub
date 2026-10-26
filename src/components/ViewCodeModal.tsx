import React, { useState } from 'react';
import { X, Copy, Check, Code2, Download, AlertCircle } from 'lucide-react';
import { Assignment, CCodeFile } from '../types/assignment';
import { getAssignmentCFiles, copyCCodeToClipboard, downloadAllCFiles } from '../lib/assignments';

interface ViewCodeModalProps {
  assignment: Assignment | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ViewCodeModal: React.FC<ViewCodeModalProps> = ({
  assignment,
  isOpen,
  onClose,
}) => {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  if (!isOpen || !assignment) return null;

  const cFiles: CCodeFile[] = getAssignmentCFiles(assignment);
  const currentFile = cFiles[activeFileIndex] || cFiles[0];

  const handleCopy = async (file: CCodeFile) => {
    const success = await copyCCodeToClipboard(file.code);
    if (success) {
      setCopiedFile(file.name);
      setCopyFeedback(`Code for ${file.name} copied successfully!`);
      setTimeout(() => {
        setCopiedFile(null);
        setCopyFeedback(null);
      }, 2500);
    } else {
      setCopyFeedback('Failed to copy to clipboard. Please copy manually.');
      setTimeout(() => setCopyFeedback(null), 3000);
    }
  };

  const handleDownloadAll = async () => {
    try {
      await downloadAllCFiles(assignment);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-sm">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="min-w-0 pr-3">
            <h2 className="font-semibold text-slate-900 text-sm sm:text-base truncate">
              {assignment.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <Code2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{cFiles.length} {cFiles.length === 1 ? 'C File' : 'C Files'}</span>
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

        {/* Feedback message */}
        {copyFeedback && (
          <div className="px-5 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center gap-1.5 shrink-0">
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{copyFeedback}</span>
          </div>
        )}

        {cFiles.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
            <p>No C source code files found for this assignment.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* File Tabs if multiple */}
            {cFiles.length > 1 && (
              <div className="flex items-center gap-1 px-4 pt-2 border-b border-slate-200 bg-slate-50/50 overflow-x-auto shrink-0">
                {cFiles.map((f, idx) => (
                  <button
                    key={f.name + idx}
                    type="button"
                    onClick={() => setActiveFileIndex(idx)}
                    className={`px-3 py-1.5 text-xs font-mono font-medium rounded-t border-t border-x -mb-px transition-colors whitespace-nowrap ${
                      activeFileIndex === idx
                        ? 'bg-white border-slate-200 text-blue-700 font-semibold'
                        : 'bg-transparent border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}

            {/* Current File Code Viewer */}
            {currentFile && (
              <div className="flex-1 flex flex-col min-h-0 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {currentFile.name}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleCopy(currentFile)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-medium transition-colors"
                  >
                    {copiedFile === currentFile.name ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex-1 bg-slate-900 rounded-md p-3 overflow-auto font-mono text-xs text-slate-200 leading-relaxed min-h-[220px]">
                  <pre className="whitespace-pre">
                    <code>{currentFile.code}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          {cFiles.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {cFiles.length === 1 ? `Download ${cFiles[0].name}` : `Download All (${cFiles.length} C Files)`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded text-xs ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
