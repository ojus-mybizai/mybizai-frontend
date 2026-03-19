'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { UICard } from '@/types/ui-protocol';

interface CardRendererProps {
  block: UICard;
}

interface CardData {
  title?: string;
  value?: string | number;
  [key: string]: unknown;
}

function normalizePath(path: string): string {
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

export default function CardRenderer({ block }: CardRendererProps) {
  const [data, setData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<CardData>(normalizePath(block.data_api))
      .then((res) => {
        if (!cancelled && res) setData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load card data');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [block.data_api]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg p-4 text-sm text-text-secondary">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  const title = data?.title ?? block.title ?? 'Summary';
  const value = data?.value ?? data?.total ?? data?.count ?? '—';

  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4">
      <p className="text-sm text-text-secondary">{title}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{String(value)}</p>
    </div>
  );
}
