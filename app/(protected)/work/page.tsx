'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ModuleGuard from '@/components/module-guard';
import { AssignWorkModal } from '@/components/work/assign-work-modal';
import { useAuthStore } from '@/lib/auth-store';
import {
  bulkUpdateWork,
  listWork,
  getWorkStats,
  updateWork,
  type Work,
  type WorkStats,
  type WorkType,
  type WorkListFilters,
} from '@/services/work';
import { listWorkTypes } from '@/services/work';
import { listEmployees } from '@/services/employees';

const PER_PAGE_OPTIONS = [10, 25, 50] as const;
const DEFAULT_PER_PAGE = 10;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS: Array<{ value: '' | 'low' | 'medium' | 'high'; label: string }> = [
  { value: '', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - x.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 0 && diffDays > -7) return `in ${Math.abs(diffDays)}d`;
  return x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isOverdueDate(d: string | null | undefined, status: string): boolean {
  if (!d || status === 'completed' || status === 'cancelled') return false;
  return new Date(d) < new Date();
}

function statusLabel(s: string): string {
  if (s === 'in_progress') return 'In progress';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    case 'cancelled': return 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400';
    default: return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  }
}

function priorityBadgeClass(priority: string): string {
  if (priority === 'high') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (priority === 'low') return 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
}

function TemplateTypeBadge({ type }: { type?: string | null }) {
  if (!type || type === 'simple') return null;
  return (
    <span className="rounded-full border border-border-color bg-bg-secondary px-1.5 py-0.5 text-xs text-text-secondary capitalize">
      {type}
    </span>
  );
}

