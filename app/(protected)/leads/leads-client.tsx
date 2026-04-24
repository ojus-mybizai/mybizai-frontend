'use client';

import { Suspense, useCallback, useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CustomerFilters } from '@/components/customers/customer-filters';
import { AIStatusBadge } from '@/components/customers/ai-status-badge';
import { CreateLeadModal } from '@/components/customers/create-lead-modal';
import { LeadFieldConfigPanel } from '@/components/customers/lead-field-config-panel';
import { useShallow } from 'zustand/react/shallow';
import { useCustomerStore } from '@/lib/customer-store';
import { useLeadStats, useEmployeeList } from '@/lib/hooks/use-reference-data';
import type { CustomerFilters as CustomerFiltersType } from '@/services/customers';
import { listLeadFields, getVisibleFields, type LeadFieldConfig } from '@/services/lead-fields';
import {
  bulkLeadAction, exportLeadsCSV, type BulkActionPayload, type Customer, type LeadTag,
  patchLead, patchAssign, moveLeadToStage as moveStageApi,
  listLeadTags, createLeadTag, assignTagToLead, unassignTagFromLead,
  listSavedViews, createSavedView, deleteSavedView, type SavedViewRecord,
} from '@/services/customers';
import dynamic from 'next/dynamic';
const LeadAnalyticsDashboard = dynamic(
  () => import('@/components/customers/lead-analytics-dashboard').then(m => m.LeadAnalyticsDashboard),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-bg-secondary rounded-lg" /> }
);
import { LeadPipelineBoard } from '@/components/leads/lead-pipeline-board';
import { LeadSidebarPanel } from '@/components/leads/lead-sidebar-panel';
import { PipelineEditorModal } from '@/components/leads/pipeline-editor-modal';
import { listPipelineStages, moveLeadToStage, type LeadPipelineStage } from '@/services/customers';

const DEFAULT_PAGE_SIZE = 25;

// ─── Types ────────────────────────────────────────────────────────────────────

type SortBy = 'created_at' | 'updated_at' | 'name' | 'priority' | 'pipeline_stage_id';
type FiltersWithSort = CustomerFiltersType & { page: number; perPage: number; sort_by: SortBy; sort_dir: 'asc' | 'desc' };
type SavedView = { id?: number; name: string; filters: Partial<FiltersWithSort> };

