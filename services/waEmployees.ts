import { apiFetch, API_BASE_URL } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

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
  /** ISO timestamp when the WhatsApp 24h customer-service window closes. Null = never opened. */
  session_window_expires_at: string | null;
  /** True if the 24h free-form messaging window is currently open. */
  session_active: boolean;
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

export async function listEmployees(params?: { status?: string; q?: string }): Promise<WaEmployee[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
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

/**
 * Download the attendance CSV export. `employee_id` is the WA-employee id
 * (a member's `legacy_wa_employee_id`); omit to export the whole team.
 * Returns a Blob so the caller can trigger a browser download — apiFetch always
 * JSON-parses, so the CSV stream is fetched directly here.
 */
export async function downloadAttendanceExport(params?: {
  employee_id?: number;
  date_from?: string;
  date_to?: string;
}): Promise<Blob> {
  const qs = new URLSearchParams();
  if (params?.employee_id) qs.set('employee_id', String(params.employee_id));
  if (params?.date_from)   qs.set('date_from',   params.date_from);
  if (params?.date_to)     qs.set('date_to',     params.date_to);
  const query = qs.toString() ? `?${qs}` : '';
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_BASE_URL}/wa/employees/attendance/export${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  return res.blob();
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
  /** AI action trail — set on `tool`-role rows (skill name + outcome). */
  tool_called?: string | null;
  tool_status?: 'success' | 'error' | 'timeout' | 'cancelled' | null;
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
