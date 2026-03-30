'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from '@/lib/use-debounce';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { DataSheetCell } from '@/components/data-sheet/data-sheet-cell';
import { RelationCell } from '@/components/data-sheet/relation-cell';
import { ReverseRelationSubTable } from '@/components/data-sheet/reverse-relation-subtable';
import { ChevronDown, ChevronRight, Layers, Plus } from 'lucide-react';
import { CreateChildDatasheetModal } from '@/components/data-sheet/create-child-datasheet-modal';
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
import { listAttachments, deleteAttachment, createView } from '@/services/dynamic-data';
import { searchBuiltinModel, getReverseRelations } from '@/services/dynamic-data';
import type { ReverseRelationMeta } from '@/services/dynamic-data';
import type { QueryFilter } from '@/components/data-sheet/data-sheet-filter-builder';
import { normalizeApiError } from '@/features/data-sheet/api/normalize-error';
import { queryParamsFromSearchParams } from '@/features/data-sheet/state/query-params';
import {
  getStoredViewState,
  setStoredViewState,
  lockViewPersist,
  unlockViewPersist,
  type ViewMode,
  type CardViewConfig,
  type ListViewConfig,
  type CalendarViewConfig,
  type KanbanViewConfig,
} from '@/features/data-sheet/state/view-state';
import { CardView } from '@/features/data-sheet/components/card-view';
import { ListView } from '@/features/data-sheet/components/list-view';
import CalendarView from '@/features/data-sheet/components/calendar-view';
import KanbanView from '@/features/data-sheet/components/kanban-view';
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
  const debouncedSearch = useDebounce(keyword, 300);
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
  const [views, setViews] = useState<Array<{ id: number; name: string; config: Record<string, unknown>; is_default?: boolean }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState<number | null>(null);
  const [confirmBulkDeleteOpen, setConfirmBulkDeleteOpen] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<number | null>(null);
  const [detailRow, setDetailRow] = useState<{ id: number; data: Record<string, unknown>; recordKey: string } | null>(null);
  const [scrollHintDismissed, setScrollHintDismissed] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const hasLoadedOnceRef = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Expandable sub-table rows ──
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [tableReverseRelations, setTableReverseRelations] = useState<ReverseRelationMeta[]>([]);

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cardConfig, setCardConfig] = useState<CardViewConfig>({ cardFields: null, gridCols: 3 });
  const [listConfig, setListConfig] = useState<ListViewConfig>({ titleField: null, detailFields: null });
  const [calendarConfig, setCalendarConfig] = useState<CalendarViewConfig>({ dateField: null, pillFields: null });
  const [kanbanConfig, setKanbanConfig] = useState<KanbanViewConfig>({ groupByField: null, cardFields: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'columns' | 'views' | 'display'>('columns');

  // Load view: backend default takes priority, then localStorage, then built-in table default.
  // Lock persists during load so the persist effect can't write 'table' to localStorage before backend responds.
  useEffect(() => {
    if (!ctx?.modelId) return;
    const mid = ctx.modelId;
    lockViewPersist(mid);

    function applyLocalStorage() {
      const stored = getStoredViewState(mid);
      if (stored) {
        if (stored.viewMode) setViewMode(stored.viewMode);
        if (stored.cardConfig) setCardConfig(stored.cardConfig);
        if (stored.listConfig) setListConfig(stored.listConfig);
        if (stored.calendarConfig) setCalendarConfig(stored.calendarConfig);
        if (stored.kanbanConfig) setKanbanConfig(stored.kanbanConfig);
      }
    }

    listViews(mid)
      .then((list) => {
        setViews(list.map((v) => ({ id: v.id, name: v.name, config: v.config ?? {}, is_default: v.is_default })));
        const defaultView = list.find((v) => v.is_default);
        if (defaultView?.config) {
          applyView(defaultView.config);
        } else {
          applyLocalStorage();
        }
        unlockViewPersist(mid);
      })
      .catch(() => {
        applyLocalStorage();
        unlockViewPersist(mid);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.modelId]);

  // Load reverse relation metadata (which child models point to this one)
  useEffect(() => {
    if (!ctx?.modelId) return;
    let cancelled = false;
    getReverseRelations(ctx.modelId)
      .then((metas) => { if (!cancelled) setTableReverseRelations(metas); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ctx?.modelId]);

  // Persist view mode changes (lock mechanism in view-state.ts prevents writes during initial load)
  const persistViewState = useCallback(() => {
    if (!ctx?.modelId) return;
    setStoredViewState(ctx.modelId, {
      visibleColumns,
      sort,
      filters,
      keyword,
      viewMode,
      cardConfig,
      listConfig,
      calendarConfig,
      kanbanConfig,
    });
  }, [ctx?.modelId, visibleColumns, sort, filters, keyword, viewMode, cardConfig, listConfig, calendarConfig, kanbanConfig]);

  useEffect(() => {
    persistViewState();
  }, [persistViewState]);

  // Sync URL -> state once on mount / URL change
  useEffect(() => {
    const q = queryParamsFromSearchParams(new URLSearchParams(searchParams?.toString() ?? ''));
    setPage(q.page);
    setPerPage(q.per_page);
    setSort(q.sort);
    setFilters(q.filters);
    setKeyword(q.keyword);
  }, [searchParams]);

  const refetch = useCallback(
    async (options?: { background?: boolean; preserveOrder?: boolean; append?: boolean }) => {
      if (!ctx?.modelId) return;
      const background = options?.background === true;
      const preserveOrder = options?.preserveOrder === true;
      const append = options?.append === true;
      if (!background && !append) {
        setLoading(true);
      }
      if (append) setLoadingMore(true);
      setError(null);
      try {
        const res = await queryRecords(ctx.modelId, {
          page,
          per_page: perPage,
          sort: sort.map((s) => ({ field: s.field, direction: s.direction || 'asc' })),
          filters,
          keyword: debouncedSearch || undefined,
        });
        if (append) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((r) => Number(r.id)));
            const newItems = res.items.filter((r) => !existingIds.has(Number(r.id)));
            return [...prev, ...newItems];
          });
        } else if (preserveOrder) {
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
        if (!append) {
          setItems([]);
          setTotal(0);
          setTotalPages(0);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [ctx?.modelId, page, perPage, sort, filters, debouncedSearch]
  );

  const handleLoadMore = useCallback(() => {
    if (page < totalPages && !loadingMore) {
      setPage((p) => p + 1);
    }
  }, [page, totalPages, loadingMore]);

  // When page changes beyond 1, append instead of replace
  const prevPageRef = useRef(1);
  useEffect(() => {
    if (page > 1 && page > prevPageRef.current) {
      void refetch({ append: true });
    }
    prevPageRef.current = page;
  }, [page]);

  useEffect(() => {
    // Only auto-fetch on page 1 or when filters/sort/keyword change (not on page increment for load-more)
    if (page === 1 || !hasLoadedOnceRef.current) {
      const background = hasLoadedOnceRef.current;
      refetch({ background }).then(() => {
        hasLoadedOnceRef.current = true;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.modelId, sort, filters, debouncedSearch]);

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
      setViews(list.map((v) => ({ id: v.id, name: v.name, config: v.config ?? {}, is_default: v.is_default })));
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
    if (config.filters) setFilters((config.filters as QueryFilter[]) ?? []);
    if (config.sort) setSort((config.sort as SortRule[]) ?? []);
    if (config.viewMode) setViewMode(config.viewMode as ViewMode);
    if (config.visibleColumns) {
      const cols = config.visibleColumns as string[];
      setVisibleColumns(Array.isArray(cols) && cols.length > 0 ? new Set(cols) : null);
    }
    if (config.cardConfig) setCardConfig(config.cardConfig as CardViewConfig);
    if (config.listConfig) setListConfig(config.listConfig as ListViewConfig);
    if (config.calendarConfig) setCalendarConfig(config.calendarConfig as CalendarViewConfig);
    if (config.kanbanConfig) setKanbanConfig(config.kanbanConfig as KanbanViewConfig);
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

      {/* ── Clean Toolbar ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {/* Search */}
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
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            className="w-full min-w-0 rounded-lg border border-border-color bg-bg-primary py-2 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:w-56"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => { setKeyword(''); setPage(1); }}
              className="absolute right-2 rounded p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              aria-label="Clear search"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Total records badge */}
        {total > 0 && (
          <span className="hidden sm:inline-flex items-center rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] font-medium text-text-secondary">
            {total} record{total !== 1 ? 's' : ''}
          </span>
        )}

        {/* Filter */}
        <button
          type="button"
          onClick={() => setFilterBuilderOpen(true)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            filters.length > 0
              ? 'border-accent/60 bg-accent-soft text-accent'
              : 'border-border-color bg-card-bg text-text-secondary hover:bg-bg-secondary'
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>
          <span className="hidden sm:inline">Filter</span>
          {filters.length > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">{filters.length}</span>
          )}
        </button>

        {/* Reports */}
        <Link
          href={`/data-sheet/${ctx.modelId}/reports`}
          className="flex items-center gap-1.5 rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" /></svg>
          <span className="hidden sm:inline">Reports</span>
        </Link>

        {/* Import */}
        <Link
          href={`/data-sheet/${ctx.modelId}/import`}
          className="flex items-center gap-1.5 rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
          <span className="hidden sm:inline">Import</span>
        </Link>

        {/* Settings — navigates to /data-sheet/{id}/settings */}
        <Link
          href={`/data-sheet/${ctx.modelId}/settings`}
          className="flex items-center gap-1.5 rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">Settings</span>
        </Link>

        {/* Add Record */}
        <button
          type="button"
          onClick={() => setAddRowOpen(true)}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          <span className="hidden sm:inline">Add {(() => {
            const name = ctx?.model?.display_name || 'Row';
            if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
            if (name.endsWith('ses') || name.endsWith('xes') || name.endsWith('zes')) return name.slice(0, -2);
            if (name.endsWith('s') && !name.endsWith('ss')) return name.slice(0, -1);
            return name;
          })()}</span>
        </button>

        {/* View Mode Switcher + View Settings gear */}
        <div className="ml-auto flex items-center gap-1">
          <div className="flex items-center rounded-lg border border-border-color bg-card-bg p-0.5">
            {(['table', 'card', 'list', 'calendar', 'kanban'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                }`}
                title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
              >
                {mode === 'table' && <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h-7.5m8.625 0h7.5m-8.625 0c.621 0 1.125.504 1.125 1.125" /></svg>}
                {mode === 'card' && <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>}
                {mode === 'list' && <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>}
                {mode === 'calendar' && <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" /></svg>}
                {mode === 'kanban' && <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" /></svg>}
                <span className="hidden sm:inline">{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
              </button>
            ))}
          </div>
          {/* View settings gear (columns, saved views, display) */}
          <button
            type="button"
            onClick={() => { setSettingsOpen(true); void loadViews(); }}
            className={`rounded-lg p-2 transition-colors ${settingsOpen ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}`}
            title="View settings"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
          </button>
        </div>
      </div>

      <DataSheetFilterBuilder
        fields={fields}
        filters={filters}
        onChange={setFilters}
        onApply={refetch}
        open={filterBuilderOpen}
        onClose={() => setFilterBuilderOpen(false)}
        reverseRelations={tableReverseRelations}
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

          {/* ── View Mode Content ── */}
          {viewMode === 'table' && (
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
                    No records yet. Click the button above to add your first entry.
                  </td>
                </tr>
              ) : items.map((row) => {
                const recordId = Number(row.id);
                const data = (row.data ?? row.normalized_data ?? {}) as Record<string, unknown>;
                const rowErrors = cellErrors[String(recordId)] ?? {};
                const isExpanded = expandedRows.has(recordId);
                const hasChildren = tableReverseRelations.length > 0;
                return (
                  <React.Fragment key={recordId}>
                  <tr className="border-b border-border-color last:border-b-0 even:bg-bg-primary/50 hover:bg-bg-secondary/60">
                    <td className="w-11 min-w-[44px] border-r border-border-color bg-inherit px-2 py-2.5">
                      <div className="flex items-center gap-1">
                        {hasChildren && (
                          <button
                            type="button"
                            className="rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors"
                            onClick={() =>
                              setExpandedRows((prev) => {
                                const next = new Set(prev);
                                if (next.has(recordId)) next.delete(recordId);
                                else next.add(recordId);
                                return next;
                              })
                            }
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                        <input
                          type="checkbox"
                          checked={selectedIds.has(recordId)}
                          onChange={() => toggleSelectOne(recordId)}
                          aria-label={`Select row ${recordId}`}
                        />
                      </div>
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
                  {/* ── Expandable sub-table row ── */}
                  {isExpanded && hasChildren && (
                    <tr className="bg-gradient-to-b from-bg-secondary/40 to-bg-secondary/10">
                      <td colSpan={visibleFields.length + 3} className="px-4 py-3 sm:px-6">
                        <div className="space-y-1">
                          {tableReverseRelations.map((rel) => (
                            <ReverseRelationSubTable
                              key={`${rel.source_model_id}-${rel.field_id}`}
                              parentModelId={modelId}
                              parentRecordId={recordId}
                              reverseRelation={rel}
                              onRecordCreated={() => void refetch({ background: true, preserveOrder: true })}
                              onRecordDeleted={() => void refetch({ background: true, preserveOrder: true })}
                              compact={true}
                              maxVisibleRows={3}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
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
          </div>
          )}

          {viewMode === 'card' && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CardView
                items={items}
                fields={fields}
                config={cardConfig}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelectOne}
                onViewDetail={(row) => setDetailRow(row)}
                onDeleteRow={handleDeleteRowClick}
              />
            </div>
          )}

          {viewMode === 'list' && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ListView
                items={items}
                fields={fields}
                config={listConfig}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelectOne}
                onViewDetail={(row) => setDetailRow(row)}
                onDeleteRow={handleDeleteRowClick}
              />
            </div>
          )}

          {viewMode === 'calendar' && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CalendarView
                items={items}
                fields={fields}
                config={calendarConfig}
                onViewDetail={(row) => setDetailRow(row)}
                onConfigChange={setCalendarConfig}
              />
            </div>
          )}

          {viewMode === 'kanban' && (
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
              <KanbanView
                items={items}
                fields={fields}
                config={kanbanConfig}
                onViewDetail={(row) => setDetailRow(row)}
                onFieldValueChange={handleSaveCell}
                onConfigChange={setKanbanConfig}
              />
            </div>
          )}

          {/* Load More */}
          {items.length > 0 && items.length < total && (
            <div className="flex shrink-0 items-center justify-center py-3">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-lg border border-border-color bg-card-bg px-6 py-2 text-xs font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary disabled:opacity-50 transition-colors"
              >
                {loadingMore ? 'Loading…' : `Load more (${items.length}/${total})`}
              </button>
            </div>
          )}
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
          modelDisplayName={ctx?.model?.display_name}
        />
      )}

      {detailRow && (
        <RowDetailModal
          recordId={detailRow.id}
          recordKey={detailRow.recordKey}
          data={detailRow.data}
          fields={fields}
          modelId={modelId}
          modelName={ctx?.model?.name}
          modelDisplayName={ctx?.model?.display_name}
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

      {/* Unified Settings Modal */}
      {settingsOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSettingsOpen(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 max-h-[85vh] flex flex-col rounded-xl border border-border-color bg-card-bg shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-color px-5 py-3">
              <h3 className="text-sm font-semibold text-text-primary">View Settings</h3>
              <button type="button" onClick={() => setSettingsOpen(false)} className="rounded p-1 text-text-secondary hover:bg-bg-secondary">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 border-b border-border-color px-5">
              {([['columns', 'Columns'], ['views', 'Saved Views'], ['display', 'Display']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSettingsTab(key)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    settingsTab === key
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Columns Tab */}
              {settingsTab === 'columns' && (
                <div className="space-y-1">
                  <p className="mb-2 text-xs text-text-secondary">Toggle which columns are visible in table view</p>
                  {searchableFields.map((f) => (
                    <label key={f.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-bg-secondary cursor-pointer">
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
                      <span className="ml-auto text-[10px] text-text-secondary">{f.field_type}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Saved Views Tab */}
              {settingsTab === 'views' && (
                <div className="space-y-3">
                  {/* Save Current View */}
                  <div className="rounded-lg border border-border-color bg-bg-secondary/50 p-3">
                    <p className="text-xs font-semibold text-text-primary mb-2">Save Current View</p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const nameInput = form.elements.namedItem('viewName') as HTMLInputElement;
                        const isDefault = (form.elements.namedItem('isDefault') as HTMLInputElement)?.checked ?? false;
                        const name = nameInput?.value?.trim();
                        if (!name || !ctx?.modelId) return;
                        try {
                          await createView(ctx.modelId, {
                            name,
                            config: {
                              viewMode,
                              filters,
                              sort,
                              visibleColumns: visibleColumns ? Array.from(visibleColumns) : null,
                              cardConfig,
                              listConfig,
                              calendarConfig,
                              kanbanConfig,
                            },
                            is_default: isDefault,
                          });
                          nameInput.value = '';
                          await loadViews();
                        } catch { /* ignore */ }
                      }}
                      className="flex flex-col gap-2"
                    >
                      <input
                        name="viewName"
                        type="text"
                        placeholder="View name (e.g. Kanban by Status)"
                        className="w-full rounded-md border border-border-color bg-card-bg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent"
                        required
                        minLength={1}
                        maxLength={128}
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                          <input name="isDefault" type="checkbox" className="rounded border-border-color" />
                          Set as default view
                        </label>
                        <button
                          type="submit"
                          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Existing Saved Views */}
                  <div>
                    <p className="mb-2 text-xs text-text-secondary">
                      {views.length === 0 ? 'No saved views yet. Save your current view above.' : 'Click a view to apply it.'}
                    </p>
                    {views.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => { applyView(v.config); setSettingsOpen(false); }}
                        className="flex w-full items-center gap-2 rounded-lg border border-border-color px-3 py-2.5 text-left text-sm text-text-primary hover:bg-bg-secondary transition-colors mb-1.5"
                      >
                        <svg className="h-4 w-4 shrink-0 text-text-secondary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="flex-1 truncate">{v.name}</span>
                        {v.is_default && (
                          <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">Default</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Display Tab — view-specific config */}
              {settingsTab === 'display' && (
                <div className="space-y-5">
                  {/* Card config */}
                  <div>
                    <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">Card View</h4>
                    <div className="mt-2">
                      <label className="text-xs text-text-secondary">Grid columns</label>
                      <div className="mt-1 flex gap-2">
                        {([2, 3, 4] as const).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setCardConfig((c) => ({ ...c, gridCols: n }))}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                              cardConfig.gridCols === n
                                ? 'border-accent bg-accent/10 text-accent'
                                : 'border-border-color text-text-secondary hover:bg-bg-secondary'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="text-xs text-text-secondary">Card fields</label>
                      <div className="mt-1 max-h-[140px] space-y-0.5 overflow-y-auto">
                        {fields.filter((f) => !['image', 'file'].includes(f.field_type)).map((f) => (
                          <label key={f.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-bg-secondary cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cardConfig.cardFields ? cardConfig.cardFields.includes(f.name) : fields.filter((x) => !['image', 'file', 'relation'].includes(x.field_type)).slice(0, 4).some((x) => x.name === f.name)}
                              onChange={(e) => {
                                const current = cardConfig.cardFields ?? fields.filter((x) => !['image', 'file', 'relation'].includes(x.field_type)).slice(0, 4).map((x) => x.name);
                                const next = e.target.checked ? [...current, f.name] : current.filter((n) => n !== f.name);
                                setCardConfig((c) => ({ ...c, cardFields: next }));
                              }}
                            />
                            <span className="text-xs text-text-primary">{f.display_name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border-color" />

                  {/* List config */}
                  <div>
                    <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">List View</h4>
                    <div className="mt-2">
                      <label className="text-xs text-text-secondary">Title field</label>
                      <select
                        value={listConfig.titleField ?? ''}
                        onChange={(e) => setListConfig((c) => ({ ...c, titleField: e.target.value || null }))}
                        className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary"
                      >
                        <option value="">Auto (first text field)</option>
                        {fields.filter((f) => ['text', 'number', 'currency', 'enum', 'date'].includes(f.field_type)).map((f) => (
                          <option key={f.id} value={f.name}>{f.display_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-3">
                      <label className="text-xs text-text-secondary">Detail fields</label>
                      <div className="mt-1 max-h-[140px] space-y-0.5 overflow-y-auto">
                        {fields.filter((f) => !['image', 'file'].includes(f.field_type)).map((f) => (
                          <label key={f.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-bg-secondary cursor-pointer">
                            <input
                              type="checkbox"
                              checked={listConfig.detailFields ? listConfig.detailFields.includes(f.name) : fields.filter((x) => !['image', 'file'].includes(x.field_type)).slice(0, 3).some((x) => x.name === f.name)}
                              onChange={(e) => {
                                const current = listConfig.detailFields ?? fields.filter((x) => !['image', 'file'].includes(x.field_type)).slice(0, 3).map((x) => x.name);
                                const next = e.target.checked ? [...current, f.name] : current.filter((n) => n !== f.name);
                                setListConfig((c) => ({ ...c, detailFields: next }));
                              }}
                            />
                            <span className="text-xs text-text-primary">{f.display_name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
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
  modelDisplayName,
}: {
  fields: DynamicField[];
  addRowData: Record<string, unknown>;
  setAddRowData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  modelDisplayName?: string;
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
        <h3 className="text-lg font-semibold text-text-primary">
          {modelDisplayName ? `Add ${modelDisplayName.endsWith('ies') ? modelDisplayName.slice(0, -3) + 'y' : modelDisplayName.endsWith('s') && !modelDisplayName.endsWith('ss') ? modelDisplayName.slice(0, -1) : modelDisplayName}` : 'Add row'}
        </h3>
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
  modelName,
  modelDisplayName,
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
  modelName?: string;
  modelDisplayName?: string;
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

  // ── Reverse relations (child records that link TO this record) ──
  const [reverseRelations, setReverseRelations] = useState<ReverseRelationMeta[]>([]);
  const [childSheetModal, setChildSheetModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getReverseRelations(modelId)
      .then((metas) => {
        if (!cancelled) setReverseRelations(metas);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [modelId]);

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

          {/* ── Reverse Relations: inline sub-tables for child records ── */}
          {reverseRelations.length > 0 && (
            <div className="border-t border-border-color pt-4 px-6 pb-4">
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-accent" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Related Records
                </h3>
                <span className="text-[10px] text-text-muted/60">
                  ({reverseRelations.length} linked {reverseRelations.length === 1 ? 'model' : 'models'})
                </span>
              </div>
              {reverseRelations.map((rel) => (
                <ReverseRelationSubTable
                  key={`${rel.source_model_id}-${rel.field_id}`}
                  parentModelId={modelId}
                  parentRecordId={recordId}
                  reverseRelation={rel}
                  onRecordCreated={() => {}}
                  onRecordDeleted={() => {}}
                  compact={false}
                />
              ))}

              {/* Create new child datasheet button */}
              <button
                type="button"
                onClick={() => setChildSheetModal(true)}
                className="mt-2 w-full rounded-lg border-2 border-dashed border-border-color py-2.5 text-xs font-medium text-text-muted hover:border-primary/30 hover:text-primary transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Create New Child Datasheet
              </button>
            </div>
          )}

          {/* No reverse relations yet — still offer to create child */}
          {reverseRelations.length === 0 && (
            <div className="border-t border-border-color pt-4 px-6 pb-4">
              <button
                type="button"
                onClick={() => setChildSheetModal(true)}
                className="w-full rounded-lg border-2 border-dashed border-border-color py-4 text-xs text-text-muted hover:border-primary/30 hover:text-primary transition-colors flex flex-col items-center gap-1"
              >
                <Layers className="h-5 w-5 mb-1" />
                <span className="font-medium">+ Create Child Datasheet</span>
                <span className="text-[10px]">Add sub-tables like visits, orders, notes</span>
              </button>
            </div>
          )}

          {/* Child datasheet creation modal */}
          {childSheetModal && modelName && (
            <CreateChildDatasheetModal
              parentModelId={Number(modelId)}
              parentModelName={modelName}
              parentDisplayName={modelDisplayName || modelName}
              onClose={() => setChildSheetModal(false)}
              onSuccess={() => {
                setChildSheetModal(false);
                // Refresh reverse relations
                getReverseRelations(modelId)
                  .then(setReverseRelations)
                  .catch(() => {});
              }}
            />
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
