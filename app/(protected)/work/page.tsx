'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/permission-guard';
import { AssignWorkModal } from '@/components/work/assign-work-modal';
import WorkKanbanBoard from '@/components/work/work-kanban-board';
import WorkCalendarView from '@/components/work/work-calendar-view';
import { WorkTemplateTable } from '@/components/work/work-template-table';
import { WorkPipelineView } from '@/components/work/work-pipeline-view';
import { useAuthStore } from '@/lib/auth-store';
import { formatDayMonth as fmtDayMonth } from '@/lib/format-date';
import {
  listWork,
  getWorkStats,
  updateWork,
  bulkUpdateWork,
  listWorkTypes,
  listProjects,
  listWorkTemplates,
  type Work,
  type WorkStats,
  type WorkType,
  type WorkListFilters,
  type WorkProject,
  type WorkTemplate,
} from '@/services/work';
import { listEmployees } from '@/services/employees';
import { useDebounce } from '@/lib/use-debounce';

/* ── Helpers ── */

function statusBadge(s: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  };
  return map[s] || map.pending;
}

function statusLabel(s: string) {
  return (
    ({ pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' } as Record<string, string>)[s] || s
  );
}

function priorityDot(p: string) {
  return ({ high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-slate-400' } as Record<string, string>)[p] || 'bg-slate-400';
}

function relativeDate(d: string | null | undefined): { text: string; overdue: boolean } {
  if (!d) return { text: '\u2014', overdue: false };
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return { text: '\u2014', overdue: false };
  const now = new Date();
  const diff = Math.ceil((date.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { text: 'Today', overdue: false };
  if (diff === 1) return { text: 'Tomorrow', overdue: false };
  if (diff <= 7) return { text: `in ${diff}d`, overdue: false };
  return { text: fmtDayMonth(date), overdue: false };
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/* ── Analytics sub-component ── */

function StatsView({ stats }: { stats: WorkStats }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <p className="text-sm text-text-secondary">Total work</p>
          <p className="mt-1 text-3xl font-bold text-text-primary">{stats.total}</p>
        </div>
        {Object.entries(stats.by_status).map(([s, c]) => (
          <div key={s} className="rounded-xl border border-border-color bg-card-bg p-4">
            <p className="text-sm text-text-secondary">{statusLabel(s)}</p>
            <p className="mt-1 text-3xl font-bold text-text-primary">{c}</p>
            {stats.total > 0 && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg-secondary">
                <div
                  className={`h-full rounded-full ${s === 'completed' ? 'bg-emerald-500' : s === 'in_progress' ? 'bg-blue-500' : s === 'cancelled' ? 'bg-gray-400' : 'bg-amber-500'}`}
                  style={{ width: `${Math.round(((c as number) / stats.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {stats.by_type.length > 0 && (
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">By work type</h3>
          <div className="space-y-2">
            {stats.by_type.map((t) => (
              <div key={t.work_type_id} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-sm font-medium text-text-primary">{t.work_type_name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-secondary">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: stats.total > 0 ? `${Math.round((t.count / stats.total) * 100)}%` : '0%' }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-semibold text-text-primary">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.by_employee.length > 0 && (
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">By employee</h3>
          <div className="space-y-2">
            {stats.by_employee.slice(0, 8).map((e) => (
              <div key={e.user_id} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-sm font-medium text-text-primary">{e.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-secondary">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: stats.total > 0 ? `${Math.round((e.count / stats.total) * 100)}%` : '0%' }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-semibold text-text-primary">{e.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SVG Icons (inline, small) ── */

const SearchIcon = () => (
  <svg className="h-4 w-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FilterIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="mx-auto h-12 w-12 text-text-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

/* ── View tab config ── */

type ViewMode = 'table' | 'board' | 'calendar' | 'analytics';

const VIEW_TABS: { mode: ViewMode; label: string }[] = [
  { mode: 'table', label: 'Table' },
  { mode: 'board', label: 'Board' },
  { mode: 'calendar', label: 'Calendar' },
  { mode: 'analytics', label: 'Analytics' },
];

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════ */

export default function WorkPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user as { id?: number } | null);
  const currentUserId = user?.id ?? null;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canAssign = hasPermission('manage_work') || hasPermission('assign_work');
  const canManageTypes = hasPermission('manage_work');

  /* ── View mode ── */
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('work-view-mode') as ViewMode) || 'table';
    return 'table';
  });

  /* ── Data ── */
  const [items, setItems] = useState<Work[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<WorkStats | null>(null);

  /* ── Filters ── */
  const [filters, setFilters] = useState<WorkListFilters>({ page: 1, per_page: 25 });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  /* ── Template view ── */
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkTemplate | null>(null);
  const [pipelineView, setPipelineView] = useState(false);

  /* ── Reference data ── */
  const [types, setTypes] = useState<WorkType[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [templates, setTemplates] = useState<WorkTemplate[]>([]);
  const [employees, setEmployees] = useState<Array<{ user_id: number; name: string }>>([]);

  /* ── UI ── */
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkAssigneeId, setBulkAssigneeId] = useState<number | null>(null);
  const [bulkPriority, setBulkPriority] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /* ── Calendar ── */
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());

  /* ── Active filter count ── */
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.priority) count++;
    if (filters.assigned_to_id) count++;
    if (filters.project_id) count++;
    return count;
  }, [filters.status, filters.priority, filters.assigned_to_id, filters.project_id]);

  const hasActiveFilters = activeFilterCount > 0 || !!searchQuery;

  /* ── Persist view mode ── */
  useEffect(() => {
    localStorage.setItem('work-view-mode', viewMode);
  }, [viewMode]);

  /* ── Load reference data on mount ── */
  useEffect(() => {
    listWorkTypes().then(setTypes).catch(() => setTypes([]));
    listEmployees()
      .then((list) =>
        setEmployees(
          list
            .filter((e) => e.id === 0 || e.is_active)
            .map((e) => ({ user_id: e.user_id, name: e.name || e.email })),
        ),
      )
      .catch(() => setEmployees([]));
    listProjects().then(setProjects).catch(() => {});
    listWorkTemplates().then(setTemplates).catch(() => {});
  }, []);

  /* ── Sync selected template object ── */
  useEffect(() => {
    if (selectedTemplateId) {
      setSelectedTemplate(templates.find((t) => t.id === selectedTemplateId) || null);
    } else {
      setSelectedTemplate(null);
      setPipelineView(false);
    }
  }, [selectedTemplateId, templates]);

  /* ── Load stats ── */
  const loadStats = useCallback(async () => {
    try {
      setStats(await getWorkStats());
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  /* ── Load work list ── */
  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const effectivePerPage =
        viewMode === 'board' || viewMode === 'calendar' || selectedTemplateId ? 200 : filters.per_page ?? 25;

      const calendarFilters: Partial<WorkListFilters> = {};
      if (viewMode === 'calendar') {
        const firstDay = new Date(calendarYear, calendarMonth, 1);
        const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
        calendarFilters.due_date_from = firstDay.toISOString().split('T')[0];
        calendarFilters.due_date_to = lastDay.toISOString().split('T')[0];
      }

      const res = await listWork({
        page: filters.page ?? 1,
        per_page: effectivePerPage,
        status: filters.status || undefined,
        work_type_id: filters.work_type_id ?? undefined,
        assigned_to_id: filters.assigned_to_id ?? undefined,
        priority: filters.priority ?? undefined,
        project_id: filters.project_id ?? undefined,
        work_template_id: selectedTemplateId ?? undefined,
        q: debouncedSearch.trim() || undefined,
        ...calendarFilters,
      });
      if (filters.page === 1) {
        setItems(res.items);
      } else {
        setItems((prev) => [...prev, ...res.items]);
      }
      setTotal(res.total);
      setSelectedIds((prev) => prev.filter((id) => res.items.some((w) => w.id === id)));
    } catch {
      setError('Failed to load work items. Try again.');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    filters.page,
    filters.per_page,
    filters.status,
    filters.work_type_id,
    filters.assigned_to_id,
    filters.priority,
    filters.project_id,
    debouncedSearch,
    selectedTemplateId,
    viewMode,
    calendarYear,
    calendarMonth,
  ]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  /* ── Filter helpers ── */
  const applyFilter = (key: keyof WorkListFilters, value: number | string | boolean | null) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const resetFilters = () => {
    setFilters({ page: 1, per_page: 25 });
    setSearchQuery('');
    setSelectedTemplateId(null);
    setFiltersExpanded(false);
  };

  /* ── Reset page on search change ── */
  useEffect(() => {
    setFilters((prev) => ({ ...prev, page: 1 }));
  }, [debouncedSearch]);

  /* ── Bulk actions ── */
  const allVisibleSelected = useMemo(
    () => items.length > 0 && items.every((w) => selectedIds.includes(w.id)),
    [items, selectedIds],
  );

  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelectedIds((prev) => prev.filter((id) => !items.some((w) => w.id === id)));
    else setSelectedIds((prev) => Array.from(new Set([...prev, ...items.map((w) => w.id)])));
  };

  const toggleSelectOne = (workId: number) => {
    setSelectedIds((prev) => (prev.includes(workId) ? prev.filter((id) => id !== workId) : [...prev, workId]));
  };

  const runBulkUpdate = async () => {
    if (!selectedIds.length || (!bulkStatus && bulkAssigneeId == null && !bulkPriority)) {
      setError('Select a status, assignee, or priority to apply.');
      return;
    }
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    try {
      await bulkUpdateWork({
        work_ids: selectedIds,
        status: (bulkStatus || undefined) as 'pending' | 'in_progress' | 'completed' | 'cancelled' | undefined,
        assigned_to_id: bulkAssigneeId ?? undefined,
        priority: (bulkPriority || undefined) as 'low' | 'medium' | 'high' | undefined,
      });
      setSelectedIds([]);
      setBulkStatus('');
      setBulkAssigneeId(null);
      setBulkPriority('');
      setNotice('Bulk update applied.');
      setFilters((prev) => ({ ...prev, page: 1 }));
      void loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk update failed.');
    } finally {
      setBulkBusy(false);
    }
  };

  /* ── Load more ── */
  const canLoadMore = viewMode === 'table' && !selectedTemplateId && items.length < total;
  const loadMore = () => {
    setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }));
  };

  /* ── Derived ── */
  const isEmpty = !loading && items.length === 0;
  const showTableView = viewMode === 'table' && !selectedTemplateId;
  const showTemplateView = viewMode === 'table' && !!selectedTemplateId && !!selectedTemplate;

  /* ── Select styling ── */
  const selectClass =
    'rounded-lg border border-border-color bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40';

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */

  return (
    <PermissionGuard permission="manage_work" module="lms">
      <div className="mx-auto w-full max-w-[1400px] space-y-4">
        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Work & Tasks</h1>
            <p className="mt-0.5 text-sm text-text-secondary">Manage and track all work across your team</p>
          </div>
          <div className="flex items-center gap-3">
            {canManageTypes && (
              <Link href="/work/templates" className="text-sm font-medium text-accent hover:underline">
                Templates
              </Link>
            )}
            {canAssign && (
              <button
                type="button"
                onClick={() => setAssignModalOpen(true)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
              >
                + Assign Work
              </button>
            )}
          </div>
        </div>

        {/* ── Alerts ── */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
            <button type="button" onClick={() => setError(null)} className="ml-2 font-medium underline">
              Dismiss
            </button>
          </div>
        )}
        {notice && !error && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
            {notice}
          </div>
        )}

        {/* ── View Tabs (unified pill group) ── */}
        <div className="flex items-center rounded-lg border border-border-color bg-card-bg p-0.5">
          {VIEW_TABS.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setViewMode(mode);
                setFilters((prev) => ({ ...prev, page: 1 }));
              }}
              className={`flex-1 sm:flex-none rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Filter Row (always visible, except analytics) ── */}
        {viewMode !== 'analytics' && (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative flex-1 sm:max-w-xs">
                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                  <SearchIcon />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search work items..."
                  className="w-full rounded-lg border border-border-color bg-bg-primary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>

              {/* Template dropdown */}
              <select
                value={selectedTemplateId ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setSelectedTemplateId(val);
                  setPipelineView(false);
                  setFilters((prev) => ({ ...prev, page: 1 }));
                }}
                className={selectClass}
              >
                <option value="">All templates</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.template_type})
                  </option>
                ))}
              </select>

              {/* Filters toggle */}
              <button
                type="button"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  filtersExpanded || activeFilterCount > 0
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-border-color text-text-secondary hover:text-text-primary hover:border-text-secondary'
                }`}
              >
                <FilterIcon />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDownIcon />
              </button>
            </div>

            {/* Expanded filter panel */}
            {filtersExpanded && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-color bg-card-bg px-4 py-3">
                <select
                  value={filters.status ?? ''}
                  onChange={(e) => applyFilter('status', e.target.value || null)}
                  className={selectClass}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.priority ?? ''}
                  onChange={(e) => applyFilter('priority', e.target.value || null)}
                  className={selectClass}
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                {canAssign && (
                  <select
                    value={filters.assigned_to_id ?? ''}
                    onChange={(e) => applyFilter('assigned_to_id', e.target.value ? Number(e.target.value) : null)}
                    className={selectClass}
                  >
                    <option value="">All employees</option>
                    {employees.map((emp) => (
                      <option key={emp.user_id} value={emp.user_id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                )}

                <select
                  value={filters.project_id ?? ''}
                  onChange={(e) => applyFilter('project_id', e.target.value ? Number(e.target.value) : null)}
                  className={selectClass}
                >
                  <option value="">All projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {hasActiveFilters && (
                  <button type="button" onClick={resetFilters} className="text-sm font-medium text-accent hover:underline">
                    Clear all
                  </button>
                )}
              </div>
            )}

            {/* Template banner */}
            {selectedTemplate && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-text-primary">Viewing: {selectedTemplate.name}</span>
                  <span className="rounded-full border border-border-color bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary capitalize">
                    {selectedTemplate.template_type}
                  </span>
                  <span className="text-text-secondary">{items.length} items</span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedTemplate.template_type === 'checklist' && selectedTemplate.steps_schema && (
                    <button
                      type="button"
                      onClick={() => setPipelineView(!pipelineView)}
                      className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                        pipelineView
                          ? 'border-accent bg-accent text-white'
                          : 'border-border-color text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Pipeline
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(null);
                      setFilters((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="text-sm text-text-secondary hover:text-text-primary"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Bulk action bar (above table) ── */}
        {selectedIds.length > 0 && viewMode === 'table' && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5">
            <span className="text-sm font-semibold text-text-primary">{selectedIds.length} selected</span>
            <div className="mx-1 h-4 w-px bg-border-color" />
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className={selectClass}>
              <option value="">Set status...</option>
              {STATUS_OPTIONS.filter((o) => o.value).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {canAssign && (
              <select
                value={bulkAssigneeId ?? ''}
                onChange={(e) => setBulkAssigneeId(e.target.value ? Number(e.target.value) : null)}
                className={selectClass}
              >
                <option value="">Reassign to...</option>
                {employees.map((emp) => (
                  <option key={emp.user_id} value={emp.user_id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            )}
            <select value={bulkPriority} onChange={(e) => setBulkPriority(e.target.value)} className={selectClass}>
              <option value="">Set priority...</option>
              {PRIORITY_OPTIONS.filter((o) => o.value).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void runBulkUpdate()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {bulkBusy ? 'Applying...' : 'Apply'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="ml-auto text-xs text-text-secondary hover:text-text-primary"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* ── Result count ── */}
        {viewMode === 'table' && !loading && items.length > 0 && (
          <p className="text-sm text-text-secondary">
            Showing {items.length} of {total} result{total !== 1 ? 's' : ''}
          </p>
        )}

        {/* ══════════════════════════════════════
           VIEW CONTENT
           ══════════════════════════════════════ */}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-bg-secondary" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && viewMode !== 'analytics' && (
          <div className="rounded-xl border border-border-color bg-card-bg px-6 py-16 text-center">
            <ClipboardIcon />
            <p className="mt-4 text-base font-semibold text-text-primary">No work items found</p>
            <p className="mt-1 text-sm text-text-secondary">
              {hasActiveFilters
                ? 'Try adjusting your filters or search query.'
                : 'Assign work to your team to get started.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {hasActiveFilters && (
                <button type="button" onClick={resetFilters} className="text-sm font-semibold text-accent hover:underline">
                  Clear filters
                </button>
              )}
              {canAssign && !hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(true)}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  + Assign Work
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Table View ── */}
        {!loading && !isEmpty && showTableView && (
          <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-color">
                <thead className="bg-bg-secondary">
                  <tr>
                    <th className="w-10 px-4 py-2.5 text-left">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Title
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Assignee
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Priority
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Due
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {items.map((w) => {
                    const due = relativeDate(w.due_date);
                    const isOverdue = due.overdue && w.status !== 'completed' && w.status !== 'cancelled';
                    return (
                      <tr
                        key={w.id}
                        className="cursor-pointer transition-colors hover:bg-bg-secondary/60"
                        onClick={() => router.push(`/workstation?work=${w.id}`)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(w.id)}
                            onChange={() => toggleSelectOne(w.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-text-primary">
                              {w.title || w.work_type_name}
                            </span>
                            {w.template_type && w.template_type !== 'simple' && (
                              <span className="rounded-full border border-border-color bg-bg-secondary px-1.5 py-0.5 text-[10px] text-text-secondary capitalize">
                                {w.template_type}
                              </span>
                            )}
                          </div>
                          {w.work_type_name && w.title && (
                            <p className="mt-0.5 text-xs text-text-secondary">{w.work_type_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-text-primary">{w.assigned_to_name || '\u2014'}</span>
                          {w.assigned_to_id === currentUserId && (
                            <span className="ml-1.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                              you
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(w.status)}`}
                          >
                            {statusLabel(w.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-block h-2 w-2 rounded-full ${priorityDot(w.priority)}`} />
                            <span className="text-sm capitalize text-text-primary">{w.priority}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm ${
                              isOverdue ? 'font-semibold text-red-600 dark:text-red-400' : 'text-text-secondary'
                            }`}
                          >
                            {due.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Template Table View ── */}
        {!loading && !isEmpty && showTemplateView && !pipelineView && (
          <WorkTemplateTable
            items={items}
            formFields={(selectedTemplate!.form_schema || []).map((f: any) => ({
              id: f.id || f.label,
              label: f.label || f.id,
              type: f.type || 'text',
            }))}
            onRowClick={(workId) => router.push(`/workstation?work=${workId}`)}
          />
        )}

        {/* ── Template Pipeline View ── */}
        {!loading && !isEmpty && showTemplateView && pipelineView && selectedTemplate!.template_type === 'checklist' && (
          <WorkPipelineView
            items={items}
            stepsSchema={(selectedTemplate!.steps_schema || []).map((s: any) => ({
              order: s.order,
              label: s.label,
            }))}
            onCardClick={(workId) => router.push(`/workstation?work=${workId}`)}
          />
        )}

        {/* ── Board View ── */}
        {!loading && !isEmpty && viewMode === 'board' && !selectedTemplateId && (
          <WorkKanbanBoard
            items={items}
            onStatusChange={async (workId, status) => {
              try {
                await updateWork(workId, { status: status as 'pending' | 'in_progress' | 'completed' | 'cancelled' });
                void loadList();
                void loadStats();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to update status.');
              }
            }}
            onCardClick={(workId) => router.push(`/workstation?work=${workId}`)}
          />
        )}

        {/* ── Calendar View ── */}
        {!loading && viewMode === 'calendar' && (
          <WorkCalendarView
            items={items}
            onItemClick={(workId) => router.push(`/workstation?work=${workId}`)}
            onMonthChange={(year, month) => {
              setCalendarYear(year);
              setCalendarMonth(month);
            }}
            currentYear={calendarYear}
            currentMonth={calendarMonth}
          />
        )}

        {/* ── Analytics View ── */}
        {viewMode === 'analytics' && stats && <StatsView stats={stats} />}
        {viewMode === 'analytics' && !stats && !loading && (
          <div className="rounded-xl border border-border-color bg-card-bg p-8 text-center text-sm text-text-secondary">
            Loading analytics...
          </div>
        )}

        {/* ── Load More (table view only) ── */}
        {canLoadMore && !loading && (
          <div className="flex justify-center pt-2 pb-4">
            <button
              type="button"
              onClick={loadMore}
              className="rounded-lg border border-border-color bg-card-bg px-6 py-2 text-sm font-medium text-text-primary shadow-sm transition-colors hover:bg-bg-secondary"
            >
              Load more
            </button>
          </div>
        )}

        {/* ── Modals ── */}
        {assignModalOpen && (
          <AssignWorkModal
            isOpen={assignModalOpen}
            onClose={() => setAssignModalOpen(false)}
            onCreated={() => {
              setAssignModalOpen(false);
              setFilters((prev) => ({ ...prev, page: 1 }));
              void loadStats();
            }}
          />
        )}
      </div>
    </PermissionGuard>
  );
}
