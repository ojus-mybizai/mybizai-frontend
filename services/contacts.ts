import { apiFetch } from '@/lib/api-client';

export type RoutingMode = 'ai' | 'manual' | 'blocked';

// ── Contact Type Def ──────────────────────────────────────────────────────────

export interface ContactTypeDef {
  id: number;
  name: string;
  color: string | null;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

// ── Contact ───────────────────────────────────────────────────────────────────

export interface Contact {
  id: number;
  publicId: string | null;
  businessId: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  source: string | null;          // system-set: whatsapp | instagram | ctwa | manual | csv
  contactTypeId: number | null;
  contactTypeName: string | null;
  contactTypeColor: string | null;
  routingMode: RoutingMode;
  aiAgentId: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  // kept for backward compat — same as source
  contactSource: string | null;
}

export interface ContactListResponse {
  items: Contact[];
  total: number;
  limit: number;
  offset: number;
}

export interface ContactChannelConfig {
  channelId: number;
  channelName: string;
  channelType: string;
  channelIdentifier: string;
  displayName: string | null;
  routingMode: RoutingMode | null;  // null = channel default (AI with channel.agent_id)
  agentId: number | null;
  agentName: string | null;
  channelDefaultAgentId: number | null;
  channelDefaultAgentName: string | null;
}

export interface UnknownSender {
  id: number;
  channelType: string;
  senderId: string;
  displayName: string | null;
  firstMessage: string | null;
  receivedAt: string | null;
  status: string;
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

function mapContact(c: Record<string, unknown>): Contact {
  const source = (c.source as string) ?? null;
  return {
    id: c.id as number,
    publicId: (c.public_id as string) ?? null,
    businessId: c.business_id as number,
    name: (c.name as string) ?? null,
    phone: (c.phone as string) ?? null,
    email: (c.email as string) ?? null,
    company: (c.company as string) ?? null,
    source,
    contactSource: source,   // backward compat alias
    contactTypeId: (c.contact_type_id as number) ?? null,
    contactTypeName: (c.contact_type_name as string) ?? null,
    contactTypeColor: (c.contact_type_color as string) ?? null,
    routingMode: ((c.routing_mode as RoutingMode) ?? 'ai'),
    aiAgentId: (c.ai_agent_id as number) ?? null,
    notes: (c.notes as string) ?? null,
    createdAt: (c.created_at as string) ?? '',
    updatedAt: (c.updated_at as string) ?? null,
  };
}

function mapChannel(r: Record<string, unknown>): ContactChannelConfig {
  return {
    channelId: r.channel_id as number,
    channelName: r.channel_name as string,
    channelType: r.channel_type as string,
    channelIdentifier: r.channel_identifier as string,
    displayName: (r.display_name as string) ?? null,
    routingMode: (r.routing_mode as RoutingMode) ?? null,
    agentId: (r.agent_id as number) ?? null,
    agentName: (r.agent_name as string) ?? null,
    channelDefaultAgentId: (r.channel_default_agent_id as number) ?? null,
    channelDefaultAgentName: (r.channel_default_agent_name as string) ?? null,
  };
}

// ── Contact Types API ─────────────────────────────────────────────────────────

export const contactTypesService = {
  list: (): Promise<ContactTypeDef[]> =>
    apiFetch<ContactTypeDef[]>('/contacts/types'),

  create: (payload: { name: string; color?: string; sort_order?: number }): Promise<ContactTypeDef> =>
    apiFetch<ContactTypeDef>('/contacts/types', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (typeId: number, payload: { name?: string; color?: string; sort_order?: number }): Promise<ContactTypeDef> =>
    apiFetch<ContactTypeDef>(`/contacts/types/${typeId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  delete: (typeId: number): Promise<void> =>
    apiFetch(`/contacts/types/${typeId}`, { method: 'DELETE' }),
};

// ── Contacts API ──────────────────────────────────────────────────────────────

export const contactsService = {
  list: async (params?: {
    search?: string;
    routingMode?: RoutingMode;
    contactTypeId?: number;
    groupId?: number;
    limit?: number;
    offset?: number;
  }): Promise<ContactListResponse> => {
    const qs = new URLSearchParams();
    if (params?.search)        qs.set('search', params.search);
    if (params?.routingMode)   qs.set('routing_mode', params.routingMode);
    if (params?.contactTypeId) qs.set('contact_type_id', String(params.contactTypeId));
    if (params?.groupId != null) qs.set('group_id', String(params.groupId));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    const raw = await apiFetch<Record<string, unknown>>(`/contacts?${qs}`);
    const data = raw as { items: Record<string, unknown>[]; total: number; limit: number; offset: number };
    return {
      items: data.items.map(mapContact),
      total: data.total,
      limit: data.limit,
      offset: data.offset,
    };
  },

  get: async (contactId: number): Promise<Contact> => {
    const raw = await apiFetch<Record<string, unknown>>(`/contacts/${contactId}`);
    return mapContact(raw);
  },

  create: async (payload: {
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
    source?: string;
    contact_type_id?: number;
    routing_mode?: RoutingMode;
    ai_agent_id?: number | null;
    notes?: string;
  }): Promise<Contact> => {
    const raw = await apiFetch<Record<string, unknown>>('/contacts', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        routing_mode: payload.routing_mode ?? 'ai',
      }),
    });
    return mapContact(raw);
  },

  update: async (contactId: number, payload: {
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
    contact_type_id?: number;
    notes?: string;
  }): Promise<Contact> => {
    const raw = await apiFetch<Record<string, unknown>>(`/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return mapContact(raw);
  },

  delete: async (contactId: number): Promise<void> => {
    await apiFetch(`/contacts/${contactId}`, { method: 'DELETE' });
  },

  bulkDelete: async (contactIds: number[]): Promise<{ deleted: number }> => {
    return apiFetch<{ deleted: number }>('/contacts/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ contact_ids: contactIds }),
    });
  },

  updateRouting: async (contactId: number, routingMode: RoutingMode, aiAgentId?: number | null): Promise<Contact> => {
    const raw = await apiFetch<Record<string, unknown>>(`/contacts/${contactId}/routing`, {
      method: 'PATCH',
      body: JSON.stringify({ routing_mode: routingMode, ai_agent_id: aiAgentId ?? null }),
    });
    return mapContact(raw);
  },

  bulkUpdateRouting: async (contactIds: number[], routingMode: RoutingMode, aiAgentId?: number | null): Promise<{ updated: number }> => {
    return apiFetch<{ updated: number }>('/contacts/bulk-routing', {
      method: 'POST',
      body: JSON.stringify({ contact_ids: contactIds, routing_mode: routingMode, ai_agent_id: aiAgentId ?? null }),
    });
  },

  getChannels: async (contactId: number): Promise<ContactChannelConfig[]> => {
    const raw = await apiFetch<Record<string, unknown>[]>(`/contacts/${contactId}/channels`);
    return raw.map(mapChannel);
  },

  updateChannelRouting: async (
    contactId: number,
    channelId: number,
    routingMode: RoutingMode | null,
    agentId?: number | null,
  ): Promise<void> => {
    await apiFetch(`/contacts/${contactId}/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify({ routing_mode: routingMode, agent_id: agentId ?? null }),
    });
  },
};

// ── Unknown Senders API ───────────────────────────────────────────────────────

export const unknownSendersService = {
  count: async (): Promise<number> => {
    const data = await apiFetch<{ count: number }>('/unknown-senders/count');
    return data.count;
  },

  list: async (params?: { limit?: number; offset?: number }): Promise<UnknownSender[]> => {
    const qs = new URLSearchParams();
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    const raw = await apiFetch<Record<string, unknown>[]>(`/unknown-senders?${qs}`);
    return raw.map(r => ({
      id: r.id as number,
      channelType: r.channel_type as string,
      senderId: r.sender_id as string,
      displayName: (r.display_name as string) ?? null,
      firstMessage: (r.first_message as string) ?? null,
      receivedAt: (r.received_at as string) ?? null,
      status: r.status as string,
    }));
  },

  resolve: async (recordId: number, payload: {
    action: 'add_as_lead' | 'add_as_contact' | 'block' | 'ignore';
    name?: string;
    routingMode?: RoutingMode;
    aiAgentId?: number | null;
    notes?: string;
  }): Promise<{ record_id: number; action: string; lead_id: number | null; contact_id: number | null }> => {
    return apiFetch(`/unknown-senders/${recordId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({
        action: payload.action,
        name: payload.name,
        routing_mode: payload.routingMode ?? 'ai',
        ai_agent_id: payload.aiAgentId ?? null,
        notes: payload.notes,
      }),
    });
  },
};

// ── Lead routing ──────────────────────────────────────────────────────────────

/** Apply routing to ALL channels of a lead at once (bulk convenience). */
export const updateLeadRouting = async (leadId: number, routingMode: RoutingMode, aiAgentId?: number | null) => {
  return apiFetch(`/leads/${leadId}/routing`, {
    method: 'PATCH',
    body: JSON.stringify({ routing_mode: routingMode, ai_agent_id: aiAgentId ?? null }),
  });
};

/** List all channels a lead is active on with per-channel routing config. */
export const getLeadChannels = async (leadId: number): Promise<ContactChannelConfig[]> => {
  const raw = await apiFetch<Record<string, unknown>[]>(`/leads/${leadId}/channels`);
  return raw.map(mapChannel);
};

/** Update routing for one specific (lead, channel) pair. */
export const updateLeadChannelRouting = async (
  leadId: number,
  channelId: number,
  routingMode: RoutingMode | null,
  agentId?: number | null,
): Promise<void> => {
  await apiFetch(`/leads/${leadId}/channels/${channelId}`, {
    method: 'PATCH',
    body: JSON.stringify({ routing_mode: routingMode, agent_id: agentId ?? null }),
  });
};
