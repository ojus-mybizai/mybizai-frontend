'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSubtasks, createSubtask, updateWork, type Work } from '@/services/work';
import { formatDayMonth as fmtDayMonth } from '@/lib/format-date';

export interface SubtaskListProps {
  workId: number;
  workTypeId: number;
  canEdit: boolean;
  employees: Array<{ user_id: number; name: string }>;
}

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-slate-400',
};

export function SubtaskList({ workId, workTypeId, canEdit, employees }: SubtaskListProps) {
  const [subtasks, setSubtasks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [toggling, setToggling] = useState<Set<number>>(new Set());

  // Inline add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState<number | ''>(employees[0]?.user_id ?? '');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchSubtasks = useCallback(async () => {
    try {
      setError(null);
      const data = await getSubtasks(workId);
      setSubtasks(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load subtasks.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  // Update default assignee when employees prop changes
  useEffect(() => {
    if (newAssignee === '' && employees.length > 0) {
      setNewAssignee(employees[0].user_id);
    }
  }, [employees, newAssignee]);

  const completedCount = subtasks.filter((s) => s.status === 'completed').length;
  const totalCount = subtasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  async function handleToggle(subtask: Work) {
    if (toggling.has(subtask.id)) return;

    setToggling((prev) => new Set(prev).add(subtask.id));
    const newStatus = subtask.status === 'completed' ? 'pending' : 'completed';

    try {
      await updateWork(subtask.id, { status: newStatus });
      await fetchSubtasks();
    } catch {
      // Silently revert -- list stays as-is since we refetch
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(subtask.id);
        return next;
      });
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || newAssignee === '') return;

    setAddError(null);
    setAdding(true);

    try {
      await createSubtask(workId, {
        work_type_id: workTypeId,
        assigned_to_id: Number(newAssignee),
        title: trimmed,
        priority: newPriority,
      });
      setNewTitle('');
      setNewPriority('medium');
      setShowAddForm(false);
      await fetchSubtasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add subtask.';
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  }

  function formatDate(d: string | null | undefined): string {
    if (!d) return '';
    try {
      return fmtDayMonth(d);
    } catch {
      return d;
    }
  }

  function getAssigneeName(id: number | null | undefined): string {
    if (!id) return '';
    const emp = employees.find((e) => e.user_id === id);
    return emp?.name ?? `User #${id}`;
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg p-4">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading subtasks...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchSubtasks(); }}
          className="mt-2 text-xs font-medium text-accent hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-color bg-card-bg">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-secondary/50 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-text-secondary transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold text-text-primary">
            Subtasks ({completedCount}/{totalCount})
          </span>
        </div>
        {totalCount > 0 && (
          <span className="text-xs text-text-secondary">{progressPct}%</span>
        )}
      </button>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="px-4 pb-2">
          <div className="w-full h-1.5 rounded-full bg-bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Subtask rows */}
      {expanded && (
        <div className="px-2 pb-2">
          {subtasks.length === 0 && !showAddForm && (
            <p className="px-2 py-3 text-sm text-text-secondary text-center">No subtasks yet.</p>
          )}

          <ul className="divide-y divide-border-color">
            {subtasks.map((st) => {
              const isCompleted = st.status === 'completed';
              const isTogglingThis = toggling.has(st.id);

              return (
                <li key={st.id} className="flex items-center gap-3 px-2 py-2.5 group">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggle(st)}
                    disabled={isTogglingThis}
                    className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-border-color hover:border-accent'
                    } ${isTogglingThis ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                    aria-label={isCompleted ? 'Mark pending' : 'Mark completed'}
                  >
                    {isCompleted && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Title */}
                  <span
                    className={`flex-1 text-sm truncate ${
                      isCompleted
                        ? 'line-through text-text-secondary'
                        : 'text-text-primary'
                    }`}
                  >
                    {st.title || 'Untitled subtask'}
                  </span>

                  {/* Assignee */}
                  {st.assigned_to_id && (
                    <span className="hidden sm:inline-block text-xs text-text-secondary truncate max-w-[100px]">
                      {st.assigned_to_name || getAssigneeName(st.assigned_to_id)}
                    </span>
                  )}

                  {/* Priority dot */}
                  <span
                    className={`flex-shrink-0 w-2 h-2 rounded-full ${PRIORITY_DOT[st.priority] ?? PRIORITY_DOT.low}`}
                    title={`${st.priority} priority`}
                  />

                  {/* Due date */}
                  {st.due_date && (
                    <span className="hidden sm:inline-block text-xs text-text-secondary whitespace-nowrap">
                      {formatDate(st.due_date)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Add subtask */}
          {canEdit && !showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-1 w-full flex items-center gap-2 px-2 py-2 text-sm text-text-secondary hover:text-accent hover:bg-accent-soft rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add subtask
            </button>
          )}

          {/* Inline add form */}
          {canEdit && showAddForm && (
            <form onSubmit={handleAdd} className="mt-2 px-2 space-y-2">
              {addError && (
                <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Subtask title..."
                  autoFocus
                  className="flex-1 rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Assignee */}
                <select
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value === '' ? '' : Number(e.target.value))}
                  className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
                >
                  <option value="" disabled>Assignee</option>
                  {employees.map((emp) => (
                    <option key={emp.user_id} value={emp.user_id}>
                      {emp.name}
                    </option>
                  ))}
                </select>

                {/* Priority */}
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>

                <div className="flex-1" />

                {/* Actions */}
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setNewTitle(''); setAddError(null); }}
                  disabled={adding}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-secondary border border-border-color transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding || !newTitle.trim() || newAssignee === ''}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {adding && (
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Add
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
