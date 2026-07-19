/**
 * Unified campaigns service — covers blast campaigns, multi-step sequences, and segments.
 *
 * Merges the former outbound.ts and nurture.ts into one API layer.
 * Backend routes: /api/v1/campaigns, /api/v1/segments, /api/v1/nurture
 */

import { apiFetch } from '@/lib/api-client';

// ─── Shared types ────────────────────────────────────────────────────────────

export type CampaignCategory = 'marketing' | 'utility' | 'reminder' | 'followup';
export type AudienceType = 'manual' | 'segment' | 'ai_filter';
export type ScheduleType = 'now' | 'scheduled' | 'drip';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled' | 'failed';
export type SequenceStatus = 'draft' | 'active' | 'archived';

// ─── Audience / Segments ─────────────────────────────────────────────────────

// Canonical filter/segment types live in ./outbound. Import them for local use
// and re-export so the wizard (this module) and FilterBuilder (./outbound) share
// ONE definition — a single source of truth that kills the two-copy drift risk.
import type {
  AudienceFilter,
  CustomFieldFilter,
  CustomFieldOp,
  FilterPickItem,
  SourceOption,
  StageOption,
  OwnerOption,
  WaEmployeeOption,
  CustomFieldOption,
  FilterOptions,
} from './outbound';
export type {
  AudienceFilter,
  CustomFieldFilter,
  CustomFieldOp,
  FilterPickItem,
  SourceOption,
  StageOption,
  OwnerOption,
  WaEmployeeOption,
  CustomFieldOption,
  FilterOptions,
};

export interface AudiencePreview {
  count: number;
  sample_leads: Array<{ id: number | null; name: string | null; phone: string }>;
  warnings: string[];
}

export interface Segment {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  filter_config: AudienceFilter;
  cached_count: number | null;
  cached_at: string | null;
  created_by_ai: boolean;
  created_at: string;
}

// ─── Campaign (blast) types ──────────────────────────────────────────────────

export interface Campaign {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  category: CampaignCategory;
  template_id: number;
  channel_id: number;
  audience_type: AudienceType;
  audience_config: Record<string, unknown> | null;
  total_recipients: number;
  estimated_cost: string;
  actual_cost: string;
  cost_per_message: string;
  schedule_type: ScheduleType;
  scheduled_at: string | null;
  throttle_per_minute: number;
  status: CampaignStatus;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  replied_count: number;
  failed_count: number;
  launched_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignRecipient {
  id: number;
  campaign_id: number;
  lead_id: number | null;
  lead_name: string | null;
  phone: string;
  status: string;
  scheduled_fire_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  failed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  cost: string;
  wa_message_id: string | null;
  resolved_params: {
    header?: string[];
    body?: string[];
    button?: [number, string][];
  } | null;
}

// ─── Sequence (multi-step) types ─────────────────────────────────────────────

export interface SequenceStep {
  id: number;
  sequence_id: number;
  step_number: number;
  delay_days: number;
  delay_hours: number;
  message_type: 'template';
  template_id: number | null;
  template_name: string | null;
  template_body: string | null;
  ai_instructions: string | null;
  send_window_start: string;
  send_window_end: string;
  skip_weekends: boolean;
  created_at: string | null;
}

export interface Sequence {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  agent_id: number | null;
  agent_name: string | null;
  on_reply: 'pause' | 'stop' | 'continue';
  timezone: string;
  status: SequenceStatus;
  steps: SequenceStep[];
  auto_enroll_enabled: boolean;
  auto_enroll_source_type: 'group' | 'segment' | null;
  auto_enroll_source_id: number | null;
  auto_enroll_max_per_day: number;
  auto_enroll_monthly_cap: number | null;
  auto_enroll_batch_confirm_threshold: number;
  auto_enroll_paused_reason: string | null;
  auto_enroll_today_count: number;
  auto_enroll_month_count: number;
  total_enrolled: number;
  active_enrolled: number;
  completed_enrolled: number;
  reply_rate: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface AutoEnrollConfig {
  auto_enroll_enabled: boolean;
  auto_enroll_source_type: 'group' | 'segment' | null;
  auto_enroll_source_id: number | null;
  auto_enroll_max_per_day: number;
  auto_enroll_monthly_cap: number | null;
  auto_enroll_batch_confirm_threshold: number;
  auto_enroll_paused_reason: string | null;
  auto_enroll_today_count: number;
  auto_enroll_month_count: number;
}

export interface Enrollment {
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

// ─── Credits ─────────────────────────────────────────────────────────────────

export interface CreditsInfo {
  balance_credits: number;
  monthly_cap: number | null;
  current_month_used: number;
  lifetime_granted: number;
  lifetime_consumed: number;
  credits_expire_at: string | null;
}

// ════════════════════════════════════════════════════════════════════════════
// API functions — Campaigns (blasts)
// ════════════════════════════════════════════════════════════════════════════

export async function listCampaigns(params?: {
  status?: CampaignStatus;
  category?: CampaignCategory;
  page?: number;
  page_size?: number;
}): Promise<{ items: Campaign[]; total: number; page: number; page_size: number }> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.category) q.set('category', params.category);
  if (params?.page !== undefined) q.set('page', String(params.page));
  if (params?.page_size !== undefined) q.set('page_size', String(params.page_size));
  const qs = q.toString();
  return apiFetch(`/campaigns${qs ? `?${qs}` : ''}`);
}

export async function getCampaign(id: number): Promise<Campaign> {
  return apiFetch<Campaign>(`/campaigns/${id}`);
}

export interface CreateCampaignPayload {
  name: string;
  description?: string;
  category: CampaignCategory;
  template_id: number;
  channel_id: number;
  audience_type: AudienceType;
  audience_config?: Record<string, unknown>;
  schedule_type?: ScheduleType;
  scheduled_at?: string;
  drip_config?: Record<string, unknown>;
  throttle_per_minute?: number;
}

export async function createCampaign(payload: CreateCampaignPayload): Promise<Campaign> {
  return apiFetch<Campaign>('/campaigns', { method: 'POST', body: JSON.stringify(payload) });
}

export async function launchCampaign(id: number): Promise<Campaign> {
  return apiFetch<Campaign>(`/campaigns/${id}/launch`, { method: 'POST' });
}

export async function cancelCampaign(id: number): Promise<Campaign> {
  return apiFetch<Campaign>(`/campaigns/${id}/cancel`, { method: 'POST' });
}

export async function listCampaignRecipients(
  campaignId: number,
  params?: { status?: string; limit?: number; offset?: number },
): Promise<CampaignRecipient[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.limit !== undefined) q.set('limit', String(params.limit));
  if (params?.offset !== undefined) q.set('offset', String(params.offset));
  const qs = q.toString();
  return apiFetch(`/campaigns/${campaignId}/recipients${qs ? `?${qs}` : ''}`);
}

