'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { listComments, createComment, deleteComment, type WorkComment } from '@/services/work';
import { formatDate } from '@/lib/format-date';

interface WorkCommentsProps {
  workId: number;
  currentUserId: number;
  canManageWork: boolean;
  employees: Array<{ user_id: number; name: string; email: string }>;
}

/* ── helpers ─────────────────────────────────────────────── */

function relativeTime(iso: string | undefined | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return formatDate(iso);
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-teal-500',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ── component ───────────────────────────────────────────── */

export function WorkComments({ workId, currentUserId, canManageWork, employees }: WorkCommentsProps) {
  const [comments, setComments] = useState<WorkComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // new comment state
  const [newContent, setNewContent] = useState('');
  const [mentionedIds, setMentionedIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // reply state
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyMentionedIds, setReplyMentionedIds] = useState<number[]>([]);
  const [replySubmitting, setReplySubmitting] = useState(false);

  // mention dropdown state
  const [mentionTarget, setMentionTarget] = useState<'new' | 'reply' | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const newTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // deleting state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  /* ── load ─────────────────────────────────────────────── */

  const loadComments = useCallback(async () => {
    try {
      setError(null);
      const data = await listComments(workId);
      setComments(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  /* ── mention logic ─────────────────────────────────────── */

  const filteredEmployees = employees.filter((e) =>
    e.name.toLowerCase().includes(mentionQuery.toLowerCase()),
  );

  function handleTextChange(
    value: string,
    setter: (v: string) => void,
    target: 'new' | 'reply',
  ) {
    setter(value);

    // detect @ trigger
    const textarea = target === 'new' ? newTextareaRef.current : replyTextareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = value.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);

    if (atMatch) {
      setMentionTarget(target);
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionTarget(null);
      setMentionQuery('');
    }
  }

  function insertMention(
    employee: { user_id: number; name: string },
    target: 'new' | 'reply',
  ) {
    const textarea = target === 'new' ? newTextareaRef.current : replyTextareaRef.current;
    const content = target === 'new' ? newContent : replyContent;
    const setter = target === 'new' ? setNewContent : setReplyContent;
    const idSetter = target === 'new' ? setMentionedIds : setReplyMentionedIds;
    const currentIds = target === 'new' ? mentionedIds : replyMentionedIds;

    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = content.slice(0, cursorPos);
    const textAfter = content.slice(cursorPos);
    const replaced = textBefore.replace(/@\w*$/, `@${employee.name} `);

    setter(replaced + textAfter);
    if (!currentIds.includes(employee.user_id)) {
      idSetter([...currentIds, employee.user_id]);
    }

    setMentionTarget(null);
    setMentionQuery('');

    // restore focus
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = replaced.length;
      textarea.setSelectionRange(pos, pos);
    });
  }

  function handleMentionKeyDown(
    e: React.KeyboardEvent,
    target: 'new' | 'reply',
  ) {
    if (mentionTarget !== target || filteredEmployees.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((i) => Math.min(i + 1, filteredEmployees.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filteredEmployees[mentionIndex], target);
    } else if (e.key === 'Escape') {
      setMentionTarget(null);
    }
  }

  /* ── submit ────────────────────────────────────────────── */

  async function handleSubmitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newContent.trim() || submitting) return;

    setSubmitting(true);
    try {
      await createComment(workId, {
        content: newContent.trim(),
        mentioned_user_ids: mentionedIds.length > 0 ? mentionedIds : undefined,
      });
      setNewContent('');
      setMentionedIds([]);
      await loadComments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitReply(parentId: number) {
    if (!replyContent.trim() || replySubmitting) return;

    setReplySubmitting(true);
    try {
      await createComment(workId, {
        content: replyContent.trim(),
        mentioned_user_ids: replyMentionedIds.length > 0 ? replyMentionedIds : undefined,
        parent_comment_id: parentId,
      });
      setReplyContent('');
      setReplyMentionedIds([]);
      setReplyToId(null);
      await loadComments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add reply');
    } finally {
      setReplySubmitting(false);
    }
  }

  async function handleDelete(commentId: number) {
    setDeletingId(commentId);
    try {
      await deleteComment(workId, commentId);
      await loadComments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
    } finally {
      setDeletingId(null);
    }
  }

  /* ── mention dropdown ──────────────────────────────────── */

  function MentionDropdown({ target }: { target: 'new' | 'reply' }) {
    if (mentionTarget !== target || filteredEmployees.length === 0) return null;

    return (
      <div className="absolute z-20 mt-1 w-64 max-h-48 overflow-y-auto rounded-lg border border-border-color bg-bg-primary shadow-lg dark:bg-bg-secondary">
        {filteredEmployees.map((emp, idx) => (
          <button
            key={emp.user_id}
            type="button"
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent-soft ${
              idx === mentionIndex ? 'bg-accent-soft' : ''
            }`}
            onMouseDown={(e) => {
              e.preventDefault(); // prevent textarea blur
              insertMention(emp, target);
            }}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor(emp.name)}`}
            >
              {emp.name.charAt(0).toUpperCase()}
            </span>
            <span className="truncate text-text-primary">{emp.name}</span>
            <span className="ml-auto truncate text-xs text-text-secondary">{emp.email}</span>
          </button>
        ))}
      </div>
    );
  }

  /* ── comment row ───────────────────────────────────────── */

  function CommentRow({ comment, isReply = false }: { comment: WorkComment; isReply?: boolean }) {
    const canDelete = comment.user_id === currentUserId || canManageWork;

    return (
      <div className={`group ${isReply ? 'ml-8' : ''}`}>
        <div className="flex gap-3 py-3">
          {/* avatar */}
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor(comment.user_name)}`}
          >
            {comment.user_name.charAt(0).toUpperCase()}
          </span>

          <div className="min-w-0 flex-1">
            {/* header */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">{comment.user_name}</span>
              <span className="text-xs text-text-secondary">{relativeTime(comment.created_at)}</span>
            </div>

            {/* content */}
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-text-primary break-words">
              {comment.content}
            </p>

            {/* actions */}
            <div className="mt-1 flex items-center gap-3">
              {!isReply && (
                <button
                  type="button"
                  className="text-xs font-medium text-text-secondary hover:text-accent transition-colors"
                  onClick={() => {
                    setReplyToId(replyToId === comment.id ? null : comment.id);
                    setReplyContent('');
                    setReplyMentionedIds([]);
                  }}
                >
                  Reply
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="text-xs text-text-secondary opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all disabled:opacity-50"
                  disabled={deletingId === comment.id}
                  onClick={() => handleDelete(comment.id)}
                  title="Delete comment"
                >
                  {deletingId === comment.id ? (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              )}
            </div>

            {/* inline reply form */}
            {!isReply && replyToId === comment.id && (
              <div className="relative mt-2">
                <textarea
                  ref={replyTextareaRef}
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none dark:bg-bg-secondary"
                  rows={2}
                  placeholder="Write a reply..."
                  value={replyContent}
                  onChange={(e) => handleTextChange(e.target.value, setReplyContent, 'reply')}
                  onKeyDown={(e) => {
                    handleMentionKeyDown(e, 'reply');
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSubmitReply(comment.id);
                    }
                  }}
                />
                <MentionDropdown target="reply" />
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
                    disabled={!replyContent.trim() || replySubmitting}
                    onClick={() => handleSubmitReply(comment.id)}
                  >
                    {replySubmitting ? 'Sending...' : 'Reply'}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                    onClick={() => setReplyToId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="border-l-2 border-border-color">
            {comment.replies.map((reply) => (
              <CommentRow key={reply.id} comment={reply} isReply />
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── render ────────────────────────────────────────────── */

  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-text-primary">Comments</h3>

      {/* error banner */}
      {error && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button
            type="button"
            className="ml-2 font-medium underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* loading state */}
      {loading ? (
        <div className="mt-4 flex items-center justify-center py-8">
          <svg className="h-5 w-5 animate-spin text-text-secondary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <>
          {/* comment list */}
          {comments.length === 0 ? (
            <p className="mt-4 text-center text-sm text-text-secondary py-6">
              No comments yet. Be the first to comment.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-border-color">
              {comments.map((c) => (
                <CommentRow key={c.id} comment={c} />
              ))}
            </div>
          )}

          {/* new comment form */}
          <form onSubmit={handleSubmitNew} className="mt-4 border-t border-border-color pt-4">
            <div className="relative">
              <textarea
                ref={newTextareaRef}
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none dark:bg-bg-secondary"
                rows={3}
                placeholder="Add a comment... (use @ to mention someone)"
                value={newContent}
                onChange={(e) => handleTextChange(e.target.value, setNewContent, 'new')}
                onKeyDown={(e) => {
                  handleMentionKeyDown(e, 'new');
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSubmitNew(e);
                  }
                }}
              />
              <MentionDropdown target="new" />
            </div>

            {mentionedIds.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {mentionedIds.map((uid) => {
                  const emp = employees.find((e) => e.user_id === uid);
                  return emp ? (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent"
                    >
                      @{emp.name}
                      <button
                        type="button"
                        className="hover:text-red-500 transition-colors"
                        onClick={() => setMentionedIds((ids) => ids.filter((id) => id !== uid))}
                      >
                        &times;
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-text-secondary">
                Ctrl+Enter to submit
              </span>
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!newContent.trim() || submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Comment'
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
