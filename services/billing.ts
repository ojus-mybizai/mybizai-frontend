import { apiFetch } from '@/lib/api-client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BillingPeriod = 'monthly' | 'annual';

export interface PlanLimits {
  max_agents: number;
  max_channels: number;
  max_datasheets: number;
  max_team_members: number;
  max_contacts: number;
  max_wa_employees: number;
  template_messages_per_month: number;
  campaigns_per_month: number;
  broadcasts_per_month: number;
}

export interface PlanFeatures {
  search_products: boolean;
  create_orders: boolean;
  send_media: boolean;
  automation_rules: boolean;
  knowledge_files: number;
}

export interface PlanCredits {
  monthly_base: number;
  annual_base: number;
  annual_bonus_pct: number;
  founder_bonus_pct: number;
  monthly_cap: number;
}

export interface Plan {
  slug: string;
  name: string;
  tagline?: string;
  description: string;
  price_monthly_inr: number;
  price_annual_inr: number;
  annual_discount_pct: number;
  agent_type: 'lite' | 'full';
  founder_eligible: boolean;
  modules: string[];
  limits: PlanLimits;
  features: PlanFeatures;
  credits: PlanCredits;
}

export interface CurrentPlan {
  plan_slug: string;
  plan: Plan | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  razorpay_subscription_id: string | null;
  billing_period?: BillingPeriod;
  is_founder?: boolean;
  trial_ends_at?: string | null;
  trial_days_remaining?: number;
  trial_used?: boolean;
}

export interface CreditWalletState {
  balance: number;
  lifetime_granted: number;
  lifetime_consumed: number;
  monthly_cap: number | null;
  current_month_used: number;
  current_month_period: string | null;
  expires_at: string | null;
  low_balance_warning: boolean;
}

export interface UsageData {
  plan_slug: string;
  month: string;
  ai_messages: number;
  ai_messages_limit: number;
  template_messages: number;
  template_messages_limit: number;
  template_messages_remaining: number;
  llm_cost_usd: number;
  llm_cost_inr: number;
  agents_used: number;
  agents_limit: number;
  channels_used: number;
  channels_limit: number;
  datasheets_used: number;
  datasheets_limit: number;
  team_members_used: number;
  team_members_limit: number;
  credits?: CreditWalletState;
}

export interface CreditLedgerEntry {
  id: number;
  entry_type: 'grant' | 'debit' | 'refund' | 'expiry' | 'adjustment';
  credits_delta: number;
  balance_after: number;
  source: string;
  reference_type: string | null;
  reference_id: number | null;
  description: string | null;
  created_at: string | null;
}

export interface SubscribeResult {
  subscription_id: string;
  short_url: string;
  status: string;
  plan_slug: string;
}

export interface TrialResult {
  plan_slug: string;
  status: string;
  trial_started_at?: string;
  trial_ends_at: string;
  trial_days: number;
  credits_granted?: number;
  monthly_cap?: number | null;
  modules?: string[];
}

export interface FounderAvailability {
  total: number;
  claimed: number;
  remaining: number;
  open: boolean;
  eligible_plans: string[];
}

export interface FounderEnrollmentResult {
  slot_number: number;
  checkout_url: string;
  subscription_id: string;
  plan_slug: string;
  billing_period: BillingPeriod;
  is_founder: boolean;
}

export interface MyFounderEnrollment {
  slot_number: number;
  plan_slug: string;
  status: 'reserved' | 'paid' | 'expired';
  bonus_credits_granted: number;
  reserved_at: string | null;
  paid_at: string | null;
}

// ── API Functions ────────────────────────────────────────────────────────────

export async function getPlans(): Promise<{ plans: Plan[] }> {
  return apiFetch<{ plans: Plan[] }>('/billing/plans', { method: 'GET' });
}

export async function getCurrentPlan(): Promise<CurrentPlan> {
  return apiFetch<CurrentPlan>('/billing/current', { method: 'GET' });
}

