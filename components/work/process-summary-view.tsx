'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  type Work,
  type WorkTemplate,
  listWork,
  getWorkTemplate,
} from '@/services/work';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  Users,
  TrendingUp,
  Timer,
  ChevronDown,
} from 'lucide-react';

interface ProcessSummaryViewProps {
  templateId: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  in_progress: { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  completed: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-400/10' },
};

const PRIORITY_CONFIG: Record<string, { label: string; dot: string }> = {
  low: { label: 'Low', dot: 'bg-slate-400' },
  medium: { label: 'Med', dot: 'bg-yellow-400' },
  high: { label: 'High', dot: 'bg-red-400' },
};

function formatDuration(hours: number | null | undefined): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isOverdue(work: Work): boolean {
  if (!work.due_date || work.status === 'completed' || work.status === 'cancelled') return false;
  return new Date(work.due_date) < new Date();
}

export function ProcessSummaryView({ templateId }: ProcessSummaryViewProps) {
  const [template, setTemplate] = useState<WorkTemplate | null>(null);
  const [items, setItems] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tpl, res] = await Promise.all([
        getWorkTemplate(templateId),
        listWork({
          work_template_id: templateId,
          status: statusFilter,
          page,
          per_page: perPage,
        }),
      ]);
      setTemplate(tpl);
      setItems(res.items);
      setTotal(res.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [templateId, statusFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Stats
  const totalItems = items.length;
  const completedCount = items.filter((w) => w.status === 'completed').length;
  const inProgressCount = items.filter((w) => w.status === 'in_progress').length;
  const overdueCount = items.filter(isOverdue).length;
  const avgDuration = (() => {
    const durations = items.filter((w) => w.duration_hours != null).map((w) => w.duration_hours!);
    return durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  })();
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // Unique employees
  const employeeMap = new Map<number, { name: string; completed: number; total: number }>();
  items.forEach((w) => {
    const existing = employeeMap.get(w.assigned_to_id);
    if (existing) {
      existing.total++;
      if (w.status === 'completed') existing.completed++;
    } else {
      employeeMap.set(w.assigned_to_id, {
        name: w.assigned_to_name,
        completed: w.status === 'completed' ? 1 : 0,
        total: 1,
      });
    }
  });

  const isChecklist = template?.template_type === 'checklist';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            {template?.name || 'Process'}
          </h2>
          <p className="text-sm text-text-secondary">
            {total} total instances · {template?.template_type || ''} template
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <div className="flex items-center gap-2 text-text-secondary">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Completion Rate</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{completionRate}%</p>
          <p className="text-xs text-text-secondary">{completedCount} of {total} done</p>
        </div>
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <div className="flex items-center gap-2 text-blue-400">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">In Progress</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{inProgressCount}</p>
          <p className="text-xs text-text-secondary">currently active</p>
        </div>
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <div className="flex items-center gap-2 text-text-secondary">
            <Timer className="h-4 w-4" />
            <span className="text-xs font-medium">Avg Duration</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{formatDuration(avgDuration)}</p>
          <p className="text-xs text-text-secondary">start to complete</p>
        </div>
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <div className={`flex items-center gap-2 ${overdueCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium">Overdue</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{overdueCount}</p>
          <p className="text-xs text-text-secondary">past due date</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {[null, 'pending', 'in_progress', 'completed', 'cancelled'].map((s) => (
          <button
            key={s ?? 'all'}
            type="button"
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === s
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-secondary hover:bg-bg-primary'
            }`}
          >
            {s ? STATUS_CONFIG[s]?.label ?? s : 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border-color bg-card-bg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-color text-left">
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Employee</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Lead</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Status</th>
              {isChecklist && (
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Progress</th>
              )}
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Priority</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Started</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Completed</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Duration</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Due</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary sr-only">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color">
            {loading ? (
              <tr>
                <td colSpan={isChecklist ? 10 : 9} className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
                  <p className="mt-2 text-sm text-text-secondary">Loading...</p>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={isChecklist ? 10 : 9} className="py-12 text-center text-text-secondary">
                  No work items found for this process.
                </td>
              </tr>
            ) : (
              items.map((w) => {
                const sc = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                const pc = PRIORITY_CONFIG[w.priority] || PRIORITY_CONFIG.medium;
                const overdue = isOverdue(w);
                return (
                  <tr key={w.id} className="hover:bg-bg-secondary/30 transition-colors">
                    {/* Employee */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                          {w.assigned_to_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-text-primary truncate max-w-[120px]">
                          {w.assigned_to_name}
                        </span>
                      </div>
                    </td>
                    {/* Lead */}
                    <td className="px-4 py-3 text-text-primary">
                      {w.lead_name ? (
                        <span className="truncate max-w-[120px] block">{w.lead_name}</span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sc.color} ${sc.bg}`}>
                        {w.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                        {overdue && <AlertTriangle className="h-3 w-3 text-red-400" />}
                        {sc.label}
                      </span>
                    </td>
                    {/* Steps progress */}
                    {isChecklist && (
                      <td className="px-4 py-3">
                        {w.steps_total != null && w.steps_total > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-accent transition-all"
                                style={{ width: `${((w.steps_completed ?? 0) / w.steps_total) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-text-secondary">
                              {w.steps_completed ?? 0}/{w.steps_total}
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                    )}
                    {/* Priority */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                        <span className={`h-2 w-2 rounded-full ${pc.dot}`} />
                        {pc.label}
                      </span>
                    </td>
                    {/* Started */}
                    <td className="px-4 py-3 text-xs text-text-secondary">{formatDate(w.started_at)}</td>
                    {/* Completed */}
                    <td className="px-4 py-3 text-xs text-text-secondary">{formatDate(w.completed_at)}</td>
                    {/* Duration */}
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {formatDuration(w.duration_hours)}
                    </td>
                    {/* Due */}
                    <td className="px-4 py-3">
                      <span className={`text-xs ${overdue ? 'font-semibold text-red-400' : 'text-text-secondary'}`}>
                        {formatDate(w.due_date)}
                      </span>
                    </td>
                    {/* Action */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/workstation?work=${w.id}`}
                        className="inline-flex items-center gap-1 rounded-md bg-bg-secondary px-2 py-1 text-xs text-text-secondary hover:bg-accent hover:text-white transition"
                      >
                        View <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > perPage && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>
            Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-border-color px-3 py-1 text-xs hover:bg-bg-secondary disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page * perPage >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-border-color px-3 py-1 text-xs hover:bg-bg-secondary disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Employee Breakdown */}
      {employeeMap.size > 1 && (
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Users className="h-4 w-4 text-text-secondary" />
            Employee Breakdown
          </h3>
          <div className="space-y-2">
            {Array.from(employeeMap.entries())
              .sort((a, b) => b[1].completed - a[1].completed)
              .map(([uid, info]) => {
                const pct = info.total > 0 ? Math.round((info.completed / info.total) * 100) : 0;
                return (
                  <div key={uid} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[9px] font-bold text-accent">
                      {info.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="w-24 truncate text-sm text-text-primary">{info.name}</span>
                    <div className="flex-1">
                      <div className="h-2 w-full rounded-full bg-bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-text-secondary w-20 text-right">
                      {info.completed}/{info.total} ({pct}%)
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
