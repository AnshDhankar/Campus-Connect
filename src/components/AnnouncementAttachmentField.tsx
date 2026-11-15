import React, { useRef, useState } from 'react';
import { Upload, FileText, Paperclip, X, Link as LinkIcon } from 'lucide-react';
import {
  ANNOUNCEMENT_FILE_ACCEPT,
  PendingAnnouncementFile,
  formatAttachmentSize,
  processAnnouncementAttachmentFile
} from '../utils/announcementAttachment';

interface AnnouncementAttachmentFieldProps {
  inputId: string;
  isDarkMode?: boolean;
  attachmentUrl: string;
  existingAttachmentName?: string;
  existingAttachmentSize?: number;
  pendingFile: PendingAnnouncementFile | null;
  onSelectFile: (file: PendingAnnouncementFile | null) => void;
  onChangeUrl: (url: string) => void;
  onRemoveAttachment: () => void;
}

export function AnnouncementAttachmentField({
  inputId,
  isDarkMode = false,
  attachmentUrl,
  existingAttachmentName,
  existingAttachmentSize,
  pendingFile,
  onSelectFile,
  onChangeUrl,
  onRemoveAttachment
}: AnnouncementAttachmentFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFilePicked = async (file?: File | null) => {
    if (!file) return;
    setFileError('');
    setIsProcessing(true);
    try {
      const processed = await processAnnouncementAttachmentFile(file);
      onSelectFile(processed);
    } catch (err: any) {
      setFileError(err?.message || 'Could not process the selected file.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const hasSavedUploadedFile =
    !pendingFile &&
    Boolean(attachmentUrl) &&
    attachmentUrl.startsWith('/api/announcements/');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-[10px] uppercase font-extrabold text-slate-550 tracking-wider">
          Document / Attachment Upload (Optional)
        </label>
        <span className="text-[10px] font-mono text-slate-400">
          PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV, Images, ZIP · Max 3MB
        </span>
      </div>

      {/* File Manager Picker & Drag/Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) {
            void handleFilePicked(dropped);
          }
        }}
        className={`border border-dashed rounded-lg p-3.5 transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30'
            : isDarkMode
              ? 'border-slate-700 bg-slate-950/70 hover:border-slate-600'
              : 'border-slate-300 bg-slate-50/80 hover:border-slate-400'
        }`}
      >
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept={ANNOUNCEMENT_FILE_ACCEPT}
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) {
              void handleFilePicked(picked);
            }
          }}
          className="hidden"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-md shrink-0 ${
              isDarkMode ? 'bg-slate-800 text-blue-400' : 'bg-white border border-slate-200 text-blue-800'
            }`}>
              <Upload className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                {isProcessing ? 'Processing attachment...' : 'Upload document or circular from file manager'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                Drag and drop a file here or click Browse Files to choose from your computer or phone.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className={`px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded border shrink-0 cursor-pointer transition-colors disabled:opacity-50 ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800 shadow-2xs'
            }`}
          >
            Browse Files
          </button>
        </div>

        {/* Selected / Existing Uploaded File Pill */}
        {pendingFile && (
          <div className={`mt-3 p-2.5 rounded border flex items-center justify-between gap-2 text-xs ${
            isDarkMode ? 'bg-slate-900 border-emerald-800/60 text-emerald-300' : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 shrink-0" />
              <span className="font-bold truncate">{pendingFile.name}</span>
              <span className="text-[10px] font-mono opacity-80 shrink-0">
                ({formatAttachmentSize(pendingFile.size)} · Ready to upload)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setFileError('');
                onRemoveAttachment();
              }}
              className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 cursor-pointer shrink-0"
              title="Remove selected file"
              aria-label="Remove selected file"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {hasSavedUploadedFile && (
          <div className={`mt-3 p-2.5 rounded border flex items-center justify-between gap-2 text-xs ${
            isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="font-bold truncate">{existingAttachmentName || 'Uploaded Attachment'}</span>
              {existingAttachmentSize ? (
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  ({formatAttachmentSize(existingAttachmentSize)})
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setFileError('');
                onRemoveAttachment();
              }}
              className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 cursor-pointer shrink-0 text-[10px] font-bold flex items-center gap-1"
              title="Remove attachment"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>
        )}

        {fileError && (
          <p className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
            {fileError}
          </p>
        )}
      </div>

      {/* Optional External Link Input (Preserved for existing URL workflows) */}
      {!pendingFile && !hasSavedUploadedFile && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="url"
              value={attachmentUrl}
              onChange={(e) => onChangeUrl(e.target.value)}
              placeholder="Or paste an external document URL (e.g. https://campusconnect.edu/docs/timetable.pdf)"
              className={`w-full text-xs py-2 pl-8 pr-3 border outline-none font-mono ${
                isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