const SMART_VIEWS: SavedView[] = [
  { name: 'High Priority', filters: { priority: 'high' } },
  { name: 'Unassigned',    filters: { assignedFilter: 'unassigned' as const } },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initialFiltersFromSearchParams(searchParams: ReturnType<typeof useSearchParams>): FiltersWithSort {
  const assignedToId = searchParams.get('assigned_to_id');
  const channelIdParam = searchParams.get('channel_id');
  let base: FiltersWithSort = { page: 1, perPage: DEFAULT_PAGE_SIZE, sort_by: 'created_at', sort_dir: 'desc' };
  if (assignedToId) {
    const id = parseInt(assignedToId, 10);
    if (!Number.isNaN(id)) base = { ...base, assignedToId: id, assignedFilter: 'all' as const };
  }
  if (channelIdParam) {
    const channelId = parseInt(channelIdParam, 10);
    if (!Number.isNaN(channelId)) base = { ...base, channelId };
  }
  return base;
}

function formatLastActivity(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatShortDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function channelTypeLabel(channelType: string): string {
  if (channelType === 'whatsapp') return 'WhatsApp';
  if (channelType === 'instagram') return 'Instagram';
  if (channelType === 'messenger') return 'Messenger';
  return channelType;
}

/** Returns days since the date, or null if invalid. */
function staleDays(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

// ─── Source badge colors ──────────────────────────────────────────────────────
const SOURCE_BADGE: Record<string, { bg: string; text: string }> = {
  whatsapp:    { bg: 'bg-green-100 dark:bg-green-900/40',   text: 'text-green-800 dark:text-green-300' },
  instagram:   { bg: 'bg-pink-100 dark:bg-pink-900/40',    text: 'text-pink-800 dark:text-pink-300' },
  messenger:   { bg: 'bg-blue-100 dark:bg-blue-900/40',    text: 'text-blue-800 dark:text-blue-300' },
  facebook:    { bg: 'bg-blue-100 dark:bg-blue-900/40',    text: 'text-blue-800 dark:text-blue-300' },
  website:     { bg: 'bg-indigo-100 dark:bg-indigo-900/40',text: 'text-indigo-800 dark:text-indigo-300' },
  referral:    { bg: 'bg-purple-100 dark:bg-purple-900/40',text: 'text-purple-800 dark:text-purple-300' },
  sms:         { bg: 'bg-amber-100 dark:bg-amber-900/40',  text: 'text-amber-800 dark:text-amber-300' },
  import:      { bg: 'bg-sky-100 dark:bg-sky-900/40',      text: 'text-sky-800 dark:text-sky-300' },
  manual:      { bg: 'bg-gray-100 dark:bg-gray-700/40',    text: 'text-gray-700 dark:text-gray-300' },
  'walk-in':   { bg: 'bg-teal-100 dark:bg-teal-900/40',   text: 'text-teal-800 dark:text-teal-300' },
  ad_campaign: { bg: 'bg-orange-100 dark:bg-orange-900/40',text: 'text-orange-800 dark:text-orange-300' },
};
function sourceBadgeCls(key: string | undefined | null): string {
  const k = (key ?? '').toLowerCase();
  const c = SOURCE_BADGE[k] ?? { bg: 'bg-gray-100 dark:bg-gray-700/40', text: 'text-gray-700 dark:text-gray-300' };
  return `${c.bg} ${c.text}`;
}

// ─── Sort header component ────────────────────────────────────────────────────

function SortTh({
  col, label, current, dir, onSort, className = '',
}: {
  col: SortBy; label: string; current: SortBy; dir: 'asc' | 'desc';
  onSort: (col: SortBy) => void; className?: string;
}) {
  const active = current === col;
  return (
    <th
      className={`px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary cursor-pointer select-none whitespace-nowrap hover:text-text-primary transition-colors ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-25'}`}>
          {active && dir === 'asc' ? '↑' : '↓'}
        </span>
      </span>
    </th>
  );
}

// ─── CSV export helper ────────────────────────────────────────────────────────

function downloadCSV(rows: Customer[], filename: string) {
  const headers = ['ID', 'Name', 'Company', 'Phone', 'Email', 'Stage', 'Priority', 'Score', 'Source', 'Created', 'Last Activity'];
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.id,
        `"${(r.name ?? '').replace(/"/g, '""')}"`,
        `"${(r.company ?? '').replace(/"/g, '""')}"`,
        r.phone ?? '',
        r.email ?? '',
        `"${(r.pipelineStageName ?? '').replace(/"/g, '""')}"`,
        r.priority ?? '',
        r.leadScore ?? '',
        r.source ?? '',
        r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
        r.lastActivity ? new Date(r.lastActivity).toLocaleDateString() : '',
      ].join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main component ───────────────────────────────────────────────────────────

function CustomersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilters = useMemo(() => initialFiltersFromSearchParams(searchParams), [searchParams]);
  const { customers, list, listAppend, total, loadingList, deleteLead } = useCustomerStore(
    useShallow((s) => ({
      customers: s.customers,
      list: s.list,
      listAppend: s.listAppend,
      total: s.total,
      loadingList: s.loadingList,
      deleteLead: s.deleteLead,
    }))
  );

  const [pageView, setPageView] = useState<'list' | 'pipeline' | 'analytics'>('list');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Only fetch lead stats when on analytics tab
  const { data: leadStats } = useLeadStats({ enabled: pageView === 'analytics' });
  // Employee list for owner assignment (cached, stale 10 min)
  const { data: employees = [] } = useEmployeeList();

  const [filters, setFilters] = useState<FiltersWithSort>(initialFilters);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<LeadPipelineStage[]>([]);
  const [pipelineEditorOpen, setPipelineEditorOpen] = useState(false);
  const [closedFilter, setClosedFilter] = useState<'all' | 'open' | 'closed'>('all');
  const menuRef = useRef<HTMLDivElement>(null);
  const [fieldConfigs, setFieldConfigs] = useState<LeadFieldConfig[]>([]);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const isLoadMoreRef = useRef(false);

  // ── Inline editing ──────────────────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<{ leadId: string; field: 'stage' | 'priority' | 'owner' } | null>(null);
  const [inlineSaving, setInlineSaving] = useState<string | null>(null); // "leadId:field"
  const inlineRef = useRef<HTMLDivElement>(null);

  // ── Tags ──────────────────────────────────────────────────────────────────────
  const [allTags, setAllTags] = useState<LeadTag[]>([]);
  const [tagPopoverLeadId, setTagPopoverLeadId] = useState<string | null>(null);
  const [tagSearchInput, setTagSearchInput] = useState('');
  const [tagSaving, setTagSaving] = useState(false);
  const tagPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listLeadTags().then(setAllTags).catch(() => {});
  }, []);

  useEffect(() => {
    if (!tagPopoverLeadId) return;
    const handler = (e: MouseEvent) => {
      if (tagPopoverRef.current && !tagPopoverRef.current.contains(e.target as Node)) {
        setTagPopoverLeadId(null);
        setTagSearchInput('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tagPopoverLeadId]);

  const handleTagToggle = useCallback(async (leadId: string, tag: LeadTag, isAssigned: boolean) => {
    setTagSaving(true);
    try {
      if (isAssigned) await unassignTagFromLead(leadId, tag.id);
      else await assignTagToLead(leadId, tag.id);
      void list(filters);
    } finally {
      setTagSaving(false);
    }
  }, [filters, list]);

  const handleCreateAndAssignTag = useCallback(async (leadId: string, name: string) => {
    if (!name.trim()) return;
    setTagSaving(true);
    try {
      const newTag = await createLeadTag(name.trim());
      setAllTags((prev) => [...prev, newTag]);
      await assignTagToLead(leadId, newTag.id);
      void list(filters);
      setTagSearchInput('');
    } finally {
      setTagSaving(false);
    }
  }, [filters, list]);

  // ── Saved / smart filter views ───────────────────────────────────────────────
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewName, setActiveViewName] = useState<string | null>(null);
  const [savingViewInput, setSavingViewInput] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  useEffect(() => {
    listSavedViews()
      .then((rows: SavedViewRecord[]) =>
        setSavedViews(rows.map((r) => ({ id: r.id, name: r.name, filters: r.filters as Partial<FiltersWithSort> })))
      )
      .catch(() => {});
  }, []);

  // ── Bulk selection ───────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  // Bulk dropdowns
  const [bulkStageOpen, setBulkStageOpen] = useState(false);
  const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false);
  const bulkToolbarRef = useRef<HTMLDivElement>(null);

  // Custom fields
  const customColumns = useMemo(
    () => getVisibleFields(fieldConfigs).filter((f) => !f.is_system && f.field_type !== 'relation'),
    [fieldConfigs]
  );
  const relationColumns = useMemo(
    () => getVisibleFields(fieldConfigs).filter((f) => f.field_type === 'relation' && !f.is_system),
    [fieldConfigs]
  );

  useEffect(() => {
    listLeadFields().then(setFieldConfigs).catch(() => {});
  }, [showFieldConfig]);

  useEffect(() => {
    listPipelineStages().then(setPipelineStages).catch(() => {});
  }, []);

  // Close action menus on outside click
  useEffect(() => {
    if (openMenuId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  // Close inline edit popover on outside click
  useEffect(() => {
    if (!editingCell) return;
    const handler = (e: MouseEvent) => {
      if (inlineRef.current && !inlineRef.current.contains(e.target as Node)) setEditingCell(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingCell]);

  // Close bulk dropdowns on outside click
  useEffect(() => {
    if (!bulkStageOpen && !bulkPriorityOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (bulkToolbarRef.current && !bulkToolbarRef.current.contains(e.target as Node)) {
        setBulkStageOpen(false);
        setBulkPriorityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [bulkStageOpen, bulkPriorityOpen]);

  // Sync URL search params → filters
  useEffect(() => {
    setFilters((prev) => {
      const next = initialFiltersFromSearchParams(searchParams);
      if (
        next.assignedToId !== prev.assignedToId ||
        next.assignedFilter !== prev.assignedFilter ||
        next.channelId !== prev.channelId
      )
        return { ...prev, ...next };
      return prev;
    });
  }, [searchParams]);

  // Fetch leads on filter / sort change
  useEffect(() => {
    if (isLoadMoreRef.current) {
      isLoadMoreRef.current = false;
      return;
    }
    void list(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Clear selection when list changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (closedFilter === 'open') return customers.filter((c) => !c.pipeline_stage_type || c.pipeline_stage_type === 'open');
    if (closedFilter === 'closed') return customers.filter((c) => c.pipeline_stage_type === 'won' || c.pipeline_stage_type === 'lost');
    return customers;
  }, [customers, closedFilter]);

  const isEmpty = !loadingList && filteredCustomers.length === 0;
  const allPageSelected = filteredCustomers.length > 0 && filteredCustomers.every((c) => selectedIds.has(c.id));

  const segmentParts: string[] = [];
  if (filters.pipelineStageId) segmentParts.push('Pipeline stage filter');
  if (filters.priority) segmentParts.push(`Priority: ${filters.priority}`);
  if (filters.source) segmentParts.push(`Source: ${filters.source.replace('_', ' ')}`);
  if (filters.channelId != null) segmentParts.push('Channel filter');
  if (filters.assignedFilter === 'me') segmentParts.push('Assigned: me');
  if (filters.assignedFilter === 'unassigned') segmentParts.push('Unassigned');
  const segmentSummary = segmentParts.length > 0 ? segmentParts.join(' · ') : null;

  const hasMore = customers.length < total;

  const handleLoadMore = () => {
    const nextPage = (filters.page || 1) + 1;
    const nextFilters = { ...filters, page: nextPage };
    isLoadMoreRef.current = true;
    setFilters(nextFilters);
    void listAppend(nextFilters);
  };

  const applyFilters = (next: Partial<CustomerFiltersType>) => {
    setActiveViewName(null);
    setFilters((f) => ({ ...f, ...next, page: 1 }));
  };

  const resetFilters = () => {
    setActiveViewName(null);
    setClosedFilter('all');
    setFilters({ page: 1, perPage: DEFAULT_PAGE_SIZE, sort_by: 'created_at', sort_dir: 'desc' });
  };

  const handleSort = useCallback((col: SortBy) => {
    setFilters((f) => ({
      ...f,
      page: 1,
      sort_by: col,
      sort_dir: f.sort_by === col && f.sort_dir === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const applyView = useCallback((view: SavedView) => {
    setActiveViewName(view.name);
    setFilters((f) => ({ ...f, ...view.filters, page: 1 }));
  }, []);

  const saveCurrentView = useCallback(async () => {
    const trimmed = newViewName.trim();
    if (!trimmed) return;
    const viewFilters = {
      priority: filters.priority,
      assignedFilter: filters.assignedFilter,
      assignedToId: filters.assignedToId,
      pipelineStageId: filters.pipelineStageId,
      source: filters.source,
      channelId: filters.channelId,
      sort_by: filters.sort_by,
      sort_dir: filters.sort_dir,
    };
    try {
      const record = await createSavedView(trimmed, viewFilters as Record<string, unknown>);
      const view: SavedView = { id: record.id, name: record.name, filters: record.filters as Partial<FiltersWithSort> };
      setSavedViews((prev) => [...prev.filter((v) => v.name !== trimmed), view]);
      setActiveViewName(trimmed);
    } catch {
      // silently ignore — user sees no change
    }
    setNewViewName('');
    setSavingViewInput(false);
  }, [filters, newViewName]);

  const deleteView = useCallback(async (name: string, id?: number) => {
    if (id != null) {
      try { await deleteSavedView(id); } catch { /* ignore */ }
    }
    setSavedViews((prev) => prev.filter((v) => v.name !== name));
    if (activeViewName === name) setActiveViewName(null);
  }, [activeViewName]);

  const activeFilterCount = [
    filters.search,
    filters.priority,
    filters.source,
    filters.channelId,
    filters.assignedFilter && filters.assignedFilter !== 'all' ? filters.assignedFilter : undefined,
  ].filter(Boolean).length;

  // ── Selection helpers ────────────────────────────────────────────────────────
  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allPageSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCustomers.map((c) => c.id)));
    }
  };

  // ── Inline edit handler ───────────────────────────────────────────────────────
  const handleInlineEdit = useCallback(async (
    leadId: string,
    field: 'stage' | 'priority' | 'owner',
    value: number | string | null,
  ) => {
    setEditingCell(null);
    const key = `${leadId}:${field}`;
    setInlineSaving(key);
    try {
      if (field === 'stage') await moveStageApi(leadId, value as number);
      else if (field === 'priority') await patchLead(leadId, { priority: value as 'low' | 'medium' | 'high' });
      else if (field === 'owner') await patchAssign(leadId, value as number | null);
      void list(filters);
    } catch {
      // list refresh will revert to server state
    } finally {
      setInlineSaving(null);
    }
  }, [filters, list]);

  // ── Bulk action handler ───────────────────────────────────────────────────────
  const handleBulkAction = async (payload: Omit<BulkActionPayload, 'lead_ids'>) => {
    const ids = Array.from(selectedIds).map(Number);
    if (!ids.length) return;
    setBulkLoading(true);
    setBulkStageOpen(false);
    setBulkPriorityOpen(false);
    try {
      await bulkLeadAction({ lead_ids: ids, ...payload });
      setSelectedIds(new Set());
      void list(filters);
    } catch (err) {
      alert('Bulk action failed. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    await handleBulkAction({ action: 'delete' });
  };

  // ── Export ────────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExportLoading(true);
    try {
      let rows;
      if (selectedIds.size > 0) {
        rows = filteredCustomers.filter((c) => selectedIds.has(c.id));
      } else {
        rows = await exportLeadsCSV(filters);
      }
      downloadCSV(rows, `leads-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <>
      <div className="flex w-full flex-col h-[calc(100vh-4rem)] gap-4">
        {/* Header */}
        <div className="shrink-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-text-primary sm:text-2xl tracking-tight">Leads</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/lead-templates"
              className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
            >
              Templates
            </Link>
            <button
              type="button"
              onClick={() => setShowFieldConfig(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Columns
            </button>
            <Link
              href="/leads/import"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Import
            </Link>
            <button
              type="button"
              onClick={handleExport}
              disabled={exportLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors disabled:opacity-50"
              title="Export leads as CSV"
            >
              {exportLoading ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              Export
            </button>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New Lead
            </button>
          </div>
        </div>

        {/* View toggle + Open/Closed quick-filter */}
        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border-color overflow-hidden text-sm font-medium">
            {(['list', 'pipeline', 'analytics'] as const).map((v, i) => {
              const icons = [
                <path key="l" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />,
                <path key="p" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />,
                <path key="a" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
              ];
              const labels = ['List', 'Pipeline', 'Analytics'];
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPageView(v)}
                  className={`px-4 py-2 transition-colors flex items-center gap-1.5 ${i > 0 ? 'border-l border-border-color' : ''} ${pageView === v ? 'bg-accent text-white' : 'bg-card-bg text-text-secondary hover:text-text-primary'}`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icons[i]}</svg>
                  {labels[i]}
                </button>
              );
            })}
          </div>

          {pageView === 'list' && (
            <div className="flex gap-1">
              {(['all', 'open', 'closed'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setClosedFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    closedFilter === f
                      ? f === 'open' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                        : f === 'closed' ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        : 'bg-accent/10 text-accent'
                      : 'border border-border-color text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline view */}
        {pageView === 'pipeline' && (
          <>
            <LeadPipelineBoard
              leads={customers}
              stages={pipelineStages}
              onMoveStage={async (leadId, stageId) => {
                await moveLeadToStage(leadId, stageId);
                void listPipelineStages().then(setPipelineStages);
                void list(filters);
              }}
              onLeadClick={(leadId) => setSelectedLeadId(String(leadId))}
              onEditPipeline={() => setPipelineEditorOpen(true)}
            />
            <PipelineEditorModal
              isOpen={pipelineEditorOpen}
              onClose={() => setPipelineEditorOpen(false)}
              stages={pipelineStages}
              onSave={() => {
                void listPipelineStages().then(setPipelineStages);
                setPipelineEditorOpen(false);
              }}
            />
          </>
        )}

        {/* Analytics view */}
        {pageView === 'analytics' && (
          <div className="flex-1 min-h-0">
            <LeadAnalyticsDashboard />
          </div>
        )}

        {/* List view */}
        {pageView === 'list' && (
          <>
            {/* Toolbar: search + filter button + saved views */}
            <div className="shrink-0 space-y-2">
              {/* Row 1: search + filter button */}
              <div className="flex items-center gap-2">
                {/* Search input — always visible */}
                <div className="relative flex-1 max-w-sm">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search leads…"
                    value={filters.search ?? ''}
                    onChange={(e) => applyFilters({ search: e.target.value || undefined })}
                    className="w-full rounded-lg border border-border-color bg-card-bg pl-9 pr-3 py-2 text-sm text-text-primary placeholder-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
                  />
                </div>

                {/* Filter button */}
                <button
                  type="button"
                  onClick={() => setFilterDrawerOpen(true)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                    activeFilterCount > 0
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border-color bg-card-bg text-text-primary hover:bg-bg-secondary'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                  </svg>
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-accent text-white text-xs font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Row 2: saved views */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider pr-1">Views:</span>
                {/* Smart views */}
                {SMART_VIEWS.map((v) => (
                  <button key={v.name} type="button" onClick={() => applyView(v)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all ${
                      activeViewName === v.name
                        ? 'border-accent bg-accent text-white shadow-sm'
                        : 'border-border-color bg-card-bg text-text-primary hover:border-accent/60 hover:bg-bg-secondary'
                    }`}>
                    {v.name}
                  </button>
                ))}
                {/* User-saved views */}
                {savedViews.map((v) => (
                  <span key={v.name} className="inline-flex items-center rounded-lg border border-border-color overflow-hidden">
                    <button type="button" onClick={() => applyView(v)}
                      className={`px-3 py-1.5 text-sm font-semibold transition-all ${
                        activeViewName === v.name
                          ? 'bg-accent text-white'
                          : 'bg-card-bg text-text-primary hover:bg-bg-secondary'
                      }`}>
                      {v.name}
                    </button>
                    <button type="button" onClick={() => deleteView(v.name, v.id)}
                      className={`px-2 py-1.5 transition-colors border-l border-border-color ${
                        activeViewName === v.name ? 'bg-accent/90 text-white/80 hover:text-white' : 'bg-card-bg text-text-secondary hover:text-red-500 hover:bg-bg-secondary'
                      }`}
                      title={`Remove "${v.name}"`}>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                {/* Save view input or button */}
                {savingViewInput ? (
                  <form className="inline-flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); saveCurrentView(); }}>
                    <input autoFocus value={newViewName} onChange={(e) => setNewViewName(e.target.value)}
                      placeholder="View name…"
                      className="rounded-lg border border-accent/60 bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/40 w-36"
                      onKeyDown={(e) => { if (e.key === 'Escape') { setSavingViewInput(false); setNewViewName(''); } }} />
                    <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Save</button>
                    <button type="button" onClick={() => { setSavingViewInput(false); setNewViewName(''); }} className="rounded-lg border border-border-color px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary">✕</button>
                  </form>
                ) : (
                  <button type="button" onClick={() => setSavingViewInput(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border-color px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-accent hover:border-accent transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Save view
                  </button>
                )}
                {activeViewName && (
                  <button type="button" onClick={resetFilters}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-text-secondary hover:text-accent transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    Clear
                  </button>
                )}
              </div>

              {/* Active filter chips — shown when filters are applied */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {filters.priority && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border-color bg-card-bg px-2.5 py-1 text-xs font-semibold text-text-primary">
                      Priority: {filters.priority}
                      <button onClick={() => applyFilters({ priority: undefined })} className="ml-0.5 text-text-secondary hover:text-red-500"><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </span>
                  )}
                  {filters.source && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border-color bg-card-bg px-2.5 py-1 text-xs font-semibold text-text-primary">
                      Source: {filters.source}
                      <button onClick={() => applyFilters({ source: undefined })} className="ml-0.5 text-text-secondary hover:text-red-500"><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </span>
                  )}
                  {filters.assignedFilter && filters.assignedFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border-color bg-card-bg px-2.5 py-1 text-xs font-semibold text-text-primary">
                      {filters.assignedFilter === 'unassigned' ? 'Unassigned' : 'Assigned to me'}
                      <button onClick={() => applyFilters({ assignedFilter: undefined, assignedToId: undefined })} className="ml-0.5 text-text-secondary hover:text-red-500"><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </span>
                  )}
                  <button onClick={() => { applyFilters({ priority: undefined, source: undefined, assignedFilter: undefined, assignedToId: undefined, channelId: undefined }); }} className="text-xs text-text-secondary hover:text-red-500 underline underline-offset-2">Clear all</button>
                </div>
              )}
            </div>

            {/* Segment summary */}
            {!loadingList && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary shrink-0 px-1">
                <span className="font-semibold text-text-primary">
                  {filteredCustomers.length} {filteredCustomers.length === 1 ? 'lead' : 'leads'}
                </span>
                {total > filteredCustomers.length && (
                  <span className="text-text-secondary">of {total} total</span>
                )}
                {segmentSummary && (
                  <>
                    <span className="text-border-color" aria-hidden>·</span>
                    <span className="text-accent font-medium">{segmentSummary}</span>
                  </>
                )}
                {closedFilter !== 'all' && (
                  <>
                    <span className="text-border-color" aria-hidden>·</span>
                    <span className="capitalize font-medium text-text-primary">{closedFilter} only</span>
                  </>
                )}
              </div>
            )}

            {loadingList && customers.length === 0 && (
              <div className="flex items-center gap-2 px-1 text-sm text-text-secondary">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading leads…
              </div>
            )}

            {isEmpty && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-color bg-card-bg px-6 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-bg-secondary">
                  <svg className="h-6 w-6 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="mb-1 text-sm font-semibold text-text-primary">No leads found</p>
                <p className="mb-4 text-xs text-text-secondary max-w-xs">
                  {segmentSummary || closedFilter !== 'all'
                    ? 'No leads match your current filters.'
                    : 'Leads are created automatically from incoming messages, or you can add one manually.'}
                </p>
                {(segmentSummary || closedFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-lg border border-border-color px-4 py-2 text-xs font-semibold text-text-primary hover:bg-bg-secondary transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {!isEmpty && (
              <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm flex flex-col">
                <div className="flex-1 min-h-0 overflow-auto">
                  <table className="min-w-full divide-y divide-border-color">
                    <thead className="bg-bg-secondary sticky top-0 z-10">
                      <tr>
                        {/* Checkbox */}
                        <th className="w-10 px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={allPageSelected}
                            onChange={toggleAll}
                            className="h-4 w-4 rounded border-border-color text-accent accent-accent cursor-pointer"
                            title={allPageSelected ? 'Deselect all' : 'Select all on page'}
                          />
                        </th>
                        <SortTh col="name" label="Lead" current={filters.sort_by} dir={filters.sort_dir} onSort={handleSort} />
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Contact</th>
                        <SortTh col="pipeline_stage_id" label="Stage" current={filters.sort_by} dir={filters.sort_dir} onSort={handleSort} />
                        <SortTh col="priority" label="Priority" current={filters.sort_by} dir={filters.sort_dir} onSort={handleSort} />
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Score</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Source</th>
                        {customColumns.map((f) => (
                          <th key={f.id} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                            {f.display_name}
                          </th>
                        ))}
                        {relationColumns.map((f) => {
                          const cfg = f.config as Record<string, unknown> | undefined;
                          const dsName = cfg?.datasheet_name as string | undefined;
                          return (
                            <th key={f.id} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                              {dsName ?? f.display_name}
                            </th>
                          );
                        })}
                        <SortTh col="updated_at" label="Activity" current={filters.sort_by} dir={filters.sort_dir} onSort={handleSort} className="whitespace-nowrap" />
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">Owner</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Mode</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color">
                      {filteredCustomers.map((c) => {
                        const days = staleDays(c.lastActivity);
                        const isStale = days !== null && days >= 7;
                        const isVeryStale = days !== null && days >= 14;
                        const isSelected = selectedIds.has(c.id);

                        return (
                          <tr
                            key={c.id}
                            className={`group hover:bg-bg-secondary/50 cursor-pointer transition-colors ${isSelected ? 'bg-accent/5' : ''}`}
                            onClick={() => setSelectedLeadId(c.id)}
                          >
                            {/* Checkbox */}
                            <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleRow(c.id)}
                                className="h-4 w-4 rounded border-border-color text-accent accent-accent cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-text-primary">{c.name || 'Unknown'}</span>
                                {c.expectedValue != null && c.expectedValue > 0 && (
                                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 whitespace-nowrap">
                                    ₹{c.expectedValue >= 1000 ? `${(c.expectedValue / 1000).toFixed(1)}k` : c.expectedValue}
                                  </span>
                                )}
                                {c.expectedCloseDate && (() => {
                                  const daysLeft = Math.ceil((new Date(c.expectedCloseDate).getTime() - Date.now()) / 86_400_000);
                                  if (daysLeft < 0) return <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">Overdue</span>;
                                  if (daysLeft <= 7) return <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{daysLeft}d</span>;
                                  return null;
                                })()}
                              </div>
                              {c.company && (
                                <div className="mt-0.5 text-xs text-text-secondary truncate max-w-[180px]">{c.company}</div>
                              )}
                              {c.lastMessagePreview && c.lastMessagePreview !== '—' && (
                                <div className="mt-0.5 line-clamp-1 text-xs text-text-secondary">{c.lastMessagePreview}</div>
                              )}
                              {c.createdAt && (
                                <div className="mt-0.5 text-xs text-text-secondary whitespace-nowrap">{formatShortDate(c.createdAt)}</div>
                              )}
                              {/* Tags */}
                              <div className="mt-1 flex flex-wrap items-center gap-1 relative" onClick={(e) => e.stopPropagation()}>
                                {(c.tags ?? []).map((t) => (
                                  <span
                                    key={t.id}
                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{ backgroundColor: (t.color ?? '#6366f1') + '20', color: t.color ?? '#6366f1', border: `1px solid ${t.color ?? '#6366f1'}40` }}
                                    onClick={() => setTagPopoverLeadId(tagPopoverLeadId === c.id ? null : c.id)}
                                  >
                                    {t.name}
                                  </span>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => { setTagPopoverLeadId(tagPopoverLeadId === c.id ? null : c.id); setTagSearchInput(''); }}
                                  className="inline-flex items-center justify-center h-4 w-4 rounded-full border border-dashed border-border-color text-text-secondary hover:border-accent hover:text-accent transition-colors text-xs"
                                  title="Add tag"
                                >+</button>
                                {tagPopoverLeadId === c.id && (
                                  <div
                                    ref={tagPopoverRef}
                                    className="absolute top-full left-0 z-40 mt-1 w-52 rounded-xl border border-border-color bg-card-bg py-2 shadow-xl"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      autoFocus
                                      value={tagSearchInput}
                                      onChange={(e) => setTagSearchInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && tagSearchInput.trim() && !allTags.some(t => t.name.toLowerCase() === tagSearchInput.trim().toLowerCase())) {
                                          void handleCreateAndAssignTag(c.id, tagSearchInput);
                                        }
                                      }}
                                      placeholder="Search or create tag…"
                                      className="mx-2 mb-1.5 w-[calc(100%-16px)] rounded-lg border border-border-color bg-bg-primary px-2.5 py-1.5 text-xs text-text-primary outline-none focus:ring-1 focus:ring-accent"
                                    />
                                    <div className="max-h-40 overflow-y-auto">
                                      {allTags
                                        .filter((t) => !tagSearchInput || t.name.toLowerCase().includes(tagSearchInput.toLowerCase()))
                                        .map((t) => {
                                          const isAssigned = (c.tags ?? []).some((ct) => ct.id === t.id);
                                          return (
                                            <button
                                              key={t.id}
                                              type="button"
                                              disabled={tagSaving}
                                              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-bg-secondary transition-colors ${isAssigned ? 'opacity-60' : ''}`}
                                              onClick={() => void handleTagToggle(c.id, t, isAssigned)}
                                            >
                                              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color ?? '#6366f1' }} />
                                              <span className="flex-1 truncate">{t.name}</span>
                                              {isAssigned && <svg className="h-3 w-3 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
                                            </button>
                                          );
                                        })}
                                      {tagSearchInput.trim() && !allTags.some(t => t.name.toLowerCase() === tagSearchInput.trim().toLowerCase()) && (
                                        <button
                                          type="button"
                                          disabled={tagSaving}
                                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-accent hover:bg-bg-secondary"
                                          onClick={() => void handleCreateAndAssignTag(c.id, tagSearchInput)}
                                        >
                                          <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                                          Create "{tagSearchInput.trim()}"
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-text-primary">{c.phone || '—'}</div>
                              {c.email && (
                                <div className="mt-0.5 text-xs text-text-secondary truncate max-w-[160px]">{c.email}</div>
                              )}
                            </td>
                            {/* Stage — inline editable */}
                            <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                              <div className="relative" ref={editingCell?.leadId === c.id && editingCell?.field === 'stage' ? inlineRef : undefined}>
                                {inlineSaving === `${c.id}:stage` ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                    Saving…
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setEditingCell({ leadId: c.id, field: 'stage' })}
                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold hover:ring-2 hover:ring-accent/30 transition-all cursor-pointer"
                                    style={c.pipelineStageColor ? { backgroundColor: c.pipelineStageColor + '20', color: c.pipelineStageColor } : undefined}
                                    title="Click to change stage"
                                  >
                                    {c.pipelineStageName ?? <span className="text-text-secondary font-normal">Set stage</span>}
                                    <svg className="h-3 w-3 opacity-50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                                  </button>
                                )}
                                {editingCell?.leadId === c.id && editingCell?.field === 'stage' && (
                                  <div className="absolute top-full left-0 z-30 mt-1 min-w-[160px] rounded-xl border border-border-color bg-card-bg py-1 shadow-xl">
                                    {pipelineStages.map((s) => (
                                      <button
                                        key={s.id}
                                        type="button"
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-secondary ${c.pipelineStageId === s.id ? 'font-semibold text-accent' : 'text-text-primary'}`}
                                        onClick={() => handleInlineEdit(c.id, 'stage', s.id)}
                                      >
                                        {s.color && <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />}
                                        {s.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            {/* Priority — inline editable */}
                            <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                              <div className="relative" ref={editingCell?.leadId === c.id && editingCell?.field === 'priority' ? inlineRef : undefined}>
                                {inlineSaving === `${c.id}:priority` ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                    Saving…
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setEditingCell({ leadId: c.id, field: 'priority' })}
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold hover:ring-2 hover:ring-accent/30 transition-all cursor-pointer ${
                                      c.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                                      c.priority === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                                      c.priority === 'low' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300' :
                                      'text-text-secondary font-normal'
                                    }`}
                                    title="Click to change priority"
                                  >
                                    {c.priority ? c.priority.charAt(0).toUpperCase() + c.priority.slice(1) : <span className="font-normal">Set</span>}
                                    <svg className="h-3 w-3 opacity-50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                                  </button>
                                )}
                                {editingCell?.leadId === c.id && editingCell?.field === 'priority' && (
                                  <div className="absolute top-full left-0 z-30 mt-1 min-w-[130px] rounded-xl border border-border-color bg-card-bg py-1 shadow-xl">
                                    {(['high', 'medium', 'low'] as const).map((p) => (
                                      <button
                                        key={p}
                                        type="button"
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-secondary ${c.priority === p ? 'font-semibold text-accent' : 'text-text-primary'}`}
                                        onClick={() => handleInlineEdit(c.id, 'priority', p)}
                                      >
                                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${p === 'high' ? 'bg-red-500' : p === 'medium' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                                        {p.charAt(0).toUpperCase() + p.slice(1)}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {c.leadScore != null ? (
                                <div className="flex items-center gap-2 min-w-[72px]">
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-secondary flex-shrink-0">
                                    <div
                                      className={`h-full rounded-full ${c.leadScore >= 71 ? 'bg-emerald-500' : c.leadScore >= 31 ? 'bg-amber-500' : 'bg-red-400'}`}
                                      style={{ width: `${Math.min(100, Math.max(4, c.leadScore))}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-bold tabular-nums ${
                                    c.leadScore >= 71 ? 'text-emerald-600 dark:text-emerald-400' :
                                    c.leadScore >= 31 ? 'text-amber-600 dark:text-amber-400' :
                                    'text-text-secondary'
                                  }`}>{Math.round(c.leadScore)}</span>
                                </div>
                              ) : (
                                <span className="text-sm text-text-secondary">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {c.linkedChannels && c.linkedChannels.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {c.linkedChannels.map((lc) => (
                                    <span
                                      key={`${lc.channel_id}-${lc.channel_identifier}`}
                                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sourceBadgeCls(lc.channel_type)}`}
                                    >
                                      {channelTypeLabel(lc.channel_type)}
                                    </span>
                                  ))}
                                </div>
                              ) : c.source ? (
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sourceBadgeCls(c.source)}`}>
                                  {c.source.replace(/_/g, ' ')}
                                </span>
                              ) : (
                                <span className="text-sm text-text-secondary">—</span>
                              )}
                            </td>
                            {/* Custom field cells */}
                            {customColumns.map((f) => (
                              <td key={f.id} className="px-4 py-3 text-sm text-text-primary whitespace-nowrap">
                                <DynamicCell field={f} value={c.custom_fields?.[f.field_key]} />
                              </td>
                            ))}
                            {/* Relation count cells */}
                            {relationColumns.map((f) => {
                              const cfg = f.config as Record<string, unknown> | undefined;
                              const target = cfg?.target as string ?? 'work';
                              const summaryKey = target === 'datasheet' && cfg?.datasheet_id
                                ? `datasheet_${cfg.datasheet_id}` : target;
                              const count = c.relations_summary?.[summaryKey] ?? 0;
                              return (
                                <td key={f.id} className="px-4 py-3">
                                  {count > 0 ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">{count}</span>
                                  ) : (
                                    <span className="text-text-secondary text-sm">—</span>
                                  )}
                                </td>
                              );
                            })}
                            {/* Activity + stale indicator + overdue follow-up */}
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                              {c.lastHumanContactAt && (
                                <div className="flex items-center gap-1 text-xs text-text-secondary" title="Last human contact">
                                  <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                                  {formatLastActivity(c.lastHumanContactAt)}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-text-secondary">{formatLastActivity(c.lastActivity)}</span>
                                {isVeryStale && (
                                  <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300" title={`No activity in ${days} days`}>
                                    {days}d
                                  </span>
                                )}
                                {isStale && !isVeryStale && (
                                  <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" title={`No activity in ${days} days`}>
                                    {days}d
                                  </span>
                                )}
                                {(c.overdueFollowupCount ?? 0) > 0 && (
                                  <span
                                    className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                    title={`${c.overdueFollowupCount} overdue follow-up${(c.overdueFollowupCount ?? 0) > 1 ? 's' : ''}`}
                                  >
                                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                    {c.overdueFollowupCount}
                                  </span>
                                )}
                                {c.nurtureStatus === 'active' && (
                                  <span
                                    title={`Nurturing: ${c.nurtureSequenceName ?? ''} (Step ${c.nurtureStep})`}
                                    className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent"
                                  >
                                    <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8l5 4-3 4z"/></svg>
                                    Nurturing
                                  </span>
                                )}
                                {c.nurtureStatus === 'paused' && (
                                  <span
                                    title={`Nurture paused: ${c.nurtureSequenceName ?? ''}`}
                                    className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-600 dark:bg-orange-900/40 dark:text-orange-300"
                                  >
                                    ⏸ Paused
                                  </span>
                                )}
                              </div>
                              </div>
                            </td>
                            {/* Owner — inline editable */}
                            <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                              <div className="relative" ref={editingCell?.leadId === c.id && editingCell?.field === 'owner' ? inlineRef : undefined}>
                                {inlineSaving === `${c.id}:owner` ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                    Saving…
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setEditingCell({ leadId: c.id, field: 'owner' })}
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold hover:ring-2 hover:ring-accent/30 transition-all cursor-pointer max-w-[140px] ${
                                      c.assignedToId
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                        : 'text-text-secondary font-normal'
                                    }`}
                                    title="Click to reassign"
                                  >
                                    <span className="truncate">
                                      {employees.find((e) => e.user_id === c.assignedToId)?.name ?? '—'}
                                    </span>
                                    <svg className="h-3 w-3 opacity-50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                                  </button>
                                )}
                                {editingCell?.leadId === c.id && editingCell?.field === 'owner' && (
                                  <div className="absolute top-full left-0 z-30 mt-1 min-w-[160px] rounded-xl border border-border-color bg-card-bg py-1 shadow-xl">
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-secondary text-text-secondary"
                                      onClick={() => handleInlineEdit(c.id, 'owner', null)}
                                    >
                                      <span className="h-2 w-2 rounded-full bg-gray-300 flex-shrink-0" />
                                      Unassign
                                    </button>
                                    {employees.map((emp) => (
                                      <button
                                        key={emp.user_id}
                                        type="button"
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-secondary ${c.assignedToId === emp.user_id ? 'font-semibold text-accent' : 'text-text-primary'}`}
                                        onClick={() => handleInlineEdit(c.id, 'owner', emp.user_id)}
                                      >
                                        <span className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
                                        {emp.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <AIStatusBadge mode={c.aiActive ? 'ai' : 'manual'} />
                            </td>
                            <td className="relative px-4 py-3 text-right">
                              <div className="relative flex items-center justify-end gap-1" ref={openMenuId === c.id ? menuRef : undefined}>
                                {/* Quick hover actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    title="Open lead"
                                    onClick={(e) => { e.stopPropagation(); setSelectedLeadId(c.id); }}
                                    className="rounded-md border border-border-color bg-bg-primary p-1.5 text-text-secondary hover:text-accent hover:border-accent transition-colors"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                  </button>
                                  {c.latestConversationId ? (
                                    <button
                                      type="button"
                                      title="Open conversation"
                                      onClick={(e) => { e.stopPropagation(); router.push(`/conversations/${c.latestConversationId}`); }}
                                      className="rounded-md border border-border-color bg-bg-primary p-1.5 text-text-secondary hover:text-accent hover:border-accent transition-colors"
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    title="Set owner"
                                    onClick={(e) => { e.stopPropagation(); setEditingCell({ leadId: c.id, field: 'owner' }); }}
                                    className="rounded-md border border-border-color bg-bg-primary p-1.5 text-text-secondary hover:text-accent hover:border-accent transition-colors"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setOpenMenuId((prev) => (prev === c.id ? null : c.id)); }}
                                  className="rounded-lg border border-border-color bg-bg-primary p-1.5 text-text-secondary hover:border-accent hover:text-text-primary transition-colors"
                                  aria-expanded={openMenuId === c.id}
                                >
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                  </svg>
                                </button>
                                {openMenuId === c.id && (
                                  <div className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-xl border border-border-color bg-card-bg py-1 shadow-xl" role="menu">
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setSelectedLeadId(c.id); }}
                                    >
                                      <svg className="h-3.5 w-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                      View & Edit
                                    </button>
                                    {c.latestConversationId ? (
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); router.push(`/conversations/${c.latestConversationId}`); }}
                                      >
                                        <svg className="h-3.5 w-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                        Conversation
                                      </button>
                                    ) : (
                                      <span className="flex items-center gap-2.5 w-full px-4 py-2 text-left text-sm text-text-secondary cursor-default">
                                        <svg className="h-3.5 w-3.5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                        No conversation
                                      </span>
                                    )}
                                    <div className="my-1 border-t border-border-color" />
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-red-600 hover:bg-bg-secondary dark:text-red-400"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(null);
                                        if (!confirm('Delete this lead? This cannot be undone.')) return;
                                        try {
                                          await deleteLead(c.id);
                                          if (selectedLeadId === c.id) setSelectedLeadId(null);
                                        } catch {
                                          alert('Failed to delete lead. Please try again.');
                                        }
                                      }}
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="shrink-0 border-t border-border-color px-4 py-3 text-center">
                    <button
                      type="button"
                      disabled={loadingList}
                      onClick={handleLoadMore}
                      className="inline-flex items-center gap-2 rounded-lg border border-border-color bg-bg-primary px-5 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-50 transition-colors"
                    >
                      {loadingList ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Loading…
                        </>
                      ) : (
                        <>Load more ({total - customers.length} remaining)</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Bulk action toolbar ─────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && pageView === 'list' && (
        <div
          ref={bulkToolbarRef}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl border border-border-color bg-card-bg px-4 py-3 shadow-2xl"
        >
          {/* Count */}
          <span className="text-sm font-semibold text-text-primary whitespace-nowrap">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-border-color mx-1" />

          {/* Change Stage */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setBulkStageOpen((o) => !o); setBulkPriorityOpen(false); }}
              disabled={bulkLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-secondary/80 disabled:opacity-50 transition-colors"
            >
              Stage
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {bulkStageOpen && (
              <div className="absolute bottom-full mb-2 left-0 min-w-[160px] rounded-xl border border-border-color bg-card-bg py-1 shadow-xl z-10">
                {pipelineStages.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                    onClick={() => handleBulkAction({ action: 'change_stage', pipeline_stage_id: s.id })}
                  >
                    {s.color && <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />}
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Change Priority */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setBulkPriorityOpen((o) => !o); setBulkStageOpen(false); }}
              disabled={bulkLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-secondary/80 disabled:opacity-50 transition-colors"
            >
              Priority
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {bulkPriorityOpen && (
              <div className="absolute bottom-full mb-2 left-0 min-w-[130px] rounded-xl border border-border-color bg-card-bg py-1 shadow-xl z-10">
                {(['high', 'medium', 'low'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary capitalize"
                    onClick={() => handleBulkAction({ action: 'change_priority', priority: p })}
                  >
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${p === 'high' ? 'bg-red-500' : p === 'medium' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export selected */}
          <button
            type="button"
            onClick={handleExport}
            disabled={exportLoading || bulkLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
          >
            {bulkLoading ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            )}
            Delete
          </button>

          {/* Clear */}
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="ml-1 rounded-full p-1.5 text-text-secondary hover:bg-bg-secondary transition-colors"
            title="Clear selection"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <CustomerFilters isOpen={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)} initial={filters} onApply={applyFilters} />

      <CreateLeadModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} fieldConfigs={fieldConfigs} />

      {showFieldConfig && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowFieldConfig(false)} />
          <div className="w-full max-w-md bg-bg-primary shadow-2xl flex flex-col h-full">
            <LeadFieldConfigPanel onClose={() => setShowFieldConfig(false)} />
          </div>
        </div>
      )}

      {selectedLeadId && (
        <LeadSidebarPanel
          leadId={selectedLeadId}
          initialData={customers.find(c => c.id === selectedLeadId)}
          onClose={() => setSelectedLeadId(null)}
          onDeleted={() => { setSelectedLeadId(null); void list(filters); }}
          onUpdated={() => void list(filters)}
        />
      )}
    </>
  );
}

// ─── Dynamic cell renderer ────────────────────────────────────────────────────

function DynamicCell({ field, value }: { field: LeadFieldConfig; value: unknown }) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-text-secondary">—</span>;
  }
  const str = String(value);

  if (field.field_type === 'boolean') {
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        value === true || str === 'true' || str === '1'
          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400'
      }`}>
        {value === true || str === 'true' || str === '1' ? 'Yes' : 'No'}
      </span>
    );
  }
  if (field.field_type === 'select') {
    return <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">{str}</span>;
  }
  if (field.field_type === 'date' || field.field_type === 'datetime') {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      return (
        <span className="text-text-primary">
          {field.field_type === 'datetime'
            ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      );
    }
  }
  if (field.field_type === 'url') {
    return <a href={str} target="_blank" rel="noopener noreferrer" className="text-accent underline text-xs truncate max-w-[120px] block">{str}</a>;
  }
  if (field.field_type === 'number') {
    return <span className="font-mono text-text-primary">{str}</span>;
  }
  return <span className="text-text-primary truncate max-w-[160px] block" title={str}>{str}</span>;
}

export default function LeadsClient() {
  return (
    <Suspense fallback={<div className="w-full space-y-4"><span className="text-sm text-text-secondary">Loading...</span></div>}>
      <CustomersContent />
    </Suspense>
  );
}
