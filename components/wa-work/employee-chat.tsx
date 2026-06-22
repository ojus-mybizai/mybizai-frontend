'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, RefreshCw, MessageSquare, AlertCircle, Wrench } from 'lucide-react';
import {
  getEmployeeChat,
  sendEmployeeChatMessage,
  markEmployeeChatRead,
  type WaEmployee,
  type WaEmployeeChat,
  type WaEmployeeChatMessage,
} from '@/services/waEmployees';

interface Props {
  employee: WaEmployee;
  /** Poll interval in ms for fetching new inbound messages. Default 8000. */
  pollMs?: number;
}

const POLL_DEFAULT = 8000;

function formatBubbleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function groupByDay(messages: WaEmployeeChatMessage[]): Array<{ day: string; items: WaEmployeeChatMessage[] }> {
  const buckets = new Map<string, WaEmployeeChatMessage[]>();
  for (const m of messages) {
    const d = new Date(m.timestamp);
    const key = Number.isNaN(d.getTime())
      ? 'Unknown'
      : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const arr = buckets.get(key) ?? [];
    arr.push(m);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries()).map(([day, items]) => ({ day, items }));
}

/**
 * One-on-one WhatsApp chat between the business owner and a registered
 * employee. Used inside the wa-work → By Employee → Chat tab.
 *
 * Manual mode only — there's no AI agent on this thread.
 */
