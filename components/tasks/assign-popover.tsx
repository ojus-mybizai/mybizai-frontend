'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useCreateTask } from '@/hooks/use-tasks';
import { useToastStore } from '@/lib/toast-store';
import type { Task, TaskCreatePayload } from '@/services/tasks';

type DueKey = 'today' | 'tomorrow' | 'in3' | 'custom';

const DUE_OPTIONS: Array<{ key: DueKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'in3', label: '+3d' },
  { key: 'custom', label: 'Pick…' },
];

function dueISOFor(k: DueKey, custom: string | null): string {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  if (k === 'today') return d.toISOString();
  if (k === 'tomorrow') {
    d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  if (k === 'in3') {
    d.setDate(d.getDate() + 3);
    return d.toISOString();
  }
  if (custom) {
    const c = new Date(custom);
    c.setHours(17, 0, 0, 0);
    return c.toISOString();
  }
  return d.toISOString();
}

export function AssignPopover({
  memberId,
  memberName,
  initialText,
  onClose,
  onAssigned,
}: {
  memberId: number;
  memberName: string;
  initialText: string;
  onClose: () => void;
  onAssigned: (t: Task) => void;
}) {
  const create = useCreateTask(memberId);
  const toast = useToastStore((s) => s.add);
  const [title, setTitle] = useState(initialText);
  const [due, setDue] = useState<DueKey>('today');
  const [customDate, setCustomDate] = useState<string>('');
  const [priority, setPriority] = useState<Task['priority']>('normal');
  const [type, setType] = useState<Task['type']>('simple');
  // null = use template/system default (2h). Simple tasks only.
  const [snoozeOverride, setSnoozeOverride] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  const submit = async () => {
    const t = title.trim();
    if (!t) return;
    const payload: TaskCreatePayload = {
      title: t,
      assignee_member_id: memberId,
      type,
      priority,
      due_at: dueISOFor(due, customDate || null),
      source: 'app',
      // Override only meaningful for simple tasks — server ignores otherwise.
      snooze_hours_override: type === 'simple' ? snoozeOverride : null,
    };
    try {
      const created = await create.mutateAsync(payload);
      toast(`Assigned to ${memberName}`, 'success');
      onAssigned(created);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not assign task', 'error');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="Assign task"
      onKeyDown={onKeyDown}
      className="absolute bottom-16 right-3 z-40 w-[320px] rounded-tc-panel border border-tc-rule bg-tc-bg-card p-3 shadow-[var(--tc-shadow-soft)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-tc-ink-muted">
          Assign to {memberName}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-tc-ink-muted hover:bg-tc-bg-card-2 hover:text-tc-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="mb-3 w-full rounded-tc-chip border border-tc-rule bg-tc-bg-ground px-2 py-1.5 text-sm text-tc-ink placeholder:text-tc-ink-muted focus:border-tc-accent focus:outline-none focus:ring-1 focus:ring-tc-accent/40"
      />

      <Section label="Due">
        <div className="flex flex-wrap gap-1">
          {DUE_OPTIONS.map((o) => (
            <Chip key={o.key} active={due === o.key} onClick={() => setDue(o.key)}>
              {o.label}
            </Chip>
          ))}
        </div>
        {due === 'custom' && (
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="mt-2 w-full rounded-tc-chip border border-tc-rule bg-tc-bg-ground px-2 py-1 text-xs text-tc-ink focus:outline-none"
          />
        )}
      </Section>

      <Section label="Priority">
        <div className="flex gap-1">
          {(['low', 'normal', 'high'] as const).map((p) => (
            <Chip key={p} active={priority === p} onClick={() => setPriority(p)}>
              {p}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Type">
        <div className="flex gap-1">
          <Chip active={type === 'simple'} onClick={() => setType('simple')}>Simple</Chip>
          <Chip active={type === 'app_action'} onClick={() => setType('app_action')}>
            <Sparkles className="mr-0.5 inline h-2.5 w-2.5" /> App action
          </Chip>
        </div>
      </Section>

      {type === 'simple' && (
        <Section label='Snooze ("Later" for this task)'>
          <div className="flex flex-wrap gap-1">
            <Chip active={snoozeOverride === null} onClick={() => setSnoozeOverride(null)}>
              Default
            </Chip>
            {[1, 2, 4, 8, 24].map((h) => (
              <Chip key={h} active={snoozeOverride === h} onClick={() => setSnoozeOverride(h)}>
                {h}h
              </Chip>
            ))}
          </div>
        </Section>
      )}

      <button
        onClick={submit}
        disabled={!title.trim() || create.isPending}
        className="mt-3 w-full rounded-tc-chip bg-tc-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
      >
        {create.isPending ? 'Assigning…' : 'Assign  ⌘↵'}
      </button>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-tc-ink-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-tc-chip border px-2 py-1 text-xs transition-colors ${
        active
          ? 'border-tc-accent bg-tc-accent-soft text-tc-accent'
          : 'border-tc-rule text-tc-ink-2 hover:border-tc-accent/50'
      }`}
    >
      {children}
    </button>
  );
}
