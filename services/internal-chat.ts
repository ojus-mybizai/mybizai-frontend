/**
 * P3b — Internal chat API client. One fn per endpoint (brief §4.1).
 * Every call goes through apiFetch; no raw fetch, no inline URLs in components.
 */
import { apiFetch } from '@/lib/api-client';
import type {
  AgentSummary,
  Callback,
  CommandOut,
  CommandSave,
  ModelsOut,
  SavedViewOut,
  SessionMeta,
  SessionOut,
  SessionSummary,
  SendResponse,
} from '@/lib/agent-blocks';

const BASE = '/internal-chat';

/** Agents with internal chat enabled (business + global system agents). */
export function listInternalAgents(): Promise<AgentSummary[]> {
  return apiFetch<AgentSummary[]>(`${BASE}/agents`, { method: 'GET' });
}

/** Sessions this user has with the given agent. */
export function listSessions(agentId: number): Promise<SessionSummary[]> {
  return apiFetch<SessionSummary[]>(`${BASE}/agents/${agentId}/sessions`, { method: 'GET' });
}

/** Create a new empty session. */
export function createSession(agentId: number): Promise<SessionMeta> {
  return apiFetch<SessionMeta>(`${BASE}/agents/${agentId}/sessions`, { method: 'POST' });
}

/** Rename a session. */
export function renameSession(conversationId: number, title: string): Promise<SessionMeta> {
  return apiFetch<SessionMeta>(`${BASE}/sessions/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

/** Load a full session thread (content + ordered blocks). */
export function getSession(conversationId: number): Promise<SessionOut> {
  return apiFetch<SessionOut>(`${BASE}/sessions/${conversationId}`, { method: 'GET' });
}

/**
 * Send a turn. A free-text turn passes `{ message }`; a block interaction passes
 * `{ callback }`. Both return the new assistant messages produced this turn.
 */
export function sendMessage(
  conversationId: number,
  body: { message: string } | { callback: Callback },
): Promise<SendResponse> {
  return apiFetch<SendResponse>(`${BASE}/sessions/${conversationId}/message`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** ⭐ Star a whole assistant message. */
export function saveMessage(messageId: number): Promise<{ saved_id: number }> {
  return apiFetch<{ saved_id: number }>(`${BASE}/messages/${messageId}/save`, { method: 'POST' });
}

/** Remove a saved view. */
export function deleteSaved(savedId: number): Promise<void> {
  return apiFetch<void>(`${BASE}/saved/${savedId}`, { method: 'DELETE' });
}

/** Saved views for an agent (this user). */
export function listSaved(agentId: number): Promise<SavedViewOut[]> {
  return apiFetch<SavedViewOut[]>(`${BASE}/agents/${agentId}/saved`, { method: 'GET' });
}

/** Chat models a user can assign to an agent (from env config). */
export function listModels(): Promise<ModelsOut> {
  return apiFetch<ModelsOut>(`${BASE}/models`, { method: 'GET' });
}

/** Set which model an agent runs on. */
export function setAgentModel(agentId: number, modelName: string): Promise<AgentSummary> {
  return apiFetch<AgentSummary>(`${BASE}/agents/${agentId}/model`, {
    method: 'PATCH',
    body: JSON.stringify({ model_name: modelName }),
  });
}

// ─── Slash commands (prompt library) ────────────────────────────────
/** Merged commands available to an agent (global ⊕ business ⊕ agent). */
export function listCommands(agentId: number): Promise<CommandOut[]> {
  return apiFetch<CommandOut[]>(`${BASE}/agents/${agentId}/commands`, { method: 'GET' });
}

/** Create (or override-copy) a command at agent/business scope. */
export function createCommand(agentId: number, body: CommandSave): Promise<CommandOut> {
  return apiFetch<CommandOut>(`${BASE}/agents/${agentId}/commands`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Edit a command you own (agent/business scope). */
export function updateCommand(commandId: number, body: CommandSave): Promise<CommandOut> {
  return apiFetch<CommandOut>(`${BASE}/commands/${commandId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** Delete a command you own. */
export function deleteCommand(commandId: number): Promise<void> {
  return apiFetch<void>(`${BASE}/commands/${commandId}`, { method: 'DELETE' });
}
