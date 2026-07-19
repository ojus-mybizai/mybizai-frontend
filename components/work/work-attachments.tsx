'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { listAttachments, uploadAttachment, deleteAttachment, type WorkAttachment } from '@/services/work';

interface WorkAttachmentsProps {
  workId: number;
  canEdit: boolean;
}

/* ── helpers ─────────────────────────────────────────────── */

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '\u2014';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '\u2014' : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function fileIcon(mimeType: string | null): string {
  if (!mimeType) return '\uD83D\uDCC1'; // folder
  if (mimeType.startsWith('image/')) return '\uD83D\uDDBC\uFE0F'; // framed picture
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType.includes('text') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('presentation') ||
    mimeType.includes('csv')
  ) {
    return '\uD83D\uDCC4'; // page facing up
  }
  return '\uD83D\uDCC1'; // folder
}

const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/* ── component ───────────────────────────────────────────── */

export function WorkAttachments({ workId, canEdit }: WorkAttachmentsProps) {
  const [attachments, setAttachments] = useState<WorkAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── load ─────────────────────────────────────────────── */

  const loadAttachments = useCallback(async () => {
    try {
      setError(null);
      const data = await listAttachments(workId);
      setAttachments(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  /* ── upload ────────────────────────────────────────────── */

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;

    // validate size
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > MAX_FILE_SIZE_BYTES) {
        setError(`File "${files[i].name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`);
        return;
      }
    }

    setUploading(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        await uploadAttachment(workId, files[i]);
      }
      await loadAttachments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
      // reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  /* ── delete ────────────────────────────────────────────── */

  async function handleDelete(attachmentId: number) {
    setDeletingId(attachmentId);
    try {
      await deleteAttachment(workId, attachmentId);
      await loadAttachments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete attachment');
    } finally {
      setDeletingId(null);
    }
  }

  /* ── render ────────────────────────────────────────────── */

  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-text-primary">Attachments</h3>

      {/* error banner */}
      {error && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button
            type="button"
            className="ml-2 font-medium underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* upload dropzone */}
      {canEdit && (
        <div
          className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
            dragOver
              ? 'border-accent bg-accent-soft'
              : 'border-border-color hover:border-accent/50 hover:bg-accent-soft/30'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {uploading ? (
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm font-medium text-accent">Uploading...</span>
            </div>
          ) : (
            <>
              <svg
                className="mb-1.5 h-8 w-8 text-text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3.75 3.75 0 013.547 5.596A4.5 4.5 0 0118.75 19.5H6.75z"
                />
              </svg>
              <span className="text-sm font-medium text-text-primary">
                Drop files or click to upload
              </span>
              <span className="mt-0.5 text-xs text-text-secondary">
                Max file size: {MAX_FILE_SIZE_MB}MB
              </span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      )}

      {/* loading state */}
      {loading ? (
        <div className="mt-4 flex items-center justify-center py-8">
          <svg className="h-5 w-5 animate-spin text-text-secondary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : attachments.length === 0 ? (
        <p className="mt-4 text-center text-sm text-text-secondary py-6">
          No attachments yet.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-border-color">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group flex items-center gap-3 py-3 first:pt-0"
            >
              {/* file icon */}
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-secondary text-lg dark:bg-bg-primary">
                {fileIcon(att.mime_type)}
              </span>

              {/* file info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary" title={att.original_file_name}>
                  {att.original_file_name}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-secondary">
                  <span>{formatFileSize(att.size_bytes)}</span>
                  {att.created_by_name && <span>{att.created_by_name}</span>}
                  <span>{formatDate(att.created_at)}</span>
                </div>
              </div>

              {/* actions */}
              <div className="flex shrink-0 items-center gap-1">
                {/* download */}
                {att.download_url && (
                  <a
                    href={att.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-accent transition-colors dark:hover:bg-bg-primary"
                    title="Download"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                )}

                {/* delete */}
                {canEdit && (
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-text-secondary opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-50 dark:hover:bg-red-900/20"
                    disabled={deletingId === att.id}
                    onClick={() => handleDelete(att.id)}
                    title="Delete attachment"
                  >
                    {deletingId === att.id ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
