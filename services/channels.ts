import { apiFetch } from '@/lib/api-client';

export type MetaChannelType = 'whatsapp' | 'instagram' | 'messenger';

export type ChannelType = MetaChannelType | string;

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  isConnected: boolean;
  agentId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  leadCount?: number;
}

type ApiChannel = {
  id: number;
  type: string;
  name: string;
  is_connected: boolean;
  agent_id: number | null;
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
    agentId: api.agent_id ?? null,
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

export async function setChannelAgent(
  channelId: string,
  agentId: number | null,
): Promise<{ channel_id: number; agent_id: number | null }> {
  return apiFetch(`/channels/${channelId}/default-agent`, {
    method: 'PUT',
    body: JSON.stringify({ agent_id: agentId }),
  });
}

export interface WhatsAppWebhookConfig {
  callback_url: string;
  verify_token: string;
  subscribed_fields: string[];
}

export async function getWhatsAppWebhookConfig(): Promise<WhatsAppWebhookConfig> {
  return apiFetch<WhatsAppWebhookConfig>('/channels/whatsapp/webhook-config', {
    method: 'GET',
  });
}

export interface WhatsAppVerifyResult {
  phone_number_id: string;
  display_phone_number?: string | null;
  verified_name?: string | null;
  quality_rating?: string | null;
  code_verification_status?: string | null;
  waba_ok?: boolean;
  waba_phone_numbers?: Array<{ id: string; display_phone_number: string | null }>;
  waba_error?: string;
}

export async function verifyWhatsAppManual(payload: {
  waba_id?: string;
  phone_number_id: string;
  access_token: string;
}): Promise<WhatsAppVerifyResult> {
  return apiFetch<WhatsAppVerifyResult>('/channels/whatsapp/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createWhatsAppManual(payload: {
  waba_id: string;
  phone_number_id: string;
  access_token: string;
  display_name?: string;
}): Promise<Channel> {
  const data = await apiFetch<ApiChannel>('/channels/whatsapp/manual', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapChannel(data);
}