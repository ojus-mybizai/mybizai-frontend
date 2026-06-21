import { apiFetch } from '@/lib/api-client';

/**
 * Agent Response Playbook — the agent's OWN reply guidance.
 *
 * Each entry belongs to a single agent (free-text `question` label + how to
 * reply). Independent of conversation topics — every agent has its own list.
 * The backend compiles active entries into a [RESPONSE PLAYBOOK] block in the
 * agent's chat system prompt.
 */
export type ReplyMode = 'guide' | 'exact';

export interface ResponsePlayItem {
  id: number;
  question: string;
  reply_mode: ReplyMode;
  guidance: string;
  example_reply?: string | null;
  knowledge_file_id?: number | null;
  position: number;
  is_active: boolean;
}

export interface ResponsePlaybookView {
  agent_id: number;
  items: ResponsePlayItem[];
}

export interface ResponsePlayCreateInput {
  question: string;
  reply_mode?: ReplyMode;
  guidance?: string;
  example_reply?: string | null;
  knowledge_file_id?: number | null;
  is_active?: boolean;
}

export interface ResponsePlayUpdateInput {
  question?: string;
  reply_mode?: ReplyMode;
  guidance?: string;
  example_reply?: string | null;
  knowledge_file_id?: number | null;
  is_active?: boolean;
}

export interface AutodraftResult {
  drafted: number;
  items: ResponsePlayItem[];
}

export async function getPlaybook(agentId: number | string): Promise<ResponsePlaybookView> {
  return apiFetch<ResponsePlaybookView>(`/agent-playbook/${agentId}`, { method: 'GET' });
}

export async function createPlay(
  agentId: number | string,
  payload: ResponsePlayCreateInput,
): Promise<ResponsePlayItem> {
  return apiFetch<ResponsePlayItem>(`/agent-playbook/${agentId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePlay(
  agentId: number | string,
  playId: number,
  payload: ResponsePlayUpdateInput,
): Promise<ResponsePlayItem> {
  return apiFetch<ResponsePlayItem>(`/agent-playbook/${agentId}/${playId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deletePlay(agentId: number | string, playId: number): Promise<void> {
  await apiFetch<void>(`/agent-playbook/${agentId}/${playId}`, { method: 'DELETE' });
}

export async function autodraftPlaybook(agentId: number | string): Promise<AutodraftResult> {
  return apiFetch<AutodraftResult>(`/agent-playbook/${agentId}/autodraft`, { method: 'POST' });
}
