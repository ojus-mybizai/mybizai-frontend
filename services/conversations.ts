import { apiFetch } from '@/lib/api-client';

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
  >('/chat_agents/?detail=false', { method: 'GET' });
  return data.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    status: a.status,
  }));
}
