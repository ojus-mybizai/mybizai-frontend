import { apiFetch } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NurtureStep {
  id: number;
  sequence_id: number;
  step_number: number;
  delay_days: number;
  delay_hours: number;
  message_type: 'ai_generated' | 'template';
  template_id: number | null;
  template_name: string | null;
  template_body: string | null;
  ai_instructions: string | null;
  send_window_start: string;
  send_window_end: string;
  skip_weekends: boolean;
  created_at: string | null;
}

export interface NurtureSequence {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  agent_id: number | null;
  agent_name: string | null;
  on_reply: 'pause' | 'stop' | 'continue';
  status: 'draft' | 'active' | 'archived';
  steps: NurtureStep[];
  total_enrolled: number;
  active_enrolled: number;
  completed_enrolled: number;
  reply_rate: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface NurtureEnrollment {
  id: number;
  lead_id: number;
  lead_name: string | null;
  lead_phone: string | null;
  sequence_id: number;
  sequence_name: string | null;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  current_step: number;
  total_steps: number;
  next_send_at: string | null;
  enrolled_by: string | null;
  paused_reason: string | null;
  enrolled_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export interface StepAnalytics {
  step_number: number;
  sent_count: number;
  reply_count: number;
  reply_rate: number;
  failed_count: number;
}

export interface SequenceAnalytics {
  sequence_id: number;
  total_enrolled: number;
  active: number;
  completed: number;
  cancelled: number;
  paused: number;
  completion_rate: number;
  overall_reply_rate: number;
  steps: StepAnalytics[];
}

// ─── Sequence API ─────────────────────────────────────────────────────────────

export async function listSequences(status?: string): Promise<NurtureSequence[]> {
  const params = status ? `?status=${status}` : '';
  return apiFetch<NurtureSequence[]>(`/nurture/sequences${params}`);
}

export async function getSequence(id: number): Promise<NurtureSequence> {
  return apiFetch<NurtureSequence>(`/nurture/sequences/${id}`);
}

export async function createSequence(data: {
  name: string;
  description?: string;
  agent_id?: number | null;
  on_reply?: 'pause' | 'stop' | 'continue';
}): Promise<NurtureSequence> {
  return apiFetch<NurtureSequence>('/nurture/sequences', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSequence(id: number, data: Partial<{
  name: string;
  description: string;
  agent_id: number | null;
  on_reply: 'pause' | 'stop' | 'continue';
  status: 'draft' | 'active' | 'archived';
}>): Promise<NurtureSequence> {
  return apiFetch<NurtureSequence>(`/nurture/sequences/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSequence(id: number): Promise<void> {
  await apiFetch<void>(`/nurture/sequences/${id}`, { method: 'DELETE' });
}

// ─── Steps API ────────────────────────────────────────────────────────────────

export async function listSteps(sequenceId: number): Promise<NurtureStep[]> {
  return apiFetch<NurtureStep[]>(`/nurture/sequences/${sequenceId}/steps`);
}

export async function addStep(sequenceId: number, data: {
  step_number: number;
  delay_days: number;
  delay_hours?: number;
  message_type: 'ai_generated' | 'template';
  template_id?: number | null;
  ai_instructions?: string;
  send_window_start?: string;
  send_window_end?: string;
  skip_weekends?: boolean;
}): Promise<NurtureStep> {
  return apiFetch<NurtureStep>(`/nurture/sequences/${sequenceId}/steps`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateStep(sequenceId: number, stepId: number, data: Partial<NurtureStep>): Promise<NurtureStep> {
  return apiFetch<NurtureStep>(`/nurture/sequences/${sequenceId}/steps/${stepId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteStep(sequenceId: number, stepId: number): Promise<void> {
  await apiFetch<void>(`/nurture/sequences/${sequenceId}/steps/${stepId}`, { method: 'DELETE' });
}

export async function previewStep(sequenceId: number, stepId: number, leadId: number): Promise<string> {
  const res = await apiFetch<{ message_text: string }>(`/nurture/sequences/${sequenceId}/preview-step`, {
    method: 'POST',
    body: JSON.stringify({ lead_id: leadId, step_id: stepId }),
  });
  return res.message_text;
}

// ─── Enrollments API ──────────────────────────────────────────────────────────

export async function enrollLeads(sequenceId: number, leadIds: number[], startAt?: string): Promise<{ enrolled: number; skipped: number }> {
  return apiFetch<{ enrolled: number; skipped: number }>(`/nurture/sequences/${sequenceId}/enroll`, {
    method: 'POST',
    body: JSON.stringify({ lead_ids: leadIds, start_at: startAt }),
  });
}

export async function listEnrollments(params: {
  sequence_id?: number;
  lead_id?: number;
  status?: string;
  page?: number;
  per_page?: number;
}): Promise<NurtureEnrollment[]> {
  const q = new URLSearchParams();
  if (params.sequence_id) q.set('sequence_id', String(params.sequence_id));
  if (params.lead_id) q.set('lead_id', String(params.lead_id));
  if (params.status) q.set('status', params.status);
  if (params.page) q.set('page', String(params.page));
  if (params.per_page) q.set('per_page', String(params.per_page));
  return apiFetch<NurtureEnrollment[]>(`/nurture/enrollments?${q.toString()}`);
}

export async function getLeadEnrollment(leadId: number): Promise<NurtureEnrollment | null> {
  return apiFetch<NurtureEnrollment | null>(`/nurture/leads/${leadId}/enrollment`);
}

export async function pauseEnrollment(enrollmentId: number): Promise<void> {
  await apiFetch<void>(`/nurture/enrollments/${enrollmentId}/pause`, { method: 'POST' });
}

export async function resumeEnrollment(enrollmentId: number): Promise<NurtureEnrollment> {
  return apiFetch<NurtureEnrollment>(`/nurture/enrollments/${enrollmentId}/resume`, { method: 'POST' });
}

export async function cancelEnrollment(enrollmentId: number): Promise<void> {
  await apiFetch<void>(`/nurture/enrollments/${enrollmentId}/cancel`, { method: 'POST' });
}

// ─── Analytics API ────────────────────────────────────────────────────────────

export async function getSequenceAnalytics(sequenceId: number): Promise<SequenceAnalytics> {
  return apiFetch<SequenceAnalytics>(`/nurture/sequences/${sequenceId}/analytics`);
}
