/**
 * Outbound messaging API client.
 *
 * Covers wallet, campaigns, and segments. Matches the backend routers:
 *   /api/v1/wallet, /api/v1/campaigns, /api/v1/segments
 */

import { apiFetch } from '@/lib/api-client';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type CampaignCategory = 'marketing' | 'utility' | 'reminder' | 'followup';
export type AudienceType = 'manual' | 'segment' | 'ai_filter';
export type ScheduleType = 'now' | 'scheduled' | 'drip';
export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface Wallet {
  id: number;
  business_id: number;
  balance: string; // numeric → string to preserve precision
  monthly_budget: string | null;
  low_balance_alert: string;
  currency: string;
}

export interface CategorySpend {
  category: string;
  total_spent: string;
  message_count: number;
  avg_cost_per_message: string;
}

export interface WalletStats {
  balance: string;
  currency: string;
  monthly_budget: string | null;
  month_total_spent: string;
  month_total_messages: number;
  by_category: CategorySpend[];
}

export interface WalletTransaction {
  id: number;
  type: 'credit' | 'debit' | 'refund';
  amount: string;
  category: string | null;
  campaign_id: number | null;
  description: string | null;
  balance_after: string;
  external_reference: string | null;
  created_at: string;
}

export interface CostEstimate {
  category: CampaignCategory;
  recipient_count: number;
  cost_per_message: string;
  total_cost: string;
  currency: string;
  wallet_balance: string;
  wallet_after_send: string;
  has_sufficient_balance: boolean;
}

// ── Custom-field filter op (T2.2) ────────────────────────────────────────
export type CustomFieldOp = 'eq' | 'contains' | 'in' | 'is_set' | 'gt' | 'lt';
export interface CustomFieldFilter {
  op: CustomFieldOp;
  value?: string | number | boolean | string[] | null;
  type?: string;                        // field_type hint (number | date | …)
}

export interface AudienceFilter {
  // ── Primary filters (applied by backend _apply_contact_filter) ───────────
  group_ids?: number[];                 // ContactGroup IDs — contacts in ANY of these
  tag_ids?: number[];                   // ContactTagDef IDs — contacts with ANY of these
  source_channels?: string[];           // contact.source: whatsapp / instagram / manual / …
  priority?: string[];                  // hot | high | medium | low
  last_messaged_within_days?: number;   // had a conversation message within the last N days
  not_messaged_within_days?: number;    // no conversation message for N+ days (or never)
  created_after?: string;               // ISO date "YYYY-MM-DD"
  created_before?: string;              // ISO date "YYYY-MM-DD"

  // ── Tier 2 dimensions ─────────────────────────────────────────────────
  pipeline_stage_ids?: number[];        // ProcessStage IDs — contacts at ANY of these
  exclude_pipeline_stage_ids?: number[];// contacts NOT at any of these stages
  assigned_to_ids?: number[];           // platform User IDs (owner)
  assigned_member_ids?: number[];       // Member IDs (owner)
  company_contains?: string;            // Contact.company ILIKE %substr%
  ad_platform?: string;                 // e.g. "meta"
  ad_campaign_names?: string[];         // Contact.meta_campaign_name values
  has_email?: boolean;                  // only contacts with a non-empty email
  custom_field_filters?: Record<string, CustomFieldFilter>;  // keyed by field def id
  exclude_contact_ids?: number[];       // interactive recipient-list trim (T2.2)

  // ── Backward-compat only (never shown in UI, silently ignored by backend) ─
  contact_type_ids?: number[];          // removed — contact types no longer exist
  tags?: string[];                      // legacy tag names — superseded by tag_ids
}

// ── Filter options (picklist data for FilterBuilder UI) ─────────────────

