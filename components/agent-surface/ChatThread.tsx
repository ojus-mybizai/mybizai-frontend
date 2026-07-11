'use client';

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Send } from 'lucide-react';
import type { Callback, MessageOut, SendResponse } from '@/lib/agent-blocks';
import Markdown from './Markdown';
import { BlockList } from './blocks';
import CanvasPreview from './CanvasPreview';

export interface ChatThreadProps {
  getMessages: () => Promise<MessageOut[]>;
  sendTurn: (body: { message: string } | { callback: Callback }) => Promise<SendResponse>;
  emptyHint?: string;
  /** When true: max-height scroll, no full-height flex (used by nested specialist panes). */
  compact?: boolean;
  onMessages?: (messages: MessageOut[]) => void;
  inputDisabled?: boolean;
  inputPlaceholder?: string;
  /** Shown as the agent name tag above assistant messages (e.g. "Contact Manager"). */
  agentLabel?: string;
  /** When true, no composer renders at the bottom — the parent provides its own. */
  hideComposer?: boolean;
  /** Increment to trigger a message re-fetch without remounting the component. */
  refreshKey?: number;
}

let _tempId = -1;
const nextTempId = () => _tempId--;

function callbackLabel(action: string): string {
  if (action === 'confirm') return 'Confirmed.';
  if (action === 'skip') return 'Skip for now.';
  if (action === 'change') return "I'd like to change that.";
  return `(${action})`;
}

export default function ChatThread({
  getMessages,
  sendTurn,
  emptyHint = 'Ask anything to get started.',
  compact = false,
  onMessages,
  inputDisabled = false,
  inputPlaceholder = 'Type a message…',
  agentLabel,
  hideComposer = false,
  refreshKey = 0,
}: ChatThreadProps) {
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');

  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const onMessagesRef = useRef(onMessages);
  onMessagesRef.current = onMessages;

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const loadRef = useRef(getMessages);
  loadRef.current = getMessages;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadRef.current()
      .then((msgs) => {
        if (cancelled) return;
        setMessages(msgs);
        onMessagesRef.current?.(msgs);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load chat.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getMessages, refreshKey]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isThinking]);

  const send = useCallback(async (body: { message: string } | { callback: Callback }, optimistic: MessageOut) => {
    if (isThinking) return;
    setMessages((prev) => [...prev, optimistic]);
    setIsThinking(true);
    setError(null);
    try {
      const res = await sendTurn(body);
      setMessages((prev) => {
        const next = [...prev, ...res.messages];
        onMessagesRef.current?.(next);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The assistant could not respond.');
    } finally {
      setIsThinking(false);
    }
  }, [isThinking, sendTurn]);

  const handleCallback = useCallback((cb: Callback) => {
    void send({ callback: cb }, {
      id: nextTempId(), role: 'user', content: callbackLabel(cb.action), blocks: [], created_at: null, saved: false,
    });
  }, [send]);

  const submit = () => {
    const text = input.trim();
    if (!text || isThinking) return;
    setInput('');
    void send({ message: text }, {
      id: nextTempId(), role: 'user', content: text, blocks: [], created_at: null, saved: false,
    });
  };

  const onSubmit = (e: FormEvent) => { e.preventDefault(); submit(); };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id ?? null;
  const latestCanvasId = [...messages].reverse().find((m) => m.role === 'assistant' && m.canvas?.length)?.id ?? null;

  const threadCls = compact
    ? 'flex min-h-0 flex-col'
    : 'flex h-full min-h-0 flex-col';

  const listCls = compact
    ? 'flex-1 space-y-6 overflow-y-auto px-5 py-5 max-h-[480px]'
    : 'flex-1 space-y-6 overflow-y-auto px-6 py-6';

  return (
    <div className={threadCls}>
      <div ref={listRef} className={listCls}>
        {loading && messages.length === 0 && (
          <p className="text-base text-text-secondary">Loading…</p>
        )}
        {!loading && messages.length === 0 && (
          <div className="pt-6 text-center text-base text-text-secondary">{emptyHint}</div>
        )}

        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-accent px-[18px] py-3 text-[17px] leading-relaxed text-white">
                  {m.content}
                </div>
              </div>
            );
          }

          const isLatest = m.id === lastAssistantId;
          const blocksDisabled = !isLatest || isThinking;

          return (
            <div key={m.id} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
                <Bot className="h-4 w-4 text-accent" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                {agentLabel && (
                  <p className="text-[12px] font-medium text-accent/80 -mb-1">{agentLabel}</p>
                )}
                {m.content && (
                  <div className="text-[17px] leading-relaxed text-text-primary">
                    <Markdown text={m.content} />
                  </div>
                )}
                <BlockList blocks={m.blocks} onCallback={handleCallback} disabled={blocksDisabled} />
                {m.canvas?.length ? (
                  <CanvasPreview
                    canvas={m.canvas}
                    interactive={m.id === latestCanvasId && !isThinking}
                    onCallback={handleCallback}
                  />
                ) : null}
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="flex items-center gap-3 pl-11">
            <span className="flex gap-1.5">
              <span className="h-2 w-2 animate-bounce rounded-full bg-text-secondary/50 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-text-secondary/50 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-text-secondary/50" />
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            <p className="text-[14px]">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="mt-2 rounded-lg px-3 py-1 text-sm text-text-secondary hover:text-text-primary"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {!hideComposer && !inputDisabled && (
        <form
          onSubmit={onSubmit}
          className="flex items-end gap-3 border-t border-border-color bg-bg-secondary/40 px-4 py-3"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={inputPlaceholder}
            disabled={isThinking}
            className="flex-1 resize-none overflow-hidden rounded-2xl border border-border-color bg-card-bg px-4 py-3 text-[15px] leading-relaxed text-text-primary outline-none transition placeholder:text-text-secondary/60 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
            style={{ minHeight: '48px', maxHeight: '160px' }}
          />
          <button
            type="submit"
            disabled={isThinking || !input.trim()}
            className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  );
}
