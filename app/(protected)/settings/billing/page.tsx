'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Check, Crown, Zap, Building2, Rocket, Loader2, ChevronRight,
  Sparkles, AlertCircle, Coins,
} from 'lucide-react';
import {
  getPlans,
  getCurrentPlan,
  getUsage,
  createSubscription,
  cancelSubscription,
  startTrial,
  getFounderAvailability,
  enrollFounder,
  type Plan,
  type CurrentPlan,
  type UsageData,
  type FounderAvailability,
  type BillingPeriod,
} from '@/services/billing';

const PLAN_ICONS: Record<string, typeof Zap> = {
  starter: Zap,
  growth: Rocket,
  pro: Crown,
  enterprise: Building2,
};

const PLAN_ACCENT: Record<string, string> = {
  starter: 'bg-blue-600',
  growth: 'bg-emerald-600',
  pro: 'bg-purple-600',
  enterprise: 'bg-amber-600',
};

function formatLimit(v: number): string {
  return v === -1 ? 'Unlimited' : v.toLocaleString();
}

function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
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
        <span className="text-sm text-text-secondary">/ {formatLimit(limit)}</span>
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
  const [founder, setFounder] = useState<FounderAvailability | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [enrollingFounder, setEnrollingFounder] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPlans(), getCurrentPlan(), getUsage(), getFounderAvailability().catch(() => null)])
      .then(([p, c, u, f]) => {
        if (cancelled) return;
        setPlans(p.plans);
        setCurrent(c);
        setUsage(u);
        setFounder(f);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load billing data');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleSubscribe = async (slug: string) => {
    setSubscribing(slug);
    setError(null);
    try {
      const result = await createSubscription(slug, billingPeriod);
      if (result.short_url) {
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

  const handleStartTrial = async () => {
    setSubscribing('trial');
    setError(null);
    try {
      const result = await startTrial();
      const credits = result.credits_granted ? ` (${result.credits_granted.toLocaleString()} credits)` : '';
      setNotice(`Free trial started — ${result.trial_days} days of full access${credits}.`);
      const [c, u] = await Promise.all([getCurrentPlan(), getUsage()]);
      setCurrent(c);
      setUsage(u);
    } catch (err: any) {
      setError(err?.message || 'Failed to start trial');
    } finally {
      setSubscribing(null);
    }
  };

  const handleEnrollFounder = async (slug: string) => {
    setEnrollingFounder(slug);
    setError(null);
    try {
      const result = await enrollFounder(slug);
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to enroll in Founder offer');
    } finally {
      setEnrollingFounder(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel? Your plan stays active until the end of the current billing period.')) return;
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
  const founderOpen = founder?.open && !isActive;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-xs text-text-secondary">
        <Link href="/settings" className="font-semibold text-accent hover:underline">Settings</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-text-primary">Billing & Plans</span>
      </nav>

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Billing & Plans</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {isActive
              ? `You are on the ${current?.plan?.name || currentSlug} plan${current?.billing_period === 'annual' ? ' (annual)' : ''}.`
              : isTrialing
                ? `Free trial: ${current?.plan?.name || currentSlug} (${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left)`
                : isTrialExpired
                  ? 'Your free trial has ended. Subscribe to continue.'
                  : 'Choose a plan to get started.'}
          </p>
        </div>

        {/* Monthly/Annual toggle */}
        {!isActive && (
          <div className="inline-flex rounded-lg border border-border-color bg-card-bg p-0.5">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                billingPeriod === 'monthly' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                billingPeriod === 'annual' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Annual <span className="ml-1 rounded-sm bg-emerald-500/20 px-1 py-0.5 text-[10px] text-emerald-700">Save 25%</span>
            </button>
          </div>
        )}
      </div>

      {/* Founder banner */}
      {founderOpen && (
        <div className="mt-5 relative overflow-hidden rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 p-5">
          <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-white text-[10px] font-bold uppercase rounded-bl-lg">
            Limited Time
          </div>
          <div className="flex items-start gap-4 flex-wrap">
            <div className="rounded-full bg-amber-500 p-3 text-white"><Sparkles className="h-5 w-5" /></div>
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-lg font-bold text-amber-900">🎁 Founder&apos;s Offer — First {founder?.total} Customers Only</h2>
              <p className="mt-1 text-sm text-amber-800">
                Pay annually and <strong>get the entire amount back as AI credits</strong> (200% bonus).
                Only available on Growth, Pro &amp; Enterprise plans.
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="font-bold text-amber-900">{founder?.remaining}</span>
                <span className="text-amber-800">of {founder?.total} spots left</span>
                <div className="ml-2 h-2 flex-1 max-w-[200px] overflow-hidden rounded-full bg-amber-200">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${((founder?.claimed || 0) / (founder?.total || 100)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Claim Trial CTA — shown only when user has not used trial and has no active sub */}
      {canTrial && (
        <div className="mt-4 overflow-hidden rounded-xl border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-600 p-2 text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-bold text-blue-900">15-day Free Trial — All Features Unlocked</div>
                <div className="mt-0.5 text-sm text-blue-800">
                  Try every feature with <strong>5,000 AI credits</strong> included. No card required. Cancel anytime.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleStartTrial}
              disabled={subscribing !== null}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
            >
              {subscribing === 'trial' ? (
                <><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Activating...</>
              ) : 'Claim Free Trial'}
            </button>
          </div>
        </div>
      )}

      {/* Trial banner */}
      {isTrialing && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm">
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
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your free trial has ended. Subscribe below to restore full access.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
      {notice && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>
      )}

      {/* Credit balance widget */}
      {usage?.credits && (isActive || isTrialing) && (
        <div className="mt-6">
          <div className={`rounded-xl border-2 p-5 ${
            usage.credits.low_balance_warning
              ? 'border-amber-300 bg-amber-50'
              : 'border-border-color bg-card-bg'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${
                  usage.credits.low_balance_warning ? 'bg-amber-500' : 'bg-accent'
                } text-white`}>
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary">AI Credit Balance</span>
                  <span className="text-2xl font-extrabold text-text-primary">
                    {usage.credits.balance.toLocaleString()}
                  </span>
                  <span className="ml-1 text-sm text-text-secondary">credits</span>
                </div>
              </div>
              <div className="text-right text-xs text-text-secondary">
                <div>This month: <strong className="text-text-primary">{usage.credits.current_month_used.toLocaleString()}</strong>
                  {usage.credits.monthly_cap && <> / {usage.credits.monthly_cap.toLocaleString()}</>}
                </div>
                {usage.credits.expires_at && (
                  <div>Expires {new Date(usage.credits.expires_at).toLocaleDateString()}</div>
                )}
                <div>Lifetime granted: {usage.credits.lifetime_granted.toLocaleString()}</div>
              </div>
            </div>
            {usage.credits.low_balance_warning && (
              <div className="mt-3 flex items-start gap-2 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Your credits are running low. The AI will pause when you hit zero — top up or upgrade to avoid downtime.</span>
              </div>
            )}
            <div className="mt-3 flex items-center justify-end">
              <Link
                href="/settings/credits"
                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  usage.credits.low_balance_warning ? 'text-amber-700' : 'text-accent'
                } hover:underline`}
              >
                Buy more credits & view full history
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Usage summary */}
      {usage && (isActive || isTrialing) && (
        <div className="mt-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Monthly Usage ({usage.month})</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <UsageCard label="AI Messages" used={usage.ai_messages} limit={usage.ai_messages_limit} sublabel="Metered via credits" />
              <UsageCard label="Template Messages" used={usage.template_messages} limit={usage.template_messages_limit}
                sublabel={usage.template_messages_remaining >= 0 ? `${usage.template_messages_remaining} remaining` : undefined} showBar />
              <div className="rounded-lg border border-border-color bg-card-bg p-4">
                <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary">LLM Cost</span>
                <span className="mt-1 block text-lg font-bold text-text-primary">
                  {usage.llm_cost_inr < 1 ? `₹${usage.llm_cost_inr.toFixed(2)}` : `₹${Math.round(usage.llm_cost_inr).toLocaleString()}`}
                </span>
                <span className="text-xs text-text-secondary">${usage.llm_cost_usd.toFixed(4)} USD</span>
              </div>
            </div>
          </div>

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
          const accent = PLAN_ACCENT[plan.slug] || 'bg-accent';
          const price = billingPeriod === 'annual' ? plan.price_annual_inr : plan.price_monthly_inr;
          const monthlyEquivalent = billingPeriod === 'annual' ? Math.round(plan.price_annual_inr / 12) : plan.price_monthly_inr;
          const creditCount = billingPeriod === 'annual' ? plan.credits.annual_base : plan.credits.monthly_base;
          const canEnrollFounder = founderOpen && plan.founder_eligible && billingPeriod === 'annual';

          return (
            <div
              key={plan.slug}
              className={`relative flex flex-col rounded-xl border-2 p-5 transition-shadow ${
                isCurrent
                  ? 'border-accent bg-accent-soft ring-2 ring-accent shadow-lg'
                  : canEnrollFounder
                    ? 'border-amber-300 bg-card-bg hover:shadow-md'
                    : 'border-border-color bg-card-bg hover:shadow-md'
              }`}
            >
              {isCurrent && (
                <span className={`absolute -top-3 left-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase text-white ${
                  isTrialing ? 'bg-blue-600' : 'bg-accent'
                }`}>
                  {isTrialing ? 'Trial Active' : 'Current Plan'}
                </span>
              )}
              {!isCurrent && canEnrollFounder && (
                <span className="absolute -top-3 left-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase text-white bg-amber-500">
                  Founder Eligible
                </span>
              )}

              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-1.5 ${accent} text-white`}>
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-bold text-text-primary">{plan.name}</h3>
              </div>
              {plan.tagline && (
                <p className="mt-0.5 text-xs text-text-secondary">{plan.tagline}</p>
              )}

              <div className="mt-3">
                <span className="text-2xl font-extrabold text-text-primary">{rupees(price)}</span>
                <span className="text-sm text-text-secondary">/{billingPeriod === 'annual' ? 'year' : 'month'}</span>
                {billingPeriod === 'annual' && plan.price_monthly_inr > 0 && (
                  <div className="text-[11px] text-text-secondary">
                    ≈ {rupees(monthlyEquivalent)}/mo · save {rupees(plan.price_monthly_inr * 12 - plan.price_annual_inr)}
                  </div>
                )}
              </div>

              <ul className="mt-4 flex-1 space-y-1.5 text-xs text-text-secondary">
                <li className="flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-amber-500" />
                  <strong className="text-text-primary">{creditCount.toLocaleString()}</strong>
                  &nbsp;AI credits{billingPeriod === 'annual' ? '/year' : '/month'}
                </li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Agent: {plan.agent_type === 'full' ? 'Full AI' : 'Lite'}</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> {formatLimit(plan.limits.max_agents)} agents</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> {formatLimit(plan.limits.max_channels)} channels</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> {formatLimit(plan.limits.max_contacts)} contacts</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> {formatLimit(plan.limits.max_team_members)} team</li>
                <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> {formatLimit(plan.limits.max_datasheets)} datasheets</li>
                {plan.limits.max_wa_employees !== 0 && (
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> WA Employees: {formatLimit(plan.limits.max_wa_employees)}</li>
                )}
                {plan.limits.campaigns_per_month !== 0 && (
                  <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> {formatLimit(plan.limits.campaigns_per_month)} campaigns/mo</li>
                )}
              </ul>

              <div className="mt-4 space-y-2">
                {/* Founder enrollment — top priority */}
                {canEnrollFounder && (
                  <button
                    type="button"
                    onClick={() => handleEnrollFounder(plan.slug)}
                    disabled={enrollingFounder !== null}
                    className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 shadow-md"
                  >
                    {enrollingFounder === plan.slug ? (
                      <><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Reserving slot...</>
                    ) : (
                      <>🎁 Claim Founder Slot</>
                    )}
                  </button>
                )}

                {isCurrent && isActive ? (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel Plan'}
                  </button>
                ) : isCurrent && isTrialing ? (
                  <button
                    type="button"
                    onClick={() => handleSubscribe(plan.slug)}
                    disabled={subscribing !== null}
                    className={`w-full rounded-lg px-4 py-2 text-sm font-semibold text-white ${accent} hover:opacity-90 disabled:opacity-50`}
                  >
                    {subscribing === plan.slug ? (
                      <><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Processing...</>
                    ) : 'Subscribe now'}
                  </button>
                ) : (
                  <>
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
                        canEnrollFounder ? 'Pay Standard Price' : 'Subscribe'
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isActive && current?.current_period_end && (
        <p className="mt-6 text-center text-xs text-text-secondary">
          Current period ends: {new Date(current.current_period_end).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
