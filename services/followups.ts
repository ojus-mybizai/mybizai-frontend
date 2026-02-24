import { apiFetch } from '@/lib/api-client';

export type FollowUpStatus = 'scheduled' | 'pending_manual' | 'sent' | 'cancelled' | 'failed';
export type FollowUpMode = 'auto' | 'manual' | 'both';
export type TemplateType = 'llm' | 'template' | 'mixed';

export interface FollowUpMessage {
  id: number;
  business_id: number;
  agent_id?: number | null;
  lead_id: number;
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
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at?: string | null;
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
}

export interface FollowUpRuleUpdate extends Partial<FollowUpRuleCreate> {}

export async function listFollowups(params: {
  lead_id?: number;
  agent_id?: number;
  status?: FollowUpStatus;
}): Promise<FollowUpMessage[]> {
  const q = new URLSearchParams();
  if (params.lead_id != null) q.set('lead_id', String(params.lead_id));
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
  lead_id: number;
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

