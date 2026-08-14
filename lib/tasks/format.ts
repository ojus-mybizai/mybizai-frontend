import type { Task } from '@/services/tasks';

export type TaskSectionKey = 'overdue' | 'today' | 'upcoming' | 'done';

export interface TaskSection {
  key: TaskSectionKey;
  label: string;
  tasks: Task[];
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function endOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

export function sectionTasks(tasks: Task[]): TaskSection[] {
  const now = new Date();
  const todayEnd = endOfDay(now).getTime();
  const todayStart = startOfDay(now).getTime();

  const overdue: Task[] = [];
  const today: Task[] = [];
  const upcoming: Task[] = [];
  const done: Task[] = [];

  for (const t of tasks) {
    if (t.status === 'done') {
      done.push(t);
      continue;
    }
    if (t.status === 'cancelled') continue;

    if (t.is_overdue) {
      overdue.push(t);
      continue;
    }
    if (!t.due_at) {
      upcoming.push(t);
      continue;
    }
    const due = new Date(t.due_at).getTime();
    if (due >= todayStart && due <= todayEnd) today.push(t);
    else if (due > todayEnd) upcoming.push(t);
    else overdue.push(t);
  }

  return [
    { key: 'overdue', label: 'Overdue', tasks: overdue },
    { key: 'today', label: 'Today', tasks: today },
    { key: 'upcoming', label: 'Upcoming', tasks: upcoming },
    { key: 'done', label: 'Done', tasks: done },
  ];
}

export function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

export function endOfWorkdayISO(): string {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}
