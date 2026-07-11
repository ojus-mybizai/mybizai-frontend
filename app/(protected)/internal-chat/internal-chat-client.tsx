'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bot, PanelRight, Plus } from 'lucide-react';
import { useInternalAgents, useSessions, useSavedViews } from '@/lib/hooks/use-internal-chat';
import { useInternalChatStore } from '@/lib/internal-chat-store';
import { useStreamStore } from '@/lib/agent-stream/stream-store';
import { queryKeys } from '@/lib/query-client';
import { createSession } from '@/services/internal-chat';
import AgentSurface from '@/components/agent-surface/AgentSurface';
import StreamSessionPane from '@/components/agent-stream/StreamSessionPane';
import SessionModal from '@/components/agent-surface/SessionModal';

// Dashboard Phase 3: flip internal-chat onto the real WebSocket streaming transport.
// Off → the blocking <AgentSurface> fallback (unchanged). Flag is read once at module
// load (build-time NEXT_PUBLIC_* inlining), which is fine for a rollout toggle.
const STREAM_INTERNAL_CHAT = process.env.NEXT_PUBLIC_STREAM_INTERNAL_CHAT === '1';

export default function InternalChatClient() {
  const qc = useQueryClient();
  const { data: agents = [], isLoading: agentsLoading } = useInternalAgents();

  // User-intent selections (null = "not yet chosen" → fall back to a sensible default).
  const [pickedAgentId, setPickedAgentId] = useState<number | null>(null);
  const [pickedSessionId, setPickedSessionId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<'list' | 'chat'>('list');

  // Derive the effective selection during render (no setState-in-effect):
  // default to the first agent / that agent's most recent session.
  const agentId = pickedAgentId ?? agents[0]?.id ?? null;

  const { data: sessions = [] } = useSessions(agentId);
  const { data: saved = [] } = useSavedViews(agentId);

  const sessionId = pickedSessionId ?? sessions[0]?.conversation_id ?? null;

  // Both thread stores expose the same saved-id seam; seed whichever backs the UI.
  const setSavedIds = useInternalChatStore((s) => s.setSavedIds);
  const setOnSavedChanged = useInternalChatStore((s) => s.setOnSavedChanged);
  const streamSetSavedIds = useStreamStore((s) => s.setSavedIds);
  const streamSetOnSavedChanged = useStreamStore((s) => s.setOnSavedChanged);
  const seedSavedIds = STREAM_INTERNAL_CHAT ? streamSetSavedIds : setSavedIds;
  const seedOnSavedChanged = STREAM_INTERNAL_CHAT ? streamSetOnSavedChanged : setOnSavedChanged;

  // Seed the thread store's saved-id map (so ⭐ un-star can DELETE the right id).
  useEffect(() => {
    seedSavedIds(saved);
  }, [saved, seedSavedIds]);

  // Let the store refresh the Saved list whenever a star toggles.
  useEffect(() => {
    seedOnSavedChanged(() => {
      if (agentId != null) void qc.invalidateQueries({ queryKey: queryKeys.internalSaved(agentId) });
    });
    return () => seedOnSavedChanged(null);
  }, [agentId, qc, seedOnSavedChanged]);

  const selectAgent = (id: number) => {
    setPickedAgentId(id);
    setPickedSessionId(null); // fall back to the agent's most recent session
    setMobilePane('chat');
  };

  const startNewChat = async () => {
    if (agentId == null) return;
    const meta = await createSession(agentId);
    await qc.invalidateQueries({ queryKey: queryKeys.internalSessions(agentId) });
    setPickedSessionId(meta.conversation_id);
    setMobilePane('chat');
  };

  const activeAgent = agents.find((a) => a.id === agentId) ?? null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-xl border border-border-color bg-card-bg">
      {/* Left pane — agent list */}
      <aside
        className={`w-full shrink-0 flex-col border-r border-border-color bg-bg-primary md:flex md:w-64 ${
          mobilePane === 'list' ? 'flex' : 'hidden'
        }`}
      >
        <div className="border-b border-border-color px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Agents</h2>
          <p className="text-[11px] text-text-secondary">Internal chat</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {agentsLoading && <p className="px-2 py-3 text-sm text-text-secondary">Loading agents…</p>}
          {!agentsLoading && agents.length === 0 && (
            <p className="px-2 py-3 text-sm text-text-secondary">
              No agents have internal chat enabled yet. Enable it from an agent&apos;s overview page.
            </p>
          )}
          {agents.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => selectAgent(a.id)}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                a.id === agentId
                  ? 'bg-accent/10 font-medium text-accent'
                  : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
              }`}
            >
              <Bot className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <span className="shrink-0 rounded-full bg-bg-secondary px-1.5 py-0.5 text-[10px] text-text-secondary">
                {a.kind}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Main pane — chat */}
      <section className={`min-w-0 flex-1 flex-col ${mobilePane === 'chat' ? 'flex' : 'hidden'} md:flex`}>
        {/* top bar */}
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border-color px-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobilePane('list')}
              className="rounded-md px-2 py-1 text-sm text-text-secondary hover:text-text-primary md:hidden"
            >
              ‹ Agents
            </button>
            <span className="truncate text-sm font-semibold text-text-primary">{activeAgent?.name ?? 'Select an agent'}</span>
          </div>
          {activeAgent && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void startNewChat()}
                title="New chat"
                className="inline-flex items-center gap-1 rounded-lg border border-border-color px-2.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent hover:text-accent"
              >
                <Plus className="h-3.5 w-3.5" /> New
              </button>
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
        </div>

        <div className="min-h-0 flex-1">
          {activeAgent && sessionId == null ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-text-secondary">
              <Bot className="h-8 w-8 opacity-40" />
              <p className="text-sm">No chats yet with {activeAgent.name}.</p>
              <button
                type="button"
                onClick={() => void startNewChat()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> Start a chat
              </button>
            </div>
          ) : STREAM_INTERNAL_CHAT && sessionId != null ? (
            <StreamSessionPane conversationId={sessionId} agentId={agentId} />
          ) : (
            <AgentSurface conversationId={sessionId} />
          )}
        </div>
      </section>

      <SessionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        agent={activeAgent}
        activeSessionId={sessionId}
        onSwitch={(id) => setPickedSessionId(id)}
      />
    </div>
  );
}
