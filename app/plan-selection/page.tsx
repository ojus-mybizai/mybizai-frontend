'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crown, Zap, Building2, Rocket, Loader2, Sparkles } from 'lucide-react';
import AuthGuard from '@/components/auth-guard';
import { getPlans, startTrial, type Plan } from '@/services/billing';
import { useAuthStore } from '@/lib/auth-store';

const PLAN_ICONS: Record<string, typeof Zap> = {
  starter: Zap,
  growth: Rocket,
  pro: Crown,
  enterprise: Building2,
};

const PLAN_COLORS: Record<string, string> = {
  starter: 'border-blue-200 hover:border-blue-400',
  growth: 'border-emerald-200 hover:border-emerald-400 ring-2 ring-emerald-100',
  pro: 'border-purple-200 hover:border-purple-400',
  enterprise: 'border-amber-200 hover:border-amber-400',
};

const PLAN_BTN: Record<string, string> = {
  starter: 'bg-blue-600 hover:bg-blue-700',
  growth: 'bg-emerald-600 hover:bg-emerald-700',
  pro: 'bg-purple-600 hover:bg-purple-700',
  enterprise: 'bg-amber-600 hover:bg-amber-700',
};

function formatLimit(v: number): string {
  return v === -1 ? 'Unlimited' : String(v);
}

function PlanSelectionContent() {
  const router = useRouter();
  const setPlanSlug = useAuthStore((s) => s.setPlanSlug);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlans()
      .then((res) => setPlans(res.plans))
      .catch(() => setError('Failed to load plans'))
      .finally(() => setLoading(false));
  }, []);

  const handleStartTrial = async (slug: string) => {
    setStarting(slug);
    setError(null);
    try {
      await startTrial(slug);
      setPlanSlug(slug);
      router.replace('/home');
    } catch (err: any) {
      setError(err?.message || 'Failed to start trial');
      setStarting(null);
    }
  };

  const handleSkip = () => {
    // Skip = auto-start Starter trial
    void handleStartTrial('starter');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg-primary px-4 py-12">
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <Sparkles className="h-6 w-6 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
            Choose your plan
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-text-secondary">
            Start with a <strong>7-day free trial</strong> on any plan. No payment required.
            You can change or cancel anytime.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const Icon = PLAN_ICONS[plan.slug] || Zap;
            const borderColor = PLAN_COLORS[plan.slug] || 'border-border-color';
            const btnColor = PLAN_BTN[plan.slug] || 'bg-accent';
            const isPopular = plan.slug === 'growth';

            return (
              <div
                key={plan.slug}
                className={`relative flex flex-col rounded-2xl border-2 bg-card-bg p-5 transition-all ${borderColor}`}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-[10px] font-bold uppercase text-white">
                    Most Popular
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-text-primary" />
                  <h3 className="text-lg font-bold text-text-primary">{plan.name}</h3>
                </div>

                <div className="mt-3">
                  <span className="text-2xl font-extrabold text-text-primary">
                    Rs {plan.price_inr.toLocaleString()}
                  </span>
                  <span className="text-sm text-text-secondary">/mo</span>
                </div>

                <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                  {plan.description}
                </p>

                <ul className="mt-4 flex-1 space-y-2 text-xs text-text-secondary">
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    AI messages: <strong className="text-text-primary">Unlimited</strong>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {plan.agent_type === 'full'
                      ? 'Full AI: search, orders, media'
                      : 'Lite AI: auto-reply + qualify'}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {formatLimit(plan.limits.max_agents)} agent{plan.limits.max_agents !== 1 ? 's' : ''}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {formatLimit(plan.limits.max_channels)} channel{plan.limits.max_channels !== 1 ? 's' : ''}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {formatLimit(plan.limits.template_messages_per_month)} templates/mo
                  </li>
                </ul>

                <button
                  type="button"
                  onClick={() => handleStartTrial(plan.slug)}
                  disabled={starting !== null}
                  className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${btnColor}`}
                >
                  {starting === plan.slug ? (
                    <><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" /> Starting...</>
                  ) : (
                    'Start 7-day free trial'
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Skip link */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={handleSkip}
            disabled={starting !== null}
            className="text-sm text-text-secondary underline hover:text-text-primary disabled:opacity-50"
          >
            Skip for now (starts on Starter plan)
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlanSelectionPage() {
  return (
    <AuthGuard>
      <PlanSelectionContent />
    </AuthGuard>
  );
}
