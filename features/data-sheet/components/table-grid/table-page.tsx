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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState<number | null>(null);
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<number | null>(null);
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

  const refetch = useCallback(async (options?: { background?: boolean }) => {
    if (!ctx?.modelId) return;
    const background = options?.background === true;
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
      setItems(res.items);
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
  }, [ctx?.modelId, page, perPage, sort, filters, keywordDebounced]);

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
        const item = items.find((r) => Number(r.id) === recordId);
        const data = (item?.data ?? item?.normalized_data ?? {}) as Record<string, unknown>;
        await updateRecord(ctx.modelId, recordId, {
          data: { ...data, [fieldName]: value },
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
        void refetch({ background: true });
      } catch (e) {
        const msg = normalizeApiError(e).message;
        setCellErrors((prev) => ({
          ...prev,
          [String(recordId)]: { ...prev[String(recordId)], [fieldName]: msg },
        }));
        throw e;
      }
    },
    [ctx?.modelId, items, refetch]
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
        data[f.name] = parseAddRowValue(f, raw);
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
    <div className="flex h-[calc(100vh-14rem)] min-h-0 flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative flex items-center">
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
            className="w-64 rounded-lg border border-border-color bg-bg-primary py-2 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
        <button
          type="button"
          onClick={() => setFilterBuilderOpen(true)}
          className={`rounded-lg border px-4 py-2 text-sm font-medium hover:bg-bg-secondary ${
            filters.length > 0
              ? 'border-accent/60 bg-accent-soft text-accent'
              : 'border-border-color bg-card-bg text-text-secondary'
          }`}
        >
          Filters {filters.length ? `(${filters.length})` : ''}
        </button>
        <div className="relative">
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
        <div className="relative">
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
          className="rounded-lg border border-border-color bg-bg-secondary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-accent-soft"
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
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border-color bg-accent-soft px-4 py-2">
              <span className="text-sm font-medium text-text-primary">{selectedIds.size} selected</span>
              <button
                type="button"
                onClick={handleBulkDeleteClick}
                disabled={bulkDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting…' : 'Delete selected'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-secondary"
              >
                Clear selection
              </button>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm">
          <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-bg-secondary">
              <tr className="border-b border-border-color bg-bg-secondary">
                <th className="sticky left-0 z-10 w-10 border-r border-border-color bg-bg-secondary px-2 py-2.5">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="sticky left-10 z-10 min-w-[120px] border-r border-border-color bg-bg-secondary px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">
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
                    <td className="sticky left-0 z-10 w-10 border-r border-border-color bg-inherit px-2 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(recordId)}
                        onChange={() => toggleSelectOne(recordId)}
                        aria-label={`Select row ${recordId}`}
                      />
                    </td>
                    <td className="sticky left-10 z-10 border-r border-border-color bg-inherit px-4 py-2.5 text-sm text-text-secondary">
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
                          onAttachmentAdded={() => void refetch({ background: true })}
                        />
                      )
                    )}
                    <td className="bg-inherit px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => handleDeleteRowClick(recordId)}
                        className="rounded-lg px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
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
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border-color bg-card-bg px-4 py-3 text-sm text-text-secondary">
            <div className="flex items-center gap-4">
              <span>Page {page} of {totalPages || 1} · {total} total</span>
              <label className="flex items-center gap-2">
                <span>Per page</span>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
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
                className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm disabled:opacity-50 hover:bg-bg-secondary"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm disabled:opacity-50 hover:bg-bg-secondary"
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
    const relationFields = fields.filter((f) => f.field_type === 'relation' && f.relation_model_id);
    relationFields.forEach((f) => {
      const key = f.name;
      queryRecords(f.relation_model_id!, { page: 1, per_page: 100 })
        .then((res) => {
          setRelationOptions((prev) => ({
            ...prev,
            [key]: res.items.map((r) => {
              const data = (r.data ?? r.normalized_data ?? r) as Record<string, unknown>;
              return {
                id: Number(r.id),
                label: String(data['name'] ?? data['title'] ?? r.record_key ?? r.id),
              };
            }),
          }));
        })
        .catch(() => {});
    });
  }, [fields]);

  const inputClass = 'mt-1 w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 max-h-[90vh] overflow-y-auto rounded-xl border border-border-color bg-card-bg p-6 shadow-xl">
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
            if (f.field_type === 'relation' && f.relation_model_id) {
              const opts = relationOptions[f.name] ?? [];
              const isMany = f.relation_kind === 'many_to_many';
              const current = Array.isArray(value) ? value : value != null ? [value] : [];
              const currentId = isMany ? (current as number[])[0] : (value as number | null);
              return (
                <div key={f.id}>
                  <label className="block text-xs font-medium text-text-secondary">{f.display_name}</label>
                  <select
                    value={isMany ? '' : (currentId ?? '')}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      setValue(isMany ? (v ? [v] : []) : v);
                    }}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {opts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
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
