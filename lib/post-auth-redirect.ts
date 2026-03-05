interface ResolvePostAuthRedirectInput {
  onboardingRequired: boolean;
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
  next,
  isOwner,
}: ResolvePostAuthRedirectInput): string {
  // Onboarding is only for owners; employees (isOwner === false) never go there
  if (onboardingRequired && isOwner !== false) return '/onboarding';
  const normalized = normalizePath(next);
  if (normalized) return normalized;
  if (!isOwner) return '/employee-dashboard';
  return '/dashboard';
}
