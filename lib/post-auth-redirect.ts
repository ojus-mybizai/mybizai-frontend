import type { DefaultRole } from '@/lib/auth-store';

interface ResolvePostAuthRedirectInput {
  onboardingRequired: boolean;
  next?: string | null;
  defaultRole?: DefaultRole;
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
  defaultRole,
}: ResolvePostAuthRedirectInput): string {
  if (onboardingRequired) return '/onboarding';
  const normalized = normalizePath(next);
  if (normalized) return normalized;
  if (defaultRole === 'manager' || defaultRole === 'executive') return '/work';
  return '/dashboard';
}