export async function previewAudience(payload: {
  audience_type: AudienceType;
  filter?: AudienceFilter;
  segment_id?: number;
  lead_ids?: number[];
  contact_ids?: number[];
  phones?: string[];
}): Promise<AudiencePreview> {
  return apiFetch<AudiencePreview>('/campaigns/preview-audience', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Interactive recipient preview (T2.2) ────────────────────────────────
export interface RecipientPreviewContact {
  id: number | null;
  name: string | null;
  phone: string | null;
  source: string | null;
  stage: string | null;
  owner: string | null;
  tags: string[];
}
export interface RecipientPreview {
  contacts: RecipientPreviewContact[];
  total: number;
  page: number;
  per_page: number;
}

export async function previewAudienceContacts(
  payload: {
    audience_type: AudienceType;
    filter?: AudienceFilter;
    segment_id?: number;
    contact_ids?: number[];
  },
  params?: { page?: number; per_page?: number },
): Promise<RecipientPreview> {
  const search = new URLSearchParams();
  if (params?.page !== undefined) search.set('page', String(params.page));
  if (params?.per_page !== undefined) search.set('per_page', String(params.per_page));
  const qs = search.toString();
  return apiFetch<RecipientPreview>(
    `/campaigns/preview-audience/contacts${qs ? `?${qs}` : ''}`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

// ════════════════════════════════════════════════════════════════════════════
// API functions — Sequences (multi-step)
// ════════════════════════════════════════════════════════════════════════════

export async function listSequences(status?: string): Promise<Sequence[]> {
  const params = status ? `?status=${status}` : '';
  return apiFetch<Sequence[]>(`/nurture/sequences${params}`);
}

export async function getSequence(id: number): Promise<Sequence> {
  return apiFetch<Sequence>(`/nurture/sequences/${id}`);
}

export async function createSequence(data: {
  name: string;
  description?: string;
  on_reply?: 'pause' | 'stop' | 'continue';
  timezone?: string;
  auto_enroll_enabled?: boolean;
  auto_enroll_source_type?: 'group' | 'segment';
  auto_enroll_source_id?: number;
  auto_enroll_max_per_day?: number;
  auto_enroll_monthly_cap?: number | null;
  auto_enroll_batch_confirm_threshold?: number;
}): Promise<Sequence> {
  return apiFetch<Sequence>('/nurture/sequences', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateSequence(id: number, data: Partial<{
  name: string;
  description: string;
  on_reply: 'pause' | 'stop' | 'continue';
  timezone: string;
  status: SequenceStatus;
  auto_enroll_enabled: boolean;
  auto_enroll_source_type: 'group' | 'segment';
  auto_enroll_source_id: number;
  auto_enroll_max_per_day: number;
  auto_enroll_monthly_cap: number | null;
  auto_enroll_batch_confirm_threshold: number;
}>): Promise<Sequence> {
  return apiFetch<Sequence>(`/nurture/sequences/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function getAutoEnrollConfig(sequenceId: number): Promise<AutoEnrollConfig> {
  return apiFetch<AutoEnrollConfig>(`/nurture/sequences/${sequenceId}/auto-enroll`);
}

export async function updateAutoEnrollConfig(sequenceId: number, data: Partial<AutoEnrollConfig>): Promise<AutoEnrollConfig> {
  return apiFetch<AutoEnrollConfig>(`/nurture/sequences/${sequenceId}/auto-enroll`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function getBackfillCount(sequenceId: number): Promise<{ existing_member_count: number }> {
  return apiFetch<{ existing_member_count: number }>(`/nurture/sequences/${sequenceId}/auto-enroll/backfill-count`);
}

export async function backfillExistingMembers(sequenceId: number): Promise<{ enrolled: number; skipped: number }> {
  return apiFetch<{ enrolled: number; skipped: number }>(`/nurture/sequences/${sequenceId}/auto-enroll/backfill`, { method: 'POST' });
}

export async function deleteSequence(id: number): Promise<void> {
  await apiFetch<void>(`/nurture/sequences/${id}`, { method: 'DELETE' });
}

export async function addStep(sequenceId: number, data: {
  step_number: number;
  delay_days: number;
  delay_hours?: number;
  template_id: number;
  send_window_start?: string;
  send_window_end?: string;
  skip_weekends?: boolean;
}): Promise<SequenceStep> {
  return apiFetch<SequenceStep>(`/nurture/sequences/${sequenceId}/steps`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateStep(sequenceId: number, stepId: number, data: Partial<SequenceStep>): Promise<SequenceStep> {
  return apiFetch<SequenceStep>(`/nurture/sequences/${sequenceId}/steps/${stepId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteStep(sequenceId: number, stepId: number): Promise<void> {
  await apiFetch<void>(`/nurture/sequences/${sequenceId}/steps/${stepId}`, { method: 'DELETE' });
}

export async function enrollContacts(
  sequenceId: number,
  contactIds: number[],
  opts?: { groupIds?: number[]; startAt?: string },
): Promise<{ enrolled: number; skipped: number }> {
  return apiFetch(`/nurture/sequences/${sequenceId}/enroll`, {
    method: 'POST',
    body: JSON.stringify({
      lead_ids: contactIds,
      group_ids: opts?.groupIds ?? [],
      start_at: opts?.startAt,
    }),
  });
}

export async function listEnrollments(params: {
  sequence_id?: number;
  lead_id?: number;
  status?: string;
  page?: number;
  per_page?: number;
}): Promise<Enrollment[]> {
  const q = new URLSearchParams();
  if (params.sequence_id) q.set('sequence_id', String(params.sequence_id));
  if (params.lead_id) q.set('lead_id', String(params.lead_id));
  if (params.status) q.set('status', params.status);
  if (params.page) q.set('page', String(params.page));
  if (params.per_page) q.set('per_page', String(params.per_page));
  return apiFetch<Enrollment[]>(`/nurture/enrollments?${q.toString()}`);
}

export async function pauseEnrollment(id: number): Promise<void> {
  await apiFetch(`/nurture/enrollments/${id}/pause`, { method: 'POST' });
}

export async function resumeEnrollment(id: number): Promise<void> {
  await apiFetch(`/nurture/enrollments/${id}/resume`, { method: 'POST' });
}

export async function cancelEnrollment(id: number): Promise<void> {
  await apiFetch(`/nurture/enrollments/${id}/cancel`, { method: 'POST' });
}

export async function getSequenceAnalytics(id: number): Promise<SequenceAnalytics> {
  return apiFetch<SequenceAnalytics>(`/nurture/sequences/${id}/analytics`);
}

// ════════════════════════════════════════════════════════════════════════════
// API functions — Segments
// ════════════════════════════════════════════════════════════════════════════

export async function getFilterOptions(): Promise<FilterOptions> {
  return apiFetch<FilterOptions>('/segments/filter-options');
}

export async function listSegments(): Promise<Segment[]> {
  return apiFetch<Segment[]>('/segments');
}

export async function createSegment(payload: {
  name: string;
  description?: string;
  filter_config: AudienceFilter;
  created_by_ai?: boolean;
}): Promise<Segment> {
  return apiFetch<Segment>('/segments', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateSegment(
  id: number,
  payload: { name?: string; description?: string; filter_config?: AudienceFilter },
): Promise<Segment> {
  return apiFetch<Segment>(`/segments/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function deleteSegment(id: number): Promise<void> {
  await apiFetch(`/segments/${id}`, { method: 'DELETE' });
}

// ════════════════════════════════════════════════════════════════════════════
// API functions — Credits
// ════════════════════════════════════════════════════════════════════════════

export async function getCreditsInfo(): Promise<CreditsInfo> {
  return apiFetch<CreditsInfo>('/credits/balance');
}

// ════════════════════════════════════════════════════════════════════════════
// AI Audience builder
// ════════════════════════════════════════════════════════════════════════════

export interface AIAudienceTurnResponse {
  reply: string;
  committed_filter: AudienceFilter | null;
  committed_count: number | null;
  trace: unknown[];
  messages: unknown[];
}

export async function aiAudienceTurn(messages: unknown[]): Promise<AIAudienceTurnResponse> {
  return apiFetch<AIAudienceTurnResponse>('/campaigns/ai-audience/turn', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}