export function EmployeeChat({ employee, pollMs = POLL_DEFAULT }: Props) {
  const [chat, setChat] = useState<WaEmployeeChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const lastMsgCountRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  const canSend = employee.status === 'active' && employee.is_active;

  // Initial + polling load
  const refresh = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setLoading(true);
      try {
        const fresh = await getEmployeeChat(employee.id);
        if (!isMountedRef.current) return;
        setChat(fresh);
        setLoadError(null);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        const msg = err?.data?.detail ?? err?.message ?? 'Could not load chat';
        setLoadError(typeof msg === 'string' ? msg : 'Could not load chat');
      } finally {
        if (isMountedRef.current && !opts.silent) setLoading(false);
      }
    },
    [employee.id],
  );

  useEffect(() => {
    isMountedRef.current = true;
    setChat(null);
    setLoading(true);
    lastMsgCountRef.current = 0;
    void refresh();
    return () => {
      isMountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!pollMs) return;
    const t = setInterval(() => {
      void refresh({ silent: true });
    }, pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  // Mark read when there are unread messages from the employee
  useEffect(() => {
    if (!chat) return;
    if ((chat.unread_count ?? 0) > 0) {
      markEmployeeChatRead(employee.id).catch(() => {
        /* non-fatal */
      });
    }
  }, [chat, employee.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!chat) return;
    const count = chat.messages.length;
    if (count !== lastMsgCountRef.current) {
      lastMsgCountRef.current = count;
      const el = listRef.current;
      if (el) {
        // Defer to next tick so layout has the new bubble height
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    }
  }, [chat]);

  const grouped = useMemo(() => (chat ? groupByDay(chat.messages) : []), [chat]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || sending || !canSend) return;
    setSending(true);
    setSendError(null);

    // Optimistic append
    const tempId = -Date.now();
    const optimistic: WaEmployeeChatMessage = {
      id: tempId,
      role: 'assistant',
      content: text,
      timestamp: new Date().toISOString(),
      read: false,
      delivered: false,
    };
    setChat((prev) =>
      prev
        ? { ...prev, messages: [...prev.messages, optimistic], last_message_at: optimistic.timestamp }
        : prev,
    );
    setDraft('');

    try {
      const sent = await sendEmployeeChatMessage(employee.id, text);
      setChat((prev) => {
        if (!prev) return prev;
        const without = prev.messages.filter((m) => m.id !== tempId);
        return { ...prev, messages: [...without, sent], last_message_at: sent.timestamp };
      });
    } catch (err: any) {
      // Roll back the optimistic message and restore draft so user can retry
      setChat((prev) =>
        prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== tempId) } : prev,
      );
      setDraft(text);
      const msg = err?.data?.detail ?? err?.message ?? 'Could not send message';
      setSendError(typeof msg === 'string' ? msg : 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */

  if (loading && !chat) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-text-secondary animate-spin" />
      </div>
    );
  }

  if (loadError && !chat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-sm text-text-secondary gap-2 px-6 text-center">
        <AlertCircle className="w-6 h-6 text-red-500" />
        <p>{loadError}</p>
        <button
          onClick={() => void refresh()}
          className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-border-color hover:bg-bg-secondary"
        >
          Retry
        </button>
      </div>
    );
  }

  const isEmpty = !chat || chat.messages.length === 0;

  const windowOpen = employee.session_active;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-bg-secondary">
      {/* Session-window status hint — centered, subtle (not a full-width band). */}
      {canSend && (
        <div className="flex items-center justify-center py-1.5 shrink-0">
          <span
            className={[
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium',
              windowOpen ? 'text-green-600' : 'text-amber-600',
            ].join(' ')}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${windowOpen ? 'bg-green-500' : 'bg-amber-500'}`} />
            {windowOpen ? 'Free messaging open · 24h window active' : 'Window closed · template-only until they reply'}
          </span>
        </div>
      )}

      {/* Messages — centered conversation column so bubbles stay chat-sized
          on wide screens instead of stretching edge to edge. */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-4">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-text-secondary">
            <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-text-primary">No messages yet</p>
            <p className="text-xs mt-1 max-w-[260px]">
              {canSend
                ? 'Send a WhatsApp message to start chatting with this employee.'
                : 'Once this employee accepts the WhatsApp invite, their chat will appear here.'}
            </p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-4">
            {grouped.map(({ day, items }) => (
              <div key={day}>
                <div className="flex items-center justify-center mb-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary px-2.5 py-1 rounded-full bg-card-bg border border-border-color">
                    {day}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {items.map((m) => (
                    <ChatBubble key={m.id} message={m} employeeName={employee.name} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="bg-bg-primary border-t border-border-color px-3 py-3 shrink-0"
      >
        <div className="mx-auto w-full max-w-2xl">
          {sendError && (
            <p className="px-1 pb-2 text-xs text-red-600">{sendError}</p>
          )}
          {!canSend && (
            <p className="px-1 pb-2 text-xs text-text-secondary">
              {employee.status === 'pending_acceptance'
                ? 'Waiting for employee to accept the invite — chat send is disabled.'
                : 'Employee is inactive — chat send is disabled.'}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              rows={1}
              placeholder={canSend ? 'Message ' + employee.name + '…' : 'Chat unavailable'}
              disabled={!canSend || sending}
              className="flex-1 resize-none rounded-2xl border border-border-color bg-bg-secondary text-text-primary placeholder:text-text-secondary px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
              style={{ maxHeight: 120 }}
            />
            <button
              type="submit"
              disabled={!canSend || sending || !draft.trim()}
              title="Send (⌘Enter)"
              className="p-2.5 rounded-full bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors shadow-sm"
            >
              {sending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ── Humanize a skill name → readable label (fallback when no content) ─────── */

function humanizeTool(name: string | null | undefined): string {
  if (!name) return 'AI action';
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Chat bubble (WhatsApp-style; left=employee, right=owner/AI) ──────────── */

function ChatBubble({ message, employeeName }: { message: WaEmployeeChatMessage; employeeName: string }) {
  const isOwner = message.role === 'assistant';
  const isTool = message.role === 'tool';
  const isSystem = message.role === 'system';

  // ── AI agent action → centered action pill (mirrors the customer inbox) ──
  // The brain engine writes one `tool`-role message per non-message action the
  // Office Assistant takes (search contact, move stage, send form, …) so the
  // owner sees exactly what the AI did inline in the employee thread.
  if (isTool) {
    const failed = message.tool_status === 'error' || message.tool_status === 'timeout';
    const label = message.content?.trim() || humanizeTool(message.tool_called);
    return (
      <div className="flex justify-center">
        <span
          className={[
            'inline-flex max-w-[85%] items-center gap-1.5 break-words rounded-full border px-3 py-1 text-[11px] font-medium',
            failed
              ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400'
              : 'border-border-color bg-bg-secondary/80 text-text-secondary',
          ].join(' ')}
          title={message.tool_called ? `AI action · ${message.tool_called}` : 'AI action'}
        >
          <Wrench className="w-3 h-3 shrink-0 opacity-70" />
          <span>{label}</span>
        </span>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] text-text-secondary px-3 py-1 rounded-full bg-card-bg border border-border-color">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 ${isOwner ? 'justify-end' : 'justify-start'}`}>
      {/* Incoming avatar */}
      {!isOwner && (
        <div className="w-6 h-6 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
          {employeeName.trim().charAt(0).toUpperCase() || '·'}
        </div>
      )}
      <div
        className={[
          'max-w-[80%] sm:max-w-[70%] rounded-2xl px-3 py-2 shadow-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed',
          isOwner
            ? 'bg-green-600 text-white rounded-br-md'
            : 'bg-card-bg text-text-primary border border-border-color rounded-bl-md',
        ].join(' ')}
      >
        {message.content}
        <div
          className={[
            'mt-1 text-[10px] flex items-center justify-end gap-1',
            isOwner ? 'text-white/75' : 'text-text-secondary',
          ].join(' ')}
        >
          <span>{formatBubbleTime(message.timestamp)}</span>
          {isOwner && (
            <span aria-hidden className={message.read ? 'text-sky-200' : 'text-white/70'}>
              {message.read || message.delivered ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
