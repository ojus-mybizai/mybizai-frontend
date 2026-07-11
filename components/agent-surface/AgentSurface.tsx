'use client';

/**
 * P3b — the ONE reusable agent thread. Renders a session (content markdown +
 * ordered blocks, interleaved), handles the user→agent round-trip, and ⭐ save.
 *
 * Interactivity rule: only the LATEST assistant message's interactive blocks are
 * live; older ones render disabled (re-acting would double-submit). Display
 * blocks always render. Saved-view read-only previews reuse <BlockList> directly,
 * not this component.
 */
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Bot, Send, Star, X, Zap } from 'lucide-react';
import { useInternalChatStore } from '@/lib/internal-chat-store';
import { useCommands } from '@/lib/hooks/use-internal-chat';
import type { Callback } from '@/lib/agent-blocks';
import Markdown from './Markdown';
import { BlockList } from './blocks';
import CanvasPreview from './CanvasPreview';

export default function AgentSurface({ conversationId }: { conversationId: number | null }) {
  const {
    messages,
    agentId,
    isThinking,
    loading,
    error,
    loadSession,
    sendText,
    sendCallback,
    retryLast,
    toggleSave,
    clearError,
    reset,
  } = useInternalChatStore(
    useShallow((s) => ({
      messages: s.messages,
      agentId: s.agentId,
      isThinking: s.isThinking,
      loading: s.loading,
      error: s.error,
      loadSession: s.loadSession,
      sendText: s.sendText,
      sendCallback: s.sendCallback,
      retryLast: s.retryLast,
      toggleSave: s.toggleSave,
      clearError: s.clearError,
      reset: s.reset,
    })),
  );

  const [input, setInput] = useState('');
  const [menuIdx, setMenuIdx] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Staged actions: action buttons (e.g. Exclude) accumulate here as removable
  // chips in the composer instead of firing immediately. On send they're
  // composed into ONE instruction so the user can batch multiple in a single turn.
  type StagedChip = { key: string; verb: string; kind: string; name: string };
  const [staged, setStaged] = useState<StagedChip[]>([]);
  // Action names that stage into the composer rather than sending immediately.
  const STAGEABLE = new Set(['exclude']);

  const { data: commands = [] } = useCommands(agentId);

  // Slash autocomplete: open while typing the command token ("/re" → menu),
  // closed once a space is typed (the trailing text is the free-form ask).
  const slashQuery = useMemo(() => {
    const t = input.trimStart();
    if (!t.startsWith('/') || t.includes(' ')) return null;
    return t.slice(1).toLowerCase();
  }, [input]);
  const menu = useMemo(
    () => (slashQuery == null ? [] : commands.filter((c) => c.command.startsWith(slashQuery)).slice(0, 6)),
    [slashQuery, commands],
  );
  const menuOpen = menu.length > 0;

  /** The command slug if the input starts with a known /command. */
  const detectCommand = (text: string): string | undefined => {
    const t = text.trimStart();
    if (!t.startsWith('/')) return undefined;
    const slug = t.slice(1).split(/\s/, 1)[0].toLowerCase();
    return commands.some((c) => c.command === slug) ? slug : undefined;
  };

  const pickCommand = (slug: string) => {
    setInput(`/${slug} `);
    setMenuIdx(0);
  };

  useEffect(() => {
    if (conversationId == null) {
      reset();
      return;
    }
    void loadSession(conversationId);
  }, [conversationId, loadSession, reset]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isThinking]);

  /** Route a block callback: stageable actions accumulate as chips; the rest send now. */
  const handleCallback = (cb: Callback) => {
    if (cb && STAGEABLE.has(cb.action)) {
      const v = cb.values || {};
      const kind = String(v.kind ?? 'item');
      const name = String(v.name ?? v.label ?? '');
      const key = `${cb.action}:${kind}:${name}`.toLowerCase();
      setStaged((prev) => (prev.some((s) => s.key === key) ? prev : [...prev, { key, verb: cb.action, kind, name }]));
      return;
    }
    void sendCallback(cb);
  };

  /** Compose the staged chips (+ any typed note) into one instruction for the agent. */
  const composeStaged = (typed: string): string => {
    const items = staged.map((s) => `${s.kind}${s.name ? ` "${s.name}"` : ''}`).join(', ');
    const base = `Update the proposed design — remove these and re-emit the full design, keeping everything else the same: ${items}.`;
    const note = typed.trim();
    return note ? `${base}\n\nAlso: ${note}` : base;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    // If the slash menu is open, Enter picks the highlighted command instead of sending.
    if (menuOpen) {
      pickCommand(menu[Math.min(menuIdx, menu.length - 1)].command);
      return;
    }
    const typed = input;
    const hasStaged = staged.length > 0;
    if (!hasStaged && !typed.trim()) return;
    const text = hasStaged ? composeStaged(typed) : typed;
    setInput('');
    setStaged([]);
    void sendText(text, hasStaged ? undefined : detectCommand(typed));
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!menuOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMenuIdx((i) => (i + 1) % menu.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMenuIdx((i) => (i - 1 + menu.length) % menu.length);
    } else if (e.key === 'Escape') {
      setInput('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      pickCommand(menu[Math.min(menuIdx, menu.length - 1)].command);
    }
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id ?? null;
  // Only the newest canvas in the thread is interactive (older ones open read-only).
  const latestCanvasId =
    [...messages].reverse().find((m) => m.role === 'assistant' && m.canvas?.length)?.id ?? null;

  if (conversationId == null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-text-secondary">
        <Bot className="h-8 w-8 opacity-40" />
        <p className="text-sm">Pick a session or start a new chat to begin.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
        {loading && messages.length === 0 && (
          <p className="text-sm text-text-secondary">Loading…</p>
        )}

        {!loading && messages.length === 0 && (
          <div className="pt-6 text-center text-sm text-text-secondary">
            Ask anything — the agent can reply with charts, tables, and more.
          </div>
        )}

        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-[14px] leading-relaxed text-white shadow-sm">
                  {m.command && (
                    <span className="mb-1 mr-1 inline-flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 align-middle text-[11px] font-semibold">
                      <Zap className="h-3 w-3" />/{m.command}
                    </span>
                  )}
                  {m.content}
                </div>
              </div>
            );
          }

          // assistant
          const isLatest = m.id === lastAssistantId;
          const blocksDisabled = !isLatest || isThinking;
          const savable = m.id > 0; // real (server) message
          return (
            <div key={m.id} className="flex items-start gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
                <Bot className="h-4 w-4 text-accent" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">{m.content && <Markdown text={m.content} />}</div>
                  {savable && (
                    <button
                      type="button"
                      onClick={() => void toggleSave(m.id)}
                      title={m.saved ? 'Remove from saved' : 'Save this result'}
                      aria-pressed={m.saved}
                      className={`shrink-0 rounded-md p-1 transition ${
                        m.saved ? 'text-amber-500' : 'text-text-secondary hover:text-amber-500'
                      }`}
                    >
                      <Star className="h-4 w-4" fill={m.saved ? 'currentColor' : 'none'} />
                    </button>
                  )}
                </div>
                <BlockList blocks={m.blocks} onCallback={handleCallback} disabled={blocksDisabled} />
                {m.canvas?.length ? (
                  <CanvasPreview
                    canvas={m.canvas}
                    interactive={m.id === latestCanvasId && !isThinking && savable}
                    onCallback={handleCallback}
                    onToggleSave={savable ? () => void toggleSave(m.id) : undefined}
                    saved={m.saved}
                  />
                ) : null}
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="flex items-center gap-2 pl-9 text-text-secondary">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary" />
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            <p>{error}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void retryLast()}
                disabled={isThinking}
                className="rounded-lg bg-accent px-3 py-1 font-semibold text-white disabled:opacity-50"
              >
                Retry
              </button>
              <button type="button" onClick={clearError} className="rounded-lg px-2 py-1 text-text-secondary hover:text-text-primary">
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="relative flex flex-col gap-2 border-t border-border-color bg-bg-secondary/30 p-3">
        {/* Staged action chips — accumulate, edit, then send as one instruction */}
        {staged.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {staged.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2 py-1 text-[12px] font-medium text-accent"
              >
                <span className="capitalize opacity-70">{s.verb}</span>
                <span className="max-w-[160px] truncate">{s.name || s.kind}</span>
                <button
                  type="button"
                  onClick={() => setStaged((prev) => prev.filter((x) => x.key !== s.key))}
                  className="ml-0.5 rounded p-0.5 transition hover:bg-accent/20"
                  aria-label={`Remove ${s.name || s.kind}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setStaged([])}
              className="px-1 text-[11px] text-text-secondary transition hover:text-text-primary"
            >
              clear
            </button>
          </div>
        )}
        <div className="relative flex items-center gap-2">
        {/* Slash-command autocomplete */}
        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-lg">
            {menu.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickCommand(c.command);
                }}
                onMouseEnter={() => setMenuIdx(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left transition ${
                  i === menuIdx ? 'bg-accent/10' : 'hover:bg-bg-secondary'
                }`}
              >
                <Zap className="h-3.5 w-3.5 shrink-0 text-accent" />
                <span className="shrink-0 text-sm font-semibold text-text-primary">/{c.command}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-text-secondary">{c.description || c.title}</span>
                {c.inherited && (
                  <span className="shrink-0 rounded-full bg-bg-secondary px-1.5 py-0.5 text-[9px] uppercase text-text-secondary">
                    {c.scope}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={staged.length > 0 ? 'Add a note (optional), then send…' : 'Ask your agent…  (type / for commands)'}
          disabled={isThinking}
          className="flex-1 rounded-xl border border-border-color bg-card-bg px-3.5 py-2.5 text-[14px] text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isThinking || (!input.trim() && staged.length === 0)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
        </div>
      </form>
    </div>
  );
}
