import { apiFetch } from '@/lib/api-client';

export type MetaChannelType = 'whatsapp' | 'instagram' | 'messenger';

export type ChannelType = MetaChannelType | string;

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  /** Platform-level credential validity. True = we can send/receive via the provider. */
  isConnected: boolean;
  agentId: number | null;
  /** True when an AI agent is bound and will auto-reply. Independent of isConnected. */
  agentAssigned: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  leadCount?: number;
  /** Provider-specific config blob — for WhatsApp this carries display_phone_number, etc. */
  config?: Record<string, unknown> | null;
}

type ApiChannel = {
  id: number;
  type: string;
  name: string;
  is_connected: boolean;
  agent_id: number | null;
  agent_assigned?: boolean;
  created_at: string | null;
  updated_at: string | null;
  lead_count?: number;
  config?: Record<string, unknown> | null;
};

function mapChannel(api: ApiChannel): Channel {
  return {
    id: String(api.id),
    type: api.type,
    name: api.name,
    isConnected: Boolean(api.is_connected),
    agentId: api.agent_id ?? null,
    agentAssigned: api.agent_assigned ?? api.agent_id != null,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    leadCount: typeof api.lead_count === 'number' ? api.lead_count : 0,
    config: api.config ?? null,
  };
}

/** Verified WhatsApp business numbers usable as a "send from" channel. */
export async function listVerifiedWhatsAppChannels(): Promise<Channel[]> {
  const all = await listChannels();
  return all.filter(c => c.type === 'whatsapp' && c.isConnected);
}

/** Best-effort display label for a WA channel — falls back to channel.name. */
export function whatsAppChannelLabel(c: Channel): string {
  const cfg = (c.config || {}) as Record<string, unknown>;
  const phone = (cfg.display_phone_number as string | undefined)
    || (cfg.phone_number as string | undefined)
    || '';
  return phone ? `${phone} · ${c.name}` : c.name;
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

// ── IndiaMART one-click connection (Lead Manager CRM pull API) ──────────────

export interface IndiaMARTConnectResult {
  channel_id: number;
  is_connected: boolean;
  leads_imported: number;
  duplicates_skipped: number;
  message: string;
}

export async function connectIndiaMART(crmKey: string, name?: string): Promise<IndiaMARTConnectResult> {
  return apiFetch<IndiaMARTConnectResult>('/channels/indiamart/connect', {
    method: 'POST',
    body: JSON.stringify({ crm_key: crmKey, name: name || undefined }),
  });
}

export interface IndiaMARTStatus {
  connected: boolean;
  connected_via: 'pull_api' | 'webhook';
  last_synced_at: string | null;
  sync_error: string | null;
  leads_24h: number;
  lead_count: number;
}

export async function getIndiaMARTStatus(channelId: string): Promise<IndiaMARTStatus> {
  return apiFetch<IndiaMARTStatus>(`/channels/${channelId}/indiamart/status`, { method: 'GET' });
}

export interface IndiaMARTSyncResult {
  ok: boolean;
  message: string;
  leads_imported: number;
  duplicates_skipped: number;
  last_synced_at: string | null;
}

export async function syncIndiaMARTNow(channelId: string): Promise<IndiaMARTSyncResult> {
  return apiFetch<IndiaMARTSyncResult>(`/channels/${channelId}/indiamart/sync-now`, { method: 'POST' });
}

export async function setChannelAgent(
  channelId: string,
  agentId: number | null,
): Promise<{ channel_id: number; agent_id: number | null; is_connected: boolean; agent_assigned: boolean }> {
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