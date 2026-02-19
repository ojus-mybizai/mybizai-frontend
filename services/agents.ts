import { apiFetch } from '@/lib/api-client';

export type AgentStatus = 'draft' | 'active' | 'paused' | 'inactive' | 'archived';
export type AgentRole = 'sales' | 'support' | 'general' | 'lead' | 'lead_gen';

/** Reply source: auto = template first then AI; template_only = only message templates; ai_only = only LLM */
export type ReplyMode = 'auto' | 'template_only' | 'ai_only';
export type ToolExecutionMode = 'realtime' | 'post_process' | 'batch';
type JsonMap = Record<string, unknown>;
export type ReplyLength = 'short' | 'medium' | 'long';

export interface AgentReplyFormat {
  maxLength?: ReplyLength;
  useBullets?: boolean;
  useEmojis?: boolean;
}

export interface AgentGuardrailRules {
  neverDo?: string[];
  alwaysDo?: string[];
  prohibitedTopics?: string[];
  offTopicMessage?: string;
}

export interface AgentEscalationPolicy {
  enabled?: boolean;
  triggers?: string[];
  message?: string;
}

export interface AgentToolAssignment {
  toolId: string;
  toolName: string;
  executionMode: ToolExecutionMode;
  enabled: boolean;
  ruleText: string;
  rulePolicy: JsonMap;
  config: JsonMap;
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  tone: string;
  instructions: string;
  model: string;
  personaName: string;
  replyLanguage: string;
  replyFormat: AgentReplyFormat;
  guardrailRules: AgentGuardrailRules;
  escalationPolicy: AgentEscalationPolicy;
  openingMessage: string;
  fallbackMessage: string;
  businessContextHint: string;
  capabilities: Record<string, boolean>;
  derivedCapabilities: Record<string, boolean>;
  status: AgentStatus;
  deployed: boolean;
  replyMode: ReplyMode;
  channelIds: string[];
  toolIds: string[];
  toolAssignments: AgentToolAssignment[];
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
  reply_mode?: ReplyMode;
  personaName?: string;
  replyLanguage?: string;
  replyFormat?: AgentReplyFormat;
  guardrailRules?: AgentGuardrailRules;
  escalationPolicy?: AgentEscalationPolicy;
  openingMessage?: string;
  fallbackMessage?: string;
  businessContextHint?: string;
}

