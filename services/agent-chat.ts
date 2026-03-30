import { apiFetch } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentRole = 'sales' | 'support' | 'general' | 'lead' | 'lead_gen';
export type AgentStatus = 'draft' | 'active' | 'paused' | 'inactive' | 'archived';

export interface AgentSummary {
  id: number;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  personaName: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string | null;
}

export interface SendMessageResponse {
  conversationId: number;
  response: string;
  messages: ChatMessage[];
}

export interface ChatHistoryResponse {
  conversationId: number | null;
  messages: ChatMessage[];
}

// ---------------------------------------------------------------------------
// API raw types (snake_case from backend)
// ---------------------------------------------------------------------------

interface ApiAgentSummary {
  id: number;
  name: string;
  role_type: AgentRole;
  status: AgentStatus;
  persona_name?: string | null;
}

interface ApiChatMessage {
  id: number;
  role: string;
  content: string;
  created_at: string | null;
}

interface ApiSendMessageResponse {
  conversation_id: number;
  response: string;
  messages: ApiChatMessage[];
}

interface ApiChatHistoryResponse {
  conversation_id: number | null;
  messages: ApiChatMessage[];
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapMessage(m: ApiChatMessage): ChatMessage {
  return {
    id: m.id,
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
    createdAt: m.created_at,
  };
}

function mapAgentSummary(a: ApiAgentSummary): AgentSummary {
  return {
    id: a.id,
    name: a.name,
    role: a.role_type,
    status: a.status,
    personaName: a.persona_name ?? '',
  };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function listAgents(): Promise<AgentSummary[]> {
  const data = await apiFetch<ApiAgentSummary[]>('/chat_agents/?detail=false');
  return data.map(mapAgentSummary);
}

export async function sendMessage(
  agentId: number,
  message: string,
  conversationId?: number,
): Promise<SendMessageResponse> {
  const body: Record<string, unknown> = { message };
  if (conversationId != null) body.conversation_id = conversationId;

  const data = await apiFetch<ApiSendMessageResponse>(
    `/chat_agents/${agentId}/chat`,
    { method: 'POST', body: JSON.stringify(body) },
  );

  return {
    conversationId: data.conversation_id,
    response: data.response,
    messages: data.messages.map(mapMessage),
  };
}

export async function getChatHistory(agentId: number): Promise<ChatHistoryResponse> {
  const data = await apiFetch<ApiChatHistoryResponse>(
    `/chat_agents/${agentId}/chat/history`,
  );

  return {
    conversationId: data.conversation_id,
    messages: (data.messages ?? []).map(mapMessage),
  };
}
