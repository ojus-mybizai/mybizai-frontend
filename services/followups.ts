import { apiFetch } from '@/lib/api-client';

export type FollowUpStatus = 'scheduled' | 'pending_manual' | 'sent' | 'cancelled' | 'failed';
export type FollowUpMode = 'auto' | 'manual' | 'both';
export type TemplateType = 'llm' | 'template' | 'mixed';
export type PlannedSendMode = 'auto' | 'free_form' | 'template';
export type ActualSendMode = 'free_form' | 'template';
export type WindowState = 'in_window' | 'out_of_window' | 'unknown';

export type FollowUpTriggerType =
  | 'session_end'
  | 'no_reply_for'
  | 'time_after_event'
  | 'pipeline_stage_change'
  | 'contact_created'
  | 'datasheet_field_change'
  | 'before_datetime_field'
  | 'schedule_recurring'
  | 'ai_skill'
  | 'manual';

export interface FollowUpMessage {
  id: number;
  business_id: number;
  agent_id?: number | null;
  lead_id?: number | null;
  contact_id?: number | null;
  conversation_id?: number | null;
  session_id?: number | null;
  status: FollowUpStatus;
  delivery_mode: FollowUpMode;
  scheduled_at: string;
  sent_at?: string | null;
  cancelled_at?: string | null;
  channel_id?: number | null;
  channel_type?: string | null;
  message_text: string;
  template_id?: number | null;
  rule_id?: number | null;
  meta?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at?: string | null;

  // v2 cost-aware fields
  planned_send_mode?: PlannedSendMode;
  actual_send_mode?: ActualSendMode | null;
  window_state?: WindowState | null;
  template_params?: string[] | null;
  estimated_cost?: string | number;
  actual_cost?: string | number;
  wallet_tx_id?: number | null;
  ai_triggered?: boolean;
  fallback_template_id?: number | null;
}

export interface FollowUpListResponse {
  items: FollowUpMessage[];
}

export interface FollowUpRule {
  id: number;
  business_id: number;
  agent_id?: number | null;
  name: string;
  description?: string | null;
  is_active: boolean;
  mode: FollowUpMode;
  delay_minutes: number;
  sequence_index?: number | null;
  conditions?: Record<string, any> | null;
  template_type: TemplateType;
  template_id?: number | null;
  llm_preset?: string | null;
  generation_config?: Record<string, any> | null;
  created_at: string;
  updated_at?: string | null;

  // v2
  trigger_type: FollowUpTriggerType;
  trigger_config?: Record<string, any> | null;
  fallback_template_id?: number | null;
  free_form_text?: string | null;
  max_per_contact: number;
  cooldown_hours: number;
  priority: number;
  max_daily_cost?: string | number | null;
}

export interface FollowUpRuleCreate {
  name: string;
  description?: string;
  is_active?: boolean;
  mode?: FollowUpMode;
  delay_minutes?: number;
  sequence_index?: number | null;
  conditions?: Record<string, any>;
  template_type?: TemplateType;
  template_id?: number | null;
  llm_preset?: string | null;
  generation_config?: Record<string, any>;
  agent_id?: number | null;

  // v2
  trigger_type: FollowUpTriggerType;
  trigger_config?: Record<string, any> | null;
  fallback_template_id?: number | null;
  free_form_text?: string | null;
  max_per_contact?: number;
  cooldown_hours?: number;
  priority?: number;
  max_daily_cost?: number | null;
}

export interface FollowUpRuleUpdate extends Partial<FollowUpRuleCreate> {}

export async function listFollowups(params: {
  lead_id?: number;
  contact_id?: number;
  agent_id?: number;
  status?: FollowUpStatus;
}): Promise<FollowUpMessage[]> {
  const q = new URLSearchParams();
  if (params.lead_id != null) q.set('lead_id', String(params.lead_id));
  if (params.contact_id != null) q.set('contact_id', String(params.contact_id));
  if (params.agent_id != null) q.set('agent_id', String(params.agent_id));
  if (params.status) q.set('status', params.status);
  const data = await apiFetch<FollowUpListResponse>(`/followups?${q.toString()}`, {
    method: 'GET',
  });
  return data.items ?? [];
}

export async function sendFollowupNow(id: number): Promise<FollowUpMessage> {
  return apiFetch<FollowUpMessage>(`/followups/${id}/send`, {
    method: 'POST',
  });
}

