'use client';

import { Clock } from 'lucide-react';
import { formatDayMonth } from '@/lib/format-date';

function label(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  if (sameDay) {
    return then.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    then.getFullYear() === tomorrow.getFullYear() &&
    then.getMonth() === tomorrow.getMonth() &&
    then.getDate() === tomorrow.getDate();
  if (isTomorrow) return 'Tomorrow';
  return formatDayMonth(iso);
}

export function DueChip({
  dueAt,
  overdue,
}: {
  dueAt: string | null;
  overdue: boolean;
}) {
  if (!dueAt) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-tc-ink-muted">
        <Clock className="h-3 w-3" /> No due date
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-mono ${
        overdue ? 'text-tc-alert font-medium' : 'text-tc-ink-muted'
      }`}
    >
      <Clock className="h-3 w-3" />
      {label(dueAt)}
      {overdue && <span className="ml-1 font-sans uppercase tracking-wider">Overdue</span>}
    </span>
  );
}
