import { apiFetch } from '@/lib/api-client';

// Unified Member surface (Employee+Task Redesign V2 — Phase 4, Slice 1).
// A Member is one identity; `portal` (login) and `whatsapp` are optional channels.

export type MemberChannel = 'portal' | 'whatsapp';

export interface Member {
  id: number;
  name: string;
  role_id: number | null;
  role_name: string | null;
  channels: MemberChannel[];
  whatsapp_number: string | null;
  has_login: boolean;
  status: string;
  is_active: boolean;
  /** Legacy WA-employee id — reuse /wa/employees/{id}/chat during transition. */
  legacy_wa_employee_id: number | null;
  /** WhatsApp-channel members only: checked in today? null = not applicable. */
  checked_in_today: boolean | null;
}

export interface MemberAttendanceDay {
  date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_method: string | null;
  check_out_method: string | null;
  work_hours: number | null;
}

export interface MemberDeactivatePayload {
  reassign_to_member_id?: number | null;
  force?: boolean;
  reason?: string | null;
}

export interface MemberDeactivateResult {
  member_id: number;
  is_active: boolean;
  reassigned_work: number;
  reassigned_contacts: number;
  reassigned_wa_contacts: number;
  reassigned_wa_tasks: number;
}

export interface MemberCreatePayload {
  name: string;
  role_id?: number | null;
  whatsapp_number?: string | null;
  email?: string | null;
}

export async function listMembers(params?: {
  q?: string;
  channel?: MemberChannel;
  role_id?: number;
}): Promise<Member[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.channel) qs.set('channel', params.channel);
  if (params?.role_id) qs.set('role_id', String(params.role_id));
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

export async function getMemberAttendance(id: number, days = 14): Promise<MemberAttendanceDay[]> {
  return apiFetch<MemberAttendanceDay[]>(`/members/${id}/attendance?days=${days}`, {
    method: 'GET',
    auth: true,
  });
}

export async function sendMemberCheckin(): Promise<{ sent: number; failed: number }> {
  return apiFetch<{ sent: number; failed: number }>('/members/attendance/send-checkin', {
    method: 'POST',
    auth: true,
  });
}

export async function deactivateMember(
  id: number,
  payload: MemberDeactivatePayload = {},
): Promise<MemberDeactivateResult> {
  return apiFetch<MemberDeactivateResult>(`/members/${id}/deactivate`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}
