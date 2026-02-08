import { apiFetch } from '@/lib/api-client';

export type MetaChannelType = 'whatsapp' | 'instagram' | 'messenger';

export type ChannelType = MetaChannelType | string;

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  isConnected: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  leadCount?: number;
}

type ApiChannel = {
  id: number;
  type: string;
  name: string;
  is_connected: boolean;
  created_at: string | null;
  updated_at: string | null;
  lead_count?: number;
};

function mapChannel(api: ApiChannel): Channel {
  return {
    id: String(api.id),
    type: api.type,
    name: api.name,
    isConnected: Boolean(api.is_connected),
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    leadCount: typeof api.lead_count === 'number' ? api.lead_count : 0,
  };
}

export async function listChannels(): Promise<Channel[]> {
  const data = await apiFetch<ApiChannel[]>('/channels/', { method: 'GET' });
  return data.map(mapChannel);
}

export async function deleteChannel(id: string): Promise<void> {
  await apiFetch<void>(`/channels/${id}`, { method: 'DELETE' });
}

export interface CreateChannelPayload {
  type: 'indiamart' | 'india_mart';
  name: string;
  config: { seller_id: string };
}export async function createChannel(payload: CreateChannelPayload): Promise<Channel> {
  const data = await apiFetch<ApiChannel>('/channels/', {
    method: 'POST',
    body: JSON.stringify({
      type: payload.type,
      name: payload.name,
      config: payload.config,
    }),
  });
  return mapChannel(data);
}