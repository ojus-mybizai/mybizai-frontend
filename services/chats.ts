import { apiFetch } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SenderInfo {
  id: number;
  name: string;
  email: string;
}

export interface TeamChatMessage {
  id: number;
  chat_id: number;
  sender_id: number;
  sender: SenderInfo | null;
  content: string;
  created_at: string;
}

export interface TeamChat {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  created_by_id: number;
  member_ids: number[];
  last_message: string | null;
  last_message_at: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface TeamChatDetail extends TeamChat {
  messages: TeamChatMessage[];
}

export interface TeamChatListResponse {
  chats: TeamChat[];
  total: number;
}

export interface CreateChatPayload {
  name: string;
  description?: string;
  member_ids?: number[];
}

export interface SendMessagePayload {
  content: string;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function listChats(params?: {
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<TeamChatListResponse> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.per_page) qs.set('per_page', String(params.per_page));
  const query = qs.toString();
  return apiFetch(`/chats/${query ? `?${query}` : ''}`, { method: 'GET' });
}

export async function createChat(payload: CreateChatPayload): Promise<TeamChat> {
  return apiFetch('/chats/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getChat(chatId: number, messagesLimit = 100): Promise<TeamChatDetail> {
  return apiFetch(`/chats/${chatId}?messages_limit=${messagesLimit}`, { method: 'GET' });
}

export async function updateChat(
  chatId: number,
  payload: Partial<CreateChatPayload>,
): Promise<TeamChat> {
  return apiFetch(`/chats/${chatId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteChat(chatId: number): Promise<void> {
  return apiFetch(`/chats/${chatId}`, { method: 'DELETE' });
}

export async function sendMessage(chatId: number, content: string): Promise<TeamChatMessage> {
  return apiFetch(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content } as SendMessagePayload),
  });
}

export async function listMessages(
  chatId: number,
  page = 1,
  per_page = 50,
): Promise<TeamChatMessage[]> {
  return apiFetch(`/chats/${chatId}/messages?page=${page}&per_page=${per_page}`, {
    method: 'GET',
  });
}

export async function deleteMessage(chatId: number, msgId: number): Promise<void> {
  return apiFetch(`/chats/${chatId}/messages/${msgId}`, { method: 'DELETE' });
}
