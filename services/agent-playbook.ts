import { apiFetch } from '@/lib/api-client';

/**
 * Agent Response Playbook — per-question-type reply guidance.
 *
 * Each item pairs a ConversationTopic (Pricing, Booking, Support, ...) with the
 * owner's reply approach. The backend compiles active plays into a
 * [RESPONSE PLAYBOOK] block in the agent's chat system prompt.
 */
export type ReplyMode = 'guide' | 'exact';

export interface ResponsePlayItem {
  topic_id: number;
  topic_name: string;
  topic_description?: string | null;
  topic_color?: string | null;
  play_id?: number | null;
  reply_mode: ReplyMode;
  guidance: string;
  example_reply?: string | null;
  knowledge_file_id?: number | null;
  is_active: boolean;
}

export interface ResponsePlaybookView {
  agent_id: number;
  items: ResponsePlayItem[];
}

export interface ResponsePlayUpsertInput {
  reply_mode: ReplyMode;
  guidance: string;
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

export async function upsertPlay(
  agentId: number | string,
  topicId: number,
  payload: ResponsePlayUpsertInput,
): Promise<ResponsePlayItem> {
  return apiFetch<ResponsePlayItem>(`/agent-playbook/${agentId}/${topicId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deletePlay(agentId: number | string, topicId: number): Promise<void> {
  await apiFetch<void>(`/agent-playbook/${agentId}/${topicId}`, { method: 'DELETE' });
}

export async function autodraftPlaybook(agentId: number | string): Promise<AutodraftResult> {
  return apiFetch<AutodraftResult>(`/agent-playbook/${agentId}/autodraft`, { method: 'POST' });
}
