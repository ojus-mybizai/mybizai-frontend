'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Crown, Zap, Building2, Rocket, Loader2, ChevronRight } from 'lucide-react';
import {
  getPlans,
  getCurrentPlan,
  getUsage,
  createSubscription,
  cancelSubscription,
  startTrial,
  type Plan,
  type CurrentPlan,
  type UsageData,
} from '@/services/billing';

const PLAN_ICONS: Record<string, typeof Zap> = {
  starter: Zap,
  growth: Rocket,
  pro: Crown,
  enterprise: Building2,
};

const PLAN_COLORS: Record<string, string> = {
  starter: 'border-blue-200 bg-blue-50',
  growth: 'border-emerald-200 bg-emerald-50',
  pro: 'border-purple-200 bg-purple-50',
  enterprise: 'border-amber-200 bg-amber-50',
};

const PLAN_ACCENT: Record<string, string> = {
  starter: 'bg-blue-600',
  growth: 'bg-emerald-600',
  pro: 'bg-purple-600',
  enterprise: 'bg-amber-600',
};

function formatLimit(v: number): string {
  return v === -1 ? 'Unlimited' : String(v);
}

function UsageCard({
  label, used, limit, sublabel, showBar,
}: {
  label: string;
  used: number;
  limit: number;
  sublabel?: string;
  showBar?: boolean;
}) {
  const isUnlimited = limit === -1;
  const pct = !isUnlimited && limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const isNearLimit = !isUnlimited && limit > 0 && pct >= 80;
  const isAtLimit = !isUnlimited && limit > 0 && used >= limit;

  return (
    <div className="rounded-lg border border-border-color bg-card-bg p-4">
      <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</span>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-lg font-bold ${isAtLimit ? 'text-red-600' : 'text-text-primary'}`}>
          {used.toLocaleString()}
        </span>
        <span className="text-sm text-text-secondary">
          / {formatLimit(limit)}
        </span>
      </div>
      {showBar && !isUnlimited && limit > 0 && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bg-secondary">
          <div
            className={`h-full rounded-full transition-all ${
              isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-accent'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {sublabel && <span className="mt-0.5 block text-xs text-text-secondary">{sublabel}</span>}
      {isAtLimit && (
        <span className="mt-0.5 block text-xs font-medium text-red-600">Limit reached — upgrade to add more</span>
      )}
    </div>
  );
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<CurrentPlan | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPlans(), getCurrentPlan(), getUsage()])
      .then(([p, c, u]) => {
        if (cancelled) return;
        setPlans(p.plans);
        setCurrent(c);
        setUsage(u);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load billing data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSubscribe = async (slug: string) => {
    setSubscribing(slug);
    setError(null);
    try {
      const result = await createSubscription(slug);
      if (result.short_url) {
        // Redirect to Razorpay checkout
        window.location.href = result.short_url;
      } else {
        setNotice('Subscription created. Complete payment to activate.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create subscription');
    } finally {
      setSubscribing(null);
    }
  };

  const handleStartTrial = async (slug: string) => {
    setSubscribing(slug);
    setError(null);
    try {
      const result = await startTrial(slug);
      setNotice(`Free trial started! You have ${result.trial_days} days of ${slug} plan access. No payment required.`);
      const [c, u] = await Promise.all([getCurrentPlan(), getUsage()]);
      setCurrent(c);
      setUsage(u);
    } catch (err: any) {
      setError(err?.message || 'Failed to start trial');
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel? Your plan will remain active until the end of the billing period.')) return;
    setCancelling(true);
    setError(null);
    try {
      await cancelSubscription();
      setNotice('Subscription cancelled. Access continues until the end of your billing period.');
      const c = await getCurrentPlan();
      setCurrent(c);
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <span className="ml-2 text-text-secondary">Loading billing...</span>
      </div>
    );
  }

  const currentSlug = current?.plan_slug || 'starter';
  const isActive = current?.status === 'active';
  const isTrialing = current?.status === 'trialing';
  const isTrialExpired = current?.status === 'trial_expired';
  const trialDaysLeft = current?.trial_days_remaining ?? 0;
  const canTrial = !current?.trial_used && !isActive && !isTrialing;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-xs text-text-secondary">
        <Link href="/settings" className="font-semibold text-accent hover:underline">Settings</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-text-primary">Billing & Plans</span>
      </nav>

      <h1 className="text-2xl font-bold text-text-primary">Billing & Plans</h1>
      <p className="mt-1 text-sm text-text-secondary">
        {isActive
          ? `You are on the ${current?.plan?.name || currentSlug} plan.`
          : isTrialing
            ? `Free trial: ${current?.plan?.name || currentSlug} plan (${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} remaining)`
            : isTrialExpired
              ? 'Your free trial has ended. Subscribe to continue using premium features.'
              : 'Choose a plan to get started.'}
      </p>

      {/* Trial banner */}
      {isTrialing && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
          <div>
            <span className="font-semibold text-blue-800">Free trial active</span>
            <span className="ml-2 text-blue-700">
              {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left on {current?.plan?.name || currentSlug}
              {current?.trial_ends_at && ` (ends ${new Date(current.trial_ends_at).toLocaleDateString()})`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSubscribe(currentSlug)}
            disabled={subscribing !== null}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Subscribe now
          </button>
        </div>
      )}

      {isTrialExpired && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your free trial has ended. Subscribe below to restore full access to your {current?.plan?.name || 'selected'} plan features.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      )}

      {/* Usage summary — show for active and trialing */}
      {usage && (isActive || isTrialing) && (
        <div className="mt-6 space-y-5">
          {/* Monthly Usage */}
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Monthly Usage ({usage.month})</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <UsageCard
                label="AI Messages"
                used={usage.ai_messages}
                limit={usage.ai_messages_limit}
                sublabel="Unlimited on all plans"
              />
              <UsageCard
                label="Template Messages"
                used={usage.template_messages}
                limit={usage.template_messages_limit}
                sublabel={usage.template_messages_remaining >= 0 ? `${usage.template_messages_remaining} remaining` : undefined}
                showBar
              />
              <div className="rounded-lg border border-border-color bg-card-bg p-4">
                <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary">LLM Cost</span>
                <span className="mt-1 block text-lg font-bold text-text-primary">
                  {usage.llm_cost_inr < 1 ? `Rs ${usage.llm_cost_inr.toFixed(2)}` : `Rs ${Math.round(usage.llm_cost_inr).toLocaleString()}`}
                </span>
                <span className="text-xs text-text-secondary">${usage.llm_cost_usd.toFixed(4)} USD</span>
              </div>
            </div>
          </div>

          {/* Resource Usage */}
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Resource Usage</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <UsageCard label="AI Agents" used={usage.agents_used} limit={usage.agents_limit} showBar />
              <UsageCard label="Channels" used={usage.channels_used} limit={usage.channels_limit} showBar />
              <UsageCard label="Datasheets" used={usage.datasheets_used} limit={usage.datasheets_limit} showBar />
              <UsageCard label="Team Members" used={usage.team_members_used} limit={usage.team_members_limit} showBar />
            </div>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.slug === currentSlug && (isActive || isTrialing);
          const Icon = PLAN_ICONS[plan.slug] || Zap;
          const color = PLAN_COLORS[plan.slug] || 'border-border-color bg-card-bg';
          const accent = PLAN_ACCENT[plan.slug] || 'bg-accent';

          return (
            <div
              key={plan.slug}
              className={`relative flex flex-col rounded-xl border-2 p-5 transition-shadow ${
                isCurrent ? `${color} ring-2 ring-accent shadow-lg` : 'border-border-color bg-card-bg hover:shadow-md'
              }`}
            >
              {isCurrent && (
                <span className={`absolute -top-3 left-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase text-white ${
                  isTrialing ? 'bg-blue-600' : 'bg-accent'
                }`}>
                  {isTrialing ? 'Trial Active' : 'Current Plan'}
                </span>
              )}

              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-1.5 ${accent} text-white`}>
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-bold text-text-primary">{plan.name}</h3>
              </div>

              <div className="mt-3">
                <span className="text-2xl font-extrabold text-text-primary">Rs {plan.price_inr.toLocaleString()}</span>
                <span className="text-sm text-text-secondary">/month</span>
              </div>

              <p className="mt-2 text-xs text-text-secondary">{plan.description}</p>

              <ul className="mt-4 flex-1 space-y-1.5 text-xs text-text-secondary">
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> AI messages: Unlimited</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Agent type: {plan.agent_type === 'full' ? 'Full AI (search, orders, media)' : 'Lite (reply + qualify)'}</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Agents: {formatLimit(plan.limits.max_agents)}</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Channels: {formatLimit(plan.limits.max_channels)}</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Team: {formatLimit(plan.limits.max_team_members)}</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Datasheets: {formatLimit(plan.limits.max_datasheets)}</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Templates: {formatLimit(plan.limits.template_messages_per_month)}/mo</li>
              </ul>

              <div className="mt-4 space-y-2">
                {isCurrent && isActive ? (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel Plan'}
                  </button>
                ) : isCurrent && isTrialing ? (
                  /* Currently trialing this plan — show subscribe button */
                  <button
                    type="button"
                    onClick={() => handleSubscribe(plan.slug)}
                    disabled={subscribing !== null}
                    className={`w-full rounded-lg px-4 py-2 text-sm font-semibold text-white ${accent} hover:opacity-90 disabled:opacity-50`}
                  >
                    {subscribing === plan.slug ? (
                      <><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Processing...</>
                    ) : (
                      'Subscribe now'
                    )}
                  </button>
                ) : (
                  <>
                    {/* Start trial (if eligible and not already trialing another plan) */}
                    {canTrial && (
                      <button
                        type="button"
                        onClick={() => handleStartTrial(plan.slug)}
                        disabled={subscribing !== null}
                        className="w-full rounded-lg border-2 border-blue-500 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                      >
                        {subscribing === plan.slug ? (
                          <><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Starting...</>
                        ) : (
                          'Start 7-day free trial'
                        )}
                      </button>
                    )}
                    {/* Subscribe directly */}
                    <button
                      type="button"
                      onClick={() => handleSubscribe(plan.slug)}
                      disabled={subscribing !== null}
                      className={`w-full rounded-lg px-4 py-2 text-sm font-semibold text-white ${accent} hover:opacity-90 disabled:opacity-50`}
                    >
                      {subscribing === plan.slug ? (
                        <><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Processing...</>
                      ) : isActive && plans.indexOf(plan) > plans.findIndex((p) => p.slug === currentSlug) ? (
                        'Upgrade'
                      ) : isActive ? (
                        'Downgrade'
                      ) : (
                        'Subscribe'
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Billing period info */}
      {isActive && current?.current_period_end && (
        <p className="mt-6 text-center text-xs text-text-secondary">
          Current period ends: {new Date(current.current_period_end).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
