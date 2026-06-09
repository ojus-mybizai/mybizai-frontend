import { apiFetch } from '@/lib/api-client';

export type AgentStatus = 'draft' | 'active' | 'paused' | 'inactive' | 'archived';
export type AgentRole = 'sales' | 'support' | 'general' | 'lead' | 'lead_gen';

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

export interface TriggerConfig {
  type: 'event' | 'schedule' | 'manual' | 'webhook';
  event?: string;
  filters?: Record<string, unknown>;
  cron?: string;
}

// ─── Skill Overrides (Phase-4 owner-authored per-skill guidance) ───

export interface SkillOverrideExample {
  /** What's happening that should make the LLM act */
  situation: string;
  /** Optional reasoning hint shown alongside the example */
  why?: string;
}

export type SkillOverrideMode = 'append' | 'replace';

/**
 * Per-skill guidance overlay set by the agent owner from the Skills page.
 * Stored on `BusinessAgent.skill_overrides` as `{ skillName: SkillOverride }`.
 *
 * - `mode: "append"` (default): owner's `customGuidance` is added on top of
 *   the developer's WHEN/DO-NOT/EXAMPLES. Owner examples come first.
 * - `mode: "replace"`: owner's block replaces the developer's WHEN/DO-NOT/
 *   EXAMPLES entirely. The skill's base description is always preserved.
 *
 * An empty `customGuidance` with `mode: "replace"` silently downgrades to
 * append — the backend never lets the owner accidentally erase all guidance.
 */
export interface SkillOverride {
  customGuidance: string;
  mode: SkillOverrideMode;
  examples: SkillOverrideExample[];
}

export type SkillOverridesMap = Record<string, SkillOverride>;

export interface AgentDatasheetAccess {
  id: number;
  agentId: number;
  dynamicModelId: number;
  dynamicModelName: string | null;
  dynamicModelDisplayName: string | null;
  allowedOperations: string[];
  readableFields: string[] | null;
  writableFields: string[] | null;
  filterFields: string[] | null;
  instruction: string | null;
  searchMode: string;
  maxResults: number;
}

export type InstructionsQuality = 'ok' | 'needs_review';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  tone: string;
  instructions: string;
  /**
   * Phase-5 builder validation flag. "needs_review" means the AI-generated
   * instructions failed structural validation at build time — a banner is
   * shown on the overview page asking the owner to review and edit.
   */
  instructionsQuality: InstructionsQuality;
  personaName: string;
  replyLanguage: string;
  replyFormat: AgentReplyFormat;
  guardrailRules: AgentGuardrailRules;
  escalationPolicy: AgentEscalationPolicy;
  fallbackMessage: string;
  businessContextHint: string;
  status: AgentStatus;
  deployed: boolean;
  channelIds: string[];
  // Unified agent mode toggles
  chatEnabled: boolean;
  automationEnabled: boolean;
  // Automation fields
  triggers: TriggerConfig[] | null;
  scheduleCron: string | null;
  maxActionsPerRun: number;
  skills: string[] | null;
  /**
   * Phase-4 owner-authored per-skill guidance overlay.
   * Map of skill_name -> { customGuidance, mode, examples }.
   * Compiled into the OpenAI tool description at runtime by the backend.
   */
  skillOverrides: SkillOverridesMap;
  /**
   * Phase-2 manifest stack — Layer 2 selector. Maps to a role template like
   * "recruitment" or "sales_inbound". `null` means no template; the skill
   * description falls back to the developer manifest (Layer 1).
   * See GET /agents/skill-templates for the live list of valid values.
   */
  roleTemplate: string | null;
  /**
   * Free-form agent settings JSON. Keys currently used:
   *   - automation_instructions: string — system prompt body for non-chat runs
   *     (event triggers, scheduled runs). Falls back to `instructions` if empty.
   */
  settings: Record<string, unknown>;
  lastRunAt: string | null;
  totalRuns: number;
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
  personaName?: string;
  replyLanguage?: string;
  replyFormat?: AgentReplyFormat;
  guardrailRules?: AgentGuardrailRules;
  escalationPolicy?: AgentEscalationPolicy;
  fallbackMessage?: string;
  businessContextHint?: string;
  // Unified agent fields
  chatEnabled?: boolean;
  automationEnabled?: boolean;
  triggers?: TriggerConfig[] | null;
  scheduleCron?: string | null;
  maxActionsPerRun?: number;
  skills?: string[] | null;
  /** Phase-4 per-skill owner overrides — see SkillOverride. */
  skillOverrides?: SkillOverridesMap;
  /** Phase-2 manifest Layer 2 — e.g. "recruitment" or null. */
  roleTemplate?: string | null;
  /** Free-form settings JSON (e.g. {automation_instructions: "..."}) */
  settings?: Record<string, unknown>;
}