export async function getUsage(): Promise<UsageData> {
  return apiFetch<UsageData>('/billing/usage', { method: 'GET' });
}

export async function getCreditLedger(limit = 25, offset = 0): Promise<{ entries: CreditLedgerEntry[]; limit: number; offset: number }> {
  return apiFetch(`/billing/credits/ledger?limit=${limit}&offset=${offset}`, { method: 'GET' });
}

export async function createSubscription(planSlug: string, billingPeriod: BillingPeriod = 'monthly'): Promise<SubscribeResult> {
  return apiFetch<SubscribeResult>('/billing/subscribe', {
    method: 'POST',
    body: JSON.stringify({ plan_slug: planSlug, billing_period: billingPeriod }),
  });
}

export async function cancelSubscription(): Promise<{ status: string; effective_at: string }> {
  return apiFetch<{ status: string; effective_at: string }>('/billing/cancel', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function changePlan(newPlanSlug: string, billingPeriod?: BillingPeriod): Promise<{ old_plan: string; new_plan: string; status: string }> {
  return apiFetch<{ old_plan: string; new_plan: string; status: string }>('/billing/change-plan', {
    method: 'POST',
    body: JSON.stringify({ new_plan_slug: newPlanSlug, billing_period: billingPeriod }),
  });
}

export async function startTrial(): Promise<TrialResult> {
  return apiFetch<TrialResult>('/billing/start-trial', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ── Founder's Offer ──

export async function getFounderAvailability(): Promise<FounderAvailability> {
  return apiFetch<FounderAvailability>('/billing/founder/availability', { method: 'GET', auth: false });
}

export async function getMyFounderEnrollment(): Promise<MyFounderEnrollment | null> {
  return apiFetch<MyFounderEnrollment | null>('/billing/founder/me', { method: 'GET' });
}

export async function enrollFounder(planSlug: string): Promise<FounderEnrollmentResult> {
  return apiFetch<FounderEnrollmentResult>('/billing/founder/enroll', {
    method: 'POST',
    body: JSON.stringify({ plan_slug: planSlug }),
  });
}

// ── Credit top-ups ──

export interface CreditPack {
  id: string;
  credits: number;
  price_inr: number;
  label: string;
}

export interface TopupPacksResponse {
  packs: CreditPack[];
  price_per_credit_inr: number;
  custom_min_inr: number;
  custom_max_inr: number;
}

export interface TopupOrderResult {
  order_id: string;
  razorpay_key_id: string;
  amount_inr: number;
  amount_paise: number;
  credits: number;
  currency: string;
  name: string;
  description: string;
  receipt: string;
  prefill: { email: string; contact: string };
}

export interface UsageTrendDay {
  date: string;
  credits: number;
  runs: number;
  cost_inr: number;
}

export interface UsageTrendByAgent {
  agent_id: number;
  credits: number;
  runs: number;
}

export interface UsageTrendByModel {
  model: string;
  credits: number;
  runs: number;
}

export interface UsageTrendResponse {
  days: number;
  trend: UsageTrendDay[];
  by_agent: UsageTrendByAgent[];
  by_model: UsageTrendByModel[];
}

export async function getTopupPacks(): Promise<TopupPacksResponse> {
  return apiFetch<TopupPacksResponse>('/billing/credits/packs', { method: 'GET' });
}

export async function createTopupOrder(input: { packId?: string; customAmountInr?: number }): Promise<TopupOrderResult> {
  return apiFetch<TopupOrderResult>('/billing/credits/topup', {
    method: 'POST',
    body: JSON.stringify({
      pack_id: input.packId,
      custom_amount_inr: input.customAmountInr,
    }),
  });
}

export async function getUsageTrend(days = 30): Promise<UsageTrendResponse> {
  return apiFetch<UsageTrendResponse>(`/billing/credits/usage-trend?days=${days}`, { method: 'GET' });
}
