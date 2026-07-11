'use client';

/**
 * Dashboard chat → full agent surface. What began as a designer-only view is now a
 * controller that can drive ANY internal-chat agent:
 *   - a real agent switch (SmartInput's picker) — swap to any internal-chat agent,
 *   - a session picker (<SessionModal>) — list / new / switch / rename,
 *   - source-scoping chips (designer only — they change what it builds).
 *
 * It owns agent + session state and the WebSocket transport lifecycle (lifted from
 * <StreamSessionPane>): on agent change it resolves that agent's most-recent (or a
 * fresh) session; on session change it reset→connect→loadSession→(seed)→replay.
 * All effects are StrictMode-safe (cancelled flags, no "already-bound" ref guards).
 * Guarded behind NEXT_PUBLIC_STREAM_DASHBOARD → the scripted MockTransport fallback.
 */
import { useEffect, useState } from 'react';
import { PanelRight } from 'lucide-react';
import { useStreamStore } from '@/lib/agent-stream/stream-store';
import { getMockTransport } from '@/lib/agent-stream/mock-transport';
import { WebSocketTransport } from '@/lib/agent-stream/ws-transport';
import { listInternalAgents, createSession } from '@/services/internal-chat';
import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import AgentChatStream from '@/components/agent-stream/AgentChatStream';
import SmartInput from '@/components/agent-stream/SmartInput';
import SessionModal from '@/components/agent-surface/SessionModal';
import type { AgentSummary, Callback } from '@/lib/agent-blocks';
import { toast } from '@/lib/toast-store';

const LIVE = process.env.NEXT_PUBLIC_STREAM_DASHBOARD !== 'false';
const GREETING =
  "Hi! Tell me what you want on your dashboard — e.g. 'focus on revenue and my team'.";

// Grid→chat hand-off buffer. The grid stages the first message in the store's
// `stagedText`, but the session effect below calls store.reset() (which clears it)
// before the transport binds — and under StrictMode the throwaway first mount's
// reset would wipe it before the surviving mount could read it. So we lift the
// staged text into a MODULE-level buffer (survives remounts, untouched by reset())
// as early as the first render, and replay it once the socket is live.
let handoffBuffer: string | null = null;

