'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, RefreshCw, MessageSquare, AlertCircle } from 'lucide-react';
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

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-bg-secondary">
      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
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
          <div className="space-y-4">
            {grouped.map(({ day, items }) => (
              <div key={day}>
                <div className="flex items-center justify-center mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary px-2 py-0.5 rounded-full bg-card-bg border border-border-color">
                    {day}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {items.map((m) => (
                    <ChatBubble key={m.id} message={m} />
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
            className="flex-1 resize-none rounded-xl border border-border-color bg-bg-secondary text-text-primary placeholder:text-text-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
            style={{ maxHeight: 120 }}
          />
          <button
            type="submit"
            disabled={!canSend || sending || !draft.trim()}
            title="Send (⌘Enter)"
            className="p-2 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {sending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Chat bubble (WhatsApp-style; left=employee, right=owner) ─────────────── */

function ChatBubble({ message }: { message: WaEmployeeChatMessage }) {
  const isOwner = message.role === 'assistant';
  const isSystem = message.role === 'system' || message.role === 'tool';

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
    <div className={`flex ${isOwner ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[78%] rounded-2xl px-3 py-2 shadow-sm whitespace-pre-wrap break-words text-sm',
          isOwner
            ? 'bg-green-600 text-white rounded-br-md'
            : 'bg-card-bg text-text-primary border border-border-color rounded-bl-md',
        ].join(' ')}
      >
        {message.content}
        <div
          className={[
            'mt-1 text-[10px] flex items-center justify-end gap-1',
            isOwner ? 'text-white/80' : 'text-text-secondary',
          ].join(' ')}
        >
          <span>{formatBubbleTime(message.timestamp)}</span>
          {isOwner && (
            <span aria-hidden>
              {message.read ? '✓✓' : message.delivered ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
