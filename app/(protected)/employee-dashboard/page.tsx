'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ModuleGuard from '@/components/module-guard';
import { useAuthStore } from '@/lib/auth-store';
import { listWork, getWorkStats, updateWork, startWork, type Work, type WorkStats } from '@/services/work';

const PER_PAGE = 20;

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleDateString(undefined, { dateStyle: 'short' });
}

function statusLabel(s: string): string {
  if (s === 'in_progress') return 'In progress';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function EmployeeDashboardPage() {
  const currentUserId = useAuthStore((s) => (s.user as { id?: number } | null)?.id ?? null);
  const [stats, setStats] = useState<WorkStats | null>(null);
  const [items, setItems] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (currentUserId == null) return;
    setLoading(true);
    setError(null);
    try {
      const [statsRes, listRes] = await Promise.all([
        getWorkStats(),
        listWork({
          page: 1,
          per_page: PER_PAGE,
          assigned_to_id: currentUserId,
        }),
      ]);
      setStats(statsRes);
      setItems(listRes.items);
    } catch {
      setError('Failed to load your work.');
      setStats(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const quickStatus = async (workId: number, status: 'pending' | 'in_progress' | 'completed' | 'cancelled') => {
    setUpdatingId(workId);
    try {
      const updated =
        status === 'in_progress'
          ? await startWork(workId)
          : await updateWork(workId, { status });
      setItems((prev) => prev.map((w) => (w.id === workId ? updated : w)));
      void load();
    } catch {
      setError('Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const overdueCount = items.filter(
    (w) => w.due_date && new Date(w.due_date) < today && w.status !== 'completed' && w.status !== 'cancelled',
  ).length;
  const upcoming = items
    .filter((w) => w.due_date && w.status !== 'completed' && w.status !== 'cancelled')
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 5);

  return (
    <ModuleGuard module="lms">
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
          <h1 className="text-2xl font-semibold text-text-primary">My Workstation</h1>
          <p className="text-sm text-text-secondary">
            Your assigned work, quick actions, and upcoming deadlines.
          </p>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-xl border border-border-color bg-card-bg p-8 text-center text-text-secondary">
              Loading…
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm font-medium text-text-secondary">Pending</div>
                  <div className="text-2xl font-semibold text-text-primary">
                    {stats?.by_status?.pending ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm font-medium text-text-secondary">In progress</div>
                  <div className="text-2xl font-semibold text-text-primary">
                    {stats?.by_status?.in_progress ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm font-medium text-text-secondary">Completed</div>
                  <div className="text-2xl font-semibold text-text-primary">
                    {stats?.by_status?.completed ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm font-medium text-text-secondary">Overdue</div>
                  <div className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
                    {overdueCount}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
                <div className="border-b border-border-color px-4 py-3">
                  <h2 className="font-semibold text-text-primary">My work</h2>
                  <p className="text-sm text-text-secondary">
                    Quick status updates. Open a row for full details.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border-color bg-bg-secondary/50">
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Title / Type</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Status</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Due</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-text-secondary">
                            No work assigned to you.
                          </td>
                        </tr>
                      ) : (
                        items.map((w) => (
                          <tr key={w.id} className="border-b border-border-color last:border-0">
                            <td className="px-4 py-2.5">
                              <Link
                                href={`/work/${w.id}`}
                                className="font-medium text-accent hover:underline"
                              >
                                {w.title || w.work_type_name || `Work #${w.id}`}
                              </Link>
                              <div className="text-xs text-text-secondary">{w.work_type_name}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="rounded px-2 py-0.5 text-xs font-medium bg-bg-secondary text-text-secondary">
                                {statusLabel(w.status)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-text-primary">{formatDate(w.due_date)}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {w.status === 'pending' && (
                                  <button
                                    type="button"
                                    disabled={updatingId === w.id}
                                    onClick={() => quickStatus(w.id, 'in_progress')}
                                    className="rounded bg-accent/90 px-2 py-1 text-xs font-medium text-white hover:bg-accent disabled:opacity-50"
                                  >
                                    Start
                                  </button>
                                )}
                                {w.status === 'in_progress' && (
                                  <button
                                    type="button"
                                    disabled={updatingId === w.id}
                                    onClick={() => quickStatus(w.id, 'completed')}
                                    className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                  >
                                    Complete
                                  </button>
                                )}
                                <Link
                                  href={`/work/${w.id}`}
                                  className="rounded border border-border-color px-2 py-1 text-xs font-medium text-text-primary hover:bg-bg-secondary"
                                >
                                  Open
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {upcoming.length > 0 && (
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <h2 className="mb-3 font-semibold text-text-primary">Upcoming deadlines</h2>
                  <ul className="space-y-2">
                    {upcoming.map((w) => (
                      <li key={w.id} className="flex items-center justify-between text-sm">
                        <Link href={`/work/${w.id}`} className="text-accent hover:underline">
                          {w.title || w.work_type_name || `Work #${w.id}`}
                        </Link>
                        <span className="text-text-secondary">{formatDate(w.due_date)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end">
                <Link
                  href="/work"
                  className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
                >
                  View all work
                </Link>
              </div>
            </>
          )}
        </div>
    </ModuleGuard>
  );
}
