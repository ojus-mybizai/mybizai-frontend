import { apiFetch } from '@/lib/api-client';

export interface ConversationTopic {
  id: number;
  name: string;
  description: string | null;
  keywords: string | null;
  color: string | null;
  is_system: boolean;
  position: number;
  usage_count: number | null;
  created_at: string | null;
}

export interface ConversationTopicCreate {
  name: string;
  description?: string | null;
  keywords?: string | null;
  color?: string | null;
}

export interface ConversationTopicUpdate {
  name?: string;
  description?: string | null;
  keywords?: string | null;
  color?: string | null;
  position?: number;
}

export async function listConversationTopics(): Promise<ConversationTopic[]> {
  return apiFetch<ConversationTopic[]>('/conversation-topics/', { method: 'GET' });
}

export async function createConversationTopic(
  payload: ConversationTopicCreate,
): Promise<ConversationTopic> {
  return apiFetch<ConversationTopic>('/conversation-topics/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateConversationTopic(
  id: number,
  payload: ConversationTopicUpdate,
): Promise<ConversationTopic> {
  return apiFetch<ConversationTopic>(`/conversation-topics/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteConversationTopic(id: number): Promise<void> {
  await apiFetch<void>(`/conversation-topics/${id}`, { method: 'DELETE' });
}

export async function seedDefaultConversationTopics(): Promise<ConversationTopic[]> {
  return apiFetch<ConversationTopic[]>('/conversation-topics/seed-defaults', {
    method: 'POST',
  });
}
