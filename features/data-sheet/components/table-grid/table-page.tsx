'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DataSheetCell } from '@/components/data-sheet/data-sheet-cell';
import { RelationCell } from '@/components/data-sheet/relation-cell';
import { DataSheetFilterBuilder } from '@/components/data-sheet/data-sheet-filter-builder';
import { useDataSheetContext } from '@/features/data-sheet/context/data-sheet-context';
import { ConfirmModal } from '@/features/data-sheet/components/confirm-modal';
import {
  queryRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  listViews,
  uploadFileForAttachment,
  bindAttachment,
  type QueryResponse,
} from '@/features/data-sheet/api';
import { searchBuiltinModel } from '@/services/dynamic-data';
import type { QueryFilter } from '@/components/data-sheet/data-sheet-filter-builder';
import { normalizeApiError } from '@/features/data-sheet/api/normalize-error';
import { queryParamsFromSearchParams } from '@/features/data-sheet/state/query-params';
import type { DynamicField } from '@/services/dynamic-data';

type SortRule = { field: string; direction: string };

function parseAddRowValue(field: DynamicField, raw: unknown): unknown {
  if (raw === '' || raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  if (str === '' || str === '—') return null;
  switch (field.field_type) {
    case 'number':
    case 'currency':
      const n = Number(str);
      return Number.isFinite(n) ? n : null;
    case 'boolean':
      if (/^(true|1|yes)$/i.test(str)) return true;
      if (/^(false|0|no)$/i.test(str)) return false;
      return null;
    case 'date':
      return str;
    case 'relation':
      if (raw == null) return null;
      if (Array.isArray(raw)) return raw.map((x) => Number(x)).filter(Number.isFinite);
      const id = Number(raw);
      return Number.isFinite(id) ? id : null;
    case 'image':
    case 'file':
      return null;
    default:
      return str;
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 25;

export function TablePage() {
  const ctx = useDataSheetContext();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<QueryResponse['items']>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [keyword, setKeyword] = useState('');
  const [keywordDebounced, setKeywordDebounced] = useState('');
  const [sort, setSort] = useState<SortRule[]>([]);
  const [filters, setFilters] = useState<QueryFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [addRowData, setAddRowData] = useState<Record<string, unknown>>({});
  const [addRowSaving, setAddRowSaving] = useState(false);
  const [cellErrors, setCellErrors] = useState<Record<string, Record<string, string>>>({});
  const [filterBuilderOpen, setFilterBuilderOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string> | null>(null);
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);
  const [views, setViews] = useState<Array<{ id: number; name: string; config: Record<string, unknown> }>>([]);
  const [viewsDropdownOpen, setViewsDropdownOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState<number | null>(null);
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<number | null>(null);
  const [scrollHintDismissed, setScrollHintDismissed] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const hasLoadedOnceRef = useRef(false);

  // Sync URL -> state once on mount / URL change
  useEffect(() => {
    const q = queryParamsFromSearchParams(new URLSearchParams(searchParams?.toString() ?? ''));
    setPage(q.page);
    setPerPage(q.per_page);
    setSort(q.sort);
    setFilters(q.filters);
    setKeyword(q.keyword);
    setKeywordDebounced(q.keyword);
  }, [searchParams]);

  // Debounce keyword
  useEffect(() => {
    const t = setTimeout(() => setKeywordDebounced(keyword), 400);
    return () => clearTimeout(t);
  }, [keyword]);

  const refetch = useCallback(
    async (options?: { background?: boolean; preserveOrder?: boolean }) => {
      if (!ctx?.modelId) return;
      const background = options?.background === true;
      const preserveOrder = options?.preserveOrder === true;
      if (!background) {
        setLoading(true);
      }
      setError(null);
      try {
        const res = await queryRecords(ctx.modelId, {
          page,
          per_page: perPage,
          sort: sort.map((s) => ({ field: s.field, direction: s.direction || 'asc' })),
          filters,
          keyword: keywordDebounced || undefined,
        });
        if (preserveOrder) {
          setItems((prev) => {
            if (prev.length === 0) return res.items;
            const byId = new Map(res.items.map((r) => [Number(r.id), r]));
            const merged = prev
              .map((row) => byId.get(Number(row.id)))
              .filter((r): r is NonNullable<typeof r> => r != null);
            return merged.length > 0 ? merged : res.items;
          });
        } else {
          setItems(res.items);
        }
        setTotal(res.total);
        setTotalPages(res.total_pages ?? (Math.ceil(res.total / perPage) || 1));
      } catch (e) {
        setError(normalizeApiError(e).message);
        setItems([]);
        setTotal(0);
        setTotalPages(0);
      } finally {
        setLoading(false);
      }
    },
    [ctx?.modelId, page, perPage, sort, filters, keywordDebounced]
  );

  useEffect(() => {
    const background = hasLoadedOnceRef.current;
    refetch({ background }).then(() => {
      hasLoadedOnceRef.current = true;
    });
  }, [refetch]);

  const toggleSort = useCallback((fieldName: string) => {
    setSort((prev) => {
      const current = prev.find((s) => s.field === fieldName);
      const nextDir = current?.direction === 'asc' ? 'desc' : 'asc';
      return [{ field: fieldName, direction: nextDir }];
    });
    setPage(1);
  }, []);

  const loadViews = useCallback(async () => {
    if (!ctx?.modelId) return;
    try {
      const list = await listViews(ctx.modelId);
      setViews(list.map((v) => ({ id: v.id, name: v.name, config: v.config ?? {} })));
    } catch {
      setViews([]);
    }
  }, [ctx?.modelId]);

  const handleSaveCell = useCallback(
    async (recordId: number, fieldName: string, value: unknown) => {
      if (!ctx?.modelId) return;
      setCellErrors((prev) => {
        const next = { ...prev };
        const row = next[String(recordId)];
        if (row) {
          const r = { ...row };
          delete r[fieldName];
          if (Object.keys(r).length === 0) {
            delete next[String(recordId)];
          } else {
            next[String(recordId)] = r;
          }
        }
        return next;
      });
      try {
        await updateRecord(ctx.modelId, recordId, {
          data: { [fieldName]: value },
          mode: 'merge',
        });
        setItems((prev) =>
          prev.map((r) =>
            Number(r.id) === recordId
              ? {
                  ...r,
                  data: { ...((r.data ?? r.normalized_data ?? {}) as Record<string, unknown>), [fieldName]: value },
                  normalized_data: { ...((r.normalized_data ?? r.data ?? {}) as Record<string, unknown>), [fieldName]: value },
                }
              : r
          )
        );
        void refetch({ background: true, preserveOrder: true });
      } catch (e) {
        const msg = normalizeApiError(e).message;
        setCellErrors((prev) => ({
          ...prev,
          [String(recordId)]: { ...prev[String(recordId)], [fieldName]: msg },
        }));
        throw e;
      }
    },
    [ctx?.modelId, refetch]
  );

  const handleAddRow = useCallback(async () => {
    const fieldList = ctx?.fields ?? [];
    if (!ctx || !fieldList.length) return;
    setAddRowSaving(true);
    setError(null);
    try {
      const data: Record<string, unknown> = {};
      for (const f of fieldList) {
        const raw = addRowData[f.name];
        const parsed = parseAddRowValue(f, raw);
        if (parsed !== null || f.is_required) {
          data[f.name] = parsed;
        }
      }
      const created = await createRecord(ctx.modelId, data);
      const recordId = created.id;

      const imageFileFields = fieldList.filter((f) => f.field_type === 'image' || f.field_type === 'file');
      for (const f of imageFileFields) {
        const raw = addRowData[f.name];
        const files: File[] = Array.isArray(raw)
          ? (raw as File[]).filter((x): x is File => x instanceof File)
          : raw instanceof File
            ? [raw]
            : [];
        for (const file of files) {
          const up = await uploadFileForAttachment(ctx.modelId, file);
          await bindAttachment(ctx.modelId, {
            dynamic_record_id: recordId,
            field_id: f.id,
            storage_key: up.storage_key,
            original_file_name: up.original_file_name,
            mime_type: up.mime_type ?? undefined,
            size_bytes: up.size_bytes ?? undefined,
          });
        }
      }

      setAddRowOpen(false);
      setAddRowData({});
      void refetch({ background: true });
    } catch (e) {
      setError(normalizeApiError(e).message);
    } finally {
      setAddRowSaving(false);
    }
  }, [ctx, addRowData, refetch]);

  const handleDeleteRowClick = useCallback((recordId: number) => {
    setConfirmDeleteRowId(recordId);
  }, []);

  const handleDeleteRowConfirm = useCallback(
    async (recordId: number) => {
      if (!ctx?.modelId) return;
      setDeletingRowId(recordId);
      try {
        await deleteRecord(ctx.modelId, recordId);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(recordId);
          return next;
        });
        setConfirmDeleteRowId(null);
        void refetch({ background: true });
      } catch (e) {
        setError(normalizeApiError(e).message);
      } finally {
        setDeletingRowId(null);
      }
    },
    [ctx?.modelId, refetch]
  );

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((r) => Number(r.id))));
    }
  }, [items, selectedIds.size]);

  const toggleSelectOne = useCallback((recordId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }, []);

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedIds.size > 0) setConfirmBulkDeleteOpen(true);
  }, [selectedIds.size]);

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (!ctx?.modelId || selectedIds.size === 0) return;
    setBulkDeleting(true);
    setError(null);
    try {
      for (const id of selectedIds) {
        await deleteRecord(ctx.modelId, id);
      }
      setSelectedIds(new Set());
      setConfirmBulkDeleteOpen(false);
      void refetch({ background: true });
    } catch (e) {
      setError(normalizeApiError(e).message);
    } finally {
      setBulkDeleting(false);
    }
  }, [ctx?.modelId, selectedIds, refetch]);

  const applyView = useCallback((config: Record<string, unknown>) => {
    const f = (config.filters as QueryFilter[]) ?? [];
    const s = (config.sort as SortRule[]) ?? [];
    setFilters(f);
    setSort(s);
    setPage(1);
  }, []);

  if (!ctx) return null;

  const { modelId, fields } = ctx;
  const searchableFields = useMemo(
    () => fields.filter((f) => f.is_searchable !== false),
    [fields]
  );
  const visibleFields = useMemo(
    () =>
      visibleColumns === null
        ? searchableFields
        : searchableFields.filter((f) => visibleColumns.has(f.name)),
    [searchableFields, visibleColumns]
  );

  const fetchRelatedRecords = useCallback(
    async (targetModelId: number) => {
      const res = await queryRecords(targetModelId, { page: 1, per_page: 50 });
      return res.items as Array<{ id: number; record_key?: string; data?: Record<string, unknown> }>;
    },
    []
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative flex min-w-0 flex-1 items-center sm:flex-initial">
          <span className="pointer-events-none absolute left-3 text-text-secondary" aria-hidden>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-border-color bg-bg-primary py-2 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:w-64"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => setKeyword('')}
              className="absolute right-2 rounded p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              aria-label="Clear search"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {/* Mobile: single Options dropdown */}
        <div className="relative md:hidden">
          <button
            type="button"
            onClick={() => {
              setOptionsOpen(!optionsOpen);
              if (!optionsOpen) void loadViews();
            }}
            className="min-h-[44px] rounded-lg border border-border-color bg-card-bg px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-bg-secondary"
          >
            Options
          </button>
          {optionsOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setOptionsOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full z-30 mt-1 w-[min(280px,100vw-2rem)] rounded-lg border border-border-color bg-card-bg p-3 shadow-lg">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterBuilderOpen(true);
                      setOptionsOpen(false);
                    }}
                    className={`flex min-h-[44px] w-full items-center rounded-lg border px-3 py-2 text-sm font-medium ${
                      filters.length > 0
                        ? 'border-accent/60 bg-accent-soft text-accent'
                        : 'border-border-color bg-bg-primary text-text-secondary hover:bg-bg-secondary'
                    }`}
                  >
                    Filters {filters.length ? `(${filters.length})` : ''}
                  </button>
                  <div>
                    <p className="mb-1 px-1 text-xs font-medium text-text-secondary">Views</p>
                    {views.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-text-secondary">No saved views</p>
                    ) : (
                      <div className="space-y-0.5">
                        {views.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              applyView(v.config);
                              setOptionsOpen(false);
                            }}
                            className="flex min-h-[44px] w-full items-center rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                          >
                            {v.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 px-1 text-xs font-medium text-text-secondary">Columns</p>
                    <div className="space-y-0.5">
                      {searchableFields.map((f) => (
                        <label key={f.id} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg px-3 py-2 hover:bg-bg-secondary">
                          <input
                            type="checkbox"
                            checked={visibleColumns === null ? true : visibleColumns.has(f.name)}
                            onChange={(e) => {
                              const next =
                                visibleColumns === null ? new Set(searchableFields.map((x) => x.name)) : new Set(visibleColumns);
                              if (e.target.checked) next.add(f.name);
                              else next.delete(f.name);
                              setVisibleColumns(next.size === searchableFields.length ? null : next);
                            }}
                          />
                          <span className="text-sm text-text-primary">{f.display_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        {/* Desktop: Filters, Views, Columns */}
        <button
          type="button"
          onClick={() => setFilterBuilderOpen(true)}
          className={`hidden rounded-lg border px-4 py-2 text-sm font-medium hover:bg-bg-secondary md:inline-flex ${
            filters.length > 0
              ? 'border-accent/60 bg-accent-soft text-accent'
              : 'border-border-color bg-card-bg text-text-secondary'
          }`}
        >
          Filters {filters.length ? `(${filters.length})` : ''}
        </button>
        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => {
              setViewsDropdownOpen(!viewsDropdownOpen);
              if (!viewsDropdownOpen) void loadViews();
            }}
            className="rounded-lg border border-border-color bg-card-bg px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-bg-secondary"
          >
            Views
          </button>
          {viewsDropdownOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setViewsDropdownOpen(false)} aria-hidden />
              <div className="absolute left-0 top-full z-30 mt-1 min-w-[160px] rounded-lg border border-border-color bg-card-bg py-1 shadow-lg">
                {views.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-text-secondary">No saved views</div>
                ) : (
                  views.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => applyView(v.config)}
                      className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                    >
                      {v.name}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setColumnPopoverOpen(!columnPopoverOpen)}
            className="rounded-lg border border-border-color bg-card-bg px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-bg-secondary"
          >
            Columns
          </button>
          {columnPopoverOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setColumnPopoverOpen(false)} aria-hidden />
              <div className="absolute left-0 top-full z-30 mt-1 min-w-[180px] rounded-lg border border-border-color bg-card-bg p-2 shadow-lg">
                {searchableFields.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={visibleColumns === null ? true : visibleColumns.has(f.name)}
                      onChange={(e) => {
                        const next =
                          visibleColumns === null ? new Set(searchableFields.map((x) => x.name)) : new Set(visibleColumns);
                        if (e.target.checked) next.add(f.name);
                        else next.delete(f.name);
                        setVisibleColumns(next.size === searchableFields.length ? null : next);
                      }}
                    />
                    <span className="text-sm text-text-primary">{f.display_name}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAddRowOpen(true)}
          className="min-h-[44px] shrink-0 rounded-lg border border-border-color bg-bg-secondary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-accent-soft"
        >
          Add row
        </button>
      </div>

      <DataSheetFilterBuilder
        fields={fields}
        filters={filters}
        onChange={setFilters}
        onApply={refetch}
        open={filterBuilderOpen}
        onClose={() => setFilterBuilderOpen(false)}
      />

      {confirmDeleteRowId !== null && (
        <ConfirmModal
          title="Delete row"
          message="Are you sure you want to delete this row? This cannot be undone."
          confirmLabel="Delete row"
          variant="danger"
          loading={deletingRowId === confirmDeleteRowId}
          onConfirm={() => void handleDeleteRowConfirm(confirmDeleteRowId)}
          onClose={() => setConfirmDeleteRowId(null)}
        />
      )}
      {confirmBulkDeleteOpen && (
        <ConfirmModal
          title="Delete selected rows"
          message={`Delete ${selectedIds.size} selected row(s)? This cannot be undone.`}
          confirmLabel="Delete selected"
          variant="danger"
          loading={bulkDeleting}
          onConfirm={() => void handleBulkDeleteConfirm()}
          onClose={() => setConfirmBulkDeleteOpen(false)}
        />
      )}

      {loading ? (
        <div className="rounded-xl border border-border-color bg-card-bg px-6 py-8 text-text-secondary">
          Loading…
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {selectedIds.size > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border-color bg-accent-soft px-3 py-2 sm:px-4">
              <span className="text-sm font-medium text-text-primary">{selectedIds.size} selected</span>
              <button
                type="button"
                onClick={handleBulkDeleteClick}
                disabled={bulkDeleting}
                className="min-h-[44px] rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting…' : 'Delete selected'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="min-h-[44px] rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-secondary"
              >
                Clear selection
              </button>
            </div>
          )}

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm">
          <div
            ref={tableScrollRef}
            onScroll={() => {
              const el = tableScrollRef.current;
              if (el && el.scrollLeft > 10) setScrollHintDismissed(true);
            }}
            className="min-h-0 min-w-0 flex-1 w-full overflow-x-auto"
          >
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-bg-secondary">
              <tr className="border-b border-border-color bg-bg-secondary">
                <th className="w-11 min-w-[44px] border-r border-border-color bg-bg-secondary px-2 py-2.5">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="min-w-[120px] border-r border-border-color bg-bg-secondary px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">
                  Record
                </th>
                {visibleFields.map((f) => {
                  const sortForField = sort.find((s) => s.field === f.name);
                  return (
                    <th
                      key={f.id}
                      className="min-w-[100px] max-w-[200px] truncate border-r border-border-color px-4 py-2.5 text-left text-sm font-semibold text-text-secondary last:border-r-0"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(f.name)}
                        className="flex items-center gap-1 hover:text-text-primary"
                      >
                        <span className="truncate">{f.display_name}</span>
                        {sortForField ? (
                          sortForField.direction === 'asc' ? (
                            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )
                        ) : (
                          <span className="inline-block h-4 w-4 shrink-0 opacity-40" aria-hidden>
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                          </span>
                        )}
                      </button>
                    </th>
                  );
                })}
                <th className="w-20 border-border-color bg-bg-secondary px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={visibleFields.length + 3} className="px-4 py-10 text-center text-sm text-text-secondary">
                    No records yet. Click &quot;Add row&quot; to create your first record.
                  </td>
                </tr>
              ) : items.map((row) => {
                const recordId = Number(row.id);
                const data = (row.data ?? row.normalized_data ?? {}) as Record<string, unknown>;
                const rowErrors = cellErrors[String(recordId)] ?? {};
                return (
                  <tr key={recordId} className="border-b border-border-color last:border-b-0 even:bg-bg-primary/50 hover:bg-bg-secondary/60">
                    <td className="w-11 min-w-[44px] border-r border-border-color bg-inherit px-2 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(recordId)}
                        onChange={() => toggleSelectOne(recordId)}
                        aria-label={`Select row ${recordId}`}
                      />
                    </td>
                    <td className="border-r border-border-color bg-inherit px-4 py-2.5 text-sm text-text-secondary">
                      {String(row.record_key ?? row.id)}
                    </td>
                    {visibleFields.map((field) =>
                      field.field_type === 'relation' ? (
                        <td key={field.id} className="min-w-[120px] max-w-[200px] border-r border-border-color bg-inherit last:border-r-0">
                          <RelationCell
                            value={data[field.name]}
                            field={field}
                            recordId={recordId}
                            onSave={(value) => handleSaveCell(recordId, field.name, value)}
                            error={rowErrors[field.name]}
                          />
                        </td>
                      ) : (
                        <DataSheetCell
                          key={field.id}
                          field={field}
                          value={data[field.name]}
                          recordId={recordId}
                          onSave={(value) => handleSaveCell(recordId, field.name, value)}
                          error={rowErrors[field.name]}
                          fetchRelatedRecords={fetchRelatedRecords}
                          modelId={modelId}
                          onAttachmentAdded={() => void refetch({ background: true, preserveOrder: true })}
                        />
                      )
                    )}
                    <td className="bg-inherit px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => handleDeleteRowClick(recordId)}
                        className="min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {!scrollHintDismissed && (
            <div
              className="pointer-events-none absolute bottom-2 right-2 z-10 rounded bg-black/60 px-2 py-1 text-xs text-white md:hidden"
              aria-hidden
            >
              Scroll →
            </div>
          )}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border-color bg-card-bg px-3 py-3 text-sm text-text-secondary sm:px-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
              <span className="text-xs sm:text-sm">
                <span className="sm:hidden">{page} / {totalPages || 1} · {total} total</span>
                <span className="hidden sm:inline">Page {page} of {totalPages || 1} · {total} total</span>
              </span>
              <label className="flex min-h-[44px] items-center gap-2">
                <span className="text-xs sm:text-sm">Per page</span>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="min-h-[44px] rounded-lg border border-border-color bg-bg-primary px-2 py-2 text-sm text-text-primary"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="min-h-[44px] min-w-[44px] rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm disabled:opacity-50 hover:bg-bg-secondary"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="min-h-[44px] min-w-[44px] rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm disabled:opacity-50 hover:bg-bg-secondary"
              >
                Next
              </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {addRowOpen && (
        <AddRowModal
          fields={fields}
          addRowData={addRowData}
          setAddRowData={setAddRowData}
          onClose={() => setAddRowOpen(false)}
          onSave={() => void handleAddRow()}
          saving={addRowSaving}
        />
      )}
    </div>
  );
}

/** Searchable relation picker for Add Row dialog */
function AddRowRelationField({
  field,
  value,
  onChange,
  allOptions,
}: {
  field: DynamicField;
  value: unknown;
  onChange: (v: unknown) => void;
  allOptions: Array<{ id: number; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [liveOpts, setLiveOpts] = useState(allOptions);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMany = field.relation_kind === 'many_to_many';
  const currentIds: number[] = Array.isArray(value) ? value.map(Number) : value != null ? [Number(value)] : [];
  const builtinModel = field.relation_builtin_model;

  // Sync initial options
  useEffect(() => { if (allOptions.length) setLiveOpts(allOptions); }, [allOptions]);

  // Search with debounce
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (!search && allOptions.length) { setLiveOpts(allOptions); return; }
      setLoading(true);
      try {
        if (builtinModel) {
          const res = await searchBuiltinModel(builtinModel, search, 1, 30);
          setLiveOpts(res.items);
        } else if (field.relation_model_id) {
          const res = await queryRecords(field.relation_model_id, { page: 1, per_page: 30, keyword: search || undefined });
          setLiveOpts(res.items.map((r) => {
            const d = (r.data ?? r.normalized_data ?? r) as Record<string, unknown>;
            const df = field.config?.relation_display_field as string | undefined;
            return { id: Number(r.id), label: String((df && d[df]) || d['name'] || d['title'] || d['display_name'] || d['full_name'] || r.record_key || r.id) };
          }));
        }
      } catch { setLiveOpts([]); }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search, open, builtinModel, field.relation_model_id, allOptions]);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (id: number) => {
    if (isMany) {
      const next = currentIds.includes(id) ? currentIds.filter((x) => x !== id) : [...currentIds, id];
      onChange(next);
    } else {
      onChange(id);
      setOpen(false);
    }
  };

  const selectedLabels = currentIds.map((id) => {
    const o = liveOpts.find((x) => x.id === id) || allOptions.find((x) => x.id === id);
    return o ? o.label : `#${id}`;
  });

  const modelLabel = builtinModel
    ? { leads: 'lead', users: 'employee', contacts: 'contact', work: 'work item' }[builtinModel] || 'record'
    : 'record';

  return (
    <div key={field.id} ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-text-secondary">{field.display_name}</label>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="mt-1 flex w-full items-center gap-2 rounded border border-border-color bg-bg-primary px-2 py-1.5 text-left text-sm text-text-primary hover:border-accent/50"
      >
        {selectedLabels.length ? (
          <div className="flex flex-1 flex-wrap gap-1">
            {selectedLabels.map((l, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/20">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-white">{l.charAt(0).toUpperCase()}</span>
                {l}
              </span>
            ))}
          </div>
        ) : (
          <span className="flex-1 text-text-secondary">Select {modelLabel}...</span>
        )}
        <svg className="h-4 w-4 shrink-0 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-2xl">
          {/* Search */}
          <div className="relative px-2.5 py-2">
            <svg className="pointer-events-none absolute left-4.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${modelLabel}s...`}
              className="w-full rounded-lg border border-border-color bg-bg-primary py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="max-h-[200px] overflow-y-auto px-1.5 pb-1.5">
            {loading ? (
              <div className="space-y-1 px-1.5 py-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex animate-pulse items-center gap-2 rounded-lg px-2 py-2">
                    <div className="h-6 w-6 rounded-full bg-bg-secondary" />
                    <div className="h-3 flex-1 rounded bg-bg-secondary" style={{ width: `${40 + i * 12}%` }} />
                  </div>
                ))}
              </div>
            ) : liveOpts.length === 0 ? (
              <div className="py-4 text-center text-xs text-text-secondary">
                {search ? 'No results found' : 'No records available'}
              </div>
            ) : (
              liveOpts.map((o) => {
                const sel = currentIds.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      sel ? 'bg-accent/10 ring-1 ring-inset ring-accent/20' : 'hover:bg-bg-secondary/80'
                    }`}
                  >
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      sel ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary'
                    }`}>
                      {sel ? (
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      ) : o.label.charAt(0).toUpperCase()}
                    </div>
                    <span className={`truncate text-sm ${sel ? 'font-semibold text-accent' : 'text-text-primary'}`}>{o.label}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer for clear */}
          {currentIds.length > 0 && (
            <div className="border-t border-border-color px-3 py-1.5">
              <button
                type="button"
                onClick={() => { onChange(isMany ? [] : null); setOpen(false); }}
                className="text-xs text-text-secondary hover:text-error"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddRowModal({
  fields,
  addRowData,
  setAddRowData,
  onClose,
  onSave,
  saving,
}: {
  fields: DynamicField[];
  addRowData: Record<string, unknown>;
  setAddRowData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [relationOptions, setRelationOptions] = useState<Record<string, Array<{ id: number; label: string }>>>({});

  useEffect(() => {
    const relationFields = fields.filter((f) => f.field_type === 'relation' && (f.relation_model_id || f.relation_builtin_model));
    relationFields.forEach((f) => {
      const key = f.name;
      if (f.relation_builtin_model) {
        searchBuiltinModel(f.relation_builtin_model, '', 1, 100)
          .then((res) => {
            setRelationOptions((prev) => ({ ...prev, [key]: res.items }));
          })
          .catch(() => {});
      } else if (f.relation_model_id) {
        queryRecords(f.relation_model_id, { page: 1, per_page: 100 })
          .then((res) => {
            setRelationOptions((prev) => ({
              ...prev,
              [key]: res.items.map((r) => {
                const data = (r.data ?? r.normalized_data ?? r) as Record<string, unknown>;
                return {
                  id: Number(r.id),
                  label: String((f.config?.relation_display_field && data[f.config.relation_display_field as string]) || (data['name'] ?? data['title'] ?? data['display_name'] ?? data['full_name'] ?? r.record_key ?? r.id)),
                };
              }),
            }));
          })
          .catch(() => {});
      }
    });
  }, [fields]);

  const inputClass = 'mt-1 w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 max-h-[90vh] overflow-y-auto rounded-xl border border-border-color bg-card-bg p-4 shadow-xl sm:p-6">
        <h3 className="text-lg font-semibold text-text-primary">Add row</h3>
        <div className="mt-4 space-y-3">
          {fields.map((f) => {
            const value = addRowData[f.name];
            const setValue = (v: unknown) => setAddRowData((prev) => ({ ...prev, [f.name]: v }));

            if (f.field_type === 'boolean') {
              const str = value === true ? 'true' : value === false ? 'false' : '';
              return (
                <div key={f.id}>
                  <label className="block text-xs font-medium text-text-secondary">{f.display_name}</label>
                  <select
                    value={str}
                    onChange={(e) => setValue(e.target.value === '' ? null : e.target.value === 'true')}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              );
            }
            if (f.field_type === 'date') {
              const str = typeof value === 'string' && value ? value : '';
              return (
                <div key={f.id}>
                  <label className="block text-xs font-medium text-text-secondary">{f.display_name}</label>
                  <input
                    type="date"
                    value={str}
                    onChange={(e) => setValue(e.target.value || null)}
                    className={inputClass}
                  />
                </div>
              );
            }
            if (f.field_type === 'number' || f.field_type === 'currency') {
              const num = typeof value === 'number' && Number.isFinite(value) ? value : '';
              return (
                <div key={f.id}>
                  <label className="block text-xs font-medium text-text-secondary">{f.display_name}</label>
                  <input
                    type="number"
                    value={num}
                    onChange={(e) => {
                      const v = e.target.value;
                      setValue(v === '' ? null : Number(v));
                    }}
                    className={inputClass}
                  />
                </div>
              );
            }
            if (f.field_type === 'enum') {
              const options = (f.config?.options as string[]) ?? [];
              const str = typeof value === 'string' ? value : '';
              return (
                <div key={f.id}>
                  <label className="block text-xs font-medium text-text-secondary">{f.display_name}</label>
                  <select
                    value={str}
                    onChange={(e) => setValue(e.target.value || null)}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }
            if (f.field_type === 'relation' && (f.relation_model_id || f.relation_builtin_model)) {
              return (
                <AddRowRelationField
                  key={f.id}
                  field={f}
                  value={value}
                  onChange={setValue}
                  allOptions={relationOptions[f.name] ?? []}
                />
              );
            }
            if (f.field_type === 'long_text') {
              return (
                <div key={f.id}>
                  <label className="block text-xs font-medium text-text-secondary">{f.display_name}</label>
                  <textarea
                    value={String(value ?? '')}
                    onChange={(e) => setValue(e.target.value || null)}
                    rows={3}
                    className={inputClass}
                  />
                </div>
              );
            }
            if (f.field_type === 'image' || f.field_type === 'file') {
              const allowMultiple = f.config?.multiple === true || f.config?.multiple === 'true';
              const files: File[] = Array.isArray(value)
                ? (value as File[]).filter((x): x is File => x instanceof File)
                : value instanceof File
                  ? [value]
                  : [];
              const fileInputId = `add-row-file-${f.id}`;
              return (
                <div key={f.id}>
                  <label className="block text-xs font-medium text-text-secondary">{f.display_name}</label>
                  <input
                    id={fileInputId}
                    type="file"
                    multiple
                    accept={f.field_type === 'image' ? 'image/*' : undefined}
                    className="mt-1 block w-full text-sm text-text-secondary file:mr-2 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
                    onChange={(e) => {
                      const chosen = e.target.files;
                      if (!chosen?.length) return;
                      const newFiles = Array.from(chosen);
                      const list = allowMultiple ? [...files, ...newFiles] : newFiles.length > 0 ? [newFiles[0]] : [];
                      setValue(list);
                      e.target.value = '';
                    }}
                  />
                  {files.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {files.map((file, i) => (
                        <span key={i} className="rounded bg-bg-secondary px-2 py-0.5 text-xs text-text-primary">
                          {file.name}
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => setValue([])}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div key={f.id}>
                <label className="block text-xs font-medium text-text-secondary">{f.display_name}</label>
                <input
                  type="text"
                  value={String(value ?? '')}
                  onChange={(e) => setValue(e.target.value || null)}
                  className={inputClass}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-border-color px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
