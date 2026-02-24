'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DynamicField } from '@/services/dynamic-data';
import { queryRecords } from '@/services/dynamic-data';

const DEBOUNCE_MS = 300;

interface RelationCellProps {
  value: unknown;
  field: DynamicField;
  recordId: number;
  onSave: (value: unknown) => Promise<void>;
  error?: string | null;
}

export function RelationCell({ value, field, onSave, error }: RelationCellProps) {
  const [editing, setEditing] = useState(false);
  const [options, setOptions] = useState<Array<{ id: number; record_key: string; label: string }>>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingIds, setPendingIds] = useState<number[]>(() =>
    Array.isArray(value) ? value : value != null ? [Number(value)] : []
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const prevEditingRef = useRef(false);

  const targetModelId = field.relation_model_id;
  const isMany = field.relation_kind === 'many_to_many';

  const loadOptions = useCallback(async (searchTerm: string) => {
    if (!targetModelId) return;
    setLoading(true);
    try {
      const res = await queryRecords(targetModelId, {
        page: 1,
        per_page: 20,
        keyword: searchTerm || undefined,
      });
      setOptions(
        res.items.map((r) => {
          const data = (r.data ?? r.normalized_data ?? r) as Record<string, unknown>;
          return {
            id: Number(r.id),
            record_key: String(r.record_key ?? r.id),
            label: String(data['name'] ?? data['title'] ?? r.record_key ?? r.id),
          };
        })
      );
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [targetModelId]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (editing && targetModelId) void loadOptions(searchDebounced);
  }, [editing, targetModelId, searchDebounced, loadOptions]);

  const currentIds = Array.isArray(value) ? value : value != null ? [Number(value)] : [];
  const missingLabels = currentIds.filter((id) => !options.some((x) => x.id === id));
  useEffect(() => {
    if (!editing && targetModelId && missingLabels.length > 0 && options.length === 0) {
      void loadOptions('');
    }
  }, [editing, targetModelId, missingLabels.length, options.length, loadOptions]);

  const currentLabels = currentIds.map((id) => {
    const o = options.find((x) => x.id === id);
    return o ? { id, label: o.label } : { id, label: `#${id}` };
  });

  const handleSelect = useCallback((id: number) => {
    if (isMany) {
      setPendingIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else {
      void onSave(id);
      setEditing(false);
    }
  }, [isMany, onSave]);

  const handleClear = useCallback(() => {
    if (isMany) {
      setPendingIds([]);
    } else {
      void onSave(null);
      setEditing(false);
    }
  }, [isMany, onSave]);

  const handleDone = useCallback(async () => {
    if (isMany) {
      await onSave(pendingIds);
      setEditing(false);
    }
  }, [isMany, onSave, pendingIds]);

  useEffect(() => {
    if (editing && !prevEditingRef.current && isMany) setPendingIds(currentIds);
    prevEditingRef.current = editing;
  }, [editing, isMany, currentIds]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    if (editing) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [editing]);

  if (!targetModelId) {
    return <div className="px-4 py-3 text-text-secondary">—</div>;
  }

  if (editing) {
    const selectedInMany = isMany ? pendingIds : [];
    return (
      <div className="relative px-4 py-3 align-top" ref={containerRef}>
        <div className="relative">
          <div className="absolute left-0 top-0 z-50 min-w-[220px] rounded-lg border border-border-color bg-card-bg p-2 shadow-lg">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search…"
              className="mb-2 w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
              autoFocus
            />
            {!isMany && (
              <button
                type="button"
                onClick={handleClear}
                className="mb-2 w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-secondary"
              >
                Clear
              </button>
            )}
            {loading ? (
              <div className="py-4 text-center text-xs text-text-secondary">Loading…</div>
            ) : (
              <div className="max-h-48 space-y-0.5 overflow-y-auto">
                {options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => handleSelect(o.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                      (isMany ? selectedInMany : currentIds).includes(o.id)
                        ? 'bg-accent-soft font-medium'
                        : 'hover:bg-bg-secondary'
                    }`}
                  >
                    {isMany && (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border-color bg-bg-primary">
                        {(selectedInMany.includes(o.id)) ? (
                          <svg className="h-3 w-3 text-accent" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : null}
                      </span>
                    )}
                    <span className="truncate">{o.label}</span>
                  </button>
                ))}
              </div>
            )}
            {isMany && (
              <div className="mt-2 flex justify-end border-t border-border-color pt-2">
                <button
                  type="button"
                  onClick={() => void handleDone()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
                >
                  Done
                </button>
              </div>
            )}
          </div>
          <span className="text-sm text-text-secondary">Select…</span>
        </div>
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
      className="group min-h-[2.5rem] cursor-pointer px-4 py-3 hover:bg-bg-secondary/60"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {currentLabels.length ? (
          currentLabels.map(({ id, label }) => (
            <span
              key={id}
              className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent"
            >
              {label}
            </span>
          ))
        ) : (
          <span className="text-text-secondary">—</span>
        )}
        <span className="opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden>
          <svg className="h-3.5 w-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </span>
      </div>
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}
