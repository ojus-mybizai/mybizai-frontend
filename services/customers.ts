import { apiFetch } from '@/lib/api-client';

export type Channel = 'whatsapp' | 'instagram' | 'messenger' | string;
export type ConversationStatus = 'ai' | 'manual';

export interface LinkedChannel {
  channel_id: number;
  channel_type: string;
  channel_identifier: string;
  display_name?: string;
}

/** Meta ad attribution data — present only when lead came from a Meta ad. */
export interface AdAttribution {
  ad_platform: string | null;                // "meta"
  // Campaign hierarchy
  meta_campaign_id?: string | null;
  meta_campaign_name?: string | null;
  meta_adset_id?: string | null;
  meta_adset_name?: string | null;
  meta_ad_id?: string | null;
  meta_ad_name?: string | null;
  meta_form_id?: string | null;
  meta_form_name?: string | null;
  meta_page_id?: string | null;
  meta_lead_id?: string | null;
  // CTWA-specific
  ctwa_clid?: string | null;
  ad_headline?: string | null;
  ad_body?: string | null;
  ad_image_url?: string | null;
  /** "text" | "ice_breaker" | "flow_response" */
  ctwa_entry_type?: string | null;
  ctwa_entry_message?: string | null;
}

export interface Customer {
  id: string; // lead_id
  name: string | null;
  company?: string | null;
  phone: string;
  email?: string | null;
  channel: Channel; // primary/first channel for display
  linkedChannels?: LinkedChannel[];
  assignedAgent: string;
  assignedToId?: number | null;
  assignedAt?: string | null;
  assignmentLockedUntil?: string | null;
  lastActivity: string;
  lastMessagePreview: string;
  aiActive: boolean;
  priority?: 'low' | 'medium' | 'high';
  source?: string;
  notes?: string | null;
  leadScore?: number;
  lastScoreUpdate?: string;
  customFields?: Record<string, unknown>;
  templateId?: number;
  lastFilled?: string;
  createdAt?: string;
  updatedAt?: string;
  latestConversationId?: string | null;
  /** Custom field values keyed by field_key (from LeadFieldConfig) */
  custom_fields?: Record<string, unknown>;
  /** Relation counts: {work: N, datasheet_record: M} */
  relations_summary?: Record<string, number>;
  /** Pipeline stage */
  pipelineStageId?: number | null;
  pipelineStageName?: string | null;
  pipelineStageColor?: string | null;
  pipeline_stage_type?: string;
  /** AI agent assigned to this lead */
  aiAgentId?: number | null;
  /** Routing mode for this lead: 'ai' | 'manual' | 'blocked' */
  routingMode?: 'ai' | 'manual' | 'blocked';
  expectedValue?: number | null;
  expectedCloseDate?: string | null;
  overdueFollowupCount?: number;
  lastHumanContactAt?: string | null;
  tags?: LeadTag[];
  nurtureStatus?: 'active' | 'paused' | null;
  nurtureSequenceName?: string | null;
  nurtureStep?: number | null;
  /** Meta ad attribution — null for non-ad leads */
  adAttribution?: AdAttribution | null;
}

export interface LeadTag {
  id: number;
  name: string;
  color?: string | null;
}

export interface Conversation {
  id: string;
  customerId: string; // lead_id
  agentId?: number | null;
  agentName: string;
  status: ConversationStatus;
  updatedAt: string;
  lastMessagePreview: string;
  totalMessages?: number;
  unreadCount?: number;
  lastUserMessageAt?: string | null;
  lastAgentMessageAt?: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  timestamp: string;
  // Delivery receipts — populated for outbound channels that emit them
  // (WhatsApp). For other channels delivered defaults to true.
  delivered?: boolean;
  read?: boolean;
  error_code?: string | null;
  error_detail?: string | null;
}

export interface ConversationSession {
  id: string;
  status: 'active' | 'ended' | 'abandoned';
  startedAt: string;
  lastMessageAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  messagesCount: number;
  summary: string | null;
  leadScore: number | null;
  sentiment: number | null;
  actionsTaken?: Array<{ tool?: string; timestamp?: string | null }>;
  // LLM cost rollup (from session_analytics worker)
  llmCostUsd: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  llmCachedInputTokens: number;
  llmRunsCount: number;
}

