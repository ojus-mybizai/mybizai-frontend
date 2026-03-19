'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { UIModal } from '@/types/ui-protocol';

interface ModalRendererProps {
  block: UIModal;
}

function normalizePath(path: string): string {
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

export default function ModalRenderer({ block }: ModalRendererProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContent = () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    apiFetch<unknown>(normalizePath(block.data_api))
      .then(setContent)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load content');
        setContent(null);
      })
      .finally(() => setLoading(false));
  };

  return (
    <>
      <button
        type="button"
        onClick={loadContent}
        className="rounded-md border border-border-color bg-card-bg px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
      >
        {block.title ?? 'View details'}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dynamic-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border-color bg-card-bg p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="dynamic-modal-title" className="text-base font-semibold text-text-primary">
                {block.title ?? 'Details'}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto text-sm text-text-primary">
              {loading && <p className="text-text-secondary">Loading…</p>}
              {error && <p className="text-red-600">{error}</p>}
              {!loading && !error && content !== null && (
                <pre className="whitespace-pre-wrap break-words">
                  {typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