// Wire shape for one skill_override entry from the backend (snake_case).
type ApiSkillOverride = {
  custom_guidance?: string;
  mode?: SkillOverrideMode;
  examples?: Array<{ situation?: string; why?: string }>;
};

function mapSkillOverrides(
  raw: Record<string, ApiSkillOverride> | null | undefined,
): SkillOverridesMap {
  if (!raw || typeof raw !== 'object') return {};
  const out: SkillOverridesMap = {};
  for (const [name, cfg] of Object.entries(raw)) {
    if (!cfg || typeof cfg !== 'object') continue;
    out[name] = {
      customGuidance: cfg.custom_guidance ?? '',
      mode: cfg.mode === 'replace' ? 'replace' : 'append',
      examples: Array.isArray(cfg.examples)
        ? cfg.examples.map((e) => ({
            situation: e?.situation ?? '',
            why: e?.why ?? '',
          }))
        : [],
    };
  }
  return out;
}

function serializeSkillOverrides(
  map: SkillOverridesMap | undefined,
): Record<string, ApiSkillOverride> {
  if (!map) return {};
  const out: Record<string, ApiSkillOverride> = {};
  for (const [name, cfg] of Object.entries(map)) {
    // Drop entries the user emptied out — keeps payloads small and lets
    // the backend cleanup pass treat them as removed.
    const guidance = (cfg.customGuidance ?? '').trim();
    const examples = (cfg.examples ?? []).filter((e) => (e.situation ?? '').trim());
    if (!guidance && examples.length === 0) continue;
    out[name] = {
      custom_guidance: guidance,
      mode: cfg.mode === 'replace' ? 'replace' : 'append',
      examples,
    };
  }
  return out;
}

type ApiChatAgent = {
  id: number;
  name: string;
  description?: string | null;
  role_type: AgentRole;
  tone?: string | null;
  instructions?: string | null;
  instructions_quality?: InstructionsQuality | null;
  persona_name?: string | null;
  reply_language?: string | null;
  reply_format?: JsonMap;
  guardrail_rules?: JsonMap;
  escalation_policy?: JsonMap;
  fallback_message?: string | null;
  business_context_hint?: string | null;
  status: AgentStatus;
  deployed: boolean;
  chat_enabled?: boolean;
  automation_enabled?: boolean;
  triggers?: TriggerConfig[] | null;
  schedule_cron?: string | null;
  max_actions_per_run?: number;
  skills?: string[] | null;
  skill_overrides?: Record<string, ApiSkillOverride> | null;
  role_template?: string | null;
  settings?: Record<string, unknown> | null;
  last_run_at?: string | null;
  total_runs?: number;
  created_at: string;
  updated_at: string | null;
  channels?: Array<{ id: number }> | null;
};

