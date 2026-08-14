'use client';

import type { Task } from '@/services/tasks';

const TONE: Record<Task['reminder_status'], string> = {
  active: 'bg-tc-info-soft text-tc-info',
  snoozed: 'bg-tc-info-soft text-tc-info',
  pending_wa_window: 'bg-tc-alert-soft text-tc-alert',
  escalated: 'bg-tc-alert-soft text-tc-alert',
  off: 'bg-tc-bg-card-2 text-tc-ink-muted',
};

function timeStr(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Nothing worth showing for active/off — those are the boring baseline.
// Callers should render this component and treat a null return as "hide me".
export function ReminderStatusPill({ task }: { task: Task }) {
  const { reminder_status } = task;
  if (reminder_status === 'active' || reminder_status === 'off') return null;

  let label = '';
  if (reminder_status === 'snoozed') {
    label = task.snoozed_until ? `Snoozed until ${timeStr(task.snoozed_until)}` : 'Snoozed';
  } else if (reminder_status === 'pending_wa_window') {
    label = 'Waiting for WA window';
  } else if (reminder_status === 'escalated') {
    label = 'Escalated to owner';
  }

  return (
    <span
      title={label}
      className={`inline-flex items-center rounded-tc-chip px-2 py-0.5 text-[11px] font-medium ${TONE[reminder_status]}`}
    >
      {label}
    </span>
  );
}

// Compact marker for TaskRow — icon only with tooltip.
export function ReminderMarker({ task }: { task: Task }) {
  const { reminder_status } = task;
  if (reminder_status === 'snoozed') {
    const label = task.snoozed_until ? `Snoozed until ${timeStr(task.snoozed_until)}` : 'Snoozed';
    return <span title={label} className="text-tc-info">⏰</span>;
  }
  if (reminder_status === 'escalated') {
    return <span title="Escalated — no more reminders" className="text-tc-alert">⚠️</span>;
  }
  if (reminder_status === 'pending_wa_window') {
    return <span title="Waiting for WA window" className="text-tc-alert">⏳</span>;
  }
  return null;
}
