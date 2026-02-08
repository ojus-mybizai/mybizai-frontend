'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { AssignWorkModal } from '@/components/work/assign-work-modal';
import { useAuthStore } from '@/lib/auth-store';
import {
  listWork,
  getWorkStats,
  type Work,
  type WorkStats,
  type WorkType,
  type WorkListFilters,
} from '@/services/work';
import { listWorkTypes } from '@/services/work';
import { listEmployees } from '@/services/employees';

const PER_PAGE = 10;
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleDateString(undefined, { dateStyle: 'short' });
}

function statusLabel(s: string): string {
  if (s === 'in_progress') return 'In progress';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function WorkPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user as { id?: number; businesses?: { role?: string }[] } | null);
  const role = user?.businesses?.[0]?.role ?? 'owner';
  const canAssign = role === 'owner' || role === 'manager';
  const canManageTypes = role === 'owner' || role === 'manager';

  const [stats, setStats] = useState<WorkStats | null>(null);
  const [items, setItems] = useState<Work[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<WorkType[]>([]);
  const [employees, setEmployees] = useState<{ user_id: number; name: string }[]>([]);
  const [filters, setFilters] = useState<WorkListFilters>({
    page: 1,
    per_page: PER_PAGE,
    status: null,
    work_type_id: null,
    assigned_to_id: null,
  });
  const [assignModalOpen, setAssignModalOpen] = useState(false);

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
    try {
      const res = await listWork({
        page: filters.page ?? 1,
        per_page: filters.per_page ?? PER_PAGE,
        status: filters.status || undefined,
        work_type_id: filters.work_type_id ?? undefined,
        assigned_to_id: filters.assigned_to_id ?? undefined,
      });
      setItems(res.items);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.total_pages);
    } catch {
      setItems([]);
      setTotal(0);
      setPage(1);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.per_page, filters.status, filters.work_type_id, filters.assigned_to_id]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    listWorkTypes().then(setTypes).catch(() => setTypes([]));
    listEmployees().then((list) => setEmployees(list.map((e) => ({ user_id: e.user_id, name: e.name || e.email })))).catch(() => setEmployees([]));
  }, []);

  const applyFilter = (key: keyof WorkListFilters, value: number | string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const isEmpty = !loading && items.length === 0;

  return (
    <ProtectedShell>
      <ModuleGuard module="lms">
          <div className="w-full space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Work</h2>
                <p className="text-base text-text-secondary">
                  View and manage work assigned to your team. Assign new work or manage work types.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManageTypes && (
                  <Link
                    href="/work/templates"
                    className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                  >
                    Manage work types
                  </Link>
                )}
                {canAssign && (
                  <button
                    type="button"
                    onClick={() => setAssignModalOpen(true)}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Assign work
                  </button>
                )}
              </div>
            </div>

            {stats && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm text-text-secondary">Total work</div>
                  <div className="text-2xl font-bold text-text-primary">{stats.total}</div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm text-text-secondary">By status</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-sm">
                    {Object.entries(stats.by_status).map(([s, c]) => (
                      <span key={s} className="rounded-full bg-bg-secondary px-2.5 py-0.5 font-medium text-text-primary">
                        {statusLabel(s)}: {c}
                      </span>
                    ))}
                    {Object.keys(stats.by_status).length === 0 && <span className="text-text-secondary">—</span>}
                  </div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm text-text-secondary">By type</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-sm">
                    {stats.by_type.slice(0, 5).map((t) => (
                      <span key={t.work_type_id} className="rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                        {t.work_type_name}: {t.count}
                      </span>
                    ))}
                    {stats.by_type.length === 0 && <span className="text-text-secondary">—</span>}
                  </div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm text-text-secondary">By employee</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-sm">
                    {stats.by_employee.slice(0, 3).map((e) => (
                      <span key={e.user_id} className="rounded-full bg-blue-100 px-2.5 py-0.5 font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        {e.name}: {e.count}
                      </span>
                    ))}
                    {stats.by_employee.length === 0 && <span className="text-text-secondary">—</span>}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-color bg-card-bg px-4 py-2">
              <span className="text-sm font-medium text-text-secondary">Filters:</span>
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
            </div>

            {loading && <div className="text-base text-text-secondary">Loading work…</div>}

            {isEmpty && (
              <div className="rounded-xl border border-border-color bg-card-bg px-6 py-10 text-center text-base text-text-secondary">
                <p className="mb-2 font-medium text-text-primary">No work found</p>
                <p className="mb-4">Assign work to get started, or adjust filters.</p>
                {canAssign && (
                  <button
                    type="button"
                    onClick={() => setAssignModalOpen(true)}
                    className="text-sm font-semibold text-accent hover:underline"
                  >
                    Assign work
                  </button>
                )}
              </div>
            )}

            {!isEmpty && (
              <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm">
                <table className="min-w-full divide-y divide-border-color">
                  <thead className="bg-bg-secondary">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Title / Type</th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Assigned to</th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Status</th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Due date</th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Lead</th>
                      <th className="px-4 py-2.5 text-right text-sm font-semibold text-text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    {items.map((w) => (
                      <tr key={w.id} className="hover:bg-bg-secondary/60">
                        <td className="px-4 py-2.5">
                          <div className="text-base font-medium text-text-primary">{w.title || w.work_type_name}</div>
                          <div className="text-sm text-text-secondary">{w.work_type_name}</div>
                        </td>
                        <td className="px-4 py-2.5 text-base text-text-primary">{w.assigned_to_name}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                            w.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                            w.status === 'in_progress' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                            w.status === 'cancelled' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                          }`}>
                            {statusLabel(w.status)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-text-secondary">{formatDate(w.due_date)}</td>
                        <td className="px-4 py-2.5">
                          {w.lead_id ? (
                            <Link href={`/customers/${w.lead_id}`} className="text-sm font-medium text-accent hover:underline">
                              {w.lead_name || `Lead #${w.lead_id}`}
                            </Link>
                          ) : (
                            <span className="text-sm text-text-secondary">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => router.push(`/work/${w.id}`)}
                            className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm font-semibold text-text-primary hover:border-accent"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-color px-4 py-3 text-sm text-text-secondary">
                  <span>Page {page} of {totalPages} · {total} total</span>
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
    </ProtectedShell>
  );
}
