import { apiFetch } from '@/lib/api-client';

export interface StartConversationResult {
  conversation_id: number;
  contact_id: number;
  contact_name: string | null;
  channel_id: number;
}

/**
 * Resolve-or-create a contact and ensure a conversation exists for
 * (contact, channel). Returns the conversation id so the caller can then send
 * the first message/template via the conversation. Used by the inbox
 * "New conversation" action.
 */
export async function startConversation(payload: {
  channel_id: number;
  contact_id?: number;
  phone?: string;
  name?: string;
}): Promise<StartConversationResult> {
  return apiFetch<StartConversationResult>('/convo/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Switch the AI agent handling a conversation. */
export async function switchConversationAgent(convoId: number, agentId: number) {
  return apiFetch(`/convo/${convoId}/switch-agent`, {
    method: 'PUT',
    body: JSON.stringify({ agent_id: agentId }),
  });
}

/** Minimal agent summary for dropdowns / selectors. */
export interface AgentSummary {
  id: number;
  name: string;
  role: string;
  status: string;
}

/** List all agents belonging to the current business (lightweight). */
export async function listAgentsForBusiness(): Promise<AgentSummary[]> {
  const data = await apiFetch<
    Array<{ id: number; name: string; role: string; status: string }>
  >('/agents/?detail=false', { method: 'GET' });
  return data.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    status: a.status,
  }));
}