export interface BindToolConfigInput {
  enabled?: boolean;
  rule_text?: string;
  rule_policy?: JsonMap;
  config?: JsonMap;
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
  derived_capabilities?: Record<string, boolean>;
  persona_name?: string | null;
  reply_language?: string | null;
  reply_format?: JsonMap;
  guardrail_rules?: JsonMap;
  escalation_policy?: JsonMap;
  opening_message?: string | null;
  fallback_message?: string | null;
  business_context_hint?: string | null;
  status: AgentStatus;
  deployed: boolean;
  reply_mode?: string;
  created_at: string;
  updated_at: string | null;
  channels?: Array<{ id: number }>;
  tools?: Array<{ id: number }>;
  tool_assignments?: Array<{
    tool_id: number;
    enabled: boolean;
    execution_mode: ToolExecutionMode;
    config?: JsonMap;
    rule_text?: string | null;
    rule_policy?: JsonMap;
    tool: { id: number; name: string };
  }>;
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
    personaName: a.persona_name ?? '',
    replyLanguage: a.reply_language ?? 'auto',
    replyFormat: {
      maxLength: (a.reply_format?.max_length as ReplyLength | undefined) ?? 'short',
      useBullets: Boolean(a.reply_format?.use_bullets),
      useEmojis: Boolean(a.reply_format?.use_emojis),
    },
    guardrailRules: {
      neverDo: Array.isArray(a.guardrail_rules?.never_do) ? (a.guardrail_rules?.never_do as string[]) : [],
      alwaysDo: Array.isArray(a.guardrail_rules?.always_do) ? (a.guardrail_rules?.always_do as string[]) : [],
      prohibitedTopics: Array.isArray(a.guardrail_rules?.prohibited_topics) ? (a.guardrail_rules?.prohibited_topics as string[]) : [],
      offTopicMessage: (a.guardrail_rules?.off_topic_message as string | undefined) ?? '',
    },
    escalationPolicy: {
      enabled: Boolean(a.escalation_policy?.enabled),
      triggers: Array.isArray(a.escalation_policy?.triggers) ? (a.escalation_policy?.triggers as string[]) : [],
      message: (a.escalation_policy?.message as string | undefined) ?? '',
    },
    openingMessage: a.opening_message ?? '',
    fallbackMessage: a.fallback_message ?? '',
    businessContextHint: a.business_context_hint ?? '',
    capabilities: a.capabilities ?? {},
    derivedCapabilities: a.derived_capabilities ?? {},
    status: a.status,
    deployed: Boolean(a.deployed),
    replyMode,
    channelIds: (a.channels ?? []).map((c) => String(c.id)),
    toolIds:
      (a.tool_assignments ?? []).map((t) => String(t.tool_id)).length > 0
        ? (a.tool_assignments ?? [])
            .filter((t) => Boolean(t.enabled))
            .map((t) => String(t.tool_id))
        : (a.tools ?? []).map((t) => String(t.id)),
    toolAssignments: (a.tool_assignments ?? []).map((ta) => ({
      toolId: String(ta.tool_id),
      toolName: ta.tool?.name ?? '',
      executionMode: ta.execution_mode,
      enabled: Boolean(ta.enabled),
      ruleText: ta.rule_text ?? '',
      rulePolicy: ta.rule_policy ?? {},
      config: ta.config ?? {},
    })),
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
    persona_name: null,
    reply_language: 'auto',
    reply_format: { max_length: 'short', use_bullets: false, use_emojis: false },
    guardrail_rules: {},
    escalation_policy: {},
    opening_message: null,
    fallback_message: null,
    business_context_hint: null,
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
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.role !== undefined) payload.role_type = input.role;
  if (input.tone !== undefined) payload.tone = input.tone;
  if (input.instructions !== undefined) payload.instructions = input.instructions;
  if (input.model !== undefined) payload.model_name = input.model;
  if (input.reply_mode !== undefined) payload.reply_mode = input.reply_mode;
  if (input.personaName !== undefined) payload.persona_name = input.personaName;
  if (input.replyLanguage !== undefined) payload.reply_language = input.replyLanguage;
  if (input.replyFormat !== undefined) {
    payload.reply_format = {
      max_length: input.replyFormat.maxLength ?? 'short',
      use_bullets: Boolean(input.replyFormat.useBullets),
      use_emojis: Boolean(input.replyFormat.useEmojis),
    };
  }
  if (input.guardrailRules !== undefined) {
    payload.guardrail_rules = {
      never_do: input.guardrailRules.neverDo ?? [],
      always_do: input.guardrailRules.alwaysDo ?? [],
      prohibited_topics: input.guardrailRules.prohibitedTopics ?? [],
      off_topic_message: input.guardrailRules.offTopicMessage ?? '',
    };
  }
  if (input.escalationPolicy !== undefined) {
    payload.escalation_policy = {
      enabled: Boolean(input.escalationPolicy.enabled),
      triggers: input.escalationPolicy.triggers ?? [],
      message: input.escalationPolicy.message ?? '',
    };
  }
  if (input.openingMessage !== undefined) payload.opening_message = input.openingMessage;
  if (input.fallbackMessage !== undefined) payload.fallback_message = input.fallbackMessage;
  if (input.businessContextHint !== undefined) payload.business_context_hint = input.businessContextHint;

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

export async function bindTools(
  id: string,
  toolIds: string[],
  toolConfigs?: Record<string, BindToolConfigInput>,
): Promise<void> {
  await apiFetch(`/chat_agents/${id}/tools`, {
    method: 'PUT',
    body: JSON.stringify({
      tool_ids: toolIds.map((v) => Number(v)),
      ...(toolConfigs ? { tool_configs: toolConfigs } : {}),
    }),
  });
}

export async function bindKnowledgeBases(id: string, kbIds: string[]): Promise<void> {
  const normalizedIds = kbIds
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && Number.isInteger(v) && v > 0);
  await apiFetch(`/chat_agents/${id}/knowledge_bases`, {
    method: 'PUT',
    body: JSON.stringify({ knowledge_base_ids: normalizedIds }),
  });
}

export async function testAgent(id: string, userMessage: string): Promise<string> {
  const res = await apiFetch<{ response: string }>(`/chat_agents/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ user_message: userMessage }),
  });
  return res.response;
}