export interface FilterPickItem {
  id: number;
  name: string;
  color: string;
  group_id?: number | null;             // tags only — null/undefined = global tag
}
export interface SourceOption {
  value: string;
  label: string;
}
export interface StageOption {
  id: number;
  name: string;
  color: string;
  process_id: number;
  process_name: string;
}
export interface OwnerOption {
  id: number;
  name: string;
  email?: string;
}
/** Owner facet keyed on Member id, matching Contact.assigned_member_id. */
export interface MemberOption {
  id: number;
  name: string;
}
export interface CustomFieldOption {
  id: number;
  name: string;
  field_type: string;                   // text | number | date | boolean | select | multi_select | …
  options: string[];                    // for select / multi_select
  group_id?: number | null;
}
export interface FilterOptions {
  groups: FilterPickItem[];             // primary organisation unit
  tags: FilterPickItem[];               // includes group_id for scope display
  sources: SourceOption[];
  stages?: StageOption[];               // pipeline stages (T2)
  owners?: OwnerOption[];               // assigned platform users (T2)
  members?: MemberOption[];             // assigned members (T2)
  ad_campaigns?: SourceOption[];        // distinct Meta campaign names (T2)
  custom_fields?: CustomFieldOption[];  // ContactFieldDef picklist (T2)
}

export interface AudiencePreview {
  count: number;
  sample_leads: Array<{
    id: number | null;
    name: string | null;
    phone: string;
  }>;
  warnings: string[];
}

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

// ────────────────────────────────────────────────────────────────────────────
// Wallet
// ────────────────────────────────────────────────────────────────────────────

export async function getWallet(): Promise<Wallet> {
  return apiFetch<Wallet>('/wallet', { method: 'GET' });
}

export async function getWalletStats(): Promise<WalletStats> {
  return apiFetch<WalletStats>('/wallet/stats', { method: 'GET' });
}

export async function topupWallet(
  amount: number,
  external_reference?: string,
  description?: string,
): Promise<Wallet> {
  return apiFetch<Wallet>('/wallet/topup', {
    method: 'POST',
    body: JSON.stringify({ amount, external_reference, description }),
  });
}

