import { apiFetch } from '@/lib/api-client';

export type WaWorkStatus = 'draft' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled';
export type AssignmentStatus = 'pending' | 'done' | 'not_done' | 'skipped' | 'in_progress' | 'failed';

export interface WaWorkAssignment {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_number: string;
  status: AssignmentStatus;
  wa_message_id: string | null;
  wa_delivered_at: string | null;
  wa_read_at: string | null;
  wa_failed_reason: string | null;
  form_response: Record<string, unknown> | null;
  form_submitted_at: string | null;
  lead_statuses: Record<string, { status: string; timestamp: string }> | null;
  responded_at: string | null;
  created_at: string;
}

export interface WaWorkItem {
  id: number;
  title: string;
  description: string | null;
  type: string | null;
  status: WaWorkStatus;
  dispatch_mode: string;
  due_at: string | null;
  dispatched_at: string | null;
  wa_template_id: number | null;
  template_name: string | null;
  assigned_count: number;
  done_count: number;
  not_done_count: number;
  in_progress_count: number;
  failed_count: number;
  pending_count: number;
  awaiting_reply_count: number;
  created_at: string;
  assignments?: WaWorkAssignment[];
}

export interface WaWorkStats {
  total_work_items: number;
  dispatched: number;
  total_assignments: number;
  done: number;
  pending: number;
  completion_rate: number;
}

export interface CreateWaWorkPayload {
  title: string;
  description?: string;
  wa_template_id?: number;
  assigned_employee_ids?: number[];
  assigned_group_id?: number;
  dispatch_mode?: 'individual' | 'broadcast';
  contact_type_id?: number;   // lead_list: filter contacts by type (null = all contacts)
  due_at?: string;
  auto_dispatch?: boolean;
}

export async function createWorkItem(data: CreateWaWorkPayload): Promise<WaWorkItem> {
  return apiFetch('/wa/work', { method: 'POST', body: JSON.stringify(data) });
}

export async function listWorkItems(params?: {
  status?: WaWorkStatus;
  page?: number;
  per_page?: number;
}): Promise<{ total: number; page: number; per_page: number; items: WaWorkItem[] }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.per_page) qs.set('per_page', String(params.per_page));
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch(`/wa/work${query}`);
}

export async function getWorkItem(id: number): Promise<WaWorkItem> {
  return apiFetch(`/wa/work/${id}`);
}

export async function updateWorkItem(
  id: number,
  data: { title?: string; description?: string; due_at?: string; status?: WaWorkStatus }
): Promise<WaWorkItem> {
  return apiFetch(`/wa/work/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteWorkItem(id: number): Promise<void> {
  return apiFetch(`/wa/work/${id}`, { method: 'DELETE' });
}

export async function dispatchWorkItem(id: number): Promise<{ success: boolean; dispatched_to: number }> {
  return apiFetch(`/wa/work/${id}/dispatch`, { method: 'POST' });
}

export async function updateAssignmentStatus(
  assignment_id: number,
  status: AssignmentStatus
): Promise<{ success: boolean }> {
  return apiFetch(`/wa/work/assignments/${assignment_id}/status?status=${status}`, { method: 'PATCH' });
}

export async function getWorkStats(): Promise<WaWorkStats> {
  return apiFetch('/wa/work/stats/summary');
}

export async function resendAssignment(
  assignment_id: number
): Promise<{ success: boolean; wa_message_id: string | null }> {
  return apiFetch(`/wa/work/assignments/${assignment_id}/resend`, { method: 'POST' });
}
