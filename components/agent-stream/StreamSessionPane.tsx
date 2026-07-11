'use client';

/**
 * Dashboard Phase 3 — the streaming replacement for <AgentSurface> on the
 * internal-chat surface. Same features (slash commands, staged action chips, ⭐
 * save, block callbacks) but driven by the streaming store over a real
 * WebSocketTransport instead of a blocking POST. The thread itself is rendered by
 * <AgentChatStream> (which reuses the agent-surface renderers verbatim); this file
 * owns the transport lifecycle + the composer.
 */
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Send, X, Zap } from 'lucide-react';
import type { Callback } from '@/lib/agent-blocks';
import { useAuthStore } from '@/lib/auth-store';
import { useCommands } from '@/lib/hooks/use-internal-chat';
import { useStreamStore } from '@/lib/agent-stream/stream-store';
import { WebSocketTransport } from '@/lib/agent-stream/ws-transport';
import AgentChatStream from './AgentChatStream';

export default function StreamSessionPane({
  conversationId,
  agentId,
}: {
  conversationId: number;
  agentId: number | null;
}) {
  const { connect, reset, loadSession, send, sendCallback, phase } = useStreamStore(
    useShallow((s) => ({
      connect: s.connect,
      reset: s.reset,
      loadSession: s.loadSession,
      send: s.send,
      sendCallback: s.sendCallback,
      phase: s.phase,
    })),
  );

  const [input, setInput] = useState('');
  const [menuIdx, setMenuIdx] = useState(0);
  const { data: commands = [] } = useCommands(agentId);

  // Staged actions (e.g. Exclude): accumulate as removable chips, composed into
  // ONE instruction on send so several can be batched in a single turn.
  type StagedChip = { key: string; verb: string; kind: string; name: string };
  const [staged, setStaged] = useState<StagedChip[]>([]);
  const STAGEABLE = new Set(['exclude']);

  const isThinking = phase === 'working' || phase === 'streaming';

  // ── Transport lifecycle: one WebSocketTransport per conversation ──
  useEffect(() => {
    const transport = new WebSocketTransport({
      conversationId,
      getToken: () => useAuthStore.getState().accessToken,
      // On reconnect, re-pull the session so anything persisted while dropped shows.
      onReconnect: () => void loadSession(conversationId),
    });
    reset();
    connect(transport);
    void loadSession(conversationId);
    return () => {
      transport.disconnect();
      reset();
    };
  }, [conversationId, connect, reset, loadSession]);

  // ── Slash-command autocomplete ──
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
    sendCallback(cb);
  };

  const composeStaged = (typed: string): string => {
    const items = staged.map((s) => `${s.kind}${s.name ? ` "${s.name}"` : ''}`).join(', ');
    const base = `Update the proposed design — remove these and re-emit the full design, keeping everything else the same: ${items}.`;
    const note = typed.trim();
    return note ? `${base}\n\nAlso: ${note}` : base;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
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
    send(text, hasStaged ? undefined : detectCommand(typed));
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

  const composerRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AgentChatStream onCallback={handleCallback} />

      <form onSubmit={onSubmit} className="relative flex flex-col gap-2 border-t border-border-color bg-bg-secondary/30 p-3">
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
          {menuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-lg">
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
            ref={composerRef}
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
