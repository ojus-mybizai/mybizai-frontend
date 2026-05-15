import { apiFetch } from '@/lib/api-client';

// pending_acceptance → employee hasn't tapped Accept yet
// active            → employee accepted the invite
// rejected          → employee declined
// inactive          → soft-deleted / deactivated by owner
export type WaEmployeeStatus = 'pending_acceptance' | 'active' | 'rejected' | 'inactive';

export interface WaEmployee {
  id: number;
  name: string;
  whatsapp_number: string;
  status: WaEmployeeStatus;
  is_active: boolean;
  contact_id: number | null;
  verified_at: string | null;
  created_at: string;
}

export interface WaGroupMember {
  id: number;
  name: string;
  whatsapp_number: string;
  status: string;
}

export interface WaEmployeeGroup {
  id: number;
  name: string;
  description: string | null;
  employee_count: number;
  created_at: string;
}

export interface WaEmployeeGroupDetail extends WaEmployeeGroup {
  members: WaGroupMember[];
}

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_method: string | null;
  check_out_method: string | null;
  work_hours: number | null;
}

// --- Employees ---

export async function addEmployee(name: string, whatsapp_number: string): Promise<WaEmployee> {
  return apiFetch('/wa/employees', { method: 'POST', body: JSON.stringify({ name, whatsapp_number }) });
}

export async function addEmployeesBulk(
  employees: { name: string; whatsapp_number: string }[]
): Promise<{ created: number; skipped: string[]; employees: { id: number; name: string; number: string }[] }> {
  return apiFetch('/wa/employees/bulk', { method: 'POST', body: JSON.stringify({ employees }) });
}

export async function listEmployees(params?: { status?: string; group_id?: number; q?: string }): Promise<WaEmployee[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.group_id) qs.set('group_id', String(params.group_id));
  if (params?.q) qs.set('q', params.q);
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch(`/wa/employees${query}`);
}

export async function getEmployee(id: number): Promise<WaEmployee> {
  return apiFetch(`/wa/employees/${id}`);
}

export async function updateEmployee(
  id: number,
  data: { name?: string; whatsapp_number?: string; is_active?: boolean }
): Promise<WaEmployee> {
  return apiFetch(`/wa/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteEmployee(id: number): Promise<void> {
  return apiFetch(`/wa/employees/${id}`, { method: 'DELETE' });
}

export async function resendInvite(employee_id: number): Promise<{ success: boolean; message: string }> {
  return apiFetch(`/wa/employees/${employee_id}/resend-invite`, { method: 'POST' });
}

export async function repairEmployeeContacts(): Promise<{
  repaired: number;
  already_ok: number;
  failed: number;
}> {
  return apiFetch('/wa/employees/repair-contacts', { method: 'POST' });
}

// --- Groups ---

export async function createGroup(data: {
  name: string;
  description?: string;
  employee_ids?: number[];
}): Promise<WaEmployeeGroup> {
  return apiFetch('/wa/employees/groups', { method: 'POST', body: JSON.stringify(data) });
}

export async function listGroups(): Promise<WaEmployeeGroup[]> {
  return apiFetch('/wa/employees/groups');
}

export async function getGroup(group_id: number): Promise<WaEmployeeGroupDetail> {
  return apiFetch(`/wa/employees/groups/${group_id}`);
}

export async function updateGroup(
  group_id: number,
  data: { name?: string; description?: string }
): Promise<WaEmployeeGroup> {
  return apiFetch(`/wa/employees/groups/${group_id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function addGroupMembers(group_id: number, employee_ids: number[]): Promise<{ added: number }> {
  return apiFetch(`/wa/employees/groups/${group_id}/members`, { method: 'POST', body: JSON.stringify({ employee_ids }) });
}

export async function removeGroupMember(group_id: number, employee_id: number): Promise<void> {
  return apiFetch(`/wa/employees/groups/${group_id}/members/${employee_id}`, { method: 'DELETE' });
}

export async function deleteGroup(group_id: number): Promise<void> {
  return apiFetch(`/wa/employees/groups/${group_id}`, { method: 'DELETE' });
}

// --- Attendance ---

export async function getAttendance(params?: {
  date?: string;
  date_from?: string;
  date_to?: string;
  employee_id?: number;
}): Promise<AttendanceRecord[]> {
  const qs = new URLSearchParams();
  if (params?.date)        qs.set('date',        params.date);
  if (params?.date_from)   qs.set('date_from',   params.date_from);
  if (params?.date_to)     qs.set('date_to',     params.date_to);
  if (params?.employee_id) qs.set('employee_id', String(params.employee_id));
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch(`/wa/employees/attendance${query}`);
}

export async function setManualAttendance(data: {
  employee_id: number;
  date: string;
  check_in_at?: string;
  check_out_at?: string;
  notes?: string;
}): Promise<{ success: boolean }> {
  return apiFetch('/wa/employees/attendance/manual', { method: 'POST', body: JSON.stringify(data) });
}

export async function sendDailyCheckin(): Promise<{ success: boolean; sent: number; failed: number }> {
  return apiFetch('/wa/employees/attendance/send-checkin', { method: 'POST' });
}

// --- Settings ---

export interface WaChannelInfo {
  id: number;
  name: string;
  phone_number: string;
  phone_number_id: string;
}

export interface WaSettings {
  wa_employee_channel_id: number | null;
  task_template_name: string | null;
  checkin_schedule_time: string | null;    // HH:MM in 24h UTC, e.g. "09:00"
  checkin_schedule_enabled: boolean;
  available_channels: WaChannelInfo[];
}

export async function getWaSettings(): Promise<WaSettings> {
  return apiFetch('/wa/employees/settings');
}

export async function updateWaSettings(data: {
  wa_employee_channel_id?: number | null;
  task_template_name?: string | null;
  checkin_schedule_time?: string | null;
  checkin_schedule_enabled?: boolean;
}): Promise<{ success: boolean }> {
  return apiFetch('/wa/employees/settings', { method: 'PUT', body: JSON.stringify(data) });
}

// --- Per-employee chat ---

export type WaEmployeeChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface WaEmployeeChatMessage {
  id: number;
  role: WaEmployeeChatRole;
  content: string;
  timestamp: string;
  read: boolean;
  delivered: boolean;
}

export interface WaEmployeeChat {
  employee_id: number;
  conversation_id: number | null;
  channel_id: number | null;
  unread_count: number;
  last_message_at: string | null;
  messages: WaEmployeeChatMessage[];
}

export async function getEmployeeChat(employee_id: number, limit = 100): Promise<WaEmployeeChat> {
  return apiFetch(`/wa/employees/${employee_id}/chat?limit=${limit}`);
}

export async function sendEmployeeChatMessage(
  employee_id: number,
  text: string,
): Promise<WaEmployeeChatMessage> {
  return apiFetch(`/wa/employees/${employee_id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function markEmployeeChatRead(employee_id: number): Promise<void> {
  return apiFetch(`/wa/employees/${employee_id}/chat/read`, { method: 'POST' });
}