export async function cancelFollowup(id: number): Promise<FollowUpMessage> {
  return apiFetch<FollowUpMessage>(`/followups/${id}/cancel`, {
    method: 'POST',
  });
}

export async function getAgentFollowupSettings(agentId: number | string): Promise<Record<string, any>> {
  return apiFetch<Record<string, any>>(`/followups/agents/${agentId}/settings`, {
    method: 'GET',
  });
}

export async function updateAgentFollowupSettings(
  agentId: number | string,
  payload: Record<string, any>,
): Promise<Record<string, any>> {
  return apiFetch<Record<string, any>>(`/followups/agents/${agentId}/settings`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/** List follow-up rules for the business, optionally filtered by agent */
export async function listFollowupRules(params?: { agent_id?: number }): Promise<FollowUpRule[]> {
  const q = new URLSearchParams();
  if (params?.agent_id != null) q.set('agent_id', String(params.agent_id));
  const url = q.toString() ? `/followups/rules?${q.toString()}` : '/followups/rules';
  return apiFetch<FollowUpRule[]>(url, { method: 'GET' });
}

export async function createFollowupRule(payload: FollowUpRuleCreate): Promise<FollowUpRule> {
  return apiFetch<FollowUpRule>('/followups/rules', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateFollowupRule(
  ruleId: number,
  payload: FollowUpRuleUpdate,
): Promise<FollowUpRule> {
  return apiFetch<FollowUpRule>(`/followups/rules/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteFollowupRule(ruleId: number): Promise<void> {
  await apiFetch<void>(`/followups/rules/${ruleId}`, { method: 'DELETE' });
}

/** Legacy: list rules for a specific agent */
export async function listAgentFollowupRules(agentId: number | string): Promise<FollowUpRule[]> {
  return apiFetch<FollowUpRule[]>(`/followups/agents/${agentId}/rules`, {
    method: 'GET',
  });
}

export async function createAgentFollowupRule(
  agentId: number | string,
  payload: FollowUpRuleCreate,
): Promise<FollowUpRule> {
  return apiFetch<FollowUpRule>(`/followups/agents/${agentId}/rules`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAgentFollowupRule(
  agentId: number | string,
  ruleId: number,
  payload: FollowUpRuleUpdate,
): Promise<FollowUpRule> {
  return apiFetch<FollowUpRule>(`/followups/agents/${agentId}/rules/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAgentFollowupRule(agentId: number | string, ruleId: number): Promise<void> {
  await apiFetch<void>(`/followups/agents/${agentId}/rules/${ruleId}`, {
    method: 'DELETE',
  });
}

export interface FollowUpMessageCreate {
  agent_id?: number | null;
  lead_id?: number;
  contact_id?: number;
  message_text: string;
  scheduled_at: string; // ISO datetime string
  delivery_mode?: FollowUpMode;
  conversation_id?: number | null;
  session_id?: number | null;
  channel_id?: number | null;
  channel_type?: string | null;
  template_id?: number | null;
  metadata?: Record<string, any> | null;
}

export async function createFollowup(payload: FollowUpMessageCreate): Promise<FollowUpMessage> {
  return apiFetch<FollowUpMessage>('/followups', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP V2 — templates picker, cost estimate, dashboard analytics
// ════════════════════════════════════════════════════════════════════════════

export interface FollowUpTemplateOption {
  id: number;
  name: string;
  meta_template_name?: string | null;
  category: string;
  language: string;
  body_preview: string;
  placeholder_count: number;
  intent_key?: string | null;
  cost_per_conversation: string | number;
  currency: string;
}

export interface FollowUpEstimateRequest {
  template_id?: number | null;
  free_form_text?: string | null;
  delay_minutes: number;
  trigger_type?: FollowUpTriggerType;
}

export interface FollowUpEstimateResponse {
  cost_if_template_send: string | number;
  cost_if_free_form: string | number;
  template_category?: string | null;
  currency: string;
  wallet_balance: string | number;
  wallet_low_warning: boolean;
  notes: string[];
}

export interface FollowUpAnalytics {
  wallet_balance: string | number;
  currency: string;

  // Credits (the real charging unit for follow-ups)
  credits_balance: number;
  credits_monthly_cap?: number | null;
  credits_monthly_used: number;
  credits_lifetime_granted: number;
  credits_lifetime_consumed: number;
  credits_expire_at?: string | null;

  rules_active: number;
  rules_paused: number;
  messages_scheduled: number;
  messages_pending_manual: number;
  messages_sent_today: number;
  messages_sent_this_month: number;
  messages_failed_last_24h: number;
  cost_today: string | number;            // estimated Meta cost (informational)
  cost_this_month: string | number;       // estimated Meta cost (informational)
  sent_this_month_free_form: number;
  sent_this_month_template: number;
  recent_failures: Array<{
    id: number;
    contact_id?: number | null;
    rule_id?: number | null;
    scheduled_at?: string | null;
    error?: string | null;
  }>;
}

export async function listFollowupTemplates(intent?: string): Promise<FollowUpTemplateOption[]> {
  const qs = intent ? `?intent=${encodeURIComponent(intent)}` : '';
  return apiFetch<FollowUpTemplateOption[]>(`/followups/templates${qs}`, { method: 'GET' });
}

export async function estimateFollowupCost(
  input: FollowUpEstimateRequest,
): Promise<FollowUpEstimateResponse> {
  return apiFetch<FollowUpEstimateResponse>('/followups/estimate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getFollowupAnalytics(): Promise<FollowUpAnalytics> {
  return apiFetch<FollowUpAnalytics>('/followups/analytics', { method: 'GET' });
}

export async function pauseFollowupRule(ruleId: number): Promise<FollowUpRule> {
  return apiFetch<FollowUpRule>(`/followups/rules/${ruleId}/pause`, { method: 'POST' });
}

export async function activateFollowupRule(ruleId: number): Promise<FollowUpRule> {
  return apiFetch<FollowUpRule>(`/followups/rules/${ruleId}/activate`, { method: 'POST' });
}

export async function listRuleMessages(
  ruleId: number,
  opts?: { status?: FollowUpStatus; limit?: number },
): Promise<FollowUpListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiFetch<FollowUpListResponse>(`/followups/rules/${ruleId}/messages${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
}

// ─── UI metadata + display helpers ──────────────────────────────────────────

export const TRIGGER_TYPE_META: Record<FollowUpTriggerType, { label: string; description: string; icon: string }> = {
  session_end: {
    label: 'Conversation ended',
    description: 'Fires when an AI conversation session closes — classic after-chat follow-up.',
    icon: '💬',
  },
  no_reply_for: {
    label: 'No reply for N minutes',
    description: 'Fires when a customer goes silent. Great for nudging fence-sitters.',
    icon: '⏱️',
  },
  time_after_event: {
    label: 'N minutes after an event',
    description: 'Fires after any business event (contact created, stage changed, etc.).',
    icon: '⏰',
  },
  pipeline_stage_change: {
    label: 'Pipeline stage change',
    description: 'Fires when a contact moves to a specific pipeline stage.',
    icon: '📊',
  },
  contact_created: {
    label: 'New contact created',
    description: 'Fires immediately when a new contact enters your CRM.',
    icon: '✨',
  },
  before_datetime_field: {
    label: 'Before a datasheet date field',
    description: 'Fires N minutes BEFORE a datetime value (e.g. 24h before a booked demo).',
    icon: '📅',
  },
  datasheet_field_change: {
    label: 'Datasheet field change',
    description: 'Fires when a specific datasheet field changes value.',
    icon: '📝',
  },
  schedule_recurring: {
    label: 'Recurring schedule',
    description: 'Fires on a cron schedule (daily/weekly/monthly).',
    icon: '🔁',
  },
  ai_skill: {
    label: 'AI agent decided',
    description: 'Created by the AI agent at conversation time. Not user-configurable here.',
    icon: '🤖',
  },
  manual: {
    label: 'Manually created',
    description: 'One-off follow-up created by a human via the UI or API.',
    icon: '👤',
  },
};

export function formatDelay(minutes: number): string {
  if (!minutes || minutes <= 0) return 'immediately';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d${h % 24 ? ` ${h % 24}h` : ''}`;
  return `${Math.floor(d / 7)}w`;
}

export function statusBadgeClasses(status: FollowUpStatus): string {
  switch (status) {
    case 'sent': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
    case 'scheduled': return 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
    case 'pending_manual': return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
    case 'cancelled': return 'bg-gray-500/15 text-gray-700 dark:text-gray-400';
    case 'failed': return 'bg-red-500/15 text-red-700 dark:text-red-400';
  }
}

export function formatMoney(amount: string | number, currency = 'INR'): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return `${currency} —`;
  return `₹${n.toFixed(2)}`;
}

