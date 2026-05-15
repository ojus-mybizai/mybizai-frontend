'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DynamicField } from '@/services/dynamic-data';
import { queryRecords, searchBuiltinModel, listFields, createRecord } from '@/services/dynamic-data';

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
  const [saving, setSaving] = useState(false);
  const [pendingIds, setPendingIds] = useState<number[]>(() =>
    Array.isArray(value) ? value : value != null ? [Number(value)] : []
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevEditingRef = useRef(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFields, setCreateFields] = useState<DynamicField[]>([]);
  const [createData, setCreateData] = useState<Record<string, unknown>>({});
  const [createSaving, setCreateSaving] = useState(false);

  const targetModelId = field.relation_model_id;
  const builtinModel = field.relation_builtin_model;
  const isMany = field.relation_kind === 'many_to_many';
  const hasTarget = !!targetModelId || !!builtinModel;

  const loadOptions = useCallback(async (searchTerm: string) => {
    if (!hasTarget) return;
    setLoading(true);
    try {
      if (builtinModel) {
        const res = await searchBuiltinModel(builtinModel, searchTerm, 1, 30);
        setOptions(
          res.items.map((item) => ({
            id: item.id,
            record_key: String(item.id),
            label: item.label,
          }))
        );
      } else if (targetModelId) {
        const res = await queryRecords(targetModelId, {
          page: 1,
          per_page: 30,
          keyword: searchTerm || undefined,
        });
        setOptions(
          res.items.map((r) => {
            const data = (r.data ?? r.normalized_data ?? r) as Record<string, unknown>;
            const displayField = field.config?.relation_display_field as string | undefined;
            const label = (displayField && data[displayField])
              || data['name'] || data['title'] || data['display_name']
              || data['full_name'] || data['label'] || data['email'] || data['phone']
              || r.record_key || `#${r.id}`;
            return {
              id: Number(r.id),
              record_key: String(r.record_key ?? r.id),
              label: String(label),
            };
          })
        );
      }
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [hasTarget, builtinModel, targetModelId]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Load options on search change or edit open
  useEffect(() => {
    if (editing && hasTarget) void loadOptions(searchDebounced);
  }, [editing, hasTarget, searchDebounced, loadOptions]);

  // Resolve labels for current IDs
  const currentIds = Array.isArray(value) ? value.map(Number) : value != null && value !== '' ? [Number(value)] : [];
  const missingLabels = currentIds.filter((id) => !options.some((x) => x.id === id));
  const [labelsLoading, setLabelsLoading] = useState(false);
  // Resolve labels for specific IDs — fetch by exact ID so position in the
  // list never matters. Track attempted keys to avoid looping on stale IDs.
  const resolvedAttempts = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!hasTarget || loading || missingLabels.length === 0) return;
    const key = [...missingLabels].sort().join(',');
    if (resolvedAttempts.current.has(key)) return;
    resolvedAttempts.current.add(key);
    setLabelsLoading(true);
    const fetch = builtinModel
      ? searchBuiltinModel(builtinModel, '', 1, missingLabels.length, missingLabels).then((res) => {
          setOptions((prev) => {
            const merged = [...prev];
            for (const item of res.items) {
              if (!merged.some((x) => x.id === item.id)) {
                merged.push({ id: item.id, record_key: String(item.id), label: item.label });
              }
            }
            return merged;
          });
        })
      : loadOptions('');
    void fetch.finally(() => setLabelsLoading(false));
  }, [hasTarget, missingLabels.length, loadOptions, loading, builtinModel]);

  const currentLabels = currentIds.map((id) => {
    const o = options.find((x) => x.id === id);
    return o ? { id, label: o.label } : { id, label: `#${id}` };
  });
  const hasResolvedLabels = currentLabels.every((l) => !l.label.startsWith('#'));

  const handleSelect = useCallback(async (id: number) => {
    if (isMany) {
      setPendingIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else {
      setSaving(true);
      await onSave(id);
      setSaving(false);
      setEditing(false);
    }
  }, [isMany, onSave]);

  const handleClear = useCallback(async () => {
    if (isMany) {
      setPendingIds([]);
    } else {
      setSaving(true);
      await onSave(null);
      setSaving(false);
      setEditing(false);
    }
  }, [isMany, onSave]);

  const handleDone = useCallback(async () => {
    if (isMany) {
      setSaving(true);
      await onSave(pendingIds);
      setSaving(false);
      setEditing(false);
    }
  }, [isMany, onSave, pendingIds]);

  // Sync pendingIds when opening multi-select
  useEffect(() => {
    if (editing && !prevEditingRef.current && isMany) setPendingIds(currentIds);
    prevEditingRef.current = editing;
  }, [editing, isMany, currentIds]);

  // Focus input on open
  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 50);
  }, [editing]);

  // Click outside to close
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

  if (!hasTarget) {
    return <div className="px-4 py-3 text-text-secondary">—</div>;
  }

  // ── Editing dropdown ──
  if (editing) {
    const selectedSet = new Set(isMany ? pendingIds : currentIds);
    const modelLabel = builtinModel
      ? { leads: 'Lead', users: 'Employee', contacts: 'Contact', work: 'Work Item' }[builtinModel] || 'Record'
      : 'Record';

    return (
      <div className="relative px-4 py-3 align-top" ref={containerRef}>
        <div className="relative">
          <div className="absolute left-0 top-0 z-50 w-[300px] overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-color bg-bg-secondary/50 px-3 py-2">
              <span className="text-xs font-semibold text-text-secondary">
                {isMany ? 'Select' : 'Choose'} {modelLabel}
              </span>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded p-0.5 text-text-secondary hover:bg-bg-primary hover:text-text-primary"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="relative px-3 py-2">
              <svg className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={`Search ${modelLabel.toLowerCase()}s...`}
                className="w-full rounded-lg border border-border-color bg-bg-primary py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
            </div>

            {/* Options list */}
            <div className="max-h-[240px] overflow-y-auto px-1.5 pb-1.5">
              {loading ? (
                <div className="space-y-1 px-1.5 py-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex animate-pulse items-center gap-2 rounded-lg px-2 py-2">
                      <div className="h-7 w-7 rounded-full bg-bg-secondary" />
                      <div className="h-3.5 flex-1 rounded bg-bg-secondary" style={{ width: `${50 + i * 10}%` }} />
                    </div>
                  ))}
                </div>
              ) : options.length === 0 ? (
                <div className="py-6 text-center">
                  <svg className="mx-auto mb-2 h-8 w-8 text-text-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-xs text-text-secondary">
                    {searchInput ? 'No results found' : 'No records available'}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {options.map((o) => {
                    const isSelected = selectedSet.has(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        disabled={saving}
                        onClick={() => void handleSelect(o.id)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                          isSelected
                            ? 'bg-accent/10 ring-1 ring-inset ring-accent/20'
                            : 'hover:bg-bg-secondary/80'
                        } ${saving ? 'opacity-50' : ''}`}
                      >
                        {/* Avatar circle */}
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isSelected ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary'
                        }`}>
                          {isMany ? (
                            isSelected ? (
                              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : null
                          ) : (
                            o.label.charAt(0).toUpperCase()
                          )}
                        </div>
                        {/* Label */}
                        <div className="min-w-0 flex-1">
                          <span className={`block truncate text-sm ${isSelected ? 'font-semibold text-accent' : 'text-text-primary'}`}>
                            {o.label}
                          </span>
                          {o.record_key !== String(o.id) && (
                            <span className="block truncate text-[10px] text-text-secondary">
                              {o.record_key}
                            </span>
                          )}
                        </div>
                        {/* Selected indicator for single-select */}
                        {!isMany && isSelected && (
                          <svg className="h-4 w-4 shrink-0 text-accent" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Create new button for custom models */}
            {field.relation_model_id && !field.relation_builtin_model && (
              <div className="border-t border-border-color px-3 py-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-color py-1.5 text-xs font-medium text-accent hover:border-accent hover:bg-accent/5 transition"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Create new record
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-2 border-t border-border-color bg-bg-secondary/30 px-3 py-2">
              {!isMany ? (
                <button
                  type="button"
                  onClick={() => void handleClear()}
                  disabled={saving || currentIds.length === 0}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-primary hover:text-error disabled:opacity-40"
                >
                  Clear
                </button>
              ) : (
                <>
                  <span className="flex-1 text-xs text-text-secondary">
                    {pendingIds.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingIds([])}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-text-secondary hover:bg-bg-primary"
                  >
                    Clear all
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDone()}
                    disabled={saving}
                    className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Done'}
                  </button>
                </>
              )}
            </div>
          </div>
          <span className="text-sm text-text-secondary">Select…</span>
        </div>
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      </div>
    );
  }

  // ── Display mode ──
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
      className="group min-h-[2.5rem] cursor-pointer px-4 py-3 hover:bg-bg-secondary/60"
    >
      <div className="flex flex-wrap items-center gap-1.5 max-h-[3rem] overflow-hidden relative">
        {labelsLoading && !hasResolvedLabels ? (
          /* Loading skeleton */
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-20 animate-pulse rounded-full bg-bg-secondary" />
            {currentIds.length > 1 && <div className="h-5 w-16 animate-pulse rounded-full bg-bg-secondary" />}
            {currentIds.length > 2 && <div className="h-5 w-8 animate-pulse rounded-full bg-bg-secondary" />}
          </div>
        ) : currentLabels.length ? (
          <>
            {currentLabels.slice(0, 2).map(({ id, label }) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/20"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                  {label.startsWith('#') ? '?' : label.charAt(0).toUpperCase()}
                </span>
                <span className="truncate max-w-[80px]">{label}</span>
              </span>
            ))}
            {currentLabels.length > 2 && (
              <span className="inline-flex items-center rounded-full bg-bg-secondary px-2 py-0.5 text-[10px] font-semibold text-text-secondary ring-1 ring-inset ring-border-color">
                +{currentLabels.length - 2}
              </span>
            )}
          </>
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

      {/* Create related record modal */}
      {showCreateModal && field.relation_model_id && (() => {
        // Load fields on mount
        if (!createFields.length) {
          void listFields(field.relation_model_id!).then(setCreateFields).catch(() => {});
        }
        return (
          <>
            <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => { setShowCreateModal(false); setCreateData({}); }} aria-hidden />
            <div
              className="fixed left-1/2 top-1/2 z-[70] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 max-h-[80vh] overflow-y-auto rounded-xl border border-border-color bg-card-bg p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-text-primary mb-4">Create new record</h3>
              <div className="space-y-3">
                {createFields
                  .filter((f) => f.field_type !== 'relation' && f.is_editable)
                  .map((f) => (
                    <div key={f.id}>
                      <label className="block text-xs font-medium text-text-secondary mb-1">
                        {f.display_name}{f.is_required && <span className="text-red-400 ml-0.5">*</span>}
                      </label>
                      {f.field_type === 'enum' ? (
                        <select
                          className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                          value={String(createData[f.name] ?? '')}
                          onChange={(e) => setCreateData((prev) => ({ ...prev, [f.name]: e.target.value }))}
                        >
                          <option value="">—</option>
                          {((f.config?.options as string[]) || []).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : f.field_type === 'boolean' ? (
                        <select
                          className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                          value={String(createData[f.name] ?? '')}
                          onChange={(e) => setCreateData((prev) => ({ ...prev, [f.name]: e.target.value === 'true' }))}
                        >
                          <option value="">—</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : (
                        <input
                          type={f.field_type === 'integer' || f.field_type === 'float' || f.field_type === 'currency' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                          className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                          value={String(createData[f.name] ?? '')}
                          onChange={(e) => setCreateData((prev) => ({ ...prev, [f.name]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setCreateData({}); setCreateFields([]); }}
                  className="rounded-lg border border-border-color px-4 py-2 text-sm text-text-secondary hover:bg-bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createSaving}
                  onClick={async () => {
                    if (!field.relation_model_id) return;
                    setCreateSaving(true);
                    try {
                      const newRec = await createRecord(field.relation_model_id, createData);
                      const newId = Number((newRec as any).id);
                      // Auto-select the new record
                      if (isMany) {
                        const updated = [...pendingIds, newId];
                        setPendingIds(updated);
                      } else {
                        await onSave(newId);
                      }
                      setShowCreateModal(false);
                      setCreateData({});
                      setCreateFields([]);
                      // Refresh options
                      setSearchDebounced('');
                    } catch {}
                    setCreateSaving(false);
                  }}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {createSaving ? 'Creating...' : 'Create & Select'}
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