export async function listWalletTransactions(params?: {
  tx_type?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<WalletTransaction[]> {
  const search = new URLSearchParams();
  if (params?.tx_type) search.set('tx_type', params.tx_type);
  if (params?.category) search.set('category', params.category);
  if (params?.limit !== undefined) search.set('limit', String(params.limit));
  if (params?.offset !== undefined) search.set('offset', String(params.offset));
  const q = search.toString();
  return apiFetch<WalletTransaction[]>(`/wallet/transactions${q ? `?${q}` : ''}`, {
    method: 'GET',
  });
}

export async function estimateCost(
  category: CampaignCategory,
  recipient_count: number,
): Promise<CostEstimate> {
  return apiFetch<CostEstimate>('/wallet/estimate', {
    method: 'POST',
    body: JSON.stringify({ category, recipient_count }),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Campaigns
// ────────────────────────────────────────────────────────────────────────────

export interface AudiencePreviewRequest {
  audience_type: AudienceType;
  filter?: AudienceFilter;
  segment_id?: number;
  lead_ids?: number[];
  phones?: string[];
}

export async function previewAudience(
  payload: AudiencePreviewRequest,
): Promise<AudiencePreview> {
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
  payload: AudiencePreviewRequest,
  params?: { page?: number; per_page?: number },
): Promise<RecipientPreview> {
  const search = new URLSearchParams();
  if (params?.page !== undefined) search.set('page', String(params.page));
  if (params?.per_page !== undefined) search.set('per_page', String(params.per_page));
  const q = search.toString();
  return apiFetch<RecipientPreview>(
    `/campaigns/preview-audience/contacts${q ? `?${q}` : ''}`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
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
  return apiFetch<Campaign>('/campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listCampaigns(params?: {
  status?: CampaignStatus;
  category?: CampaignCategory;
  page?: number;
  page_size?: number;
}): Promise<{
  items: Campaign[];
  total: number;
  page: number;
  page_size: number;
}> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.category) search.set('category', params.category);
  if (params?.page !== undefined) search.set('page', String(params.page));
  if (params?.page_size !== undefined) search.set('page_size', String(params.page_size));
  const q = search.toString();
  return apiFetch(`/campaigns${q ? `?${q}` : ''}`, { method: 'GET' });
}

export async function getCampaign(id: number): Promise<Campaign> {
  return apiFetch<Campaign>(`/campaigns/${id}`, { method: 'GET' });
}

export async function launchCampaign(id: number): Promise<Campaign> {
  return apiFetch<Campaign>(`/campaigns/${id}/launch`, { method: 'POST' });
}

export async function cancelCampaign(id: number): Promise<Campaign> {
  return apiFetch<Campaign>(`/campaigns/${id}/cancel`, { method: 'POST' });
}

export async function listCampaignRecipients(
  campaign_id: number,
  params?: { status?: string; limit?: number; offset?: number },
): Promise<CampaignRecipient[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.limit !== undefined) search.set('limit', String(params.limit));
  if (params?.offset !== undefined) search.set('offset', String(params.offset));
  const q = search.toString();
  return apiFetch(`/campaigns/${campaign_id}/recipients${q ? `?${q}` : ''}`, {
    method: 'GET',
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Segments
// ────────────────────────────────────────────────────────────────────────────

export async function getFilterOptions(): Promise<FilterOptions> {
  return apiFetch<FilterOptions>('/segments/filter-options', { method: 'GET' });
}

export async function listSegments(): Promise<Segment[]> {
  return apiFetch<Segment[]>('/segments', { method: 'GET' });
}

export async function createSegment(payload: {
  name: string;
  description?: string;
  filter_config: AudienceFilter;
  created_by_ai?: boolean;
}): Promise<Segment> {
  return apiFetch<Segment>('/segments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSegment(
  id: number,
  payload: { name?: string; description?: string; filter_config?: AudienceFilter },
): Promise<Segment> {
  return apiFetch<Segment>(`/segments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteSegment(id: number): Promise<void> {
  await apiFetch(`/segments/${id}`, { method: 'DELETE' });
}

// ────────────────────────────────────────────────────────────────────────────
// Meta WhatsApp Usage
// ────────────────────────────────────────────────────────────────────────────

/** One row from Meta's conversation_category or conversation_type dimension */
export interface MetaBucket {
  count: number;
  cost_usd: number;
}

export interface MetaUsage {
  /** Number of free-tier service conversations used this month */
  free_tier_used: number;
  /** Meta's monthly free-tier limit (always 1 000) */
  free_tier_limit: number;
  /** Per-category breakdown: MARKETING | UTILITY | AUTHENTICATION | SERVICE */
  by_category: Record<string, MetaBucket>;
  /** Per-type breakdown: REGULAR | FREE_TIER | FREE_ENTRY_POINT */
  by_type: Record<string, MetaBucket>;
  /** Total USD charged by Meta this month across all categories */
  total_cost_usd: number;
  /** Set when the channel is missing or not properly configured */
  error?: string;
  /** Debug info always included — channel_id, waba_id, raw call log */
  debug?: {
    channel_id?: number;
    waba_id?: string;
    token_preview?: string;
    token_length?: number;
    granularity?: string;
    start_epoch?: number;
    end_epoch?: number;
    note?: string;   // set when fallback (no-dimensions) path was used
    calls?: Array<{
      params?: Record<string, unknown>;
      exact_url: string;   // the real URL urllib3 sent (after param encoding)
      status: number | null;
      response_body: string | null;
      meta_error: unknown;
    }>;
    // fallback shape for pre-call errors (no channel / missing config keys)
    channel_candidates?: Array<{ id: number; name: string; is_connected: boolean }>;
    config_keys?: string[];
  };
}

export async function getMetaUsage(): Promise<MetaUsage> {
  return apiFetch<MetaUsage>('/wallet/meta-usage', { method: 'GET' });
}

// ────────────────────────────────────────────────────────────────────────────
// AI Audience Builder
// ────────────────────────────────────────────────────────────────────────────

export interface AITurnMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: unknown;
}

export interface AIAudienceTurnResponse {
  reply: string;
  committed_filter: AudienceFilter | null;
  committed_count: number | null;
  trace: Array<{ tool: string; args: unknown; result: unknown }>;
  messages: AITurnMessage[];
}

export async function aiAudienceTurn(
  messages: AITurnMessage[],
): Promise<AIAudienceTurnResponse> {
  return apiFetch<AIAudienceTurnResponse>('/campaigns/ai-audience/turn', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}
