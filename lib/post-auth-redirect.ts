interface ResolvePostAuthRedirectInput {
  onboardingRequired: boolean;
  /** True if business is onboarded but no plan_slug in extra_data yet. */
  planSelectionRequired?: boolean;
  next?: string | null;
  /** When false, redirect non-owner to employee dashboard. */
  isOwner?: boolean;
}

function normalizePath(next?: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith('/')) return null;
  if (next.startsWith('//')) return null;
  return next;
}

export function resolvePostAuthRedirect({
  onboardingRequired,
  planSelectionRequired,
  next,
  isOwner,
}: ResolvePostAuthRedirectInput): string {
  // Onboarding is only for owners; employees (isOwner === false) never go there
  if (onboardingRequired && isOwner !== false) return '/onboarding';
  // Plan selection after onboarding but before dashboard
  if (planSelectionRequired && isOwner !== false) return '/plan-selection';
  const normalized = normalizePath(next);
  if (normalized) return normalized;
  if (!isOwner) return '/employee-dashboard';
  return '/home';
}
