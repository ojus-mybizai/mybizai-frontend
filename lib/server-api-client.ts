import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';

// Server-only base URL: prefer internal API_URL, fallback to public
const API_BASE_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:8000/api/v1';

// ---------------------------------------------------------------------------
// Auth session type (mirrors auth-store fields)
// ---------------------------------------------------------------------------
export interface AuthSession {
  accessToken: string;
  user: Record<string, unknown> | null;
  onboardingRequired: boolean;
  defaultBusinessId: number | null;
  defaultRole: 'owner' | 'manager' | 'executive' | null;
  hasActiveBusinessAccess: boolean;
  isOwner: boolean;
  permissionKeys: string[];
}

// ---------------------------------------------------------------------------
// getAuthSession — cached per-request, deduped via React.cache()
// ---------------------------------------------------------------------------
export const getAuthSession = cache(async (): Promise<AuthSession | null> => {
  const cookieStore = await cookies();
  const refreshCookie = cookieStore.get('refresh_token');

  if (!refreshCookie?.value) {
    return null;
  }

  try {
    // Call /auth/refresh forwarding the refresh_token cookie
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${refreshCookie.value}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Record<string, unknown>;

    const accessToken =
      (typeof payload.access_token === 'string' && payload.access_token) ||
      (typeof payload.accessToken === 'string' && payload.accessToken) ||
      null;

    if (!accessToken) {
      return null;
    }

    const user =
      payload.user && typeof payload.user === 'object'
        ? (payload.user as Record<string, unknown>)
        : null;

    const onboardingRequired =
      (payload.onboarding_required as boolean | undefined) ??
      (payload.onboardingRequired as boolean | undefined) ??
      false;

    const defaultBusinessId =
      (payload.default_business_id as number | null | undefined) ??
      (payload.defaultBusinessId as number | null | undefined) ??
      null;

    const defaultRole =
      (payload.default_role as 'owner' | 'manager' | 'executive' | null | undefined) ??
      (payload.defaultRole as 'owner' | 'manager' | 'executive' | null | undefined) ??
      null;

    const hasActiveBusinessAccess =
      (payload.has_active_business_access as boolean | undefined) ??
      (payload.hasActiveBusinessAccess as boolean | undefined) ??
      true;

    const isOwner =
      (payload.is_owner as boolean | undefined) ??
      (payload.isOwner as boolean | undefined) ??
      false;

    const permissionKeys = Array.isArray(payload.permission_keys)
      ? (payload.permission_keys as string[])
      : Array.isArray((payload as { permissionKeys?: string[] }).permissionKeys)
        ? (payload as { permissionKeys: string[] }).permissionKeys
        : [];

    return {
      accessToken,
      user,
      onboardingRequired: Boolean(onboardingRequired),
      defaultBusinessId: typeof defaultBusinessId === 'number' ? defaultBusinessId : null,
      defaultRole,
      hasActiveBusinessAccess: Boolean(hasActiveBusinessAccess),
      isOwner: Boolean(isOwner),
      permissionKeys,
    };
  } catch {
    return null;
  }
});

// ---------------------------------------------------------------------------
// serverApiFetch — authenticated server-side API calls
// ---------------------------------------------------------------------------
export async function serverApiFetch<T>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T | null> {
  const session = await getAuthSession();
  if (!session) return null;

  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}
