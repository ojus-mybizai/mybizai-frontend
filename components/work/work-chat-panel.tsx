'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { listComments, createComment, deleteComment, uploadAttachment, type WorkComment } from '@/services/work';
import { formatDate } from '@/lib/format-date';

/* ── types ──────────────────────────────────────────────── */

interface WorkChatPanelProps {
  workId: number;
  currentUserId: number;
  currentUserName: string;
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

function flattenComments(comments: WorkComment[]): WorkComment[] {
  const result: WorkComment[] = [];
  for (const c of comments) {
    result.push(c);
    if (c.replies) result.push(...c.replies);
  }
  return result.sort(
    (a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime(),
  );
}

/* ── component ───────────────────────────────────────────── */

export function WorkChatPanel({
  workId,
  currentUserId,
  currentUserName,
  canManageWork,
  employees,
}: WorkChatPanelProps) {
  const [messages, setMessages] = useState<WorkComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // input state
  const [content, setContent] = useState('');
  const [mentionedIds, setMentionedIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // mention dropdown
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);

  // deleting
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const lastCountRef = useRef(0);

  /* ── load ─────────────────────────────────────────────── */

  const loadComments = useCallback(async () => {
    try {
      setError(null);
      const data = await listComments(workId);
      const flat = flattenComments(data);
      // skip re-render if polling and count unchanged
      if (!isInitialLoad.current && flat.length === lastCountRef.current) return;
      lastCountRef.current = flat.length;
      setMessages(flat);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [workId]);

  // initial load
  useEffect(() => {
    isInitialLoad.current = true;
    setLoading(true);
    loadComments().then(() => {
      isInitialLoad.current = false;
    });
  }, [loadComments]);

  // polling every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      loadComments();
    }, 15_000);
    return () => clearInterval(interval);
  }, [loadComments]);

  /* ── auto-scroll ─────────────────────────────────────── */

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // scroll on initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom('instant');
    }
    // only on loading transition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  /* ── mention logic ───────────────────────────────────── */

  const filteredEmployees = employees.filter((e) =>
    e.name.toLowerCase().includes(mentionQuery.toLowerCase()),
  );

  function handleTextChange(value: string) {
    setContent(value);

    // auto-grow textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    // detect @ trigger
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = value.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);

    if (atMatch) {
      setMentionActive(true);
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionActive(false);
      setMentionQuery('');
    }
  }

  function insertMention(employee: { user_id: number; name: string }) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = content.slice(0, cursorPos);
    const textAfter = content.slice(cursorPos);
    const replaced = textBefore.replace(/@\w*$/, `@${employee.name} `);

    setContent(replaced + textAfter);
    if (!mentionedIds.includes(employee.user_id)) {
      setMentionedIds((ids) => [...ids, employee.user_id]);
    }

    setMentionActive(false);
    setMentionQuery('');

    requestAnimationFrame(() => {
      textarea.focus();
      const pos = replaced.length;
      textarea.setSelectionRange(pos, pos);
    });
  }

  function handleMentionKeyDown(e: React.KeyboardEvent) {
    if (!mentionActive || filteredEmployees.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((i) => Math.min(i + 1, filteredEmployees.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filteredEmployees[mentionIndex]);
    } else if (e.key === 'Escape') {
      setMentionActive(false);
    }
  }

  /* ── submit ──────────────────────────────────────────── */

  async function handleSend() {
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    try {
      await createComment(workId, {
        content: content.trim(),
        mentioned_user_ids: mentionedIds.length > 0 ? mentionedIds : undefined,
      });
      setContent('');
      setMentionedIds([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      isInitialLoad.current = false;
      lastCountRef.current = 0; // force refresh
      await loadComments();
      scrollToBottom('smooth');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: number) {
    setDeletingId(commentId);
    try {
      await deleteComment(workId, commentId);
      lastCountRef.current = 0; // force refresh
      await loadComments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete message');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmitting(true);
    try {
      await uploadAttachment(workId, file);
      await createComment(workId, {
        content: `[\u{1F4CE} ${file.name}]`,
        mentioned_user_ids: undefined,
      });
      lastCountRef.current = 0;
      await loadComments();
      scrollToBottom('smooth');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setSubmitting(false);
      // reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // mention keys take priority
    if (mentionActive && filteredEmployees.length > 0) {
      handleMentionKeyDown(e);
      return;
    }

    // Enter without shift sends
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /* ── render ──────────────────────────────────────────── */

  return (
    <div className="flex h-full flex-col">
      {/* error banner */}
      {error && (
        <div className="mx-3 mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
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

      {/* messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <svg className="h-5 w-5 animate-spin text-text-secondary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-text-secondary">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" />
            </svg>
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isOwn = msg.user_id === currentUserId;
              const canDelete = isOwn || canManageWork;

              return (
                <div
                  key={msg.id}
                  className={`group flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  {/* other user avatar */}
                  {!isOwn && (
                    <span
                      className={`mr-2 mt-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor(msg.user_name)}`}
                    >
                      {msg.user_name.charAt(0).toUpperCase()}
                    </span>
                  )}

                  <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* sender name for other users */}
                    {!isOwn && (
                      <span className="mb-0.5 ml-1 text-xs font-medium text-text-secondary">
                        {msg.user_name}
                      </span>
                    )}

                    {/* bubble */}
                    <div className="relative">
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap ${
                          isOwn
                            ? 'rounded-br-sm bg-accent text-white'
                            : 'rounded-bl-sm bg-bg-secondary text-text-primary dark:bg-bg-secondary'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {/* delete button on hover */}
                      {canDelete && (
                        <button
                          type="button"
                          className={`absolute top-1 ${
                            isOwn ? '-left-7' : '-right-7'
                          } opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-red-500 disabled:opacity-50`}
                          disabled={deletingId === msg.id}
                          onClick={() => handleDelete(msg.id)}
                          title="Delete message"
                        >
                          {deletingId === msg.id ? (
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

                    {/* timestamp */}
                    <span className={`mt-0.5 text-[10px] text-text-secondary ${isOwn ? 'mr-1 text-right' : 'ml-1'}`}>
                      {relativeTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* input bar */}
      <div className="relative shrink-0 border-t border-border-color bg-bg-primary px-3 py-2 dark:bg-bg-primary">
        {/* mention dropdown — positioned above input */}
        {mentionActive && filteredEmployees.length > 0 && (
          <div className="absolute bottom-full mb-1 left-3 z-20 w-64 max-h-48 overflow-y-auto rounded-lg border border-border-color bg-bg-primary shadow-lg dark:bg-bg-secondary">
            {filteredEmployees.map((emp, idx) => (
              <button
                key={emp.user_id}
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent-soft ${
                  idx === mentionIndex ? 'bg-accent-soft' : ''
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(emp);
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
        )}

        {/* mentioned tags */}
        {mentionedIds.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
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

        <div className="flex items-end gap-2">
          {/* attachment button */}
          <button
            type="button"
            className="mb-0.5 shrink-0 rounded-full p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* textarea */}
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none rounded-xl border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:bg-bg-secondary"
            rows={1}
            placeholder="Type a message... (@ to mention)"
            value={content}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {/* send button */}
          <button
            type="button"
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!content.trim() || submitting}
            onClick={handleSend}
            title="Send message"
          >
            {submitting ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
