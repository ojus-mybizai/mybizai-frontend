import { apiFetch } from '@/lib/api-client';

export type AgentStatus = 'draft' | 'active' | 'paused' | 'inactive' | 'archived';
export type AgentRole = 'sales' | 'support' | 'general' | 'lead' | 'lead_gen';

/** Reply source: auto = template first then AI; template_only = only message templates; ai_only = only LLM */
export type ReplyMode = 'auto' | 'template_only' | 'ai_only';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  tone: string;
  instructions: string;
  model: string;
  capabilities: Record<string, boolean>;
  status: AgentStatus;
  deployed: boolean;
  replyMode: ReplyMode;
  channelIds: string[];
  toolIds: string[];
  kbIds: string[];
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateAgentInput {
  name: string;
  role: AgentRole;
  tone: string;
}

export interface UpdateAgentInput {
  name?: string;
  role?: AgentRole;
  tone?: string;
  instructions?: string;
  model?: string;
  capabilities?: Record<string, boolean>;
  reply_mode?: ReplyMode;
}

type ApiChatAgent = {
  id: number;
  name: string;
  description?: string | null;
  role_type: AgentRole;
  tone?: string | null;
  instructions?: string | null;
  model_name?: string | null;
  capabilities?: Record<string, boolean>;
  status: AgentStatus;
  deployed: boolean;
  reply_mode?: string;
  created_at: string;
  updated_at: string | null;
  channels?: Array<{ id: number }>;
  tools?: Array<{ id: number }>;
  knowledge_bases?: Array<{ id: number }>;
};

const VALID_REPLY_MODES: ReplyMode[] = ['auto', 'template_only', 'ai_only'];

function mapAgent(a: ApiChatAgent): Agent {
  const raw = a.reply_mode ?? 'auto';
  const replyMode: ReplyMode = VALID_REPLY_MODES.includes(raw as ReplyMode) ? (raw as ReplyMode) : 'auto';
  return {
    id: String(a.id),
    name: a.name,
    role: a.role_type,
    tone: a.tone ?? '',
    instructions: a.instructions ?? '',
    model: a.model_name ?? '',
    capabilities: a.capabilities ?? {},
    status: a.status,
    deployed: Boolean(a.deployed),
    replyMode,
    channelIds: (a.channels ?? []).map((c) => String(c.id)),
    toolIds: (a.tools ?? []).map((t) => String(t.id)),
    kbIds: (a.knowledge_bases ?? []).map((k) => String(k.id)),
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

export async function listAgents(): Promise<Agent[]> {
  const data = await apiFetch<ApiChatAgent[]>('/chat_agents/', { method: 'GET' });
  return data.map(mapAgent);
}

export async function getAgent(id: string): Promise<Agent | null> {
  const data = await apiFetch<ApiChatAgent>(`/chat_agents/${id}`, { method: 'GET' });
  return mapAgent(data);
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  const payload = {
    name: input.name,
    description: null,
    role_type: input.role,
    tone: input.tone,
    instructions: 'Describe how this agent should operate.',
    model_name: 'gpt-5-mini',
    capabilities: {},
    status: 'draft' as const,
    deployed: false,
  };
  const created = await apiFetch<ApiChatAgent>('/chat_agents/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapAgent(created);
}

export async function updateAgent(id: string, input: UpdateAgentInput): Promise<Agent> {
  const payload: any = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.role !== undefined) payload.role_type = input.role;
  if (input.tone !== undefined) payload.tone = input.tone;
  if (input.instructions !== undefined) payload.instructions = input.instructions;
  if (input.model !== undefined) payload.model_name = input.model;
  if (input.capabilities !== undefined) payload.capabilities = input.capabilities;
  if (input.reply_mode !== undefined) payload.reply_mode = input.reply_mode;

  const updated = await apiFetch<ApiChatAgent>(`/chat_agents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return mapAgent(updated);
}

export async function deleteAgent(id: string): Promise<void> {
  await apiFetch<void>(`/chat_agents/${id}`, { method: 'DELETE' });
}

export async function toggleAgentStatus(id: string, next: AgentStatus): Promise<Agent> {
  if (next === 'active') {
    const updated = await apiFetch<ApiChatAgent>(`/chat_agents/${id}/deploy`, { method: 'POST' });
    return mapAgent(updated);
  }
  if (next === 'paused') {
    const updated = await apiFetch<ApiChatAgent>(`/chat_agents/${id}/pause`, { method: 'POST' });
    return mapAgent(updated);
  }
  // fallback: update status directly
  return updateAgent(id, { });
}

export async function bindChannels(id: string, channelIds: string[]): Promise<void> {
  await apiFetch(`/chat_agents/${id}/channels`, {
    method: 'PUT',
    body: JSON.stringify({ channel_ids: channelIds.map((v) => Number(v)) }),
  });
}

export async function bindTools(id: string, toolIds: string[]): Promise<void> {
  await apiFetch(`/chat_agents/${id}/tools`, {
    method: 'PUT',
    body: JSON.stringify({ tool_ids: toolIds.map((v) => Number(v)) }),
  });
}

export async function bindKnowledgeBases(id: string, kbIds: string[]): Promise<void> {
  await apiFetch(`/chat_agents/${id}/knowledge_bases`, {
    method: 'PUT',
    body: JSON.stringify({ knowledge_base_ids: kbIds.map((v) => Number(v)) }),
  });
}

export async function testAgent(id: string, userMessage: string): Promise<string> {
  const res = await apiFetch<{ response: string }>(`/chat_agents/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ user_message: userMessage }),
  });
  return res.response;
}

