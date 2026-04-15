/**
 * Lite Agent API service — CRUD for lightweight single-call agents.
 */
import { apiFetch } from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────

export interface LiteAgent {
  id: string;
  businessId: number;
  name: string;
  instructions: string;
  modelName: string | null;
  tone: string;
  replyLanguage: string;
  personaName: string | null;
  fallbackMessage: string | null;
  businessContextHint: string | null;
  status: 'draft' | 'active' | 'paused';
  deployed: boolean;
  channelIds: string[];
  totalRuns: number;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface ApiLiteAgent {
  id: number;
  business_id: number;
  name: string;
  instructions: string | null;
  model_name: string | null;
  tone: string | null;
  reply_language: string | null;
  persona_name: string | null;
  fallback_message: string | null;
  business_context_hint: string | null;
  status: string;
  deployed: boolean;
  channel_ids: number[];
  total_runs: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateLiteAgentInput {
  name: string;
  instructions?: string;
  tone?: string;
  reply_language?: string;
}

export interface UpdateLiteAgentInput {
  name?: string;
  instructions?: string;
  tone?: string;
  reply_language?: string;
  persona_name?: string;
  fallback_message?: string;
  business_context_hint?: string;
  model_name?: string;
}

// ── Mapper ───────────────────────────────────────────────────────

function mapAgent(a: ApiLiteAgent): LiteAgent {
  return {
    id: String(a.id),
    businessId: a.business_id,
    name: a.name,
    instructions: a.instructions || '',
    modelName: a.model_name,
    tone: a.tone || 'friendly',
    replyLanguage: a.reply_language || 'auto',
    personaName: a.persona_name,
    fallbackMessage: a.fallback_message,
    businessContextHint: a.business_context_hint,
    status: (a.status as LiteAgent['status']) || 'draft',
    deployed: a.deployed,
    channelIds: (a.channel_ids || []).map(String),
    totalRuns: a.total_runs || 0,
    lastRunAt: a.last_run_at,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

// ── API Functions ────────────────────────────────────────────────

export async function listLiteAgents(): Promise<LiteAgent[]> {
  const raw = await apiFetch<ApiLiteAgent[]>('/lite-agents/');
  return (raw || []).map(mapAgent);
}

export async function getLiteAgent(id: string): Promise<LiteAgent | null> {
  try {
    const raw = await apiFetch<ApiLiteAgent>(`/lite-agents/${id}`);
    return mapAgent(raw);
  } catch {
    return null;
  }
}

export async function createLiteAgent(input: CreateLiteAgentInput): Promise<LiteAgent> {
  const raw = await apiFetch<ApiLiteAgent>('/lite-agents/', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return mapAgent(raw);
}

export async function updateLiteAgent(id: string, input: UpdateLiteAgentInput): Promise<LiteAgent> {
  const raw = await apiFetch<ApiLiteAgent>(`/lite-agents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return mapAgent(raw);
}

export async function deleteLiteAgent(id: string): Promise<void> {
  await apiFetch(`/lite-agents/${id}`, { method: 'DELETE' });
}

export async function deployLiteAgent(id: string): Promise<LiteAgent> {
  const raw = await apiFetch<ApiLiteAgent>(`/lite-agents/${id}/deploy`, { method: 'POST' });
  return mapAgent(raw);
}

export async function pauseLiteAgent(id: string): Promise<LiteAgent> {
  const raw = await apiFetch<ApiLiteAgent>(`/lite-agents/${id}/pause`, { method: 'POST' });
  return mapAgent(raw);
}

export async function bindLiteAgentChannels(
  agentId: string,
  channelIds: string[],
): Promise<void> {
  await apiFetch(`/lite-agents/${agentId}/channels`, {
    method: 'PUT',
    body: JSON.stringify({ channel_ids: channelIds.map(Number) }),
  });
}

export async function testLiteAgent(id: string, userMessage: string): Promise<string> {
  const raw = await apiFetch<{ response: string }>(`/lite-agents/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ user_message: userMessage }),
  });
  return raw.response;
}