export interface CustomerFilters {
  search?: string;
  page?: number;
  perPage?: number;
  stage_type?: string;
  priority?: 'low' | 'medium' | 'high';
  source?: string;
  channelId?: number;
  assignedToId?: number | null;
  assignedFilter?: 'all' | 'unassigned' | 'me';
  pipelineStageId?: number | null;
  sort_by?: 'created_at' | 'updated_at' | 'name' | 'priority' | 'pipeline_stage_id';
  sort_dir?: 'asc' | 'desc';
  /** Filter to only leads from a specific ad platform (e.g. "meta") */
  ad_platform?: string | null;
  /** Filter by Meta campaign ID */
  meta_campaign_id?: string | null;
  /** Filter by Meta lead ad form ID */
  meta_form_id?: string | null;
}

type Lead = {
  id: number;
  business_id: number;
  assigned_to_id?: number | null;
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  priority?: string;
  source?: string | null;
  notes?: string | null;
  extra_data?: Record<string, any> | null;
  created_at: string;
  updated_at?: string | null;
  linked_channels?: LinkedChannel[];
  assigned_at?: string | null;
  assignment_locked_until?: string | null;
};

function primaryChannel(lead: Lead): Channel {
  const channels = lead.linked_channels;
  if (channels && channels.length > 0) return channels[0].channel_type as Channel;
  return (lead.source as Channel) || 'whatsapp';
}

type LeadListResponse = {
  leads: Lead[];
  total: number;
  page: number;
  per_page: number;
};

type ConvoOut = {
  id: number;
  lead_id?: number | null;
  contact_id?: number | null;
  agent_id?: number | null;
  agent_name?: string | null;
  mode: 'ai' | 'manual';
  summary?: string | null;
  last_message_at?: string | null;
  updated_at?: string | null;
  lead_name?: string | null;
  contact_name?: string | null;
  owner_type?: string | null;
  owner_name?: string | null;
  channel_id?: number | null;
  channel_name?: string | null;
  channel_type?: string | null;
  lead_status?: string | null;
  last_intent?: string | null;
  last_message_preview?: string | null;
  unread_count?: number | null;
  total_messages?: number | null;
  last_user_message_at?: string | null;
  last_agent_message_at?: string | null;
};

export interface ConversationListFilters {
  channel_type?: string;
  channel_id?: number;
  mode?: string;
  lead_status?: string;
  intent?: string;
  unread_only?: boolean;
  agent_id?: number;
  agent_name?: string;
  contact_group_id?: number;
}

type PaginatedMessages = {
  total: number;
  page: number;
  limit: number;
  messages: Array<{
    id: number;
    role: 'user' | 'assistant' | 'tool' | 'system';
    content: string;
    timestamp: string;
    delivered?: boolean;
    read?: boolean;
    error_code?: string | null;
    error_detail?: string | null;
  }>;
};

type SessionOut = {
  id: number;
  status: 'active' | 'ended' | 'abandoned';
  started_at: string;
  last_message_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  messages_count: number;
  summary?: string | null;
  lead_score?: number | null;
  sentiment?: number | null;
  actions_taken?: Array<{ tool?: string; timestamp?: string | null }>;
  llm_cost_usd?: number | null;
  llm_input_tokens?: number | null;
  llm_output_tokens?: number | null;
  llm_cached_input_tokens?: number | null;
  llm_runs_count?: number | null;
};

const EXTRA_DATA_SYSTEM_KEYS = [
  'lead_level_score',
  'last_score_update',
  '_template_id',
  'last_filled',
] as const;

function parseExtraData(extraData: Record<string, any> | null | undefined) {
  if (!extraData) {
    return {
      leadScore: undefined as number | undefined,
      lastScoreUpdate: undefined as string | undefined,
      templateId: undefined as number | undefined,
      lastFilled: undefined as string | undefined,
      customFields: {} as Record<string, any>,
    };
  }
  const {
    lead_level_score,
    last_score_update,
    _template_id,
    last_filled,
    ...rest
  } = extraData;
  const customFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(rest || {})) {
    if (EXTRA_DATA_SYSTEM_KEYS.includes(k as any)) continue;
    customFields[k] = v;
  }
  return {
    leadScore: typeof lead_level_score === 'number' ? lead_level_score : undefined,
    lastScoreUpdate: typeof last_score_update === 'string' ? last_score_update : undefined,
    templateId:
      typeof _template_id === 'number'
        ? _template_id
        : typeof _template_id === 'string'
          ? parseInt(_template_id, 10)
          : undefined,
    lastFilled: typeof last_filled === 'string' ? last_filled : undefined,
    customFields,
  };
}

/** Lightweight list of leads for dropdowns. No conversation data. */
export interface LeadOption {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
}

