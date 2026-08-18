import { apiFetch } from '@/lib/api-client';

export type MemberChannel = 'portal' | 'whatsapp';
export type MemberWaStatus = 'not_connected' | 'pending' | 'declined' | 'active' | 'inactive' | 'failed';

export interface Member {
  id: number;
  name: string;
  role_id: number | null;
  role_name: string | null;
  channels: MemberChannel[];
  whatsapp_number: string | null;
  phone: string | null;
  has_login: boolean;
  status: string;
  is_active: boolean;
  is_assignable: boolean;
  /** Per-channel WhatsApp state. Prefer this over `status` for the WA pill. */
  wa_status: MemberWaStatus;
  /**
   * Only present on the create response — the real outcome of the WhatsApp
   * invite. The member is created either way; 'no_channel' means nothing was
   * sent because no team WhatsApp number is configured.
   */
  wa_invite_status?: 'sent' | 'failed' | 'no_channel' | null;
  wa_invite_detail?: string | null;
  wa_invite_settings_url?: string | null;
  /**
   * Portal-email invite outcome from create / attachPortal. The member is
   * created either way — 'failed' means SMTP send did not go through.
   */
  portal_invite_status?: 'sent' | 'failed' | null;
  portal_invite_detail?: string | null;
  portal_invite_email?: string | null;
  /** Persistent delivery error from Meta's webhook (populated async after create). */
  wa_invite_error_code?: string | null;
  wa_invite_error_detail?: string | null;
}

/** Error code the API returns when no team WhatsApp number is configured. */
export const WA_CHANNEL_NOT_CONFIGURED = 'wa_channel_not_configured';

/** Pull the structured picker error off a thrown ApiError, if that's what it is. */
export function waChannelSetupError(
  err: unknown,
): { message: string; settings_url: string } | null {
  const data = (err as { data?: { detail?: unknown } })?.data;
  const detail = data?.detail;
  if (detail && typeof detail === 'object') {
    const d = detail as Record<string, unknown>;
    if (d.code === WA_CHANNEL_NOT_CONFIGURED) {
      return {
        message: typeof d.message === 'string' ? d.message : 'WhatsApp is not configured.',
        settings_url:
          typeof d.settings_url === 'string' ? d.settings_url : '/settings/whatsapp',
      };
    }
  }
  return null;
}

export interface MemberCreatePayload {
  name: string;
  role_id?: number | null;
  whatsapp_number?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface MemberUpdatePayload {
  name?: string;
  role_id?: number;
}

export interface MemberDeactivatePayload {
  reassign_to_member_id?: number | null;
  force?: boolean;
}

export async function listMembers(params?: {
  q?: string;
  channel?: MemberChannel;
  role_id?: number;
  assignable_only?: boolean;
  /** Comma-separated Member.status values (e.g. "pending_acceptance,declined"). */
  status?: string;
  /** Default true — set false to hide deactivated members. */
  include_inactive?: boolean;
}): Promise<Member[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.channel) qs.set('channel', params.channel);
  if (params?.role_id) qs.set('role_id', String(params.role_id));
  if (params?.assignable_only) qs.set('assignable_only', 'true');
  if (params?.status) qs.set('status', params.status);
  if (params?.include_inactive === false) qs.set('include_inactive', 'false');
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch<Member[]>(`/members${query}`, { method: 'GET', auth: true });
}

export async function createMember(payload: MemberCreatePayload): Promise<Member> {
  return apiFetch<Member>('/members', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getMember(id: number): Promise<Member> {
  return apiFetch<Member>(`/members/${id}`, { method: 'GET', auth: true });
}

export async function getMe(): Promise<Member> {
  return apiFetch<Member>('/members/me', { method: 'GET', auth: true });
}

export async function updateMember(id: number, payload: MemberUpdatePayload): Promise<Member> {
  return apiFetch<Member>(`/members/${id}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function attachWhatsApp(id: number, whatsapp_number: string): Promise<Member> {
  return apiFetch<Member>(`/members/${id}/channels/whatsapp`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ whatsapp_number }),
  });
}

export async function attachPortal(id: number, email: string): Promise<Member> {
  return apiFetch<Member>(`/members/${id}/channels/portal`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ email }),
  });
}

export async function resendWhatsAppInvite(id: number): Promise<{ status: string; message: string }> {
  return apiFetch(`/members/${id}/channels/whatsapp/resend`, { method: 'POST', auth: true });
}

export async function detachWhatsApp(id: number): Promise<Member> {
  return apiFetch<Member>(`/members/${id}/channels/whatsapp`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function resendPortalInvite(id: number): Promise<{ status: string; message: string }> {
  return apiFetch(`/members/${id}/channels/portal/resend`, { method: 'POST', auth: true });
}

// ── Chat (Path A: delegates to WA-employee chat backend) ────────────────────

export interface MemberChatMessage {
  id: number;
  role: string;
  content: string;
  timestamp: string;
  read: boolean;
  delivered: boolean;
  tool_called?: string | null;
  tool_status?: string | null;
}

export interface MemberChat {
  employee_id: number;
  conversation_id: number | null;
  channel_id: number | null;
  unread_count: number;
  last_message_at: string | null;
  messages: MemberChatMessage[];
}

export async function getMemberChat(id: number, limit = 100): Promise<MemberChat> {
  return apiFetch<MemberChat>(`/members/${id}/chat?limit=${limit}`, {
    method: 'GET',
    auth: true,
  });
}

export async function sendMemberMessage(id: number, text: string): Promise<MemberChatMessage> {
  return apiFetch<MemberChatMessage>(`/members/${id}/messages`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ text }),
  });
}

export async function markMemberChatRead(id: number): Promise<void> {
  await apiFetch(`/members/${id}/chat/read`, { method: 'POST', auth: true });
}

export async function deactivateMember(
  id: number,
  payload: MemberDeactivatePayload = {},
): Promise<{ member_id: number; is_active: boolean; reassigned_tasks: number }> {
  return apiFetch(`/members/${id}/deactivate`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}
