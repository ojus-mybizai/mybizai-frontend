export type ChatRole = 'user' | 'assistant';

export interface DashboardMessage {
  id: string;
  role: ChatRole;
  content: string;
}