export async function listLeadsForSelect(params: { search?: string; per_page?: number } = {}): Promise<LeadOption[]> {
  const perPage = Math.min(100, params.per_page ?? 100);
  const searchParams = new URLSearchParams();
  searchParams.set('page', '1');
  searchParams.set('per_page', String(perPage));
  if (params.search) searchParams.set('search', params.search);
  const data = await apiFetch<LeadListResponse>(`/leads?${searchParams.toString()}`, { method: 'GET' });
  return (data.leads ?? []).map((l) => ({
    id: l.id,
    name: l.name ?? null,
    phone: l.phone ?? '',
    email: l.email ?? null,
  }));
}

export async function listCustomers(filters: CustomerFilters = {}) {
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 10;

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('per_page', String(perPage));
  if (filters.search) params.set('search', filters.search);
  if (filters.stage_type) params.set('stage_type', filters.stage_type);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.source) params.set('source', filters.source);
  if (filters.channelId != null) params.set('channel_id', String(filters.channelId));
  if (filters.assignedFilter === 'unassigned') params.set('assigned_filter', 'unassigned');
  if (filters.assignedFilter === 'me' && filters.assignedToId != null) params.set('assigned_to_id', String(filters.assignedToId));
  if (filters.assignedToId != null && filters.assignedFilter !== 'me' && filters.assignedFilter !== 'unassigned') params.set('assigned_to_id', String(filters.assignedToId));
  if (filters.pipelineStageId != null) params.set('pipeline_stage_id', String(filters.pipelineStageId));
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.sort_dir) params.set('sort_dir', filters.sort_dir);
  // ── Ad source filters ──────────────────────────────────────────────
  if (filters.ad_platform) params.set('ad_platform', filters.ad_platform);
  if (filters.meta_campaign_id) params.set('meta_campaign_id', filters.meta_campaign_id);
  if (filters.meta_form_id) params.set('meta_form_id', filters.meta_form_id);

  const data = await apiFetch<LeadListResponse>(`/leads?${params.toString()}`, { method: 'GET' });

  // Convo data is now enriched server-side — no waterfall needed
  const items: Customer[] = data.leads.map((l) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = l as any;
    const lastActivity = raw.last_message_at ?? l.updated_at ?? l.created_at;
    const { leadScore, lastScoreUpdate, customFields, templateId, lastFilled } = parseExtraData(l.extra_data);
    return {
      id: String(l.id),
      name: l.name ?? null,
      phone: l.phone ?? '',
      email: l.email ?? null,
      channel: primaryChannel(l),
      linkedChannels: l.linked_channels ?? [],
      assignedAgent: '—',
      assignedToId: l.assigned_to_id ?? null,
      assignedAt: l.assigned_at ?? null,
      assignmentLockedUntil: l.assignment_locked_until ?? null,
      lastActivity,
      lastMessagePreview: raw.last_message_preview ?? '—',
      aiActive: false,
      priority: l.priority as 'low' | 'medium' | 'high' | undefined,
      source: l.source ?? undefined,
      notes: l.notes ?? null,
      leadScore,
      lastScoreUpdate,
      customFields,
      templateId,
      lastFilled,
      createdAt: l.created_at,
      updatedAt: l.updated_at ?? undefined,
      latestConversationId: raw.latest_conversation_id ? String(raw.latest_conversation_id) : null,
      custom_fields: raw.custom_fields,
      relations_summary: raw.relations_summary,
      pipelineStageId: raw.pipeline_stage_id ?? null,
      pipelineStageName: raw.pipeline_stage_name ?? null,
      pipelineStageColor: raw.pipeline_stage_color ?? null,
      pipeline_stage_type: raw.pipeline_stage_type ?? undefined,
      aiAgentId: raw.ai_agent_id ?? null,
      expectedValue: raw.expected_value != null ? Number(raw.expected_value) : null,
      expectedCloseDate: raw.expected_close_date ?? null,
      overdueFollowupCount: raw.overdue_followup_count ?? 0,
      lastHumanContactAt: raw.last_human_contact_at ?? null,
      tags: (raw.tags ?? []) as LeadTag[],
      nurtureStatus: raw.nurture_status ?? null,
      nurtureSequenceName: raw.nurture_sequence_name ?? null,
      nurtureStep: raw.nurture_step ?? null,
      adAttribution: raw.ad_attribution ?? null,
    };
  });

  return {
    items,
    total: data.total,
    page: data.page,
    perPage: data.per_page,
    totalPages: Math.max(1, Math.ceil(data.total / data.per_page)),
  };
}

export interface BulkActionPayload {
  lead_ids: number[];
  action: 'change_stage' | 'change_priority' | 'assign' | 'delete';
  pipeline_stage_id?: number;
  priority?: 'low' | 'medium' | 'high';
  assigned_to_id?: number | null;
}

