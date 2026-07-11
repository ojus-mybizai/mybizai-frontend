'use client';

/**
 * Phase 1 — deep module behind the onboarding shell.
 *
 * Owns everything the shell shouldn't know: load + one-time conductor bootstrap,
 * the merged-transcript refetch (single source of truth for ordering), active-
 * agent derivation, and composer routing. The shell consumes a value-shaped
 * interface and none of this.
 *
 * The two real *decisions* — which endpoint a send targets, and which agents the
 * picker shows — live in the pure helpers below (`resolveSendTarget`,
 * `deriveAgents`) so they stay unit-testable and free of React/fetch.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Callback, MessageOut } from '@/lib/agent-blocks';
import { useAuthStore } from '@/lib/auth-store';
import * as onboarding from '@/services/onboarding';
import type { OnboardingStatus } from '@/services/onboarding';
import { sendMessage as icSendMessage } from '@/services/internal-chat';

export type AgentRef = {
  agent_id: number | null;
  kind: string;
  label: string;
  conversation_id: number;
};

export interface OnboardingTranscript {
  messages: MessageOut[];
  status: OnboardingStatus | null;
  agents: AgentRef[];
  activeAgent: AgentRef | null;
  setActiveAgent: (a: AgentRef) => void;
  /** Free-text turn to the active agent, then refetch. */
  send: (text: string) => Promise<void>;
  /** Block interaction (choice/proposal/form) routed to the active agent. */
  sendCallback: (cb: Callback) => Promise<void>;
  /** Callback that must always reach the conductor (skip-step, next-setup). */
  conductorCallback: (cb: Callback) => Promise<void>;
  loading: boolean;
  sending: boolean;
}

const CONDUCTOR_KIND = 'onboarding';

// Display labels — mirrors the backend transcript map but the frontend owns its
// own copy (agent_label already arrives on the row; these are the fallbacks for
// agents that have a thread but no assistant message rendered yet).
const KIND_LABEL: Record<string, string> = {
  onboarding:         'Business setup',
  contacts:           'Contact Manager',
  datasheet_designer: 'Datasheet Designer',
  process_designer:   'Process & Automation Designer',
  agent_builder:      'Agent Builder',
};

// ─── Pure helper 1: send routing (testable) ─────────────────────────────────

export type SendTarget =
  | { via: 'conductor' }
  | { via: 'specialist'; conversationId: number };

/** Conductor kind → conductor endpoint; any specialist → its sub-session. */
export function resolveSendTarget(a: AgentRef): SendTarget {
  if (a.kind === CONDUCTOR_KIND) return { via: 'conductor' };
  return { via: 'specialist', conversationId: a.conversation_id };
}

// ─── Pure helper 2: agent derivation (testable) ─────────────────────────────

/**
 * From the merged messages (for agent_id/label enrichment) + status (the
 * authoritative conversation ids), produce the ordered picker list and the
 * default active agent. The conductor always exists (status.conversation_id);
 * a specialist appears once its step has a conversation_id (a thread exists).
 * Default active = the in-progress specialist if any, else the conductor.
 */
export function deriveAgents(
  messages: MessageOut[],
  status: OnboardingStatus,
): { agents: AgentRef[]; defaultActive: AgentRef } {
  const firstOfKind = (kind: string) =>
    messages.find((m) => m.role === 'assistant' && m.agent_kind === kind);

  const refFor = (kind: string, conversationId: number): AgentRef => {
    const seen = firstOfKind(kind);
    return {
      agent_id: seen?.agent_id ?? null,
      kind,
      label: seen?.agent_label ?? KIND_LABEL[kind] ?? kind,
      conversation_id: conversationId,
    };
  };

  const conductor = refFor(CONDUCTOR_KIND, status.conversation_id);
  const agents: AgentRef[] = [conductor];

  let inProgress: AgentRef | null = null;
  for (const kind of status.plan) {
    const step = status.step_statuses[kind];
    if (!step?.conversation_id) continue; // no thread yet → not in the picker
    const ref = refFor(kind, step.conversation_id);
    agents.push(ref);
    if (step.status === 'in_progress') inProgress = ref;
  }

  return { agents, defaultActive: inProgress ?? conductor };
}

// ─── The hook ────────────────────────────────────────────────────────────────

export function useOnboardingTranscript(): OnboardingTranscript {
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  // null = auto-follow the derived default (in-progress specialist / conductor).
  // A string pins the picker to the user's manual choice by kind.
  const [activeKind, setActiveKind] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const setOnboardingRequired = useAuthStore((s) => s.setOnboardingRequired);

  // Refetch both status + the merged transcript. We never append send responses —
  // the server's /transcript is the single source of truth for order.
  const refetch = useCallback(async () => {
    const [s, msgs] = await Promise.all([
      onboarding.getStatus(),
      onboarding.getTranscript(),
    ]);
    setStatus(s);
    setMessages(msgs);
    if (s.onboarding_completed) setOnboardingRequired(false);
  }, [setOnboardingRequired]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // The bootstrap WRITE (conductor's opening turn on an empty thread) lives
        // in /messages; rendering lives in /transcript. Call /messages once for
        // that side-effect and ignore its return, then load the merged stream.
        await onboarding.getStatus();
        await onboarding.getMessages();
        const [s, msgs] = await Promise.all([
          onboarding.getStatus(),
          onboarding.getTranscript(),
        ]);
        if (cancelled) return;
        setStatus(s);
        setMessages(msgs);
        if (s.onboarding_completed) setOnboardingRequired(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setOnboardingRequired]);

  const { agents, activeAgent } = useMemo(() => {
    if (!status) return { agents: [] as AgentRef[], activeAgent: null as AgentRef | null };
    const { agents, defaultActive } = deriveAgents(messages, status);
    const pinned = activeKind ? agents.find((a) => a.kind === activeKind) : undefined;
    return { agents, activeAgent: pinned ?? defaultActive };
  }, [messages, status, activeKind]);

  const setActiveAgent = useCallback((a: AgentRef) => setActiveKind(a.kind), []);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || sending || !activeAgent) return;
    setSending(true);
    try {
      const target = resolveSendTarget(activeAgent);
      if (target.via === 'conductor') await onboarding.sendMessage({ message: text });
      else await icSendMessage(target.conversationId, { message: text });
      await refetch();
    } finally {
      setSending(false);
    }
  }, [sending, activeAgent, refetch]);

  const sendCallback = useCallback(async (cb: Callback) => {
    if (sending || !activeAgent) return;
    setSending(true);
    try {
      const target = resolveSendTarget(activeAgent);
      if (target.via === 'conductor') await onboarding.sendMessage({ callback: cb });
      else await icSendMessage(target.conversationId, { callback: cb });
      await refetch();
    } finally {
      setSending(false);
    }
  }, [sending, activeAgent, refetch]);

  const conductorCallback = useCallback(async (cb: Callback) => {
    if (sending) return;
    setSending(true);
    try {
      await onboarding.sendMessage({ callback: cb });
      await refetch();
    } finally {
      setSending(false);
    }
  }, [sending, refetch]);

  return {
    messages,
    status,
    agents,
    activeAgent,
    setActiveAgent,
    send,
    sendCallback,
    conductorCallback,
    loading,
    sending,
  };
}
