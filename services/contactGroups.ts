import { apiFetch } from '@/lib/api-client';

export interface ContactGroup {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  aiAgentId: number | null;
  agentName: string | null;
  routingMode: 'ai' | 'manual';
  memberCount: number;
  createdAt: string;
}

export interface GroupMember {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  routingMode: string;
}

export interface ContactGroupDetail extends ContactGroup {
  members: GroupMember[];
}

function mapGroup(r: Record<string, unknown>): ContactGroup {
  return {
    id: r.id as number,
    name: r.name as string,
    description: (r.description as string) ?? null,
    color: (r.color as string) ?? '#6366f1',
    aiAgentId: (r.ai_agent_id as number) ?? null,
    agentName: (r.agent_name as string) ?? null,
    routingMode: (r.routing_mode as 'ai' | 'manual') ?? 'ai',
    memberCount: (r.member_count as number) ?? 0,
    createdAt: r.created_at as string,
  };
}

export const contactGroupsService = {
  list: async (): Promise<ContactGroup[]> => {
    const data = await apiFetch<Record<string, unknown>[]>('/contact-groups');
    return data.map(mapGroup);
  },

  get: async (id: number): Promise<ContactGroupDetail> => {
    const r = await apiFetch<Record<string, unknown>>(`/contact-groups/${id}`);
    return {
      ...mapGroup(r),
      members: ((r.members as Record<string, unknown>[]) ?? []).map(m => ({
        id: m.id as number,
        name: (m.name as string) ?? null,
        phone: (m.phone as string) ?? null,
        email: (m.email as string) ?? null,
        routingMode: m.routing_mode as string,
      })),
    };
  },

  create: async (payload: {
    name: string;
    description?: string;
    color?: string;
    aiAgentId?: number | null;
    routingMode?: 'ai' | 'manual';
  }): Promise<ContactGroup> => {
    const r = await apiFetch<Record<string, unknown>>('/contact-groups', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        description: payload.description ?? null,
        color: payload.color ?? '#6366f1',
        ai_agent_id: payload.aiAgentId ?? null,
        routing_mode: payload.routingMode ?? 'ai',
      }),
    });
    return mapGroup(r);
  },

  update: async (id: number, payload: {
    name?: string;
    description?: string;
    color?: string;
    aiAgentId?: number | null;
    routingMode?: 'ai' | 'manual';
  }): Promise<ContactGroup> => {
    const r = await apiFetch<Record<string, unknown>>(`/contact-groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: payload.name,
        description: payload.description,
        color: payload.color,
        ai_agent_id: payload.aiAgentId,
        routing_mode: payload.routingMode,
      }),
    });
    return mapGroup(r);
  },

  delete: async (id: number): Promise<void> => {
    await apiFetch(`/contact-groups/${id}`, { method: 'DELETE' });
  },

  addMembers: async (groupId: number, leadIds: number[]): Promise<ContactGroup> => {
    const r = await apiFetch<Record<string, unknown>>(`/contact-groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ lead_ids: leadIds }),
    });
    return mapGroup(r);
  },

  removeMembers: async (groupId: number, leadIds: number[]): Promise<ContactGroup> => {
    const r = await apiFetch<Record<string, unknown>>(`/contact-groups/${groupId}/members`, {
      method: 'DELETE',
      body: JSON.stringify({ lead_ids: leadIds }),
    });
    return mapGroup(r);
  },
};
