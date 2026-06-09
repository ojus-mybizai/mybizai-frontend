'use client';

import React, { useEffect, useState } from 'react';
import {
  updateEntry, listEntryComments, addEntryComment, deleteEntryComment,
  listEntryWaWork,
  type ProcessEntry, type ProcessStage, type EntryComment,
} from '@/services/processes';
import type { Employee } from '@/services/employees';
import {
  resendAssignment,
  type WaWorkItem, type WaWorkAssignment, type AssignmentStatus,
} from '@/services/waWork';
import { Avatar, PriorityBadge, formatCurrency, relativeTime } from './shared';

interface Props {
  entry: ProcessEntry;
  stages: ProcessStage[];
  employees: Employee[];
  onClose: () => void;
  onUpdated: (e: ProcessEntry) => void;
}

export default function EntryDetailDrawer({ entry, stages, employees, onClose, onUpdated }: Props) {
  const [title, setTitle] = useState(entry.title || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | ''>(entry.priority || '');
  const [expectedValue, setExpectedValue] = useState<string>(entry.expected_value?.toString() || '');
  const [expectedCloseDate, setExpectedCloseDate] = useState<string>(entry.expected_close_date || '');
  const [assigneeId, setAssigneeId] = useState<number | null>(entry.assigned_to_id);
  const [stageId, setStageId] = useState<number | null>(entry.current_stage_id);
  const [saving, setSaving] = useState(false);

  const [comments, setComments] = useState<EntryComment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(true);

  // ── WhatsApp tasks (Phase 3) ───────────────────────────────────────────
  const [waWork, setWaWork] = useState<WaWorkItem[]>([]);
  const [waLoading, setWaLoading] = useState(true);
  const [waError, setWaError] = useState('');

  async function reloadWaWork() {
    setWaLoading(true);
    try {
      const items = await listEntryWaWork(entry.process_id, entry.id);
      setWaWork(items);
      setWaError('');
    } catch (e: any) {
      setWaError(e?.message || 'Failed to load WhatsApp tasks');
    } finally {
      setWaLoading(false);
    }
  }

  useEffect(() => {
    setCommentsLoading(true);
    listEntryComments(entry.id)
      .then(setComments)
      .catch(() => {})
      .finally(() => setCommentsLoading(false));
    reloadWaWork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateEntry(entry.id, {
        title: title.trim() || null,
        priority: priority || null,
        expected_value: expectedValue.trim() === '' ? null : Number(expectedValue),
        expected_close_date: expectedCloseDate || null,
        assigned_to_id: assigneeId,
      });
      onUpdated(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    try {
      const c = await addEntryComment(entry.id, commentBody.trim());
      setComments(prev => [c, ...prev]);
      setCommentBody('');
    } catch {}
  }

  async function handleDeleteComment(id: number) {
    try {
      await deleteEntryComment(entry.id, id);
      setComments(prev => prev.filter(c => c.id !== id));
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="w-full max-w-md bg-card-bg border-l border-border-color overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border-color bg-card-bg">
          <div className="min-w-0">
            <p className="text-xs text-text-secondary">{entry.entity_type}</p>
            <p className="text-base font-semibold text-text-primary truncate">{entry.entity_name || `#${entry.entity_id}`}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-secondary text-text-secondary" title="Close">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Deal title */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Deal title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 enterprise expansion"
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Value + close date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Expected value (₹)</label>
              <input
                type="number"
                value={expectedValue}
                onChange={(e) => setExpectedValue(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Expected close</label>
              <input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {/* Priority + Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">—</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Stage</label>
              <select
                value={stageId ?? ''}
                onChange={(e) => setStageId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Assigned to</label>
            <select
              value={assigneeId ?? ''}
              onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Unassigned</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>

          {/* Meta */}
          <div className="border-t border-border-color pt-3 text-[11px] text-text-secondary space-y-1">
            <div>Entered: {entry.entered_at ? new Date(entry.entered_at).toLocaleString() : '—'}</div>
            <div>In stage: {entry.days_in_stage ?? 0} days</div>
            {entry.source && <div>Source: {entry.source}</div>}
          </div>

          {/* Comments */}
          <div className="border-t border-border-color pt-5">
            <h3 className="text-sm font-semibold text-text-primary mb-2">Comments</h3>
            <form onSubmit={handleAddComment} className="mb-3">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={2}
                placeholder="Leave a note..."
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
              <button
                type="submit"
                disabled={!commentBody.trim()}
                className="mt-1.5 px-3 py-1 text-xs font-medium rounded-md bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
              >
                Post
              </button>
            </form>

            {commentsLoading && <p className="text-xs text-text-secondary">Loading…</p>}
            {!commentsLoading && comments.length === 0 && (
              <p className="text-xs text-text-secondary">No comments yet.</p>
            )}
            <div className="space-y-2">
              {comments.map(c => (
                <div key={c.id} className="flex gap-2 group">
                  <Avatar name={c.user_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-medium text-text-primary truncate">{c.user_name || 'Unknown'}</span>
                      <span className="text-[10px] text-text-secondary">{relativeTime(c.created_at)}</span>
                    </div>
                    <p className="text-xs text-text-primary whitespace-pre-wrap">{c.body}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-red-500"
                    title="Delete"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* WhatsApp tasks — auto-spawned by stage entry. */}
          <WhatsAppTasksSection
            items={waWork}
            loading={waLoading}
            error={waError}
            onRefresh={reloadWaWork}
          />
        </div>
      </div>
    </div>
  );
}

// ─── WhatsApp tasks section ──────────────────────────────────────────────────
// Lists WaWorkItems linked to this process entry (via process_entry_id) with
// per-employee delivery / read / done status. Owners can resend a single
// assignment or peek at the form response for whatsapp_form tasks.

function WhatsAppTasksSection({
  items, loading, error, onRefresh,
}: {
  items: WaWorkItem[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  return (
    <div className="border-t border-border-color pt-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-text-primary">
          WhatsApp tasks {items.length > 0 && <span className="text-text-secondary font-normal">({items.length})</span>}
        </h3>
        <button
          onClick={onRefresh}
          className="text-[11px] text-accent hover:underline font-medium"
          title="Reload — useful after a status webhook"
        >
          ↻ Refresh
        </button>
      </div>

      {loading && <p className="text-xs text-text-secondary">Loading…</p>}
      {!loading && error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="text-xs text-text-secondary">
          No WhatsApp tasks dispatched yet. Configure them on stage cards under Settings.
        </p>
      )}

      <div className="space-y-3">
        {items.map(item => (
          <WaWorkItemCard key={item.id} item={item} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  );
}

function WaWorkItemCard({ item, onRefresh }: { item: WaWorkItem; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(true);

  const completionPct = item.assigned_count > 0
    ? Math.round((item.done_count / item.assigned_count) * 100)
    : 0;

  const statusBadge = (() => {
    const tone =
      item.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : item.status === 'dispatched' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      : item.status === 'draft' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : item.status === 'cancelled' ? 'bg-bg-secondary text-text-secondary'
      : 'bg-bg-secondary text-text-secondary';
    return tone;
  })();

  return (
    <div className="rounded-md border border-border-color bg-bg-secondary/40 overflow-hidden">
      <button
        onClick={() => setExpanded(s => !s)}
        className="w-full text-left flex items-start gap-2 px-3 py-2 hover:bg-bg-secondary"
      >
        <span aria-hidden className="text-base leading-none mt-0.5">📱</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-text-primary truncate">{item.title}</span>
            <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded ${statusBadge}`}>
              {item.status}
            </span>
            {item.dispatch_mode === 'broadcast' && (
              <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                Broadcast
              </span>
            )}
            {item.type && (
              <span className="text-[9px] uppercase tracking-wide text-text-secondary">{item.type}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-secondary">
            <span>{item.done_count}/{item.assigned_count} done</span>
            <span>·</span>
            <span>{item.pending_count} pending</span>
            {item.failed_count > 0 && <><span>·</span><span className="text-red-500">{item.failed_count} failed</span></>}
            {item.dispatched_at && <><span>·</span><span>sent {relativeTime(item.dispatched_at)}</span></>}
          </div>
          {/* Progress bar */}
          <div className="mt-1 h-1 rounded-full bg-bg-primary overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${completionPct}%` }} />
          </div>
        </div>
        <svg className={`h-3.5 w-3.5 text-text-secondary transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-border-color px-3 py-2 space-y-1.5">
          {(item.assignments || []).length === 0 ? (
            <p className="text-[11px] text-text-secondary">No assignments yet.</p>
          ) : (
            (item.assignments || []).map(a => (
              <AssignmentRow key={a.id} assignment={a} onResent={onRefresh} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

const ASSIGNMENT_STATUS_TONE: Record<AssignmentStatus, string> = {
  pending:     'bg-bg-primary text-text-secondary border border-border-color',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  done:        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  not_done:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  skipped:     'bg-bg-secondary text-text-secondary',
  failed:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

function AssignmentRow({ assignment, onResent }: {
  assignment: WaWorkAssignment;
  onResent: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Delivery ticks — single (sent), double (delivered), blue (read). Mirrors
  // WhatsApp's own convention so users intuitively read the status at a glance.
  const tick = (() => {
    if (assignment.wa_read_at) return { label: '✓✓ Read', color: 'text-blue-500' };
    if (assignment.wa_delivered_at) return { label: '✓✓ Delivered', color: 'text-text-secondary' };
    if (assignment.wa_message_id) return { label: '✓ Sent', color: 'text-text-secondary' };
    if (assignment.wa_failed_reason) return { label: '✗ Failed', color: 'text-red-500' };
    return null;
  })();

  async function handleResend() {
    if (busy) return;
    setBusy(true);
    try {
      await resendAssignment(assignment.id);
      onResent();
    } catch (e: any) {
      alert(e?.message || 'Resend failed');
    } finally {
      setBusy(false);
    }
  }

  const hasFormResponse = assignment.form_response && Object.keys(assignment.form_response).length > 0;

  return (
    <div className="rounded bg-card-bg p-2 text-[11px]">
      <div className="flex items-center gap-2 flex-wrap">
        <Avatar name={assignment.employee_name} size="sm" />
        <span className="text-text-primary font-medium truncate flex-1 min-w-0">
          {assignment.employee_name}
        </span>
        <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded ${ASSIGNMENT_STATUS_TONE[assignment.status]}`}>
          {assignment.status.replace('_', ' ')}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-text-secondary flex-wrap">
        <span className="font-mono text-[10px]">{assignment.employee_number}</span>
        {tick && <span className={tick.color}>{tick.label}</span>}
        {assignment.responded_at && (
          <span>· replied {relativeTime(assignment.responded_at)}</span>
        )}
      </div>
      {assignment.wa_failed_reason && (
        <p className="mt-1 text-red-500 text-[10px]">⚠ {assignment.wa_failed_reason}</p>
      )}

      <div className="mt-1.5 flex items-center gap-2">
        {hasFormResponse && (
          <button
            onClick={() => setShowForm(s => !s)}
            className="text-[10px] text-accent hover:underline"
          >
            {showForm ? 'Hide response' : 'View response'}
          </button>
        )}
        <button
          onClick={handleResend}
          disabled={busy}
          className="text-[10px] text-text-secondary hover:text-accent disabled:opacity-50"
          title="Resend the WhatsApp message"
        >
          {busy ? 'Resending…' : '↻ Resend'}
        </button>
      </div>

      {showForm && hasFormResponse && (
        <div className="mt-1.5 rounded bg-bg-secondary p-2">
          <table className="w-full text-[10px]">
            <tbody>
              {Object.entries(assignment.form_response || {}).map(([k, v]) => (
                <tr key={k} className="align-top">
                  <td className="text-text-secondary pr-2 whitespace-nowrap">{k}</td>
                  <td className="text-text-primary break-words">{String(v ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
