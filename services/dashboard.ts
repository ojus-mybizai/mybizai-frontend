import { apiFetch } from '@/lib/api-client';

export interface DashboardChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DashboardChatResponse {
  reply: string;
}

export async function sendDashboardChat(
  message: string,
  history?: DashboardChatMessage[],
  attachments?: File[],
  active_datasheet_id?: number
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
  });
}