export async function bulkLeadAction(payload: BulkActionPayload): Promise<{ affected: number; action: string }> {
  return apiFetch('/leads/bulk-action', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function exportLeadsCSV(filters: CustomerFilters = {}): Promise<Customer[]> {
  const result = await listCustomers({ ...filters, page: 1, perPage: 1000 });
  return result.items;
}

export async function getCustomer(id: string): Promise<Customer | null> {
  // Use direct lead-by-id endpoint
  const leadId = Number(id);
  const lead = await apiFetch<Lead>(`/leads/${leadId}`, { method: 'GET' });
  
  // Fetch conversations to enrich data
  const convos = await apiFetch<ConvoOut[]>(`/convo/lead/${leadId}`, { method: 'GET' });
  const latestConvo = convos.length > 0 
    ? [...convos].sort((a, b) => {
        const tsA = a.last_message_at ?? a.updated_at ?? '';
        const tsB = b.last_message_at ?? b.updated_at ?? '';
        return new Date(tsB).getTime() - new Date(tsA).getTime();
      })[0]
    : null;
  
  const { leadScore, lastScoreUpdate, customFields, templateId, lastFilled } = parseExtraData(lead.extra_data);
  const last = latestConvo?.last_message_at ?? latestConvo?.updated_at ?? lead.updated_at ?? lead.created_at;
  return {
    id: String(lead.id),
    name: lead.name ?? null,
    company: lead.company ?? null,
    phone: lead.phone ?? '',
    email: lead.email ?? null,
    channel: primaryChannel(lead),
    linkedChannels: lead.linked_channels ?? [],
    assignedAgent: latestConvo?.agent_name ?? '—',
    assignedToId: lead.assigned_to_id ?? null,
    assignedAt: lead.assigned_at ?? null,
    assignmentLockedUntil: lead.assignment_locked_until ?? null,
    lastActivity: last,
    lastMessagePreview: latestConvo?.summary ?? '—',
    aiActive: (latestConvo?.mode ?? 'ai') === 'ai',
    priority: lead.priority as 'low' | 'medium' | 'high' | undefined,
    source: lead.source ?? undefined,
    notes: lead.notes ?? null,
    leadScore,
    lastScoreUpdate,
    customFields,
    templateId,
    lastFilled,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at ?? undefined,
  };
}

function mapConvosToConversations(leadId: number, convos: ConvoOut[]): Conversation[] {
  return convos.map((c) => ({
    id: String(c.id),
    customerId: String(c.lead_id),
    agentId: c.agent_id ?? null,
    agentName: c.agent_name ?? '—',
    status: c.mode,
    updatedAt: c.updated_at ?? c.last_message_at ?? new Date().toISOString(),
    lastMessagePreview: c.last_message_preview ?? c.summary ?? '—',
    totalMessages: c.total_messages ?? 0,
    unreadCount: c.unread_count ?? 0,
    lastUserMessageAt: c.last_user_message_at ?? null,
    lastAgentMessageAt: c.last_agent_message_at ?? null,
  }));
}

/** Inbox list item: conversation with lead/contact and channel names for display. */
export interface InboxConversation extends Conversation {
  leadName?: string;
  contactName?: string;
  ownerName?: string;
  ownerType?: 'lead' | 'contact';
  contactId?: number | null;
  channelId?: number | null;
  channelName?: string;
  channelType?: string;
  leadStatus?: string;
  lastIntent?: string;
  unreadCount?: number;
}

function mapConvosToInboxConversations(convos: ConvoOut[]): InboxConversation[] {
  return convos.map((c) => ({
    id: String(c.id),
    customerId: c.lead_id != null ? String(c.lead_id) : String(c.contact_id ?? ''),
    contactId: c.contact_id ?? null,
    agentId: c.agent_id ?? null,
    agentName: c.agent_name ?? '—',
    status: c.mode,
    updatedAt: c.updated_at ?? c.last_message_at ?? new Date().toISOString(),
    lastMessagePreview: c.last_message_preview ?? c.summary ?? '—',
    leadName: c.lead_name ?? undefined,
    contactName: c.contact_name ?? undefined,
    ownerName: c.owner_name ?? c.lead_name ?? c.contact_name ?? undefined,
    ownerType: (c.owner_type as 'lead' | 'contact') ?? (c.lead_id ? 'lead' : 'contact'),
    channelId: c.channel_id ?? null,
    channelName: c.channel_name ?? undefined,
    channelType: c.channel_type ?? undefined,
    leadStatus: c.lead_status ?? undefined,
    lastIntent: c.last_intent ?? undefined,
    unreadCount: c.unread_count ?? 0,
  }));
}

export async function listAllConversations(
  filters?: ConversationListFilters,
): Promise<InboxConversation[]> {
  const params = new URLSearchParams();
  if (filters?.channel_type) params.set('channel_type', filters.channel_type);
  if (filters?.channel_id) params.set('channel_id', String(filters.channel_id));
  if (filters?.mode) params.set('mode', filters.mode);
  if (filters?.lead_status) params.set('lead_status', filters.lead_status);
  if (filters?.intent) params.set('intent', filters.intent);
  if (filters?.unread_only) params.set('unread_only', 'true');
  if (filters?.agent_id) params.set('agent_id', String(filters.agent_id));
  if (filters?.agent_name) params.set('agent_name', filters.agent_name);
  if (filters?.contact_group_id) params.set('contact_group_id', String(filters.contact_group_id));
  const qs = params.toString();
  const url = qs ? `/convo/?${qs}` : '/convo/';
  const convos = await apiFetch<ConvoOut[]>(url, { method: 'GET' });
  return mapConvosToInboxConversations(convos);
}

export async function listConversations(customerId: string): Promise<Conversation[]> {
  const leadId = Number(customerId);
  const convos = await apiFetch<ConvoOut[]>(`/convo/lead/${leadId}`, { method: 'GET' });
  return mapConvosToConversations(leadId, convos);
}

export interface CustomerDetailResult {
  customer: Customer;
  conversations: Conversation[];
}

/** Fetches lead + convos once; use to avoid duplicate GET /convo/lead/:id. */
export async function fetchCustomerDetail(id: string): Promise<CustomerDetailResult> {
  const leadId = Number(id);
  const [lead, convos] = await Promise.all([
    apiFetch<Lead>(`/leads/${leadId}`, { method: 'GET' }),
    apiFetch<ConvoOut[]>(`/convo/lead/${leadId}`, { method: 'GET' }),
  ]);
  const latestConvo =
    convos.length > 0
      ? [...convos].sort((a, b) => {
          const tsA = a.last_message_at ?? a.updated_at ?? '';
          const tsB = b.last_message_at ?? b.updated_at ?? '';
          return new Date(tsB).getTime() - new Date(tsA).getTime();
        })[0]
      : null;
  const { leadScore, lastScoreUpdate, customFields, templateId, lastFilled } = parseExtraData(lead.extra_data);
  const last = latestConvo?.last_message_at ?? latestConvo?.updated_at ?? lead.updated_at ?? lead.created_at;
  const customer: Customer = {
    id: String(lead.id),
    name: lead.name ?? null,
    company: lead.company ?? null,
    phone: lead.phone ?? '',
    email: lead.email ?? null,
    assignedToId: lead.assigned_to_id ?? null,
    assignedAt: lead.assigned_at ?? null,
    assignmentLockedUntil: lead.assignment_locked_until ?? null,
    channel: primaryChannel(lead),
    linkedChannels: lead.linked_channels ?? [],
    assignedAgent: latestConvo?.agent_name ?? '—',
    lastActivity: last,
    lastMessagePreview: latestConvo?.summary ?? '—',
    aiActive: (latestConvo?.mode ?? 'ai') === 'ai',
    priority: lead.priority as 'low' | 'medium' | 'high' | undefined,
    source: lead.source ?? undefined,
    notes: lead.notes ?? null,
    leadScore,
    lastScoreUpdate,
    customFields,
    templateId,
    lastFilled,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at ?? undefined,
    aiAgentId: (lead as any).ai_agent_id ?? null,
    routingMode: ((lead as any).routing_mode ?? 'manual') as 'ai' | 'manual' | 'blocked',
    expectedValue: (lead as any).expected_value != null ? Number((lead as any).expected_value) : null,
    expectedCloseDate: (lead as any).expected_close_date ?? null,
  };
  const conversations = mapConvosToConversations(leadId, convos);
  return { customer, conversations };
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const convoId = Number(conversationId);
  const data = await apiFetch<PaginatedMessages>(`/convo/${convoId}/messages?page=1&limit=50`, {
    method: 'GET',
  });
  // backend returns DESC, UI expects ASC
  const sorted = [...data.messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return sorted.map((m) => ({
    id: String(m.id),
    conversationId,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    delivered: m.delivered,
    read: m.read,
    error_code: m.error_code ?? null,
    error_detail: m.error_detail ?? null,
  }));
}

function mapSession(s: SessionOut): ConversationSession {
  return {
    id: String(s.id),
    status: s.status,
    startedAt: s.started_at,
    lastMessageAt: s.last_message_at ?? null,
    endedAt: s.ended_at ?? null,
    durationSeconds: s.duration_seconds ?? null,
    messagesCount: s.messages_count ?? 0,
    summary: s.summary ?? null,
    leadScore: typeof s.lead_score === 'number' ? s.lead_score : null,
    sentiment: typeof s.sentiment === 'number' ? s.sentiment : null,
    actionsTaken: s.actions_taken ?? [],
    llmCostUsd: typeof s.llm_cost_usd === 'number' ? s.llm_cost_usd : 0,
    llmInputTokens: typeof s.llm_input_tokens === 'number' ? s.llm_input_tokens : 0,
    llmOutputTokens: typeof s.llm_output_tokens === 'number' ? s.llm_output_tokens : 0,
    llmCachedInputTokens: typeof s.llm_cached_input_tokens === 'number' ? s.llm_cached_input_tokens : 0,
    llmRunsCount: typeof s.llm_runs_count === 'number' ? s.llm_runs_count : 0,
  };
}

export async function listConversationSessions(conversationId: string): Promise<ConversationSession[]> {
  const convoId = Number(conversationId);
  const rows = await apiFetch<SessionOut[]>(`/convo/${convoId}/sessions`, { method: 'GET' });
  return (rows ?? []).map(mapSession);
}

export async function appendMessage(
  conversationId: string,
  role: Message['role'],
  content: string,
): Promise<{ ok: true; message: Message } | { ok: false; error: string }> {
  const convoId = Number(conversationId);
  try {
    const created = await apiFetch<any>(`/convo/${convoId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        text: content,
        sender: role === 'assistant' ? 'assistant' : 'user',
        message_type: 'text',
      }),
    });
    return {
      ok: true,
      message: {
        id: String(created.id),
        conversationId,
        role: created.role,
        content: created.content,
        timestamp: created.timestamp,
      },
    };
  } catch (err: any) {
    const detail = err?.data?.detail ?? err?.message ?? 'Failed to send message';
    return { ok: false, error: typeof detail === 'string' ? detail : 'Failed to send message' };
  }
}

export async function toggleConversationStatus(conversationId: string, status: ConversationStatus) {
  const convoId = Number(conversationId);
  await apiFetch(`/convo/${convoId}/mode`, {
    method: 'PUT',
    body: JSON.stringify({ mode: status }),
  });
  return true;
}

// Lead Management Types
export interface LeadCreate {
  name: string;
  company?: string;
  phone: string;
  email?: string;
  priority?: 'low' | 'medium' | 'high';
  source?: string;
  notes?: string;
  expected_value?: number;
  expected_close_date?: string;
  extra_data?: Record<string, any>;
}

export interface LeadUpdate {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  priority?: 'low' | 'medium' | 'high';
  source?: string;
  notes?: string;
  expected_value?: number | null;
  expected_close_date?: string | null;
  extra_data?: Record<string, any>;
  assigned_to_id?: number | null;
  pipeline_stage_id?: number | null;
}

export interface LeadStats {
  total_leads: number;
  by_stage: Record<string, number>;
  by_priority: Record<string, number>;
  by_source: Record<string, number>;
}

// Lead Management Functions
export async function createLead(data: LeadCreate): Promise<Customer> {
  const created = await apiFetch<Lead>('/leads', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  // Fetch the created lead with full data
  return getCustomer(String(created.id)) as Promise<Customer>;
}

/** Lightweight PATCH — no round-trip GET after PUT. Use for inline edits. */
export async function patchLead(id: string, data: LeadUpdate): Promise<void> {
  await apiFetch<Lead>(`/leads/${Number(id)}`, { method: 'PUT', body: JSON.stringify(data) });
}

// ─── Saved views ─────────────────────────────────────────────────────────────

export interface SavedViewRecord {
  id: number;
  name: string;
  filters: Record<string, unknown>;
  created_at?: string | null;
}

export async function listSavedViews(): Promise<SavedViewRecord[]> {
  return apiFetch<SavedViewRecord[]>('/leads/saved-views');
}

export async function createSavedView(name: string, filters: Record<string, unknown>): Promise<SavedViewRecord> {
  return apiFetch<SavedViewRecord>('/leads/saved-views', {
    method: 'POST',
    body: JSON.stringify({ name, filters }),
  });
}

export async function deleteSavedView(viewId: number): Promise<void> {
  await apiFetch<void>(`/leads/saved-views/${viewId}`, { method: 'DELETE' });
}

// ─── Tag management ───────────────────────────────────────────────────────────

export async function listLeadTags(): Promise<LeadTag[]> {
  return apiFetch<LeadTag[]>('/leads/tags');
}

export async function createLeadTag(name: string, color?: string): Promise<LeadTag> {
  return apiFetch<LeadTag>('/leads/tags', {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  });
}

export async function deleteLeadTag(tagId: number): Promise<void> {
  await apiFetch<void>(`/leads/tags/${tagId}`, { method: 'DELETE' });
}

export async function assignTagToLead(leadId: string, tagId: number): Promise<void> {
  await apiFetch<void>(`/leads/${Number(leadId)}/tags/${tagId}`, { method: 'POST' });
}

export async function unassignTagFromLead(leadId: string, tagId: number): Promise<void> {
  await apiFetch<void>(`/leads/${Number(leadId)}/tags/${tagId}`, { method: 'DELETE' });
}

/** Lightweight assign — no round-trip GET after PUT. Use for inline edits. */
export async function patchAssign(id: string, assignedToId: number | null): Promise<void> {
  await apiFetch<void>(`/leads/${Number(id)}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ assigned_to_id: assignedToId, force_reassign: false }),
  });
}

export async function updateLead(id: string, data: LeadUpdate): Promise<Customer> {
  const leadId = Number(id);
  await apiFetch<Lead>(`/leads/${leadId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  
  // Fetch updated lead with full data
  return getCustomer(id) as Promise<Customer>;
}

export async function assignLead(
  id: string,
  assignedToId: number | null,
  forceReassign = false,
): Promise<Customer> {
  const leadId = Number(id);
  await apiFetch<Lead>(`/leads/${leadId}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ assigned_to_id: assignedToId, force_reassign: forceReassign }),
  });
  return getCustomer(id) as Promise<Customer>;
}

