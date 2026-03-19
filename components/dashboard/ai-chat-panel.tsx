'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardMessage, AgentUIBlock } from './types';
import ChatHistory from './chat-history';
import type { ManagerStatus } from '@/services/dashboard';
import {
  sendDashboardChat,
  getManagerHistory,
  listManagerSessions,
  createNewManagerSession,
  activateManagerSession,
  getSessionHistory,
  type ManagerSession,
  type ManagerHistoryMessage,
} from '@/services/dashboard';

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconSend = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
);
const IconStop = () => (
  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
    <rect x="5" y="5" width="14" height="14" rx="2.5" />
  </svg>
);
const IconPlus = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const IconHistory = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconExpand = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
  </svg>
);
const IconCompress = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4m0 5H4m5 0L3 3m12 6h5m-5 0V4m0 5l6-6M9 15v5m0-5H4m5 0l-6 6m12-6h5m-5 0v5m0-5l6 6" />
  </svg>
);
const IconChevron = () => (
  <svg className="h-3 w-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);
const IconSparkle = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);
const IconWebhook = () => (
  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractAgentUI(ui: unknown): AgentUIBlock | null {
  if (!ui || typeof ui !== 'object') return null;
  const t = (ui as Record<string, unknown>)['type'];
  if (typeof t === 'string' && ['slot_form', 'confirmation_card', 'success_card', 'table'].includes(t))
    return ui as AgentUIBlock;
  return null;
}

function hydrateMessages(raw: ManagerHistoryMessage[]): DashboardMessage[] {
  return raw
    .filter((m) => !m.content.startsWith('__'))
    .map((m) => {
      const rawUi = m.ui_blocks;
      const agentUi = extractAgentUI(rawUi);
      return {
        id: `hist-${m.id}`,
        role: m.role,
        content: m.content,
        tool_states: m.tool_states,
        agent_ui: agentUi,
        ui: !agentUi && Array.isArray(rawUi) ? { blocks: rawUi as never } : null,
        source: m.source,
        created_at: m.created_at,
      };
    });
}

// ─── Session Popover ──────────────────────────────────────────────────────────

function SessionPopover({
  sessions, currentSessionId, onSelect, onNewChat, onClose,
}: {
  sessions: ManagerSession[];
  currentSessionId: number | null;
  onSelect: (id: number) => void;
  onNewChat: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-border-color bg-card-bg shadow-2xl shadow-black/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
        <span className="text-xs font-semibold text-text-primary">Conversations</span>
        <button type="button" onClick={onNewChat}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 transition-opacity">
          <IconPlus className="h-3 w-3" /> New
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto py-1.5">
        {sessions.length === 0 && (
          <p className="px-4 py-5 text-center text-xs text-text-secondary">No conversations yet</p>
        )}
        {sessions.map((s) => {
          const active = s.id === currentSessionId;
          return (
            <button key={s.id} type="button"
              onClick={() => { onSelect(s.id); onClose(); }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-secondary transition-colors ${active ? 'bg-accent/5' : ''}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-accent' : 'bg-border-color'}`} />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-xs font-medium ${active ? 'text-accent' : 'text-text-primary'}`}>{s.title}</p>
                <p className="text-[10px] text-text-secondary mt-0.5">
                  {s.message_count} messages
                  {s.last_active_at && ` · ${new Date(s.last_active_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Webhook Popover ──────────────────────────────────────────────────────────

function WebhookPopover({
  status, apiBase, loading, onConnect, onDisconnect, onRegenerateToken, onClose,
}: {
  status: ManagerStatus | null;
  apiBase: string;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRegenerateToken: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const webhookUrl = status ? `${apiBase}/api/v1/dashboard/manager/webhook/${status.webhook_token}` : '';

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [onClose]);

  const copy = () => {
    navigator.clipboard.writeText(webhookUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div ref={ref} className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-border-color bg-card-bg shadow-2xl shadow-black/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-border-color">
        <p className="text-xs font-semibold text-text-primary">AI Manager Connection</p>
        <p className="text-[11px] text-text-secondary mt-0.5">
          {loading ? 'Checking…' : status?.is_connected ? 'Connected and active' : 'Disconnected'}
        </p>
      </div>
      <div className="p-4 space-y-3">
        {/* Connect / Disconnect */}
        {status?.is_connected ? (
          <button type="button" onClick={onDisconnect} disabled={loading}
            className="w-full rounded-xl border border-red-200 bg-red-50 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400 transition-colors">
            Disconnect agent
          </button>
        ) : (
          <button type="button" onClick={onConnect} disabled={loading}
            className="w-full rounded-xl bg-accent py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
            {loading ? 'Connecting…' : 'Connect agent'}
          </button>
        )}

        {/* Webhook URL */}
        {status && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-medium text-text-secondary">Webhook URL</p>
              <button type="button" onClick={onRegenerateToken} className="text-[11px] text-text-secondary hover:text-text-primary underline">
                Regenerate
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border-color bg-bg-secondary px-3 py-2">
              <code className="flex-1 truncate text-[11px] text-accent">{webhookUrl}</code>
              <button type="button" onClick={copy}
                className="shrink-0 rounded-lg border border-border-color bg-card-bg px-2 py-1 text-[11px] font-medium text-text-primary hover:bg-bg-secondary transition-colors">
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-text-secondary leading-relaxed">
              POST <code className="bg-bg-secondary px-1 rounded">{"{ \"message\": \"...\" }"}</code> to this URL — no auth header needed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Thinking dots ────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-3 py-3 pl-1">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
        <IconSparkle />
      </div>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-accent/50 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Quick prompts ────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { icon: '👤', text: 'Add a new lead',         prompt: 'add a new lead' },
  { icon: '📋', text: 'Create a task',           prompt: 'create a new work task' },
  { icon: '📊', text: "Today's overview",        prompt: 'give me a business overview for today' },
  { icon: '👥', text: 'Show team',               prompt: 'show all team members' },
  { icon: '📦', text: 'Recent orders',           prompt: 'show recent orders' },
  { icon: '🔔', text: 'Pending follow-ups',      prompt: 'show pending follow-ups' },
];

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface AIChatPanelProps {
  className?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  managerStatus?: ManagerStatus | null;
  managerLoading?: boolean;
  apiBase?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onRegenerateToken?: () => void;
}

export default function AIChatPanel({
  className = '',
  isFullscreen = false,
  onToggleFullscreen,
  managerStatus,
  managerLoading = false,
  apiBase = '',
  onConnect = () => {},
  onDisconnect = () => {},
  onRegenerateToken = () => {},
}: AIChatPanelProps) {
  const [messages, setMessages]               = useState<DashboardMessage[]>([]);
  const [input, setInput]                     = useState('');
  const [isLoading, setIsLoading]             = useState(false);
  const [currentSessionId, setCurrentSessId]  = useState<number | null>(null);
  const [currentTitle, setCurrentTitle]       = useState('AI Manager');
  const [sessions, setSessions]               = useState<ManagerSession[]>([]);
  const [showSessions, setShowSessions]       = useState(false);
  const [showWebhook, setShowWebhook]         = useState(false);
  const [historyLoaded, setHistoryLoaded]     = useState(false);

  const inputRef          = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const abortRef          = useRef<AbortController | null>(null);

  const isConnected = managerStatus?.is_connected ?? false;

  // ── Boot ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (historyLoaded) return;
    setHistoryLoaded(true);
    (async () => {
      try {
        const h = await getManagerHistory(100);
        setCurrentSessId(h.session_id);
        if (h.messages.length > 0) setMessages(hydrateMessages(h.messages));
      } catch { /* non-critical */ }
    })();
  }, [historyLoaded]);

  const loadSessions = useCallback(async () => {
    try {
      const r = await listManagerSessions();
      setSessions(r.sessions);
      const act = r.sessions.find((s) => s.is_active);
      if (act) setCurrentTitle(act.title);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Auto-resize ───────────────────────────────────────────────────────────

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  // ── Stop ─────────────────────────────────────────────────────────────────

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setMessages((prev) => [...prev, {
      id: `stopped-${Date.now()}`, role: 'assistant',
      content: '_(Response stopped)_', source: 'chat',
    }]);
    inputRef.current?.focus();
  }, []);

  // ── Send ─────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async (message?: string) => {
    const trimmed = (message ?? input).trim();
    if (!trimmed || isLoading) return;

    const isControl = trimmed.startsWith('__');
    if (!isControl) {
      setMessages((prev) => [...prev, {
        id: `user-${Date.now()}`, role: 'user', content: trimmed, source: 'chat',
      }]);
    }
    setInput('');
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }
    setIsLoading(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const history = messages
        .filter((m) => !m.content.startsWith('__'))
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const res = await sendDashboardChat(trimmed || ' ', history, undefined, undefined, ctrl.signal);

      const rawUi  = res.ui;
      const agentUi = extractAgentUI(rawUi);
      const legacyUi = !agentUi && rawUi && typeof rawUi === 'object' && 'blocks' in rawUi
        ? (rawUi as { blocks: unknown[] }) : null;

      setMessages((prev) => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        agent_ui: agentUi,
        ui: legacyUi ? { blocks: legacyUi.blocks as never } : null,
        tool_states: res.tool_states ?? [],
        source: 'chat',
      }]);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`, role: 'assistant',
        content: (err as Error).message || 'Something went wrong. Please try again.',
        source: 'chat',
      }]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages]);

  // ── Edit ─────────────────────────────────────────────────────────────────

  const handleEdit = useCallback((msgId: string, content: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msgId);
      return idx === -1 ? prev : prev.slice(0, idx);
    });
    setInput(content);
    setTimeout(() => {
      const ta = inputRef.current;
      if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; autoResize(ta); }
    }, 50);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSelectSession = async (id: number) => {
    try {
      const r = await activateManagerSession(id);
      setCurrentSessId(r.session_id);
      setCurrentTitle(r.title || 'AI Manager');
      const h = await getSessionHistory(id, 100);
      setMessages(hydrateMessages(h.messages));
      await loadSessions();
    } catch { /* non-critical */ }
  };

  const handleNewChat = async () => {
    try {
      const r = await createNewManagerSession();
      setCurrentSessId(r.session_id);
      setCurrentTitle('New Chat');
      setMessages([]);
      await loadSessions();
      setShowSessions(false);
    } catch { /* non-critical */ }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>

      {/* ── Slim header ── */}
      <div className="flex shrink-0 items-center justify-between px-2 pb-2">

        {/* Session selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowSessions((v) => !v); setShowWebhook(false); }}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-text-primary hover:bg-bg-secondary transition-colors"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
              isConnected ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-zinc-500'
            }`} />
            <span className="max-w-[200px] truncate">{currentTitle}</span>
            <IconChevron />
          </button>
          {showSessions && (
            <SessionPopover
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelect={handleSelectSession}
              onNewChat={handleNewChat}
              onClose={() => setShowSessions(false)}
            />
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-0.5">
          {/* Webhook / connection popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowWebhook((v) => !v); setShowSessions(false); }}
              title="Connection & webhook"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
            >
              <IconWebhook />
            </button>
            {showWebhook && (
              <WebhookPopover
                status={managerStatus ?? null}
                apiBase={apiBase}
                loading={managerLoading}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
                onRegenerateToken={onRegenerateToken}
                onClose={() => setShowWebhook(false)}
              />
            )}
          </div>

          <button type="button" onClick={() => { setShowSessions((v) => !v); setShowWebhook(false); }}
            title="Conversation history"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors">
            <IconHistory />
          </button>

          <button type="button" onClick={handleNewChat} title="New conversation"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors">
            <IconPlus />
          </button>

          {onToggleFullscreen && (
            <button type="button" onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit full view' : 'Full view'}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors">
              {isFullscreen ? <IconCompress /> : <IconExpand />}
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (

          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center gap-5 px-6 py-8 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <IconSparkle />
              </div>
              <p className="text-base font-semibold text-text-primary">AI Manager</p>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed max-w-xs">
                Your business co-pilot. Ask anything or pick a quick action.
              </p>
            </div>
            <div className="grid w-full max-w-sm grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((q) => (
                <button key={q.prompt} type="button" onClick={() => handleSend(q.prompt)}
                  className="flex items-center gap-2.5 rounded-xl border border-border-color bg-card-bg px-3 py-2.5 text-left text-xs font-medium text-text-primary hover:border-accent hover:bg-accent/5 transition-all shadow-sm">
                  <span className="text-base leading-none">{q.icon}</span>
                  {q.text}
                </button>
              ))}
            </div>
          </div>

        ) : (

          <div className="px-4 py-2">
            <ChatHistory messages={messages} onSend={handleSend} onEdit={handleEdit} disabled={isLoading} />
            {isLoading && <ThinkingDots />}
            <div ref={messagesEndRef} />
          </div>

        )}
      </div>

      {/* ── Floating input (Claude-style) ── */}
      <div className="shrink-0 px-3 pb-3 pt-1">
        <div className={`rounded-2xl border bg-card-bg shadow-lg shadow-black/10 dark:shadow-black/40 transition-all ${
          isLoading
            ? 'border-accent/30 shadow-accent/5'
            : 'border-border-color hover:border-accent/30 focus-within:border-accent/50 focus-within:shadow-accent/10'
        }`}>
          {/* Text input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? 'AI is thinking…' : 'Message AI Manager…'}
            rows={1}
            disabled={isLoading}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm leading-relaxed text-text-primary placeholder-text-secondary/50 focus:outline-none disabled:cursor-default disabled:opacity-60"
            style={{ maxHeight: '140px', overflowY: 'auto' }}
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-3 pb-2.5">
            <p className="text-[10px] text-text-secondary/40 select-none">
              ↵ send · ⇧↵ new line · hover to edit
            </p>

            {/* Send / Stop */}
            {isLoading ? (
              <button type="button" onClick={handleStop} title="Stop response"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500 text-white shadow-sm hover:bg-red-600 transition-colors">
                <IconStop />
              </button>
            ) : (
              <button type="button" onClick={() => handleSend()} disabled={!input.trim()} title="Send"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white shadow-sm hover:opacity-90 disabled:opacity-25 transition-opacity">
                <IconSend />
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
