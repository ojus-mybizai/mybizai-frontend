'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  X, Clock, CheckCircle2, AlertCircle, MessageSquare, Activity,
  User, Send, FileText, ChevronRight, UserCog, Link2, Copy,
} from 'lucide-react';
import { formatDateTime } from '@/lib/format-date';
import {
  getTask, listTaskComments, addTaskComment, listTaskEvents,
  startTask, completeTask, cancelTask, reassignTask,
  type Task, type TaskComment, type TaskEvent,
} from '@/services/tasks';
import { listMembers, type Member } from '@/services/members';
import { useToastStore } from '@/lib/toast-store';
import { MemberAvatar } from './shared/member-avatar';
import { SessionWindowChip } from './shared/session-window-chip';
import { TaskStatusPill } from './shared/task-status-pill';
import { ReminderStatusPill } from './shared/reminder-status-pill';
import { DueChip } from './shared/due-chip';

const TYPE_BADGE: Record<Task['type'], string> = {
  simple: 'bg-tc-bg-card-2 text-tc-ink-2',
  app_action: 'bg-tc-info-soft text-tc-info',
};

function completionSentence(cc: Record<string, unknown> | null): string | null {
  if (!cc) return null;
  const signal = cc.signal as string;
  if (signal === 'record_created') return 'Done when: a record is created in the target datasheet.';
  if (signal === 'field_equals') return `Done when: ${cc.field} equals "${cc.value}".`;
  if (signal === 'stage_reached') return 'Done when: the deal reaches the target stage.';
  if (signal === 'fields_filled') {
    const fields = (cc.fields as string[]) || [];
    return `Done when: ${fields.join(', ')} are filled.`;
  }
  return null;
}