export async function deleteLead(id: string): Promise<void> {
  const leadId = Number(id);
  await apiFetch(`/leads/${leadId}`, {
    method: 'DELETE',
  });
}

export interface RescoreResult {
  leadId: number;
  leadLevelScore: number;
  previousScore: number | null;
  lastScoreUpdate: string;
  sessionsConsidered: number;
  sessionBreakdown: Array<{
    sessionId: number;
    createdAt: string | null;
    ageDays: number;
    weight: number;
    messagesCount: number;
    sessionScore: number;
    weightedContribution: number;
  }>;
}

/**
 * Recompute the lead-level score on demand (calls the same scorer the
 * session analytics worker uses). Returns the new score plus a breakdown
 * of which sessions contributed to it.
 */
export async function rescoreLead(id: string): Promise<RescoreResult> {
  const leadId = Number(id);
  const raw = await apiFetch<any>(`/leads/${leadId}/rescore`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return {
    leadId: raw.lead_id,
    leadLevelScore: raw.lead_level_score,
    previousScore: raw.previous_score ?? null,
    lastScoreUpdate: raw.last_score_update,
    sessionsConsidered: raw.sessions_considered ?? 0,
    sessionBreakdown: (raw.session_breakdown ?? []).map((s: any) => ({
      sessionId: s.session_id,
      createdAt: s.created_at ?? null,
      ageDays: s.age_days,
      weight: s.weight,
      messagesCount: s.messages_count,
      sessionScore: s.session_score,
      weightedContribution: s.weighted_contribution,
    })),
  };
}

export async function getLeadStats(): Promise<LeadStats> {
  return apiFetch<LeadStats>('/leads/stats', { method: 'GET' });
}export interface LeadStatsOverTime {
  series: Array<{ date: string; count: number }>;
}

export async function getLeadStatsOverTime(days = 30): Promise<LeadStatsOverTime> {
  return apiFetch<LeadStatsOverTime>(`/leads/stats/over_time?days=${days}`, { method: 'GET' });
}

export async function recalcConversationAnalytics(conversationId: string): Promise<void> {
  const convoId = Number(conversationId);
  await apiFetch(`/analytics/conversations/${convoId}/recalculate`, {
    method: 'POST',
  });
}

// ─── Lead Notes ───────────────────────────────────────────────────────────────

export interface LeadNote {
  id: number;
  lead_id: number;
  content: string;
  category: string | null;
  source: string; // "manual" | "agent"
  created_at: string | null;
}

export interface LeadNoteCreate {
  content: string;
  category?: string;
}

export async function listLeadNotes(leadId: number | string): Promise<LeadNote[]> {
  return apiFetch<LeadNote[]>(`/leads/${leadId}/notes`, { method: 'GET', auth: true });
}

export async function createLeadNote(leadId: number | string, payload: LeadNoteCreate): Promise<LeadNote> {
  return apiFetch<LeadNote>(`/leads/${leadId}/notes`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteLeadNote(leadId: number | string, noteId: number): Promise<void> {
  await apiFetch<void>(`/leads/${leadId}/notes/${noteId}`, { method: 'DELETE', auth: true });
}


// ---------- Pipeline Stages ----------

export interface LeadPipelineStage {
  id: number;
  business_id: number;
  name: string;
  color: string | null;
  stage_type: 'open' | 'won' | 'lost';
  sort_order: number;
  is_default: boolean;
  auto_create_work: boolean;
  work_template_id: number | null;
  work_template_name: string | null;
  lead_count: number;
  created_at?: string;
  updated_at?: string;
}

export async function listPipelineStages(): Promise<LeadPipelineStage[]> {
  return apiFetch<LeadPipelineStage[]>('/leads/pipeline-stages', { method: 'GET', auth: true });
}

export async function createPipelineStage(payload: {
  name: string; color?: string; stage_type?: string; sort_order?: number; is_default?: boolean;
}): Promise<LeadPipelineStage> {
  return apiFetch<LeadPipelineStage>('/leads/pipeline-stages', {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updatePipelineStage(stageId: number, payload: Partial<{
  name: string; color: string; stage_type: string; sort_order: number; is_default: boolean;
}>): Promise<LeadPipelineStage> {
  return apiFetch<LeadPipelineStage>(`/leads/pipeline-stages/${stageId}`, {
    method: 'PUT', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deletePipelineStage(stageId: number): Promise<void> {
  await apiFetch(`/leads/pipeline-stages/${stageId}`, { method: 'DELETE', auth: true });
}

export async function moveLeadToStage(leadId: number | string, pipelineStageId: number): Promise<Customer> {
  return apiFetch<Customer>(`/leads/${leadId}/move-stage`, {
    method: 'PUT', auth: true,
    body: JSON.stringify({ pipeline_stage_id: pipelineStageId }),
    headers: { 'Content-Type': 'application/json' },
  });
}


// ---------- Lead Activities ----------

export interface LeadActivity {
  id: number;
  lead_id: number;
  user_id: number | null;
  user_name: string | null;
  activity_type: string;
  description: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at?: string;
}

export async function listLeadActivities(leadId: number | string, page = 1, perPage = 50): Promise<LeadActivity[]> {
  return apiFetch<LeadActivity[]>(`/leads/${leadId}/activities?page=${page}&per_page=${perPage}`, {
    method: 'GET', auth: true,
  });
}


// ---------- Lead-Linked Datasheets ----------

/** A datasheet that has a relation field pointing to Leads (business-level). */
export interface LeadLinkedModel {
  model_id: number;
  display_name: string;
  field_name: string;
}

/** Legacy shape returned by per-lead linked-datasheets endpoint. */
export interface LinkedDatasheet {
  model_id: number;
  name: string;
  display_name: string;
  record_count: number;
}

export interface LinkedRecordField {
  id: number;
  name: string;
  display_name: string;
  field_type: string;
  is_required: boolean;
  config: Record<string, unknown> | null;
}

export interface LinkedRecord {
  id: number;
  data: Record<string, unknown>;
  record_key: string | null;
  status: string | null;
  created_at: string | null;
}

export interface LinkedRecordsResponse {
  fields: LinkedRecordField[];
  records: LinkedRecord[];
  total_count?: number;
}

/** Business-level: which datasheets have a relation field to Leads. */
export async function getLeadLinkedModels(): Promise<LeadLinkedModel[]> {
  return apiFetch<LeadLinkedModel[]>('/leads/linked-models', { method: 'GET', auth: true });
}

/** Per-lead: datasheets with record counts for a specific lead. */
export async function getLinkedDatasheets(leadId: number | string): Promise<LinkedDatasheet[]> {
  return apiFetch<LinkedDatasheet[]>(`/leads/${leadId}/linked-datasheets`, { method: 'GET', auth: true });
}

export async function getLinkedRecords(leadId: number | string, modelId: number): Promise<LinkedRecordsResponse> {
  return apiFetch<LinkedRecordsResponse>(`/leads/${leadId}/linked-records/${modelId}`, { method: 'GET', auth: true });
}

export async function setLeadAiAgent(
  leadId: number | string,
  agentId: number | null,
): Promise<{ lead_id: number; ai_agent_id: number | null }> {
  return apiFetch(`/leads/${leadId}/ai-agent`, {
    method: 'PUT',
    body: JSON.stringify({ agent_id: agentId }),
  });
}