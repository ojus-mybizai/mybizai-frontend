/**
 * Agent Builder v2 (JSON-config flow) — typed wrappers around
 * /agent-builder/v2/* endpoints. Used by the per-agent builder chat panel.
 */
import { apiFetch } from '@/lib/api-client'

export interface ConfigIssue {
  id: string
  severity: 'error' | 'warn'
  field: string
  message: string
}

// The config is intentionally loose on the client — the panel only needs to
// summarise changes, not validate them (the backend does that).
export type AgentConfig = Record<string, unknown>

export interface AskQuestion {
  text: string
  options: string[]
  multi: boolean
  allow_custom: boolean
}

export interface TurnOutput {
  mode: 'ask' | 'propose'
  message: string
  question?: AskQuestion | null
  config?: AgentConfig | null
  patch?: Record<string, unknown> | null
  merged?: AgentConfig | null
  issues?: ConfigIssue[]
  ready_to_apply?: boolean
}

export interface RefineTranscript {
  customer_msg: string
  agent_reply: string
}

export const agentBuilderV2 = {
  /** Serialize the live agent into the editable config (for the panel). */
  getConfig: (agentId: number | string): Promise<AgentConfig> =>
    apiFetch<AgentConfig>(`/agent-builder/v2/agents/${agentId}/config`),

  /** One conversational turn — feedback + prior history (+ optional test transcript). */
  refine: (
    agentId: number | string,
    feedback: string,
    opts?: { transcript?: RefineTranscript; history?: { role: string; content: string }[] },
  ): Promise<TurnOutput> =>
    apiFetch<TurnOutput>(`/agent-builder/v2/agents/${agentId}/refine`, {
      method: 'POST',
      body: JSON.stringify({
        feedback,
        transcript: opts?.transcript ?? null,
        history: opts?.history ?? null,
      }),
    }),

  /** Apply a confirmed patch to the agent. */
  applyRefine: (
    agentId: number | string,
    patch: Record<string, unknown>,
  ): Promise<{ agent_id: number; name: string; config: AgentConfig }> =>
    apiFetch(`/agent-builder/v2/agents/${agentId}/apply-refine`, {
      method: 'POST',
      body: JSON.stringify({ patch }),
    }),

  /** One CREATE turn (draft flow) — needs an existing builder session id. */
  draft: (sessionId: string, message: string): Promise<TurnOutput> =>
    apiFetch<TurnOutput>(`/agent-builder/v2/sessions/${sessionId}/draft`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  /** Build the drafted config into a real agent. */
  applyDraft: (sessionId: string): Promise<{ agent_id: number; name: string }> =>
    apiFetch(`/agent-builder/v2/sessions/${sessionId}/apply`, { method: 'POST' }),
}
