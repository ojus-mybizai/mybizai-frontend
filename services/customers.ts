import { apiFetch } from '@/lib/api-client';

export type Channel = 'whatsapp' | 'instagram' | 'messenger' | string;
export type ConversationStatus = 'ai' | 'manual';

export interface LinkedChannel {
  channel_id: number;
  channel_type: string;
  channel_identifier: string;
}

export interface Customer {
  id: string; // lead_id
  name: string | null;
  phone: string;
  email?: string | null;
  channel: Channel; // primary/first channel for display
  linkedChannels?: LinkedChannel[];
  assignedAgent: string;
  assignedToId?: number | null;
  lastActivity: string;
  lastMessagePreview: string;
  aiActive: boolean;
  status?: 'new' | 'contacted' | 'qualified' | 'lost' | 'won';
  priority?: 'low' | 'medium' | 'high';
  source?: string;
  notes?: string | null;
  leadScore?: number;
  lastScoreUpdate?: string;
  customFields?: Record<string, any>;
  templateId?: number;
  lastFilled?: string;
  createdAt?: string;
  updatedAt?: string;
  latestConversationId?: string | null;
}

export interface Conversation {
  id: string;
  customerId: string; // lead_id
  agentName: string;
  status: ConversationStatus;
  updatedAt: string;
  lastMessagePreview: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  timestamp: string;
}

export interface CustomerFilters {
  search?: string;
  page?: number;
  perPage?: number;
  status?: 'new' | 'contacted' | 'qualified' | 'lost' | 'won';
  priority?: 'low' | 'medium' | 'high';
  source?: string;
  channelId?: number; // Filter by channel (leads linked to this channel)
  assignedToId?: number | null; // Filter by assignee; use with assignedFilter for "unassigned"
  assignedFilter?: 'all' | 'unassigned' | 'me'; // me = current user (owner)
}

type Lead = {
  id: number;
  business_id: number;
  assigned_to_id?: number | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string;
  priority?: string;
  source?: string | null;
  notes?: string | null;
  extra_data?: Record<string, any> | null;
  created_at: string;
  updated_at?: string | null;
  linked_channels?: LinkedChannel[];
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
  lead_id: number;
  agent_name?: string | null;
  mode: 'ai' | 'manual';
  summary?: string | null;
  last_message_at?: string | null;
  updated_at?: string | null;
  lead_name?: string | null;
  channel_name?: string | null;
  channel_type?: string | null;
  lead_status?: string | null;
  last_intent?: string | null;
  last_message_preview?: string | null;
  unread_count?: number | null;
};

export interface ConversationListFilters {
  channel_type?: string;
  mode?: string;
  lead_status?: string;
  intent?: string;
  unread_only?: boolean;
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
  }>;
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

/** Lightweight list of leads for dropdowns (e.g. order/appointment create). No conversation data. */
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
  const search = filters.search ?? undefined;

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('per_page', String(perPage));
  if (search) params.set('search', search);
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.source) params.set('source', filters.source);
  if (filters.channelId != null) params.set('channel_id', String(filters.channelId));
  if (filters.assignedFilter === 'unassigned') params.set('assigned_filter', 'unassigned');
  if (filters.assignedFilter === 'me' && filters.assignedToId != null) params.set('assigned_to_id', String(filters.assignedToId));
  if (filters.assignedToId != null && filters.assignedFilter !== 'me' && filters.assignedFilter !== 'unassigned') params.set('assigned_to_id', String(filters.assignedToId));

  const data = await apiFetch<LeadListResponse>(`/leads?${params.toString()}`, { method: 'GET' });

  // Only fetch conversations if we have leads (avoid unnecessary API call)
  let latestByLead = new Map<number, ConvoOut>();
  if (data.leads.length > 0) {
    try {
      // Fetch conversations only for the leads we're displaying (more efficient)
      const leadIds = data.leads.map(l => l.id);
      // For now, we'll fetch all conversations but this could be optimized to fetch only for specific leads
      const convos = await apiFetch<ConvoOut[]>('/convo/', { method: 'GET' });
      for (const c of convos) {
        if (leadIds.includes(c.lead_id)) {
          const prev = latestByLead.get(c.lead_id);
          const ts = c.last_message_at ?? c.updated_at ?? '';
          const prevTs = prev?.last_message_at ?? prev?.updated_at ?? '';
          if (!prev || (ts && prevTs && new Date(ts).getTime() > new Date(prevTs).getTime())) {
            latestByLead.set(c.lead_id, c);
          }
        }
      }
    } catch (error) {
      // If conversation fetch fails, continue without conversation data
      console.warn('Failed to fetch conversations for lead list:', error);
    }
  }

  const items: Customer[] = data.leads.map((l) => {
    const convo = latestByLead.get(l.id);
    const last = convo?.last_message_at ?? convo?.updated_at ?? l.updated_at ?? l.created_at;
    const { leadScore, lastScoreUpdate, customFields, templateId, lastFilled } = parseExtraData(l.extra_data);
    return {
      id: String(l.id),
      name: l.name ?? null,
      phone: l.phone ?? '',
      email: l.email ?? null,
      channel: primaryChannel(l),
      linkedChannels: l.linked_channels ?? [],
      assignedAgent: convo?.agent_name ?? '—',
      assignedToId: l.assigned_to_id ?? null,
      lastActivity: last,
      lastMessagePreview: convo?.summary ?? '—',
      aiActive: (convo?.mode ?? 'ai') === 'ai',
      status: l.status as 'new' | 'contacted' | 'qualified' | 'lost' | 'won' | undefined,
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
      latestConversationId: convo ? String(convo.id) : null,
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
    phone: lead.phone ?? '',
    email: lead.email ?? null,
    channel: primaryChannel(lead),
    linkedChannels: lead.linked_channels ?? [],
    assignedAgent: latestConvo?.agent_name ?? '—',
    assignedToId: lead.assigned_to_id ?? null,
    lastActivity: last,
    lastMessagePreview: latestConvo?.summary ?? '—',
    aiActive: (latestConvo?.mode ?? 'ai') === 'ai',
    status: lead.status as 'new' | 'contacted' | 'qualified' | 'lost' | 'won' | undefined,
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
    agentName: c.agent_name ?? '—',
    status: c.mode,
    updatedAt: c.updated_at ?? c.last_message_at ?? new Date().toISOString(),
    lastMessagePreview: c.last_message_preview ?? c.summary ?? '—',
  }));
}

