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
import { listAttachments, deleteAttachment } from '@/services/dynamic-data';
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
  const [detailRow, setDetailRow] = useState<{ id: number; data: Record<string, unknown>; recordKey: string } | null>(null);
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
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailRow({ id: recordId, data, recordKey: String(row.record_key ?? row.id) })}
                          className="min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRowClick(recordId)}
                          className="min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
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

      {detailRow && (
        <RowDetailModal
          recordId={detailRow.id}
          recordKey={detailRow.recordKey}
          data={detailRow.data}
          fields={fields}
          modelId={modelId}
          onClose={() => setDetailRow(null)}
          onSave={async (fieldName, value) => {
            await handleSaveCell(detailRow.id, fieldName, value);
            // Refresh data in detail modal
            const freshItems = items.find((r) => Number(r.id) === detailRow.id);
            if (freshItems) {
              setDetailRow((prev) => prev ? { ...prev, data: { ...prev.data, [fieldName]: value } } : null);
            }
          }}
          onDelete={() => {
            handleDeleteRowClick(detailRow.id);
            setDetailRow(null);
          }}
          onAttachmentAdded={() => void refetch({ background: true, preserveOrder: true })}
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

/* ────────────────────────────────────────────────────────────────── */
/*  Row Detail Modal — card-style view of a single record           */
/* ────────────────────────────────────────────────────────────────── */

function RowDetailModal({
  recordId,
  recordKey,
  data,
  fields,
  modelId,
  onClose,
  onSave,
  onDelete,
  onAttachmentAdded,
}: {
  recordId: number;
  recordKey: string;
  data: Record<string, unknown>;
  fields: DynamicField[];
  modelId: number | string;
  onClose: () => void;
  onSave: (fieldName: string, value: unknown) => Promise<void>;
  onDelete: () => void;
  onAttachmentAdded?: () => void;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<unknown>('');
  const [saving, setSaving] = useState(false);
  const [attachmentsByField, setAttachmentsByField] = useState<Record<number, any[]>>({});
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  const [relationLabels, setRelationLabels] = useState<Record<string, Array<{ id: number; label: string }>>>({});
  const [relationDetails, setRelationDetails] = useState<Record<string, Array<{ id: number; data: Record<string, unknown> }>>>({});
  const [createRelModal, setCreateRelModal] = useState<{ field: DynamicField; relModelId: number } | null>(null);
  const [createRelFields, setCreateRelFields] = useState<DynamicField[]>([]);
  const [createRelData, setCreateRelData] = useState<Record<string, unknown>>({});
  const [createRelSaving, setCreateRelSaving] = useState(false);

  // Load attachments for image/file fields
  useEffect(() => {
    setLoadingAttachments(true);
    listAttachments(recordId)
      .then((all: unknown) => {
        const arr = all as any[];
        const grouped: Record<number, any[]> = {};
        for (const att of arr) {
          const fid = att.field_id as number;
          if (!grouped[fid]) grouped[fid] = [];
          grouped[fid].push(att);
        }
        setAttachmentsByField(grouped);
      })
      .catch(() => {})
      .finally(() => setLoadingAttachments(false));
  }, [recordId]);

  // Load relation labels + full record data for nested view (handles single + multi IDs)
  useEffect(() => {
    const relationFields = fields.filter((f) => f.field_type === 'relation' && data[f.name] != null && data[f.name] !== '');
    if (!relationFields.length) return;
    const labels: Record<string, Array<{ id: number; label: string }>> = {};
    const details: Record<string, Array<{ id: number; data: Record<string, unknown> }>> = {};
    const promises = relationFields.map(async (f) => {
      const raw = data[f.name];
      // Normalize to array of IDs
      const ids: number[] = Array.isArray(raw)
        ? raw.map(Number)
        : String(raw).includes(',')
          ? String(raw).split(',').map((s) => Number(s.trim())).filter(Boolean)
          : [Number(raw)];
      if (!ids.length || ids.every((id) => isNaN(id))) return;
      try {
        const builtinModel = f.relation_builtin_model;
        const relModelId = f.relation_model_id;
        if (builtinModel) {
          const results = await searchBuiltinModel(builtinModel, '', 1, 200);
          labels[f.name] = ids.map((id) => {
            const match = results.items.find((r) => Number(r.id) === id);
            return { id, label: match ? String(match.label || id) : String(id) };
          });
          details[f.name] = [];
        } else if (relModelId) {
          const resp = await queryRecords(relModelId, { page: 1, per_page: 200 });
          const allItems = (resp.items || []) as Array<Record<string, unknown>>;
          const displayField = f.config?.relation_display_field as string | undefined;
          labels[f.name] = [];
          details[f.name] = [];
          for (const id of ids) {
            const match = allItems.find((r) => Number(r.id) === id);
            if (match) {
              const d = ((match.data ?? match.normalized_data ?? {}) as Record<string, unknown>);
              const lbl = String(displayField && d[displayField] ? d[displayField] : (d['name'] ?? d['title'] ?? d['display_name'] ?? (match.record_key as string) ?? id));
              labels[f.name].push({ id, label: lbl });
              details[f.name].push({ id, data: d });
            } else {
              labels[f.name].push({ id, label: String(id) });
            }
          }
        }
      } catch (err) {
        console.warn('[RowDetailModal] Failed to load relation data for field', f.name, err);
      }
    });
    void Promise.all(promises).then(() => {
      setRelationLabels(labels);
      setRelationDetails(details);
    });
  }, [fields, data]);

  const handleSave = async (fieldName: string) => {
    setSaving(true);
    try {
      await onSave(fieldName, editDraft);
      setEditingField(null);
    } catch {}
    setSaving(false);
  };

  const handleFileUpload = async (field: DynamicField, file: File) => {
    try {
      const uploaded = await uploadFileForAttachment(modelId, file);
      await bindAttachment(modelId, {
        dynamic_record_id: recordId,
        field_id: field.id,
        storage_key: uploaded.storage_key,
        original_file_name: uploaded.original_file_name,
        mime_type: uploaded.mime_type ?? undefined,
        size_bytes: uploaded.size_bytes ?? undefined,
      });
      // Refresh attachments
      const all = await listAttachments(recordId) as any[];
      const grouped: Record<number, any[]> = {};
      for (const att of all) {
        const fid = att.field_id as number;
        if (!grouped[fid]) grouped[fid] = [];
        grouped[fid].push(att);
      }
      setAttachmentsByField(grouped);
      onAttachmentAdded?.();
    } catch {}
  };

  const handleDeleteAttachment = async (attId: number) => {
    try {
      await deleteAttachment(attId);
      setAttachmentsByField((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[Number(key)] = next[Number(key)].filter((a: any) => a.id !== attId);
        }
        return next;
      });
    } catch {}
  };

  const renderFieldValue = (field: DynamicField) => {
    const value = data[field.name];
    const isImage = field.field_type === 'image';
    const isFile = field.field_type === 'file';

    // Image/File fields — show attachments
    if (isImage || isFile) {
      const atts = attachmentsByField[field.id] || [];
      if (loadingAttachments) return <span className="text-xs text-text-muted">Loading...</span>;
      return (
        <div className="space-y-2">
          {isImage && atts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {atts.map((att: any) => (
                <div key={att.id} className="group relative">
                  <a href={att.signed_url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.signed_url}
                      alt={att.original_file_name || ''}
                      className="h-24 w-24 rounded-lg border border-border-color object-cover transition hover:opacity-80"
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAttachment(att.id)}
                    className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white group-hover:flex"
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {isFile && atts.length > 0 && (
            <div className="space-y-1">
              {atts.map((att: any) => (
                <div key={att.id} className="group flex items-center gap-2 rounded-lg border border-border-color bg-bg-secondary/30 px-3 py-2">
                  <span className="text-sm">📎</span>
                  <a href={att.signed_url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm text-accent hover:underline">
                    {att.original_file_name || 'file'}
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAttachment(att.id)}
                    className="hidden text-xs text-red-500 hover:text-red-600 group-hover:block"
                  >Remove</button>
                </div>
              ))}
            </div>
          )}
          {(!atts.length || !!(field.config?.multiple)) && (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border-color px-3 py-2 text-sm text-text-secondary transition hover:border-accent hover:text-accent">
              <span>{isImage ? '📷 Add image' : '📎 Add file'}</span>
              <input type="file" accept={isImage ? 'image/*' : undefined} className="hidden"
                onChange={(e) => e.target.files?.[0] && void handleFileUpload(field, e.target.files[0])} />
            </label>
          )}
        </div>
      );
    }

    // Relation fields — show labels + nested detail cards
    if (field.field_type === 'relation') {
      const labelItems = relationLabels[field.name] || [];
      const detailItems = relationDetails[field.name] || [];
      const nestedFields = (field.config?.nested_display_fields as string[]) || [];
      const hasLabels = labelItems.length > 0;

      return (
        <div className="space-y-3">
          {/* Label pills */}
          {hasLabels ? (
            <div className="flex flex-wrap gap-1.5">
              {labelItems.map((item) => (
                <span key={item.id} className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent ring-1 ring-inset ring-accent/20">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                    {item.label.charAt(0).toUpperCase()}
                  </span>
                  {item.label}
                </span>
              ))}
            </div>
          ) : value ? (
            <span className="text-sm text-text-secondary">ID: {String(value)}</span>
          ) : (
            <span className="text-sm text-text-muted">—</span>
          )}

          {/* Nested detail cards */}
          {detailItems.length > 0 && (
            <div className="space-y-2">
              {detailItems.map((item) => {
                const fieldKeys = nestedFields.length > 0 ? nestedFields : Object.keys(item.data).slice(0, 6);
                const nonEmptyKeys = fieldKeys.filter((k) => item.data[k] != null && item.data[k] !== '');
                if (!nonEmptyKeys.length) return null;
                return (
                  <div key={item.id} className="rounded-lg border border-border-color bg-bg-secondary/20 px-4 py-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                      {nonEmptyKeys.map((key) => (
                        <div key={key} className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{key.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-text-primary truncate" title={String(item.data[key])}>{String(item.data[key])}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create new related record button */}
          {field.relation_model_id && !field.relation_builtin_model && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCreateRelModal({ field, relModelId: field.relation_model_id! });
                void import('@/features/data-sheet/api').then(({ listFields: lf }) => {
                  lf(field.relation_model_id!).then(setCreateRelFields).catch(() => {});
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent transition"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Create & link new record
            </button>
          )}
        </div>
      );
    }

    // Boolean
    if (field.field_type === 'boolean') {
      const boolVal = value === true || value === 'true' || value === 'yes' || value === 1;
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${boolVal ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
          <span className={`h-2 w-2 rounded-full ${boolVal ? 'bg-emerald-500' : 'bg-red-400'}`} />
          {boolVal ? 'Yes' : 'No'}
        </span>
      );
    }

    // Enum
    if (field.field_type === 'enum') {
      return value
        ? <span className="inline-flex rounded-full bg-bg-secondary px-3 py-1 text-sm font-medium text-text-primary">{String(value)}</span>
        : <span className="text-sm text-text-muted">—</span>;
    }

    // Long text
    if (field.field_type === 'long_text') {
      return value
        ? <p className="whitespace-pre-wrap text-sm text-text-primary leading-relaxed">{String(value)}</p>
        : <span className="text-sm text-text-muted">—</span>;
    }

    // Date
    if (field.field_type === 'date' && value) {
      try {
        return <span className="text-sm text-text-primary">{new Date(String(value)).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>;
      } catch { return <span className="text-sm text-text-primary">{String(value)}</span>; }
    }

    // Currency/number
    if ((field.field_type === 'currency' || field.field_type === 'float' || field.field_type === 'integer') && value != null && value !== '') {
      const num = Number(value);
      if (field.field_type === 'currency') {
        const currency = (field.config?.currency as string) || 'INR';
        try {
          return <span className="text-sm font-medium text-text-primary">{new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(num)}</span>;
        } catch { return <span className="text-sm font-medium text-text-primary">{String(value)}</span>; }
      }
      return <span className="text-sm text-text-primary">{num.toLocaleString()}</span>;
    }

    // Default text
    return value != null && value !== ''
      ? <span className="text-sm text-text-primary">{String(value)}</span>
      : <span className="text-sm text-text-muted">—</span>;
  };

  // Group fields by category for better layout
  const imageFields = fields.filter((f) => f.field_type === 'image');
  const fileFields = fields.filter((f) => f.field_type === 'file');
  const regularFields = fields.filter((f) => f.field_type !== 'image' && f.field_type !== 'file');

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-bg-primary shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-card-bg border-b border-border-color">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Record Details</h3>
              <p className="text-xs text-text-muted font-mono">{recordKey}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10 transition"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-text-muted hover:text-text-primary hover:bg-bg-secondary transition"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Image gallery section (if any image fields have attachments) */}
          {imageFields.length > 0 && (
            <div className="border-b border-border-color bg-bg-secondary/30 px-6 py-5">
              {imageFields.map((field) => (
                <div key={field.id}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">{field.display_name || field.name}</p>
                  {renderFieldValue(field)}
                </div>
              ))}
            </div>
          )}

          {/* Main fields — 2-column form grid */}
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
              {regularFields.map((field) => {
                const isEditing = editingField === field.name;
                const canEdit = field.is_editable;
                const value = data[field.name];
                const hasValue = value != null && value !== '';
                // Long text and relation fields span full width
                const isFullWidth = field.field_type === 'long_text' || field.field_type === 'relation';

                return (
                  <div
                    key={field.id}
                    className={`group rounded-lg px-3 py-3 transition ${isFullWidth ? 'md:col-span-2' : ''} ${isEditing ? 'bg-bg-secondary/60 ring-1 ring-accent/30' : canEdit ? 'hover:bg-bg-secondary/40 cursor-pointer' : ''}`}
                    onClick={() => {
                      if (!canEdit || isEditing) return;
                      setEditingField(field.name);
                      setEditDraft(data[field.name] ?? '');
                    }}
                  >
                    {field.field_type === 'relation' ? (
                      /* ── Relation fields: always show value + inline RelationCell for editing ── */
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                            {field.display_name || field.name}
                            {field.is_required && <span className="ml-0.5 text-red-400">*</span>}
                          </label>
                        </div>
                        <div className="rounded-lg border border-border-color overflow-hidden">
                          <RelationCell
                            value={data[field.name]}
                            field={field}
                            recordId={recordId}
                            onSave={async (newVal) => {
                              await onSave(field.name, newVal);
                            }}
                          />
                        </div>
                        {/* Nested detail cards below the picker */}
                        {(() => {
                          const detailItems = relationDetails[field.name] || [];
                          const nestedFields = (field.config?.nested_display_fields as string[]) || [];
                          if (!detailItems.length) return null;
                          return (
                            <div className="mt-2 space-y-2">
                              {detailItems.map((item) => {
                                const fieldKeys = nestedFields.length > 0 ? nestedFields : Object.keys(item.data).slice(0, 6);
                                const nonEmptyKeys = fieldKeys.filter((k) => item.data[k] != null && item.data[k] !== '');
                                if (!nonEmptyKeys.length) return null;
                                return (
                                  <div key={item.id} className="rounded-lg border border-border-color bg-bg-secondary/20 px-4 py-3">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                      {nonEmptyKeys.map((key) => (
                                        <div key={key} className="min-w-0">
                                          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{key.replace(/_/g, ' ')}</p>
                                          <p className="text-sm text-text-primary truncate" title={String(item.data[key])}>{String(item.data[key])}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        {/* Create new button */}
                        {field.relation_model_id && !field.relation_builtin_model && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCreateRelModal({ field, relModelId: field.relation_model_id! });
                              void import('@/features/data-sheet/api').then(({ listFields: lf }) => {
                                lf(field.relation_model_id!).then(setCreateRelFields).catch(() => {});
                              });
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent transition"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Create & link new record
                          </button>
                        )}
                      </div>
                    ) : isEditing ? (
                      /* ── Edit mode: stacked label + input ── */
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-text-secondary">
                          {field.display_name || field.name}
                          {field.is_required && <span className="ml-0.5 text-red-400">*</span>}
                        </label>
                        <div>
                          {field.field_type === 'long_text' ? (
                            <textarea
                              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition"
                              rows={4}
                              value={String(editDraft ?? '')}
                              onChange={(e) => setEditDraft(e.target.value)}
                              autoFocus
                            />
                          ) : field.field_type === 'boolean' ? (
                            <select
                              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:border-accent outline-none"
                              value={String(editDraft ?? '')}
                              onChange={(e) => setEditDraft(e.target.value === 'true')}
                              autoFocus
                            >
                              <option value="">—</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : field.field_type === 'enum' ? (
                            <select
                              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:border-accent outline-none"
                              value={String(editDraft ?? '')}
                              onChange={(e) => setEditDraft(e.target.value)}
                              autoFocus
                            >
                              <option value="">—</option>
                              {(field.config?.options as string[] || []).map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.field_type === 'integer' || field.field_type === 'float' || field.field_type === 'currency' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition"
                              value={String(editDraft ?? '')}
                              onChange={(e) => setEditDraft(e.target.value)}
                              autoFocus
                            />
                          )}
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingField(null); }}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-primary transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={(e) => { e.stopPropagation(); void handleSave(field.name); }}
                            className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── View mode: label on top, value below ── */
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                            {field.display_name || field.name}
                            {field.is_required && <span className="ml-0.5 text-red-400">*</span>}
                          </label>
                          {canEdit && (
                            <svg className="h-3 w-3 text-text-muted/40 opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          )}
                        </div>
                        <div className={`min-h-[24px] ${!hasValue ? 'py-0.5' : ''}`}>
                          {renderFieldValue(field)}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* File attachments section */}
          {fileFields.length > 0 && (
            <div className="border-t border-border-color px-6 py-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Attachments</p>
              <div className="space-y-3">
                {fileFields.map((field) => (
                  <div key={field.id}>
                    <p className="mb-1.5 text-xs text-text-secondary">{field.display_name || field.name}</p>
                    {renderFieldValue(field)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border-color bg-card-bg px-6 py-3 flex items-center justify-between">
          <p className="text-[10px] text-text-muted">
            ID: {recordId}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-color bg-bg-primary px-4 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Create related record modal */}
      {createRelModal && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setCreateRelModal(null)} aria-hidden />
          <div
            className="fixed left-1/2 top-1/2 z-[70] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 max-h-[80vh] overflow-y-auto rounded-xl border border-border-color bg-card-bg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-text-primary mb-4">Create new linked record</h3>
            <div className="space-y-3">
              {createRelFields
                .filter((f) => f.field_type !== 'relation' && f.is_editable)
                .map((f) => (
                  <div key={f.id}>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      {f.display_name}{f.is_required && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                    {f.field_type === 'long_text' ? (
                      <textarea
                        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                        rows={3}
                        value={String(createRelData[f.name] ?? '')}
                        onChange={(e) => setCreateRelData((prev) => ({ ...prev, [f.name]: e.target.value }))}
                      />
                    ) : f.field_type === 'boolean' ? (
                      <select
                        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                        value={String(createRelData[f.name] ?? '')}
                        onChange={(e) => setCreateRelData((prev) => ({ ...prev, [f.name]: e.target.value === 'true' }))}
                      >
                        <option value="">—</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : f.field_type === 'enum' ? (
                      <select
                        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                        value={String(createRelData[f.name] ?? '')}
                        onChange={(e) => setCreateRelData((prev) => ({ ...prev, [f.name]: e.target.value }))}
                      >
                        <option value="">—</option>
                        {((f.config?.options as string[]) || []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.field_type === 'integer' || f.field_type === 'float' || f.field_type === 'currency' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                        value={String(createRelData[f.name] ?? '')}
                        onChange={(e) => setCreateRelData((prev) => ({ ...prev, [f.name]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setCreateRelModal(null); setCreateRelData({}); setCreateRelFields([]); }}
                className="rounded-lg border border-border-color px-4 py-2 text-sm text-text-secondary hover:bg-bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createRelSaving}
                onClick={async () => {
                  if (!createRelModal) return;
                  setCreateRelSaving(true);
                  try {
                    const newRec = await createRecord(createRelModal.relModelId, createRelData);
                    const newId = (newRec as any).id;
                    await onSave(createRelModal.field.name, newId);
                    setCreateRelModal(null);
                    setCreateRelData({});
                    setCreateRelFields([]);
                  } catch {}
                  setCreateRelSaving(false);
                }}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {createRelSaving ? 'Creating...' : 'Create & Link'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