function StatsView({ stats }: { stats: WorkStats }) {
  return (
    <div className="space-y-4">
      {/* Summary cards */}
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
                  style={{ width: `${Math.round((c / stats.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* By type */}
      {stats.by_type.length > 0 && (
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <h3 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wide">By work type</h3>
          <div className="space-y-2">
            {stats.by_type.map((t) => (
              <div key={t.work_type_id} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-sm font-medium text-text-primary">{t.work_type_name}</span>
                <div className="flex-1 h-2 overflow-hidden rounded-full bg-bg-secondary">
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

      {/* By employee */}
      {stats.by_employee.length > 0 && (
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <h3 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wide">By employee</h3>
          <div className="space-y-2">
            {stats.by_employee.slice(0, 8).map((e) => (
              <div key={e.user_id} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-sm font-medium text-text-primary">{e.name}</span>
                <div className="flex-1 h-2 overflow-hidden rounded-full bg-bg-secondary">
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

export default function WorkPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user as { id?: number } | null);
  const currentUserId = user?.id ?? null;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canAssign = hasPermission('manage_work') || hasPermission('assign_work');
  const canManageTypes = hasPermission('manage_work');

  const [stats, setStats] = useState<WorkStats | null>(null);
  const [items, setItems] = useState<Work[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [types, setTypes] = useState<WorkType[]>([]);
  const [employees, setEmployees] = useState<{ user_id: number; name: string }[]>([]);
  const [selectedWorkIds, setSelectedWorkIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<'pending' | 'in_progress' | 'completed' | 'cancelled' | ''>('');
  const [bulkAssigneeId, setBulkAssigneeId] = useState<number | null>(null);
  const [filters, setFilters] = useState<WorkListFilters>({
    page: 1,
    per_page: DEFAULT_PER_PAGE,
    status: null,
    work_type_id: null,
    assigned_to_id: null,
    priority: null,
    overdue: null,
    q: null,
  });
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [pageView, setPageView] = useState<'list' | 'analytics'>('list');
  const [quickFilter, setQuickFilter] = useState<'all' | 'mine' | 'overdue' | 'pending' | 'in_progress' | 'completed'>('all');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (openMenuId === null) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);

  const loadStats = useCallback(async () => {
    try {
      const data = await getWorkStats();
      setStats(data);
    } catch {
      setStats(null);
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listWork({
        page: filters.page ?? 1,
        per_page: filters.per_page ?? DEFAULT_PER_PAGE,
        status: filters.status || undefined,
        work_type_id: filters.work_type_id ?? undefined,
        assigned_to_id: filters.assigned_to_id ?? undefined,
        priority: filters.priority ?? undefined,
        overdue: filters.overdue ?? undefined,
        q: (filters.q || '').trim() || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.total_pages);
      setSelectedWorkIds((prev) => prev.filter((id) => res.items.some((w) => w.id === id)));
    } catch {
      setError('Failed to load work items. Try again.');
      setItems([]);
      setTotal(0);
      setPage(1);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.per_page, filters.status, filters.work_type_id, filters.assigned_to_id, filters.priority, filters.overdue, filters.q]);

  useEffect(() => { void loadStats(); }, [loadStats]);
  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => {
    listWorkTypes().then(setTypes).catch(() => setTypes([]));
    listEmployees()
      .then((list) => setEmployees(list.filter((e) => e.id === 0 || e.is_active).map((e) => ({ user_id: e.user_id, name: e.name || e.email }))))
      .catch(() => setEmployees([]));
  }, []);

  const applyFilter = (key: keyof WorkListFilters, value: number | string | boolean | null) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const applyQuickFilter = (qf: typeof quickFilter) => {
    setQuickFilter(qf);
    const base: Partial<WorkListFilters> = { status: null, assigned_to_id: null, overdue: null, page: 1 };
    if (qf === 'mine') base.assigned_to_id = currentUserId;
    else if (qf === 'overdue') base.overdue = true;
    else if (qf === 'pending') base.status = 'pending';
    else if (qf === 'in_progress') base.status = 'in_progress';
    else if (qf === 'completed') base.status = 'completed';
    setFilters((prev) => ({ ...prev, ...base }));
  };

  const resetFilters = () => {
    setQuickFilter('all');
    setFilters({ page: 1, per_page: filters.per_page ?? DEFAULT_PER_PAGE, status: null, work_type_id: null, assigned_to_id: null, priority: null, overdue: null, q: null });
  };

  const allVisibleSelected = useMemo(
    () => items.length > 0 && items.every((w) => selectedWorkIds.includes(w.id)),
    [items, selectedWorkIds],
  );

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) setSelectedWorkIds((prev) => prev.filter((id) => !items.some((w) => w.id === id)));
    else setSelectedWorkIds((prev) => Array.from(new Set([...prev, ...items.map((w) => w.id)])));
  };

  const toggleSelectOne = (workId: number) => {
    setSelectedWorkIds((prev) => (prev.includes(workId) ? prev.filter((id) => id !== workId) : [...prev, workId]));
  };

  const applyQuickStatus = async (workId: number, status: 'pending' | 'in_progress' | 'completed' | 'cancelled') => {
    try {
      const updated = await updateWork(workId, { status });
      setItems((prev) => prev.map((item) => (item.id === workId ? updated : item)));
      setNotice(`Status updated.`);
      setError(null);
      void loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status.');
    }
  };

  const runBulkUpdate = async () => {
    if (!selectedWorkIds.length || (!bulkStatus && bulkAssigneeId == null)) {
      setError('Pick a bulk status or assignee first.');
      return;
    }
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    try {
      await bulkUpdateWork({ work_ids: selectedWorkIds, status: bulkStatus || undefined, assigned_to_id: bulkAssigneeId ?? undefined });
      setSelectedWorkIds([]);
      setBulkStatus('');
      setBulkAssigneeId(null);
      setNotice('Bulk update applied.');
      void loadList();
      void loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk update failed.');
    } finally {
      setBulkBusy(false);
    }
  };

  const perPage = filters.per_page ?? DEFAULT_PER_PAGE;
  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  const isEmpty = !loading && items.length === 0;
  const selectedCount = selectedWorkIds.length;

  const hasActiveFilters = !!(filters.status || filters.work_type_id || filters.assigned_to_id || filters.priority || filters.overdue || filters.q);

  return (
    <ModuleGuard module="lms">
      <div className="w-full space-y-4">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Work & Tasks</h2>
            <p className="text-base text-text-secondary">View and manage work assigned to your team.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageTypes && (
              <Link
                href="/work/templates"
                className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-secondary transition-colors"
              >
                Manage templates
              </Link>
            )}
            {canAssign && (
              <button
                type="button"
                onClick={() => setAssignModalOpen(true)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                + Assign work
              </button>
            )}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
        {notice && !error && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
            {notice}
          </div>
        )}

        {/* View toggle + Quick filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-lg border border-border-color text-sm font-medium">
            <button
              type="button"
              onClick={() => setPageView('list')}
              className={`px-4 py-2 transition-colors ${pageView === 'list' ? 'bg-accent text-white' : 'bg-card-bg text-text-secondary hover:text-text-primary'}`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                List
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPageView('analytics')}
              className={`border-l border-border-color px-4 py-2 transition-colors ${pageView === 'analytics' ? 'bg-accent text-white' : 'bg-card-bg text-text-secondary hover:text-text-primary'}`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analytics
              </span>
            </button>
          </div>

          {/* Quick filter pills — list view only */}
          {pageView === 'list' && (
            <div className="flex flex-wrap gap-1">
              {([
                { key: 'all', label: 'All' },
                { key: 'mine', label: 'My work' },
                { key: 'pending', label: 'Pending' },
                { key: 'in_progress', label: 'In progress' },
                { key: 'completed', label: 'Completed' },
                { key: 'overdue', label: 'Overdue' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyQuickFilter(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    quickFilter === key
                      ? key === 'overdue' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                        : key === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : key === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'bg-accent/10 text-accent'
                      : 'border border-border-color text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Analytics view */}
        {pageView === 'analytics' && stats && <StatsView stats={stats} />}
        {pageView === 'analytics' && !stats && (
          <div className="rounded-xl border border-border-color bg-card-bg p-8 text-center text-sm text-text-secondary">Loading analytics…</div>
        )}

        {/* List view */}
        {pageView === 'list' && (
          <>
            {/* Filters bar */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-color bg-card-bg px-4 py-2.5">
              <select
                value={filters.status ?? ''}
                onChange={(e) => applyFilter('status', e.target.value || null)}
                className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={filters.priority ?? ''}
                onChange={(e) => {
                  const v = e.target.value as '' | 'low' | 'medium' | 'high';
                  applyFilter('priority', v === '' ? null : v);
                }}
                className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={filters.work_type_id ?? ''}
                onChange={(e) => applyFilter('work_type_id', e.target.value ? Number(e.target.value) : null)}
                className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">All types</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {canAssign && (
                <select
                  value={filters.assigned_to_id ?? ''}
                  onChange={(e) => applyFilter('assigned_to_id', e.target.value ? Number(e.target.value) : null)}
                  className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">All employees</option>
                  {employees.map((e) => (
                    <option key={e.user_id} value={e.user_id}>{e.name}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={filters.q ?? ''}
                onChange={(e) => applyFilter('q', e.target.value || null)}
                placeholder="Search title, notes…"
                className="min-w-0 w-full rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent sm:w-auto sm:min-w-[200px]"
              />
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-xs font-semibold text-text-secondary hover:border-accent hover:text-text-primary"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Segment count bar */}
            {!loading && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-color bg-card-bg px-4 py-2 text-sm text-text-secondary">
                <span className="font-medium text-text-primary">
                  Showing {total === 0 ? '0' : `${start}–${end}`} of {total} work item{total !== 1 ? 's' : ''}
                </span>
                {hasActiveFilters && (
                  <button type="button" onClick={resetFilters} className="text-xs text-accent hover:underline">
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {/* Bulk action bar */}
            {selectedCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
                <span className="text-sm font-semibold text-text-primary">{selectedCount} selected</span>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as typeof bulkStatus)}
                  className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">Set status…</option>
                  {STATUS_OPTIONS.filter((o) => o.value).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {canAssign && (
                  <select
                    value={bulkAssigneeId ?? ''}
                    onChange={(e) => setBulkAssigneeId(e.target.value ? Number(e.target.value) : null)}
                    className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">Reassign to…</option>
                    {employees.map((emp) => (
                      <option key={emp.user_id} value={emp.user_id}>{emp.name}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void runBulkUpdate()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {bulkBusy ? 'Applying…' : 'Apply'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWorkIds([])}
                  className="text-xs text-text-secondary hover:text-text-primary"
                >
                  Clear selection
                </button>
              </div>
            )}

            {loading && (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-bg-secondary" />
                ))}
              </div>
            )}

            {isEmpty && (
              <div className="rounded-xl border border-border-color bg-card-bg px-6 py-12 text-center">
                <p className="mb-1 text-base font-semibold text-text-primary">No work found</p>
                <p className="mb-4 text-sm text-text-secondary">
                  {hasActiveFilters ? 'Try adjusting your filters.' : 'Assign work to get started.'}
                </p>
                {canAssign && !hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => setAssignModalOpen(true)}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    + Assign work
                  </button>
                )}
                {hasActiveFilters && (
                  <button type="button" onClick={resetFilters} className="text-sm font-semibold text-accent hover:underline">
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {!isEmpty && !loading && (
              <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border-color">
                    <thead className="bg-bg-secondary">
                      <tr>
                        <th className="px-4 py-2.5 text-left">
                          <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} className="rounded" />
                        </th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Work</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Assigned to</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Status</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Priority</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Due</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Lead</th>
                        <th className="px-4 py-2.5 text-right text-sm font-semibold text-text-secondary">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color">
                      {items.map((w) => {
                        const overdue = isOverdueDate(w.due_date, w.status);
                        return (
                          <tr
                            key={w.id}
                            className="hover:bg-bg-secondary/60 cursor-pointer"
                            onClick={() => router.push(`/work/${w.id}`)}
                          >
                            <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedWorkIds.includes(w.id)}
                                onChange={() => toggleSelectOne(w.id)}
                                className="rounded"
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-text-primary">
                                  {w.title || w.work_type_name}
                                </span>
                                <TemplateTypeBadge type={w.template_type} />
                              </div>
                              <div className="mt-0.5 text-xs text-text-secondary">{w.work_type_name}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-sm text-text-primary">{w.assigned_to_name}</span>
                              {w.assigned_to_id === currentUserId && (
                                <span className="ml-1.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent">me</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(w.status)}`}>
                                {statusLabel(w.status)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${priorityBadgeClass(w.priority)}`}>
                                {w.priority}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`text-sm ${overdue ? 'font-semibold text-red-600 dark:text-red-400' : 'text-text-secondary'}`}>
                                {overdue && '⚠ '}{formatDate(w.due_date)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                              {w.lead_id ? (
                                <Link
                                  href={`/customers/${w.lead_id}`}
                                  className="text-sm font-medium text-accent hover:underline"
                                >
                                  {w.lead_name || `Lead #${w.lead_id}`}
                                </Link>
                              ) : (
                                <span className="text-sm text-text-secondary">—</span>
                              )}
                            </td>
                            <td className="relative px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <div
                                className="relative flex justify-end"
                                ref={openMenuId === w.id ? menuRef : undefined}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId((prev) => (prev === w.id ? null : w.id));
                                  }}
                                  className="rounded-lg border border-border-color bg-bg-primary p-1.5 text-text-secondary hover:border-accent hover:text-text-primary"
                                  aria-label="Actions"
                                >
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                  </svg>
                                </button>
                                {openMenuId === w.id && (
                                  <div
                                    className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-border-color bg-card-bg py-1 shadow-lg"
                                    role="menu"
                                  >
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                                      onClick={() => { setOpenMenuId(null); router.push(`/work/${w.id}`); }}
                                    >
                                      Open
                                    </button>
                                    {canAssign && (
                                      <>
                                        <div className="my-1 border-t border-border-color" />
                                        {(['pending', 'in_progress', 'completed', 'cancelled'] as const).map((s) => (
                                          <button
                                            key={s}
                                            type="button"
                                            role="menuitem"
                                            disabled={w.status === s}
                                            className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary disabled:opacity-40"
                                            onClick={() => { setOpenMenuId(null); void applyQuickStatus(w.id, s); }}
                                          >
                                            Mark {statusLabel(s)}
                                          </button>
                                        ))}
                                      </>
                                    )}
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

                {/* Pagination */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-color px-4 py-3 text-sm text-text-secondary">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      Page {page} of {totalPages} · {total === 0 ? '0' : `${start}–${end}`} of {total}
                    </span>
                    <label className="flex items-center gap-2">
                      <span>Per page</span>
                      <select
                        value={perPage}
                        onChange={(e) => setFilters((f) => ({ ...f, per_page: Number(e.target.value) as typeof PER_PAGE_OPTIONS[number], page: 1 }))}
                        className="rounded-lg border border-border-color bg-bg-primary px-2 py-1 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {PER_PAGE_OPTIONS.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                      className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                      className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AssignWorkModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        onCreated={() => {
          void loadStats();
          void loadList();
        }}
      />
    </ModuleGuard>
  );
}
