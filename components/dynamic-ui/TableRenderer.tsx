'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { UITable } from '@/types/ui-protocol';

interface TableRendererProps {
  block: UITable;
}

interface TableApiResponse {
  items?: Record<string, unknown>[];
  data?: Record<string, unknown>[];
}

function normalizePath(path: string): string {
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

export default function TableRenderer({ block }: TableRendererProps) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!block.data_api) {
      console.warn('[ChatFlow] TableRenderer: block has no data_api', { title: block.title });
      setLoading(false);
      setError('No data source');
      return;
    }
    setLoading(true);
    setError(null);
    const path = normalizePath(block.data_api);
    try {
      const res = await apiFetch<TableApiResponse>(path);
      const list = Array.isArray(res?.items) ? res.items : Array.isArray(res?.data) ? res.data : [];
      setItems(list);
      console.log('[ChatFlow] TableRenderer fetch ok:', { data_api: path, itemCount: list.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load table data';
      setError(msg);
      setItems([]);
      console.warn('[ChatFlow] TableRenderer fetch failed:', { data_api: path, error: msg });
    } finally {
      setLoading(false);
    }
  }, [block.data_api, block.title]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = block.columns?.length ? block.columns : [];
  const keys = columns.length > 0 ? columns.map((c) => c.key) : items.length ? Object.keys(items[0] as object) : [];

  if (loading) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg px-4 py-6 text-sm text-text-secondary">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg px-4 py-6 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg">
      <div className="flex items-center justify-between border-b border-border-color px-4 py-2">
        {block.title && (
          <h3 className="text-sm font-semibold text-text-primary">{block.title}</h3>
        )}
        {block.reloadable && (
          <button
            type="button"
            onClick={fetchData}
            className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
          >
            Reload
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        {items.length === 0 ? (
          <div className="px-4 py-6 text-sm text-text-secondary">No data</div>
        ) : (
          <table className="min-w-full divide-y divide-border-color text-base">
            <thead className="bg-bg-secondary/60">
              <tr>
                {keys.map((key) => {
                  const col = columns.find((c) => c.key === key);
                  const label = col?.label ?? key;
                  return (
                    <th
                      key={key}
                      className="px-4 py-3 text-left text-sm font-semibold text-text-secondary"
                    >
                      {label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {items.map((row, idx) => (
                <tr key={idx} className="hover:bg-bg-secondary/60">
                  {keys.map((key) => (
                    <td key={key} className="px-4 py-3 text-text-primary">
                      {String((row as Record<string, unknown>)[key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