export default function DashboardChatPage() {
  const [fatal, setFatal] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Capture the grid→chat hand-off during render — earlier than any effect or
  // reset(), so no teardown can clear it. getState() is SSR-safe; we never
  // overwrite an already-captured value with null.
  const stagedNow = useStreamStore.getState().stagedText;
  if (stagedNow && handoffBuffer === null) handoffBuffer = stagedNow;

  const activeAgent = agents.find((a) => a.id === agentId) ?? null;
  const activeAgentKind = activeAgent?.kind ?? 'dashboard_designer';

  // ── Fallback: scripted transport (no backend) when the flag is off ──
  useEffect(() => {
    if (LIVE) return;
    const store = useStreamStore.getState();
    store.connect(getMockTransport());
    store.seedGreeting(GREETING);
    store.flushStaged();
  }, []);

  // ── 1) Resolve agents once → default to ?agent= or the designer ──
  useEffect(() => {
    if (!LIVE) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listInternalAgents();
        if (cancelled) return;
        const designer = list.find((a) => a.kind === 'dashboard_designer');
        if (!designer) throw new Error('The Dashboard Designer is not available.');
        setAgents(list);
        // Default agent precedence:
        //   1) ?agent= deep-link (explicit intent),
        //   2) the active dashboard layout's bound default agent,
        //   3) the Dashboard Designer.
        // Each candidate must still exist in the agent list, else fall through.
        const raw = new URLSearchParams(window.location.search).get('agent');
        const wanted = raw ? Number(raw) : NaN;
        let initial = list.find((a) => a.id === wanted);
        if (!initial) {
          // Best-effort: read the active layout's default agent (never blocks).
          try {
            const layouts = await apiFetch<{ is_active: boolean; default_agent_id: number | null }[]>(
              '/widgets/layouts',
            );
            if (cancelled) return;
            const active = layouts.find((l) => l.is_active) ?? layouts[0];
            const layoutAgentId = active?.default_agent_id ?? null;
            if (layoutAgentId != null) initial = list.find((a) => a.id === layoutAgentId);
          } catch {
            /* no layout default — fall back below */
          }
        }
        setAgentId((initial ?? designer).id);
      } catch (e) {
        if (cancelled) return;
        // Live path unavailable → degrade to the scripted transport.
        setFatal(e instanceof Error ? e.message : 'Could not reach the agents.');
        const store = useStreamStore.getState();
        store.connect(getMockTransport());
        store.seedGreeting(GREETING);
        store.flushStaged();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── 2) On agent change → always a FRESH session for that agent ──
  // Switching the agent from the composer is an intentional "start over here"
  // gesture, so we open a brand-new session rather than resuming its most-recent
  // one. (Prior threads stay reachable via the <SessionModal> picker.)
  useEffect(() => {
    if (!LIVE || agentId == null) return;
    let cancelled = false;
    // Drop the previous agent's thread immediately (teardown fires in effect 3).
    setConversationId(null);
    (async () => {
      try {
        const { conversation_id: cid } = await createSession(agentId);
        if (cancelled) return;
        setConversationId(cid);
      } catch (e) {
        if (cancelled) return;
        setFatal(e instanceof Error ? e.message : 'Could not open a session.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  // ── 3) On session change → reset → connect → loadSession → seed → replay ──
  useEffect(() => {
    if (!LIVE || conversationId == null) return;
    let cancelled = false;
    const store = useStreamStore.getState();
    const ws = new WebSocketTransport({
      conversationId,
      getToken: () => useAuthStore.getState().accessToken,
      onReconnect: () => void store.loadSession(conversationId),
    });
    // Belt-and-braces: also lift any staged message here (in case it arrived after
    // the first render), before reset() clears it.
    const staged = useStreamStore.getState().stagedText;
    if (staged && handoffBuffer === null) handoffBuffer = staged;
    // reset() before connect so the previous agent's thread/phase can't bleed through.
    store.reset();
    store.connect(ws);
    void store.loadSession(conversationId).then(() => {
      if (cancelled) return;
      // Seed a client-side greeting only for the designer's brand-new empty thread.
      if (activeAgentKind === 'dashboard_designer') store.seedGreeting(GREETING);
      // Replay the message typed on the grid, once, now that the socket is live.
      if (handoffBuffer) {
        const msg = handoffBuffer;
        handoffBuffer = null;
        store.send(msg);
      }
    });
    return () => {
      cancelled = true;
      ws.disconnect();
      store.reset();
    };
    // activeAgentKind is derived from agentId, which drives conversationId — including
    // it keeps the greeting gate honest without causing extra reconnects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, activeAgentKind]);

  // Route every block/canvas action to the backend in session mode; in mock mode
  // there is no server, so an apply just informs the user.
  const handleCallback = (cb: Callback) => {
    const store = useStreamStore.getState();
    if (store.mode === 'session') {
      store.sendCallback(cb);
      return;
    }
    if (cb.action === 'confirm' || cb.action === 'apply') {
      toast.info('Connect the live agent to apply changes.');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden">
        {/* Header: active agent + session picker */}
        {LIVE && activeAgent && (
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 px-4">
            <span className="truncate text-sm font-semibold text-text-primary">
              {activeAgent.name}
            </span>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              title="Sessions & saved"
              className="inline-flex items-center gap-1 rounded-lg border border-border-color px-2.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent hover:text-accent"
            >
              <PanelRight className="h-3.5 w-3.5" /> Sessions
            </button>
          </div>
        )}

        {fatal && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            {fatal} Showing a preview instead.
          </div>
        )}
        <AgentChatStream onCallback={handleCallback} />
        <SmartInput
          variant="pinned"
          agentKind={activeAgentKind}
          agents={LIVE ? agents : undefined}
          agentId={agentId}
          onSwitchAgent={LIVE ? setAgentId : undefined}
        />
      </div>

      <SessionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        agent={activeAgent}
        activeSessionId={conversationId}
        onSwitch={(id) => setConversationId(id)}
      />
    </div>
  );
}
