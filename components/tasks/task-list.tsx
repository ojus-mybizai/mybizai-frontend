'use client';

import { useMemo } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { Task } from '@/services/tasks';
import { sectionTasks, type TaskSectionKey } from '@/lib/tasks/format';
import { useTaskConsole } from '@/stores/task-console-store';
import { TaskRow } from './task-row';
import { TaskListSkeleton } from './shared/skeletons';

const SECTION_TONE: Record<TaskSectionKey, string> = {
  overdue: 'text-tc-alert',
  today: 'text-tc-ink',
  upcoming: 'text-tc-ink-2',
  done: 'text-tc-ink-muted',
};

export function TaskList({
  tasks,
  loading,
  memberName,
  onOpen,
  onComplete,
}: {
  tasks: Task[];
  loading: boolean;
  memberName: string;
  onOpen: (id: number) => void;
  onComplete: (id: number) => void;
}) {
  const sections = useMemo(() => sectionTasks(tasks), [tasks]);
  const { doneCollapsed, toggleDone } = useTaskConsole();

  if (loading) return <TaskListSkeleton />;

  const hasAny = sections.some((s) => s.tasks.length > 0);
  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-tc-ink-muted">
        <CheckCircle2 className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm font-medium text-tc-ink-2">
          Nothing on {memberName}&apos;s plate.
        </p>
        <p className="mt-1 text-xs">
          Try assigning a task from the composer below.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {sections.map((s) => {
        if (s.tasks.length === 0) return null;
        const isDone = s.key === 'done';
        const collapsed = isDone && doneCollapsed;
        return (
          <section key={s.key}>
            <button
              onClick={isDone ? toggleDone : undefined}
              disabled={!isDone}
              className={`mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider ${SECTION_TONE[s.key]} ${
                isDone ? 'cursor-pointer hover:text-tc-ink-2' : 'cursor-default'
              }`}
            >
              {isDone && (collapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              ))}
              {s.label}
              <span className="ml-1 font-mono normal-case text-tc-ink-muted">
                {s.tasks.length}
              </span>
            </button>
            {!collapsed && (
              <div className="space-y-2">
                {s.tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onOpen={onOpen}
                    onComplete={onComplete}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
