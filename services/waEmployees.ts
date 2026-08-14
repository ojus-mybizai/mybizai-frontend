import { apiFetch } from '@/lib/api-client';

export interface WaEmployee {
  id: number;
  name: string;
  whatsapp_number: string;
  status: string;
  role: string;
  is_active: boolean;
  contact_id: number | null;
  verified_at: string | null;
  created_at: string;
  session_window_expires_at: string | null;
  session_active: boolean;
}

export interface WaSettings {
  wa_employee_channel_id: number | null;
  task_template_name: string | null;
  checkin_schedule_time: string | null;
  checkin_schedule_enabled: boolean;
  available_channels: {
    id: number;
    name: string;
    phone_number: string;
    phone_number_id: string;
  }[];
}

export interface WaEmployeeChatMessage {
  id: number;
  role: string;
  content: string;
  timestamp: string;
  read: boolean;
  delivered: boolean;
  tool_called: string | null;
  tool_status: string | null;
}

export interface WaEmployeeChat {
  employee_id: number;
  conversation_id: number | null;
  channel_id: number | null;
  unread_count: number;
  last_message_at: string | null;
  messages: WaEmployeeChatMessage[];
}

export async function listEmployees(opts?: { status?: string }): Promise<WaEmployee[]> {
  const qs = opts?.status ? `?status=${encodeURIComponent(opts.status)}` : '';
  return apiFetch<WaEmployee[]>(`/wa/employees${qs}`, { method: 'GET', auth: true });
}

export async function getWaSettings(): Promise<WaSettings> {
  return apiFetch<WaSettings>('/wa/employees/settings', { method: 'GET', auth: true });
}

export async function updateWaSettings(payload: Partial<WaSettings>): Promise<WaSettings> {
  return apiFetch<WaSettings>('/wa/employees/settings', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getEmployeeChat(employeeId: number): Promise<WaEmployeeChat> {
  return apiFetch<WaEmployeeChat>(`/wa/employees/${employeeId}/chat`, {
    method: 'GET',
    auth: true,
  });
}

export async function sendEmployeeChatMessage(
  employeeId: number,
  text: string,
): Promise<WaEmployeeChatMessage> {
  return apiFetch<WaEmployeeChatMessage>(`/wa/employees/${employeeId}/messages`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ text }),
  });
}

export async function markEmployeeChatRead(employeeId: number): Promise<void> {
  return apiFetch<void>(`/wa/employees/${employeeId}/read`, {
    method: 'POST',
    auth: true,
  });
}