export function TaskDrawer({
  taskId,
  onClose,
  onTaskUpdated,
}: {
  taskId: number;
  onClose: () => void;
  onTaskUpdated?: () => void;
}) {
  const toast = useToastStore((s) => s.add);
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeTab, setActiveTab] = useState<'activity' | 'comments'>('comments');
  const [commentDraft, setCommentDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c, e, m] = await Promise.all([
        getTask(taskId),
        listTaskComments(taskId),
        listTaskEvents(taskId),
        listMembers({ assignable_only: true }),
      ]);
      setTask(t);
      setComments(c);
      setEvents(e);
      setMembers(m);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not load task', 'error');
    } finally {
      setLoading(false);
    }
  }, [taskId, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const runAction = async (fn: () => Promise<Task>, label: string) => {
    setActionLoading(true);
    try {
      const updated = await fn();
      setTask(updated);
      onTaskUpdated?.();
      const e = await listTaskEvents(taskId);
      setEvents(e);
      toast(label, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : `${label} failed`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReassign = async (memberId: number) => {
    setReassignOpen(false);
    await runAction(() => reassignTask(taskId, memberId), 'Task reassigned');
  };

  const handleComment = async () => {
    if (!commentDraft.trim()) return;
    setSending(true);
    try {
      const c = await addTaskComment(taskId, commentDraft.trim());
      setComments((prev) => [...prev, c]);
      setCommentDraft('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not post comment', 'error');
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/tasks?task=${taskId}`;
    navigator.clipboard.writeText(url);
    toast('Link copied', 'success');
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label="Task details"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-tc-rule bg-tc-bg-card shadow-xl"
      >
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-tc-accent border-t-transparent" />
          </div>
        ) : !task ? (
          <div className="flex flex-1 items-center justify-center text-sm text-tc-ink-muted">
            Task not found.
          </div>
        ) : (
          <>
            <header className="flex items-start gap-3 border-b border-tc-rule p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`rounded-tc-chip px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TYPE_BADGE[task.type]}`}>
                    {task.type === 'simple' ? 'Simple' : 'App action'}
                  </span>
                  <TaskStatusPill status={task.status} />
                  {task.is_overdue && (
                    <span className="rounded-tc-chip bg-tc-alert-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-tc-alert">
                      Overdue
                    </span>
                  )}
                  <ReminderStatusPill task={task} />
                </div>
                <h2 className="font-serif text-lg font-semibold leading-tight text-tc-ink">
                  {task.title}
                </h2>
                <div className="mt-2 flex items-center gap-3 text-xs text-tc-ink-muted">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {task.assignee_name ?? 'Unassigned'}
                  </span>
                  <DueChip dueAt={task.due_at} overdue={task.is_overdue} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={copyLink}
                  aria-label="Copy link"
                  title="Copy link"
                  className="rounded p-1.5 text-tc-ink-muted hover:bg-tc-bg-card-2 hover:text-tc-ink"
                >
                  <Link2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(String(task.id));
                    toast('Task ID copied', 'success');
                  }}
                  aria-label="Copy task ID"
                  title="Copy ID"
                  className="rounded p-1.5 text-tc-ink-muted hover:bg-tc-bg-card-2 hover:text-tc-ink"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded p-1.5 text-tc-ink-muted hover:bg-tc-bg-card-2 hover:text-tc-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {(task.instructions || completionSentence(task.completion_condition)) && (
              <div className="space-y-2 border-b border-tc-rule bg-tc-bg-card-2 px-4 py-3">
                {task.instructions && (
                  <p className="text-sm text-tc-ink-2">{task.instructions}</p>
                )}
                {completionSentence(task.completion_condition) && (
                  <div className="flex items-start gap-2 rounded-tc-chip bg-tc-info-soft px-2 py-1.5 text-xs text-tc-info">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {completionSentence(task.completion_condition)}
                  </div>
                )}
              </div>
            )}

            {task.status !== 'done' && task.status !== 'cancelled' && (
              <div className="flex flex-wrap items-center gap-2 border-b border-tc-rule px-4 py-2">
                {task.status === 'open' && (
                  <ActionButton
                    onClick={() => runAction(() => startTask(task.id), 'Started')}
                    tone="info"
                    disabled={actionLoading}
                  >
                    Start
                  </ActionButton>
                )}
                {task.type === 'simple' && (
                  <ActionButton
                    onClick={() => runAction(() => completeTask(task.id), 'Marked done')}
                    tone="primary"
                    disabled={actionLoading}
                  >
                    Mark done
                  </ActionButton>
                )}
                <div className="relative">
                  <ActionButton
                    onClick={() => setReassignOpen((v) => !v)}
                    tone="ghost"
                    disabled={actionLoading}
                  >
                    <UserCog className="h-3.5 w-3.5" /> Reassign
                  </ActionButton>
                  {reassignOpen && (
                    <div className="absolute left-0 top-full z-10 mt-1 max-h-64 w-56 overflow-y-auto rounded-tc-panel border border-tc-rule bg-tc-bg-card shadow-[var(--tc-shadow-soft)]">
                      {members.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleReassign(m.id)}
                          disabled={m.id === task.assignee_member_id}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-tc-ink hover:bg-tc-bg-card-2 disabled:opacity-40"
                        >
                          <MemberAvatar name={m.name} size={20} />
                          <span className="flex-1 truncate">{m.name}</span>
                          <SessionWindowChip
                            expiresAt={m.session_window_expires_at}
                            active={m.session_active}
                            hasWhatsapp={m.channels.includes('whatsapp')}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <ActionButton
                  onClick={() => runAction(() => cancelTask(task.id), 'Cancelled')}
                  tone="ghost"
                  disabled={actionLoading}
                >
                  Cancel task
                </ActionButton>
              </div>
            )}

            <nav role="tablist" aria-label="Detail tabs" className="flex border-b border-tc-rule">
              {(['comments', 'activity'] as const).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 border-b-2 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
                    activeTab === tab
                      ? 'border-tc-accent text-tc-accent'
                      : 'border-transparent text-tc-ink-muted hover:text-tc-ink-2'
                  }`}
                >
                  {tab === 'comments' ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> Comments ({comments.length})
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" /> Activity
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="flex-1 overflow-y-auto">
              {activeTab === 'comments' && (
                <div className="space-y-3 p-4">
                  {comments.length === 0 && (
                    <p className="py-8 text-center text-xs text-tc-ink-muted">
                      No comments yet.
                    </p>
                  )}
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-tc-card bg-tc-bg-card-2 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <MemberAvatar name={c.author_name ?? '?'} size={20} />
                        <span className="text-xs font-medium text-tc-ink">
                          {c.author_name ?? 'Unknown'}
                        </span>
                        <span className="text-[10px] text-tc-ink-muted">
                          {c.created_at ? formatDateTime(c.created_at) : ''}
                        </span>
                        {c.channel === 'whatsapp' && (
                          <span className="rounded-tc-chip bg-emerald-500/15 px-1 py-0.5 text-[10px] font-medium text-emerald-500">
                            WA
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-tc-ink-2">{c.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-3 p-4">
                  {events.length === 0 && (
                    <p className="py-8 text-center text-xs text-tc-ink-muted">No activity yet.</p>
                  )}
                  {events.map((e) => (
                    <div key={e.id} className="flex items-start gap-2 text-xs">
                      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-tc-bg-card-2">
                        {e.event_type === 'created' && <FileText className="h-3 w-3 text-tc-ink-muted" />}
                        {e.event_type === 'status_changed' && <ChevronRight className="h-3 w-3 text-tc-info" />}
                        {e.event_type === 'assigned' && <User className="h-3 w-3 text-tc-ink-muted" />}
                        {e.event_type.startsWith('reminded') && <Clock className="h-3 w-3 text-tc-alert" />}
                        {e.event_type === 'escalated' && <AlertCircle className="h-3 w-3 text-tc-alert" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-tc-ink">
                          <span className="font-medium">{e.actor_name ?? 'System'}</span>{' '}
                          {e.event_type === 'created' && 'created this task'}
                          {e.event_type === 'status_changed' && `${e.from_status} → ${e.to_status}`}
                          {e.event_type === 'assigned' && 'reassigned this task'}
                          {e.event_type === 'reminded' && `sent reminder #${(e.payload as { count?: number } | null)?.count ?? ''}`.trim()}
                          {e.event_type === 'reminded_overdue' && 'sent an overdue reminder'}
                          {e.event_type === 'snoozed' && (
                            <>tapped Later (snoozed for {(e.payload as { hours?: number } | null)?.hours ?? '?'}h)</>
                          )}
                          {e.event_type === 'reminder_skipped_no_wa' && 'skipped reminder (no WhatsApp)'}
                          {e.event_type === 'escalated_to_owner' && 'escalated to owner'}
                          {e.event_type === 'escalated' && 'escalated to owner'}
                        </p>
                        <p className="text-[10px] text-tc-ink-muted">
                          {e.created_at ? formatDateTime(e.created_at) : ''}
                          {e.channel && ` · ${e.channel}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activeTab === 'comments' && (
              <div className="flex items-center gap-2 border-t border-tc-rule p-3">
                <input
                  type="text"
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleComment()}
                  placeholder="Write a comment…"
                  className="flex-1 rounded-tc-chip border border-tc-rule bg-tc-bg-ground px-2 py-1.5 text-sm text-tc-ink placeholder:text-tc-ink-muted focus:border-tc-accent focus:outline-none focus:ring-1 focus:ring-tc-accent/40"
                />
                <button
                  onClick={handleComment}
                  disabled={sending || !commentDraft.trim()}
                  aria-label="Send comment"
                  className="rounded-tc-chip bg-tc-accent p-2 text-white hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone: 'primary' | 'info' | 'ghost';
}) {
  const toneCls = {
    primary: 'bg-tc-accent text-white hover:opacity-90',
    info: 'bg-tc-info text-white hover:opacity-90',
    ghost: 'border border-tc-rule text-tc-ink-2 hover:bg-tc-bg-card-2',
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-tc-chip px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${toneCls}`}
    >
      {children}
    </button>
  );
}
