'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { UIConfirmation } from '@/types/ui-protocol';

interface ConfirmationRendererProps {
  block: UIConfirmation;
}

function normalizePath(path: string): string {
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

export default function ConfirmationRenderer({ block }: ConfirmationRendererProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const method = block.method ?? 'DELETE';

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(normalizePath(block.confirm_api), { method });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg p-4 text-sm font-medium text-green-600">
        Done.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4">
      {block.title && (
        <h3 className="mb-2 text-base font-semibold text-text-primary">{block.title}</h3>
      )}
      <p className="mb-3 text-sm text-text-secondary">{block.message}</p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Confirming…' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}
