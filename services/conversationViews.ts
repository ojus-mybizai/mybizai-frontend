import { apiFetch } from '@/lib/api-client';

export interface ConversationSavedView {
  id: number;
  name: string;
  emoji: string | null;
  position: number;
  channel_type: string | null;
  mode: string | null;
  contact_group_id: number | null;
  contact_group_name: string | null;
  unread_only: boolean;
  intent: string | null;
  agent_id: number | null;
  created_at: string;
}

export interface ConversationSavedViewCreate {
  name: string;
  emoji?: string | null;
  channel_type?: string | null;
  mode?: string | null;
  contact_group_id?: number | null;
  unread_only?: boolean;
  intent?: string | null;
  agent_id?: number | null;
}

export interface ConversationSavedViewUpdate {
  name?: string;
  emoji?: string | null;
  channel_type?: string | null;
  mode?: string | null;
  contact_group_id?: number | null;
  unread_only?: boolean | null;
  intent?: string | null;
  agent_id?: number | null;
}

export async function listConversationViews(): Promise<ConversationSavedView[]> {
  return apiFetch<ConversationSavedView[]>('/convo/views/', { method: 'GET' });
}

export async function createConversationView(
  payload: ConversationSavedViewCreate,
): Promise<ConversationSavedView> {
  return apiFetch<ConversationSavedView>('/convo/views/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateConversationView(
  id: number,
  payload: ConversationSavedViewUpdate,
): Promise<ConversationSavedView> {
  return apiFetch<ConversationSavedView>(`/convo/views/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteConversationView(id: number): Promise<void> {
  await apiFetch<void>(`/convo/views/${id}`, { method: 'DELETE' });
}

export async function reorderConversationViews(ids: number[]): Promise<void> {
  await apiFetch<void>('/convo/views/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ ids }),
  });
}
