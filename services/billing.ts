import { apiFetch } from '@/lib/api-client';

// ── Types ──

export interface PlanLimits {
  max_agents: number;
  max_channels: number;
  max_datasheets: number;
  max_team_members: number;
  template_messages_per_month: number;
}

export interface PlanFeatures {
  search_products: boolean;
  create_orders: boolean;
  send_media: boolean;
  automation_rules: boolean;
  knowledge_files: number;
}

export interface Plan {
  slug: string;
  name: string;
  price_inr: number;
  billing_period: string;
  agent_type: 'lite' | 'full';
  limits: PlanLimits;
  features: PlanFeatures;
  description: string;
}

export interface CurrentPlan {
  plan_slug: string;
  plan: Plan | null;
  status: string; // "active" | "trialing" | "trial_expired" | "cancelled" | "none"
  current_period_start: string | null;
  current_period_end: string | null;
  razorpay_subscription_id: string | null;
  trial_ends_at?: string | null;
  trial_days_remaining?: number;
  trial_used?: boolean;
}

export interface SubscribeResult {
  subscription_id: string;
  short_url: string;
  status: string;
  plan_slug: string;
}

export interface UsageData {
  plan_slug: string;
  month: string;
  // Monthly usage
  ai_messages: number;
  ai_messages_limit: number;
  template_messages: number;
  template_messages_limit: number;
  template_messages_remaining: number;
  llm_cost_usd: number;
  llm_cost_inr: number;
  // Resource usage (current vs plan limit, -1 = unlimited)
  agents_used: number;
  agents_limit: number;
  channels_used: number;
  channels_limit: number;
  datasheets_used: number;
  datasheets_limit: number;
  team_members_used: number;
  team_members_limit: number;
}

// ── API Functions ──

export async function getPlans(): Promise<{ plans: Plan[] }> {
  return apiFetch<{ plans: Plan[] }>('/billing/plans', { method: 'GET' });
}

export async function getCurrentPlan(): Promise<CurrentPlan> {
  return apiFetch<CurrentPlan>('/billing/current', { method: 'GET' });
}

export async function getUsage(): Promise<UsageData> {
  return apiFetch<UsageData>('/billing/usage', { method: 'GET' });
}

export async function createSubscription(planSlug: string): Promise<SubscribeResult> {
  return apiFetch<SubscribeResult>('/billing/subscribe', {
    method: 'POST',
    body: JSON.stringify({ plan_slug: planSlug }),
  });
}

export async function cancelSubscription(): Promise<{ status: string; effective_at: string }> {
  return apiFetch<{ status: string; effective_at: string }>('/billing/cancel', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function changePlan(newPlanSlug: string): Promise<{ old_plan: string; new_plan: string; status: string }> {
  return apiFetch<{ old_plan: string; new_plan: string; status: string }>('/billing/change-plan', {
    method: 'POST',
    body: JSON.stringify({ new_plan_slug: newPlanSlug }),
  });
}

export interface TrialResult {
  plan_slug: string;
  status: string;
  trial_ends_at: string;
  trial_days: number;
}

export async function startTrial(planSlug: string): Promise<TrialResult> {
  return apiFetch<TrialResult>('/billing/start-trial', {
    method: 'POST',
    body: JSON.stringify({ plan_slug: planSlug }),
  });
}
