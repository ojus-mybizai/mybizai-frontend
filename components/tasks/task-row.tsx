'use client';

import { memo } from 'react';
import { Check, Sparkles } from 'lucide-react';
import type { Task } from '@/services/tasks';
import { DueChip } from './shared/due-chip';
import { ReminderMarker } from './shared/reminder-status-pill';

const PRIORITY_DOT: Record<Task['priority'], string> = {
  high: 'bg-tc-alert',
  normal: 'bg-tc-info',
  low: 'bg-tc-ink-muted/50',
};

interface TaskRowProps {
  task: Task;
  onOpen: (id: number) => void;
  onComplete: (id: number) => void;
  busy?: boolean;
}

function TaskRowBase({ task, onOpen, onComplete, busy }: TaskRowProps) {
  const done = task.status === 'done';
  // app_action tasks auto-close via their completion condition; manual
  // complete is refused by the backend with 400. Disable the checkbox
  // and route the user to the drawer instead.
  const autoOnly = task.type === 'app_action';
  const disabled = done || busy || autoOnly;
  return (
    <div
      className={`group flex items-center gap-3 rounded-tc-card border border-tc-rule bg-tc-bg-card px-3 py-2.5 transition-shadow hover:shadow-[var(--tc-shadow-soft)] ${
        done ? 'opacity-60' : ''
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onComplete(task.id);
        }}
        disabled={disabled}
        title={
          done
            ? 'Task done'
            : autoOnly
              ? 'This task auto-closes when its condition is met — open to see how.'
              : 'Mark done'
        }
        aria-label={
          done
            ? 'Task done'
            : autoOnly
              ? 'Auto-closing task — open for details'
              : 'Mark done'
        }
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
          done
            ? 'border-tc-accent bg-tc-accent text-white'
            : autoOnly
              ? 'border-dashed border-tc-rule-strong bg-transparent text-tc-ink-muted cursor-not-allowed'
              : 'border-tc-rule-strong hover:border-tc-accent hover:bg-tc-accent-soft'
        }`}
      >
        {done && <Check className="h-3 w-3" />}
        {!done && autoOnly && <Sparkles className="h-2.5 w-2.5" />}
      </button>

      <button
        onClick={() => onOpen(task.id)}
        className="flex-1 min-w-0 text-left"
        aria-label={`${task.title} — ${task.assignee_name ?? 'Unassigned'}${
          task.due_at ? ` due ${new Date(task.due_at).toLocaleString()}` : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`}
            aria-hidden
          />
          <span
            className={`truncate text-sm text-tc-ink ${done ? 'line-through' : ''}`}
          >
            {task.title}
          </span>
          {task.type === 'app_action' && (
            <span className="inline-flex items-center gap-0.5 rounded-tc-chip bg-tc-info-soft px-1 py-0.5 text-[10px] font-medium text-tc-info">
              <Sparkles className="h-2.5 w-2.5" /> action
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-tc-ink-muted">
          <DueChip dueAt={task.due_at} overdue={task.is_overdue} />
          <ReminderMarker task={task} />
        </div>
      </button>
    </div>
  );
}

export const TaskRow = memo(TaskRowBase);
