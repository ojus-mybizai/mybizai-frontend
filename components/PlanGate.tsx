'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { getCurrentPlan } from '@/services/billing';

interface PlanGateProps {
  /** Plan slugs that have access to this feature */
  allowedPlans?: string[];
  /** Alternatively, check a specific feature key from plan_config.features */
  feature?: string;
  /** Explicitly pass the current plan slug to avoid an API call */
  currentPlan?: string;
  /** What to show when the plan doesn't have access */
  fallback?: ReactNode;
  /** Content to render when access is granted */
  children: ReactNode;
}

/**
 * Gate content behind a plan check.
 *
 * Usage:
 *   <PlanGate allowedPlans={['growth', 'pro', 'enterprise']}>
 *     <CreateOrderButton />
 *   </PlanGate>
 *
 *   <PlanGate feature="search_products">
 *     <ProductSearchPanel />
 *   </PlanGate>
 */
export function PlanGate({ allowedPlans, feature, currentPlan: currentPlanProp, fallback, children }: PlanGateProps) {
  const { planSlug: storePlan, planLoaded, setPlanSlug: setStorePlan } = useAuthStore((s) => ({
    planSlug: s.planSlug,
    planLoaded: s.planLoaded,
    setPlanSlug: s.setPlanSlug,
  }));

  const planSlug = currentPlanProp || storePlan || 'starter';

  // Fetch once if not already cached in the store
  useEffect(() => {
    if (currentPlanProp || planLoaded) return;
    getCurrentPlan()
      .then((p) => setStorePlan(p.plan_slug || 'starter'))
      .catch(() => setStorePlan('growth')); // fail open
  }, [currentPlanProp, planLoaded, setStorePlan]);

  // Check by allowed plan slugs
  if (allowedPlans && allowedPlans.length > 0) {
    if (!allowedPlans.includes(planSlug)) {
      return <>{fallback ?? <UpgradePrompt currentPlan={planSlug} />}</>;
    }
  }

  // Check by feature key (from plan_config.features)
  // This is a client-side approximation — the backend enforces the real limit
  if (feature) {
    const PLAN_FEATURES: Record<string, Record<string, boolean>> = {
      starter: { search_products: false, create_orders: false, send_media: false, automation_rules: false },
      growth: { search_products: true, create_orders: true, send_media: true, automation_rules: true },
      pro: { search_products: true, create_orders: true, send_media: true, automation_rules: true },
      enterprise: { search_products: true, create_orders: true, send_media: true, automation_rules: true },
    };
    const features = PLAN_FEATURES[planSlug] || PLAN_FEATURES.starter;
    if (!features[feature]) {
      return <>{fallback ?? <UpgradePrompt currentPlan={planSlug} />}</>;
    }
  }

  return <>{children}</>;
}

function UpgradePrompt({ currentPlan }: { currentPlan: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <Lock className="h-4 w-4 flex-none" />
      <span>
        This feature requires a higher plan.{' '}
        <Link href="/settings/billing" className="font-semibold underline hover:text-amber-900">
          Upgrade from {currentPlan}
        </Link>
      </span>
    </div>
  );
}
