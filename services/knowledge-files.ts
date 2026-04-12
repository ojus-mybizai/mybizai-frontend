import { apiFetch } from '@/lib/api-client';

/**
 * Knowledge Files — plain-text knowledge attached to a specific agent.
 *
 * Each file has a unique `topic_key` per agent. At runtime the agent's
 * BrainEngine exposes a `lookup_knowledge` skill with an enum of the agent's
 * topics, so the LLM can fetch the full content only when the customer's
 * question matches one of them.
 */
export interface KnowledgeFile {
  id: number;
  business_id: number;
  agent_id: number;
  title: string;
  topic_key: string;
  content: string;
  trigger_description?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface KnowledgeFileCreateInput {
  agent_id: number;
  title: string;
  topic_key: string;
  content: string;
  trigger_description?: string | null;
  is_active?: boolean;
}

export interface KnowledgeFileUpdateInput {
  title?: string;
  topic_key?: string;
  content?: string;
  trigger_description?: string | null;
  is_active?: boolean;
}

/**
 * List knowledge files for the current business.
 * Optionally filter by agent_id.
 */
export async function listKnowledgeFiles(agentId?: number | string): Promise<KnowledgeFile[]> {
  const query = agentId !== undefined ? `?agent_id=${agentId}` : '';
  return apiFetch<KnowledgeFile[]>(`/knowledge-files/${query}`, { method: 'GET' });
}

export async function getKnowledgeFile(id: number | string): Promise<KnowledgeFile> {
  return apiFetch<KnowledgeFile>(`/knowledge-files/${id}`, { method: 'GET' });
}

export async function createKnowledgeFile(payload: KnowledgeFileCreateInput): Promise<KnowledgeFile> {
  return apiFetch<KnowledgeFile>('/knowledge-files/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateKnowledgeFile(
  id: number | string,
  payload: KnowledgeFileUpdateInput,
): Promise<KnowledgeFile> {
  return apiFetch<KnowledgeFile>(`/knowledge-files/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteKnowledgeFile(id: number | string): Promise<void> {
  await apiFetch<void>(`/knowledge-files/${id}`, { method: 'DELETE' });
}
