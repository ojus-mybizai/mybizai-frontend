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
  attachments?: File[]
): Promise<DashboardChatResponse> {
  if (attachments?.length) {
    const form = new FormData();
    form.append('message', message);
    form.append('history', JSON.stringify(history ?? []));
    for (let i = 0; i < attachments.length; i++) {
      form.append('files', attachments[i], attachments[i].name);
    }
    return apiFetch<DashboardChatResponse>('/dashboard/chat', {
      method: 'POST',
      body: form,
    });
  }
  return apiFetch<DashboardChatResponse>('/dashboard/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      history: history ?? [],
    }),
  });
}
