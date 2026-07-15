'use client';

import { useState, useEffect, useRef } from 'react';
import type { DynamicField } from '@/services/dynamic-data';
import { queryRecords, searchBuiltinModel } from '@/services/dynamic-data';

interface Opt { id: number; label: string }

/**
 * Single-select record picker for filtering by a relation field.
 * Emits the selected record's numeric id (or null when cleared).
 * Unlike the row-add picker this is always single-select — filtering asks
 * "links to record X", even for many-to-many relations.
 */
export function RelationRecordPicker({
  field,
  value,
  onChange,
}: {
  field: DynamicField;
  value: unknown;
  onChange: (v: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [opts, setOpts] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const builtinModel = field.relation_builtin_model;
  const hasTarget = Boolean(builtinModel || field.relation_model_id);
  const selectedId = value != null && value !== '' ? Number(value) : null;
  const modelLabel = builtinModel
    ? ({ leads: 'lead', users: 'employee', contacts: 'contact', work: 'work item' } as Record<string, string>)[builtinModel] || 'record'
    : 'record';

  // Load options (initial + on search)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        if (builtinModel) {
          const res = await searchBuiltinModel(builtinModel, search, 1, 30);
          setOpts(res.items);
        } else if (field.relation_model_id) {
          const res = await queryRecords(field.relation_model_id, { page: 1, per_page: 30, keyword: search || undefined });
          setOpts(res.items.map((r) => {
            const d = (r.data ?? r.normalized_data ?? r) as Record<string, unknown>;
            const df = field.config?.relation_display_field as string | undefined;
            return { id: Number(r.id), label: String((df && d[df]) || d['name'] || d['title'] || d['display_name'] || d['full_name'] || r.record_key || r.id) };
          }));
        }
      } catch { setOpts([]); }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search, open, builtinModel, field.relation_model_id]);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedLabel = selectedId != null
    ? (opts.find((o) => o.id === selectedId)?.label ?? `#${selectedId}`)
    : null;

  if (!hasTarget) {
    return (
      <div className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border-color bg-bg-secondary/40 px-3 py-2 text-xs text-text-secondary">
        Relation target not configured.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="flex w-full items-center gap-2 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-left text-sm text-text-primary hover:border-accent/50"
      >
        {selectedLabel ? (
          <span className="inline-flex flex-1 items-center gap-1 text-text-primary">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">{selectedLabel.charAt(0).toUpperCase()}</span>
            {selectedLabel}
          </span>
        ) : (
          <span className="flex-1 text-text-secondary">Select {modelLabel}...</span>
        )}
        <svg className="h-4 w-4 shrink-0 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-2xl">
          <div className="px-2.5 py-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${modelLabel}s...`}
              className="w-full rounded-lg border border-border-color bg-bg-primary py-2 px-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto px-1.5 pb-1.5">
            {loading ? (
              <div className="py-4 text-center text-xs text-text-secondary">Loading...</div>
            ) : opts.length === 0 ? (
              <div className="py-4 text-center text-xs text-text-secondary">{search ? 'No results found' : 'No records available'}</div>
            ) : (
              opts.map((o) => {
                const sel = selectedId === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { onChange(o.id); setOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${sel ? 'bg-accent/10 ring-1 ring-inset ring-accent/20' : 'hover:bg-bg-secondary/80'}`}
                  >
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${sel ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary'}`}>
                      {o.label.charAt(0).toUpperCase()}
                    </div>
                    <span className={`truncate text-sm ${sel ? 'font-semibold text-accent' : 'text-text-primary'}`}>{o.label}</span>
                  </button>
                );
              })
            )}
          </div>
          {selectedId != null && (
            <div className="border-t border-border-color px-3 py-1.5">
              <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="text-xs text-text-secondary hover:text-red-500">
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
