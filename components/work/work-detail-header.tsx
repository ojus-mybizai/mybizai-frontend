'use client';

import Link from 'next/link';
import type { Work } from '@/services/work';
import { formatDate as fmtDate } from '@/lib/format-date';

function formatDate(d: string | null | undefined): string {
  return fmtDate(d);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    case 'cancelled':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    case 'low':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
  }
}

function statusLabel(status: string): string {
  return status === 'in_progress' ? 'In progress' : status.charAt(0).toUpperCase() + status.slice(1);
}

export interface WorkDetailHeaderProps {
  work: Work;
  /** Optional slot for primary action (e.g. Start work) */
  action?: React.ReactNode;
  /** Show the ← Back to Work nav link — default true */
  showBack?: boolean;
  /** Show compact meta (assignee, due) — default true */
  showMeta?: boolean;
}

export function WorkDetailHeader({
  work,
  action,
  showBack = true,
  showMeta = true,
}: WorkDetailHeaderProps) {
  const isOverdue =
    work.status !== 'completed' &&
    work.status !== 'cancelled' &&
    work.due_date &&
    new Date(work.due_date) < new Date() &&
    !Number.isNaN(new Date(work.due_date).getTime());

  return (
    <header className="space-y-3">
      {(showBack || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {showBack && (
            <Link
              href="/work"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-accent hover:underline"
            >
              <span aria-hidden>←</span>
              Back to Work
            </Link>
          )}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary">
          {work.title || work.work_type_name || 'Untitled work'}
        </h1>
        <p className="mt-0.5 text-sm text-text-secondary">{work.work_type_name}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(work.status)}`}
        >
          {statusLabel(work.status)}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${priorityBadgeClass(work.priority)}`}
        >
          {work.priority}
        </span>
        {work.template_type && work.template_type !== 'simple' && (
          <span className="inline-flex items-center rounded-full border border-border-color bg-bg-secondary px-2.5 py-0.5 text-xs font-medium text-text-secondary capitalize">
            {work.template_type}
          </span>
        )}
        {isOverdue && (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
            Overdue
          </span>
        )}
      </div>

      {showMeta && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-secondary">
          <span>
            Assigned to <span className="font-medium text-text-primary">{work.assigned_to_name}</span>
          </span>
          <span>
            Due{' '}
            {isOverdue ? (
              <span className="font-medium text-red-600 dark:text-red-400">{formatDate(work.due_date)}</span>
            ) : (
              <span className="font-medium text-text-primary">{formatDate(work.due_date)}</span>
            )}
          </span>
          {work.lead_name && (
            <span>
              Customer <span className="font-medium text-text-primary">{work.lead_name}</span>
            </span>
          )}
        </div>
      )}
    </header>
  );
}
