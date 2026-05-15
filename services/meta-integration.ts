import { apiFetch } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetaIntegration {
  id: number;
  business_id: number;
  app_id: string;
  app_secret_masked: string;
  page_id: string;
  page_name: string | null;
  verify_token: string;
  webhook_url: string;
  default_pipeline_stage_id: number | null;
  default_agent_id: number | null;
  default_priority: string;
  is_active: boolean;
  last_webhook_at: string | null;
  webhook_error_count: number;
}

export interface MetaIntegrationCreate {
  app_id: string;
  app_secret: string;
  page_access_token: string;
  page_id: string;
  page_name?: string;
  default_pipeline_stage_id?: number | null;
  default_agent_id?: number | null;
  default_priority?: string;
}

export interface MetaLeadForm {
  id: number;
  form_id: string;
  form_name: string | null;
  page_id: string | null;
  source_label: string | null;
  pipeline_stage_id: number | null;
  pipeline_stage_name: string | null;
  agent_id: number | null;
  priority: string;
  is_active: boolean;
  leads_received: number;
  last_lead_at: string | null;
}

export interface MetaFormRoutingConfig {
  source_label?: string;
  pipeline_stage_id?: number | null;
  agent_id?: number | null;
  priority?: string;
}

export interface MetaPageForm {
  form_id: string;
  form_name: string;
  status: string;
  leads_count: number;
  created_time: string | null;
  is_connected: boolean;
}

export interface MetaStats {
  total_meta_leads: number;
  days: number;
  by_campaign: Array<{ name: string; count: number }>;
  by_form: Array<{ name: string; count: number }>;
  by_entry_type: Array<{ type: string; count: number }>;
}

export interface MetaOAuthPage {
  id: string;
  name: string;
  category: string;
  fan_count: number;
}

export interface MetaOAuthExchangeResult {
  long_lived_token: string;
  pages: MetaOAuthPage[];
}

export interface MetaPageSelectPayload {
  long_lived_token: string;
  page_id: string;
  page_name?: string;
  default_pipeline_stage_id?: number | null;
  default_agent_id?: number | null;
  default_priority?: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/** Get current Meta integration config. Throws 404 if not set up. */
export async function getMetaIntegration(): Promise<MetaIntegration> {
  return apiFetch<MetaIntegration>('/meta/integration', { method: 'GET' });
}

/** Save (create or update) Meta integration credentials. */
export async function saveMetaIntegration(
  data: MetaIntegrationCreate,
): Promise<MetaIntegration> {
  return apiFetch<MetaIntegration>('/meta/integration', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Soft-delete the Meta integration. */
export async function deleteMetaIntegration(): Promise<void> {
  await apiFetch('/meta/integration', { method: 'DELETE' });
}

/** Fetch lead forms live from Meta Graph API for the connected page. */
export async function listPageForms(): Promise<{ forms: MetaPageForm[]; total: number }> {
  return apiFetch<{ forms: MetaPageForm[]; total: number }>('/meta/page-forms', {
    method: 'GET',
  });
}

/** List locally connected Meta lead forms. */
export async function listConnectedForms(): Promise<MetaLeadForm[]> {
  return apiFetch<MetaLeadForm[]>('/meta/forms', { method: 'GET' });
}

/** Connect a Meta lead form with routing config. */
export async function connectMetaForm(
  formId: string,
  config: MetaFormRoutingConfig,
): Promise<MetaLeadForm> {
  return apiFetch<MetaLeadForm>(`/meta/forms/${formId}/connect`, {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

/** Update routing config for a connected form. */
export async function updateMetaForm(
  formId: string,
  config: MetaFormRoutingConfig,
): Promise<MetaLeadForm> {
  return apiFetch<MetaLeadForm>(`/meta/forms/${formId}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

/** Disconnect a Meta lead form. */
export async function disconnectMetaForm(formId: string): Promise<void> {
  await apiFetch(`/meta/forms/${formId}`, { method: 'DELETE' });
}

/** Get ad attribution stats for last N days. */
export async function getMetaStats(days = 30): Promise<MetaStats> {
  return apiFetch<MetaStats>(`/meta/stats?days=${days}`, { method: 'GET' });
}

// ─── OAuth flow ───────────────────────────────────────────────────────────────

/** Get the Facebook App ID and scopes needed for the JS SDK popup. */
export async function getMetaAuthConfig(): Promise<{ app_id: string; scope: string }> {
  return apiFetch<{ app_id: string; scope: string }>('/meta/auth/config', { method: 'GET' });
}

/**
 * Extend the short-lived user access token (from FB.login popup) to a
 * long-lived token and return the list of pages the user manages.
 */
export async function exchangeMetaToken(
  userAccessToken: string,
): Promise<MetaOAuthExchangeResult> {
  return apiFetch<MetaOAuthExchangeResult>('/meta/auth/exchange', {
    method: 'POST',
    body: JSON.stringify({ user_access_token: userAccessToken }),
  });
}

/** Complete setup: save the chosen page as the active Meta integration. */
export async function selectMetaPage(
  payload: MetaPageSelectPayload,
): Promise<MetaIntegration> {
  return apiFetch<MetaIntegration>('/meta/auth/select-page', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
