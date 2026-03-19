import { apiFetch } from '@/lib/api-client';
import type { ChatAPIResponse } from '@/types/ui-protocol';
import type { ToolState } from '@/components/dashboard/tool-state-display';

export interface DashboardChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Chat response: reply text + optional structured UI + tool execution states. */
export interface DashboardChatResponse extends ChatAPIResponse {
  tool_states?: ToolState[];
}

// ---------------------------------------------------------------------------
// Manager session
// ---------------------------------------------------------------------------

export interface ManagerStatus {
  session_id: number;
  is_connected: boolean;
  webhook_token: string;
  last_active_at: string | null;
}

export interface ManagerSession {
  id: number;
  title: string;
  is_active: boolean;
  is_connected: boolean;
  message_count: number;
  last_active_at: string | null;
  created_at: string;
}

export interface ManagerSessionsResponse {
  sessions: ManagerSession[];
  total: number;
}

export interface ManagerHistoryMessage {
  id: number;
  role: 'user' | 'assistant' | 'webhook';
  content: string;
  tool_states?: ToolState[];
  ui_blocks?: unknown;
  source: 'chat' | 'webhook';
  created_at: string;
}

export interface ManagerHistoryResponse {
  session_id: number;
  is_connected: boolean;
  messages: ManagerHistoryMessage[];
}

export async function getManagerStatus(): Promise<ManagerStatus> {
  return apiFetch<ManagerStatus>('/dashboard/manager/status');
}

export async function connectManager(): Promise<ManagerStatus> {
  return apiFetch<ManagerStatus>('/dashboard/manager/connect', { method: 'POST' });
}

export async function disconnectManager(): Promise<{ session_id: number; is_connected: boolean }> {
  return apiFetch('/dashboard/manager/disconnect', { method: 'POST' });
}

export async function regenerateWebhookToken(): Promise<{ webhook_token: string }> {
  return apiFetch('/dashboard/manager/regenerate-token', { method: 'POST' });
}

export async function getManagerHistory(limit = 50): Promise<ManagerHistoryResponse> {
  return apiFetch<ManagerHistoryResponse>(`/dashboard/manager/history?limit=${limit}`);
}

export async function listManagerSessions(): Promise<ManagerSessionsResponse> {
  return apiFetch<ManagerSessionsResponse>('/dashboard/manager/sessions');
}

export async function createNewManagerSession(title = ''): Promise<ManagerStatus & { title: string }> {
  return apiFetch('/dashboard/manager/sessions/new', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function activateManagerSession(sessionId: number): Promise<ManagerStatus & { title: string }> {
  return apiFetch(`/dashboard/manager/sessions/${sessionId}/activate`, { method: 'POST' });
}

export async function getSessionHistory(sessionId: number, limit = 100): Promise<ManagerHistoryResponse & { title: string }> {
  return apiFetch(`/dashboard/manager/sessions/${sessionId}/history?limit=${limit}`);
}

/** Mock AI chat response for UI/theme demo (GET /dashboard/chat-demo). */
export async function getDashboardChatDemo(): Promise<DashboardChatResponse> {
  return apiFetch<DashboardChatResponse>('/dashboard/chat-demo', { method: 'GET' });
}

export async function sendDashboardChat(
  message: string,
  history?: DashboardChatMessage[],
  attachments?: File[],
  active_datasheet_id?: number,
  signal?: AbortSignal,
): Promise<DashboardChatResponse> {
  if (attachments?.length) {
    const form = new FormData();
    form.append('message', message);
    form.append('history', JSON.stringify(history ?? []));
    if (active_datasheet_id !== undefined && active_datasheet_id !== null) {
      form.append('active_datasheet_id', String(active_datasheet_id));
    }
    for (let i = 0; i < attachments.length; i++) {
      form.append('files', attachments[i], attachments[i].name);
    }
    return apiFetch<DashboardChatResponse>('/dashboard/chat', {
      method: 'POST',
      body: form,
      signal,
    });
  }
  const body: { message: string; history: DashboardChatMessage[]; active_datasheet_id?: number } = {
    message,
    history: history ?? [],
  };
  if (active_datasheet_id !== undefined && active_datasheet_id !== null) {
    body.active_datasheet_id = active_datasheet_id;
  }
  return apiFetch<DashboardChatResponse>('/dashboard/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
}