function mapAgent(a: ApiChatAgent): Agent {
  return {
    id: String(a.id),
    name: a.name,
    role: a.role_type,
    tone: a.tone ?? '',
    instructions: a.instructions ?? '',
    instructionsQuality: (a.instructions_quality === 'needs_review'
      ? 'needs_review'
      : 'ok'),
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
    fallbackMessage: a.fallback_message ?? '',
    businessContextHint: a.business_context_hint ?? '',
    status: a.status,
    deployed: Boolean(a.deployed),
    channelIds: (a.channels ?? []).map((ch) => String(ch.id)),
    // Unified agent mode toggles
    chatEnabled: a.chat_enabled ?? true,
    automationEnabled: a.automation_enabled ?? false,
    // Automation fields
    triggers: a.triggers ?? null,
    scheduleCron: a.schedule_cron ?? null,
    maxActionsPerRun: a.max_actions_per_run ?? 10,
    skills: a.skills ?? null,
    skillOverrides: mapSkillOverrides(a.skill_overrides),
    roleTemplate: a.role_template ?? null,
    settings: (a.settings && typeof a.settings === 'object') ? (a.settings as Record<string, unknown>) : {},
    lastRunAt: a.last_run_at ?? null,
    totalRuns: a.total_runs ?? 0,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

export async function listAgents(): Promise<Agent[]> {
  const data = await apiFetch<ApiChatAgent[]>('/agents/', { method: 'GET' });
  return data.map(mapAgent);
}

export async function getAgent(id: string): Promise<Agent | null> {
  const data = await apiFetch<ApiChatAgent>(`/agents/${id}`, { method: 'GET' });
  return mapAgent(data);
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  const payload = {
    name: input.name,
    description: null,
    role_type: input.role,
    tone: input.tone,
    instructions: 'Describe how this agent should operate.',
    persona_name: null,
    reply_language: 'auto',
    reply_format: { max_length: 'short', use_bullets: false, use_emojis: false },
    guardrail_rules: {},
    escalation_policy: {},
    fallback_message: null,
    business_context_hint: null,
    status: 'draft' as const,
    deployed: false,
    chat_enabled: true,
  };
  const created = await apiFetch<ApiChatAgent>('/agents/', {
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
  if (input.fallbackMessage !== undefined) payload.fallback_message = input.fallbackMessage;
  if (input.businessContextHint !== undefined) payload.business_context_hint = input.businessContextHint;
  // Unified agent fields
  if (input.chatEnabled !== undefined) payload.chat_enabled = input.chatEnabled;
  if (input.automationEnabled !== undefined) payload.automation_enabled = input.automationEnabled;
  if (input.triggers !== undefined) payload.triggers = input.triggers;
  if (input.scheduleCron !== undefined) payload.schedule_cron = input.scheduleCron;
  if (input.maxActionsPerRun !== undefined) payload.max_actions_per_run = input.maxActionsPerRun;
  if (input.skills !== undefined) payload.skills = input.skills;
  if (input.skillOverrides !== undefined) {
    payload.skill_overrides = serializeSkillOverrides(input.skillOverrides);
  }
  if (input.roleTemplate !== undefined) {
    payload.role_template = input.roleTemplate;
  }
  if (input.settings !== undefined) payload.settings = input.settings;

  const updated = await apiFetch<ApiChatAgent>(`/agents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return mapAgent(updated);
}

export async function deleteAgent(id: string): Promise<void> {
  await apiFetch<void>(`/agents/${id}`, { method: 'DELETE' });
}

export async function toggleAgentStatus(id: string, next: AgentStatus): Promise<Agent> {
  if (next === 'active') {
    const updated = await apiFetch<ApiChatAgent>(`/agents/${id}/deploy`, { method: 'POST' });
    return mapAgent(updated);
  }
  if (next === 'paused') {
    const updated = await apiFetch<ApiChatAgent>(`/agents/${id}/pause`, { method: 'POST' });
    return mapAgent(updated);
  }
  // fallback: update status directly
  return updateAgent(id, { });
}

export async function bindChannels(agentId: string, channelIds: string[]): Promise<void> {
  await apiFetch(`/agents/${agentId}/channels`, {
    method: 'PUT',
    body: JSON.stringify({ channel_ids: channelIds.map(Number) }),
  });
}

export async function testAgent(id: string, userMessage: string, sessionId?: string): Promise<string> {
  const res = await apiFetch<{ response: string }>(`/agents/${id}/test`, {
    method: 'POST',
    body: JSON.stringify({ user_message: userMessage, session_id: sessionId ?? null }),
  });
  return res.response;
}

// ---------- AI Agent Builder ----------

export interface AIBuildResponse {
  message: string;
  agent_created: boolean;
  agent_id: number | null;
  agent_name: string | null;
  skills_selected: string[];
  config_preview: Record<string, unknown> | null;
}

export async function aiBuildAgent(description: string, conversationHistory: Array<{ role: string; content: string }> = []): Promise<AIBuildResponse> {
  return apiFetch<AIBuildResponse>('/agents/ai-build', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ description, conversation_history: conversationHistory }),
    headers: { 'Content-Type': 'application/json' },
  });
}


// ─── Datasheet Access (Unified Agent) ────────────────────────

export interface DatasheetAccessInput {
  dynamic_model_id: number;
  allowed_operations: string[];
  readable_fields?: string[] | null;
  writable_fields?: string[] | null;
  filter_fields?: string[] | null;
  instruction?: string | null;
  search_mode?: string;
  max_results?: number;
}

interface ApiDatasheetAccess {
  id: number;
  agent_id: number;
  dynamic_model_id: number;
  dynamic_model_name: string | null;
  dynamic_model_display_name: string | null;
  allowed_operations: string[];
  readable_fields: string[] | null;
  writable_fields: string[] | null;
  filter_fields: string[] | null;
  instruction: string | null;
  search_mode: string;
  max_results: number;
}

function mapDatasheetAccess(a: ApiDatasheetAccess): AgentDatasheetAccess {
  return {
    id: a.id,
    agentId: a.agent_id,
    dynamicModelId: a.dynamic_model_id,
    dynamicModelName: a.dynamic_model_name,
    dynamicModelDisplayName: a.dynamic_model_display_name,
    allowedOperations: a.allowed_operations ?? [],
    readableFields: a.readable_fields,
    writableFields: a.writable_fields,
    filterFields: a.filter_fields,
    instruction: a.instruction,
    searchMode: a.search_mode ?? 'structured',
    maxResults: a.max_results ?? 25,
  };
}

export async function listDatasheetAccess(agentId: string): Promise<AgentDatasheetAccess[]> {
  const data = await apiFetch<ApiDatasheetAccess[]>(`/agents/${agentId}/datasheet-access`);
  return data.map(mapDatasheetAccess);
}

export async function saveDatasheetAccess(
  agentId: string,
  items: DatasheetAccessInput[],
): Promise<AgentDatasheetAccess[]> {
  const data = await apiFetch<ApiDatasheetAccess[]>(`/agents/${agentId}/datasheet-access`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
  return data.map(mapDatasheetAccess);
}


// ─── Skills (Unified Agent — Automation) ────────────────────

export interface SkillDefinition {
  name: string;
  description: string;
  category: string;
  parameters: Record<string, unknown>;
  is_llm_based: boolean;
  requires_confirmation: boolean;
  estimated_latency_ms: number;
}

export interface DynamicTrigger {
  event: string;
  label: string;
  datasheet_id: number;
  datasheet_name: string;
}

export interface SkillsAndTriggersResponse {
  skills: SkillDefinition[];
  dynamic_triggers: DynamicTrigger[];
}

export async function listAvailableSkills(): Promise<SkillDefinition[]> {
  const res = await apiFetch<SkillsAndTriggersResponse>('/agents/skills/available');
  return res.skills ?? [];
}

export async function listAvailableSkillsAndTriggers(): Promise<SkillsAndTriggersResponse> {
  return apiFetch<SkillsAndTriggersResponse>('/agents/skills/available');
}

/**
 * Get the skill names currently enabled for an agent + per-skill overrides.
 * Backed by GET /agents/{id}/skills.
 */
export async function getAgentSkills(agentId: string | number): Promise<{
  skills: string[];
  skillOverrides: SkillOverridesMap;
}> {
  const res = await apiFetch<{
    skills: string[];
    skill_overrides?: Record<string, ApiSkillOverride> | null;
  }>(`/agents/${agentId}/skills`, { method: 'GET' });
  return {
    skills: res.skills ?? [],
    skillOverrides: mapSkillOverrides(res.skill_overrides),
  };
}

/**
 * Replace the set of skills enabled for an agent. Optionally also save the
 * per-skill owner overrides (Phase 4) in the same atomic round-trip so the
 * skills page never has to fire two requests.
 * Backed by PUT /agents/{id}/skills.
 */
export async function setAgentSkills(
  agentId: string | number,
  skills: string[],
  skillOverrides?: SkillOverridesMap,
): Promise<{ agent_id: number; skills: string[]; skill_overrides: Record<string, ApiSkillOverride> }> {
  const body: Record<string, unknown> = { skills };
  if (skillOverrides !== undefined) {
    body.skill_overrides = serializeSkillOverrides(skillOverrides);
  }
  return apiFetch<{
    success: boolean;
    agent_id: number;
    skills: string[];
    skill_overrides: Record<string, ApiSkillOverride>;
  }>(`/agents/${agentId}/skills`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}


// ─── Phase-2 Role Templates ─────────────────────────────────

export interface RoleTemplateSummary {
  name: string;
  label: string;
  description: string;
  skillCount: number;
  coveredSkills: string[];
}

export interface RoleTemplateSkillOverlay {
  whenToUse?: string;
  examples?: Array<{
    situation?: string;
    call?: Record<string, unknown>;
    why?: string;
  }>;
}

export interface RoleTemplateDetail {
  name: string;
  label: string;
  description: string;
  skills: Record<string, RoleTemplateSkillOverlay>;
}

type ApiRoleTemplate = {
  name: string;
  label?: string;
  description?: string;
  skill_count?: number;
  covered_skills?: string[];
};

export async function listSkillTemplates(): Promise<RoleTemplateSummary[]> {
  const res = await apiFetch<{ templates: ApiRoleTemplate[] }>('/agents/skill-templates');
  return (res.templates ?? []).map((t) => ({
    name: t.name,
    label: t.label ?? t.name,
    description: t.description ?? '',
    skillCount: t.skill_count ?? 0,
    coveredSkills: t.covered_skills ?? [],
  }));
}

export async function getSkillTemplate(name: string): Promise<RoleTemplateDetail> {
  const res = await apiFetch<{
    name: string;
    label?: string;
    description?: string;
    skills?: Record<string, { when_to_use?: string; examples?: RoleTemplateSkillOverlay['examples'] }>;
  }>(`/agents/skill-templates/${encodeURIComponent(name)}`);
  const skills: Record<string, RoleTemplateSkillOverlay> = {};
  for (const [skillName, overlay] of Object.entries(res.skills ?? {})) {
    skills[skillName] = {
      whenToUse: overlay?.when_to_use,
      examples: overlay?.examples,
    };
  }
  return {
    name: res.name,
    label: res.label ?? res.name,
    description: res.description ?? '',
    skills,
  };
}


// ─── Phase-2c AI-suggest per-skill guidance ─────────────────

export interface SkillGuidanceSuggestion {
  customGuidance: string;
  examples: Array<{ situation: string; call: Record<string, unknown>; why: string }>;
  mode: SkillOverrideMode;
}

/**
 * Ask the backend LLM to draft custom_guidance + examples for one skill,
 * grounded in this agent's role + instructions. Does NOT mutate the agent;
 * the UI shows the suggestion and the owner decides whether to apply it.
 */
export async function suggestSkillGuidance(
  agentId: string | number,
  skillName: string,
): Promise<SkillGuidanceSuggestion> {
  const res = await apiFetch<{
    skill_name: string;
    suggestion: {
      custom_guidance?: string;
      examples?: Array<{ situation?: string; call?: Record<string, unknown>; why?: string }>;
      mode?: SkillOverrideMode;
    };
  }>(`/agents/${agentId}/skills/${encodeURIComponent(skillName)}/suggest`, {
    method: 'POST',
  });
  const s = res.suggestion ?? {};
  return {
    customGuidance: s.custom_guidance ?? '',
    examples: (s.examples ?? []).map((e) => ({
      situation: e.situation ?? '',
      call: (e.call && typeof e.call === 'object') ? e.call : {},
      why: e.why ?? '',
    })),
    mode: s.mode === 'replace' ? 'replace' : 'append',
  };
}

export async function runAgentManually(agentId: string, context?: Record<string, unknown>): Promise<unknown> {
  return apiFetch(`/agents/${agentId}/run`, {
    method: 'POST',
    body: JSON.stringify(context ?? {}),
  });
}


// ─── Skill preview (compiled tool description) ───────────────
// Returns exactly what OpenAI sees for this skill — both the default
// (Layer-1-only) and the effective (Layer 1 + role template + owner override)
// so the Skills page can show a live preview + diff.

export interface SkillPreview {
  skillName: string;
  defaultDescription: string;
  effectiveDescription: string;
  parameters: Record<string, unknown>;
  layers: {
    hasRoleTemplate: boolean;
    roleTemplateName: string | null;
    hasOwnerOverride: boolean;
    ownerMode: SkillOverrideMode | null;
  };
}

interface ApiPreviewResponse {
  skill_name: string;
  default_description: string;
  effective_description: string;
  parameters: Record<string, unknown>;
  layers?: {
    has_role_template?: boolean;
    role_template_name?: string | null;
    has_owner_override?: boolean;
    owner_mode?: string | null;
  };
}

function _mapPreview(res: ApiPreviewResponse): SkillPreview {
  return {
    skillName: res.skill_name,
    defaultDescription: res.default_description ?? '',
    effectiveDescription: res.effective_description ?? '',
    parameters: res.parameters ?? {},
    layers: {
      hasRoleTemplate: !!res.layers?.has_role_template,
      roleTemplateName: res.layers?.role_template_name ?? null,
      hasOwnerOverride: !!res.layers?.has_owner_override,
      ownerMode:
        res.layers?.owner_mode === 'replace'
          ? 'replace'
          : res.layers?.owner_mode === 'append'
            ? 'append'
            : null,
    },
  };
}

/** Get the saved compiled description for a skill on an agent. */
export async function getSkillPreview(
  agentId: string | number,
  skillName: string,
): Promise<SkillPreview> {
  const res = await apiFetch<ApiPreviewResponse>(
    `/agents/${agentId}/skills/${encodeURIComponent(skillName)}/preview`,
  );
  return _mapPreview(res);
}

/**
 * Live-preview a skill description with an UNSAVED draft override applied.
 * Used by the Skills page to update the preview pane while the owner types.
 * Debounce on the caller side.
 */
export async function previewSkillWithDraft(
  agentId: string | number,
  skillName: string,
  draft: SkillOverride,
): Promise<SkillPreview> {
  const res = await apiFetch<ApiPreviewResponse>(
    `/agents/${agentId}/skills/${encodeURIComponent(skillName)}/preview`,
    {
      method: 'POST',
      body: JSON.stringify({
        customGuidance: draft.customGuidance,
        mode: draft.mode,
        examples: draft.examples,
      }),
    },
  );
  return _mapPreview(res);
}


// ─── Agent Templates ─────────────────────────────────────────

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  instructions: string;
  skills: string[];
  triggers: TriggerConfig[];
  schedule_cron?: string;
  settings: Record<string, unknown>;
  category: string;
  icon: string;
}

export async function listAgentTemplates(): Promise<AgentTemplate[]> {
  const res = await apiFetch<{ templates?: AgentTemplate[] }>('/agents/templates');
  return res.templates ?? [];
}

export async function createAgentFromTemplate(templateId: string): Promise<Agent> {
  const data = await apiFetch<ApiChatAgent>(`/agents/from-template/${templateId}`, {
    method: 'POST',
  });
  return mapAgent(data);
}


// ─── Agent Run History (Automation) ──────────────────────────

export interface AgentSkillResult {
  skill: string;
  args: Record<string, unknown>;
  success: boolean;
  output?: unknown;
  error?: string;
  execution_time_ms: number;
}

export type AgentRunStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed' | 'skipped' | 'timeout';

export interface AgentRun {
  id: number;
  trigger_event?: string;
  reasoning?: string;
  actions_taken?: AgentSkillResult[];
  status: AgentRunStatus;
  tokens_used: number;
  cost_usd: number;
  duration_ms: number;
  error?: string;
  created_at?: string;
}

export async function listAgentRuns(agentId: string, limit = 20): Promise<AgentRun[]> {
  const res = await apiFetch<{ runs?: AgentRun[] }>(`/agents/${agentId}/runs?limit=${limit}`);
  return res.runs ?? [];
}

