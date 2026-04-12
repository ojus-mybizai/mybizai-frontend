'use client';

import type { KnowledgeFile } from '@/services/knowledge-files';
import { FileText, Edit2, Trash2 } from 'lucide-react';

interface KnowledgeFileCardProps {
  file: KnowledgeFile;
  onEdit: (file: KnowledgeFile) => void;
  onDelete: (file: KnowledgeFile) => void;
}

export function KnowledgeFileCard({ file, onEdit, onDelete }: KnowledgeFileCardProps) {
  const preview = (file.content || '').trim().slice(0, 160);

  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4 transition hover:border-text-secondary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-text-primary">{file.title}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <code className="rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-text-primary">
                {file.topic_key}
              </code>
              {!file.is_active && (
                <span className="rounded-full bg-bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                  Inactive
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onEdit(file)}
            className="rounded-lg p-1.5 text-text-secondary transition hover:bg-bg-secondary hover:text-text-primary"
            title="Edit"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(file)}
            className="rounded-lg p-1.5 text-text-secondary transition hover:bg-red-500/10 hover:text-red-500"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {file.trigger_description && (
        <div className="mt-2 text-[11px] italic text-text-secondary">
          <span className="font-semibold not-italic">When:</span> {file.trigger_description}
        </div>
      )}

      {preview && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-text-secondary">
          {preview}
          {file.content.length > preview.length && '…'}
        </p>
      )}
    </div>
  );
}
