'use client';

import React, { useEffect, useState } from 'react';
import {
  updateEntry, listEntryComments, addEntryComment, deleteEntryComment,
  type ProcessEntry, type ProcessStage, type EntryComment,
} from '@/services/processes';
import type { Employee } from '@/services/employees';
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

  useEffect(() => {
    setCommentsLoading(true);
    listEntryComments(entry.id)
      .then(setComments)
      .catch(() => {})
      .finally(() => setCommentsLoading(false));
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
        </div>
      </div>
    </div>
  );
}