/** Inbox list item: conversation with lead and channel names for display. */
export interface InboxConversation extends Conversation {
  leadName?: string;
  channelName?: string;
  channelType?: string;
  leadStatus?: string;
  lastIntent?: string;
  unreadCount?: number;
}

function mapConvosToInboxConversations(convos: ConvoOut[]): InboxConversation[] {
  return convos.map((c) => ({
    id: String(c.id),
    customerId: String(c.lead_id),
    agentName: c.agent_name ?? '—',
    status: c.mode,
    updatedAt: c.updated_at ?? c.last_message_at ?? new Date().toISOString(),
    lastMessagePreview: c.last_message_preview ?? c.summary ?? '—',
    leadName: c.lead_name ?? undefined,
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
  if (filters?.mode) params.set('mode', filters.mode);
  if (filters?.lead_status) params.set('lead_status', filters.lead_status);
  if (filters?.intent) params.set('intent', filters.intent);
  if (filters?.unread_only) params.set('unread_only', 'true');
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
    phone: lead.phone ?? '',
    email: lead.email ?? null,
    assignedToId: lead.assigned_to_id ?? null,
    channel: primaryChannel(lead),
    linkedChannels: lead.linked_channels ?? [],
    assignedAgent: latestConvo?.agent_name ?? '—',
    lastActivity: last,
    lastMessagePreview: latestConvo?.summary ?? '—',
    aiActive: (latestConvo?.mode ?? 'ai') === 'ai',
    status: lead.status as 'new' | 'contacted' | 'qualified' | 'lost' | 'won' | undefined,
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
  }));
}

export async function appendMessage(conversationId: string, role: Message['role'], content: string): Promise<Message> {
  const convoId = Number(conversationId);
  const created = await apiFetch<any>(`/convo/${convoId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      text: content,
      sender: role === 'assistant' ? 'assistant' : 'user',
      message_type: 'text',
    }),
  });
  return {
    id: String(created.id),
    conversationId,
    role: created.role,
    content: created.content,
    timestamp: created.timestamp,
  };
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
  phone: string;
  email?: string;
  status?: 'new' | 'contacted' | 'qualified' | 'lost' | 'won';
  priority?: 'low' | 'medium' | 'high';
  source?: string;
  notes?: string;
  extra_data?: Record<string, any>;
}

export interface LeadUpdate {
  name?: string;
  phone?: string;
  email?: string;
  status?: 'new' | 'contacted' | 'qualified' | 'lost' | 'won';
  priority?: 'low' | 'medium' | 'high';
  source?: string;
  notes?: string;
  extra_data?: Record<string, any>;
  assigned_to_id?: number | null;
}

export interface LeadStats {
  total_leads: number;
  by_status: Record<string, number>;
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

export async function updateLead(id: string, data: LeadUpdate): Promise<Customer> {
  const leadId = Number(id);
  await apiFetch<Lead>(`/leads/${leadId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  
  // Fetch updated lead with full data
  return getCustomer(id) as Promise<Customer>;
}

export async function deleteLead(id: string): Promise<void> {
  const leadId = Number(id);
  await apiFetch(`/leads/${leadId}`, {
    method: 'DELETE',
  });
}

export async function getLeadStats(): Promise<LeadStats> {
  return apiFetch<LeadStats>('/leads/stats', { method: 'GET' });
}export async function recalcConversationAnalytics(conversationId: string): Promise<void> {
  const convoId = Number(conversationId);
  await apiFetch(`/analytics/conversations/${convoId}/recalculate`, {
    method: 'POST',
  });
}