'use client';

import type { Task } from '@/services/tasks';

const LABEL: Record<Task['status'], string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

const TONE: Record<Task['status'], string> = {
  open: 'bg-tc-info-soft text-tc-info',
  in_progress: 'bg-tc-accent-soft text-tc-accent',
  done: 'bg-tc-accent-soft text-tc-accent',
  cancelled: 'bg-tc-bg-card-2 text-tc-ink-muted',
};

export function TaskStatusPill({ status }: { status: Task['status'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-tc-chip px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TONE[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}
