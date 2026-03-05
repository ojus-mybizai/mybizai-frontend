'use client';

import { ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { apiFetch, API_BASE_URL } from '@/lib/api-client';
import { subscribeAuthEvents } from '@/lib/auth-events';

interface Props {
  children: ReactNode;
}

export default function AuthBootstrap({ children }: Props) {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const setOnboardingRequired = useAuthStore((s) => s.setOnboardingRequired);
  const setDefaultBusinessId = useAuthStore((s) => s.setDefaultBusinessId);
  const setDefaultRole = useAuthStore((s) => s.setDefaultRole);
  const setHasActiveBusinessAccess = useAuthStore((s) => s.setHasActiveBusinessAccess);
  const setPermissionKeys = useAuthStore((s) => s.setPermissionKeys);
  const setIsOwner = useAuthStore((s) => s.setIsOwner);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const setInitialized = useAuthStore((s) => s.setInitialized);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (isInitialized) return;

    let isMounted = true;

    async function init() {
      try {
        // Restore access token from sessionStorage if store has none (e.g. after full page reload)
        if (typeof window !== 'undefined') {
          try {
            const stored = sessionStorage.getItem('access_token');
            if (stored && !useAuthStore.getState().accessToken) {
              setAccessToken(stored);
            }
          } catch {
            // ignore
          }
        }

        const current = useAuthStore.getState();
        if (!current.accessToken) {
          try {
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const data = await response.json();
              const payload = data as Record<string, unknown>;
              const accessToken =
                (typeof payload.access_token === 'string' && payload.access_token) ||
                (typeof payload.accessToken === 'string' && payload.accessToken) ||
                null;
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
                (payload.is_owner as boolean | undefined) ?? (payload.isOwner as boolean | undefined) ?? false;
              const permissionKeys = Array.isArray(payload.permission_keys)
                ? (payload.permission_keys as string[])
                : Array.isArray((payload as { permissionKeys?: string[] }).permissionKeys)
                  ? ((payload as { permissionKeys: string[] }).permissionKeys)
                  : [];

              if (isMounted) {
                setAccessToken(accessToken);
                setUser(user);
                setOnboardingRequired(Boolean(onboardingRequired));
                setDefaultBusinessId(
                  typeof defaultBusinessId === 'number' ? defaultBusinessId : null,
                );
                setDefaultRole(defaultRole);
                setHasActiveBusinessAccess(Boolean(hasActiveBusinessAccess));
                setIsOwner(Boolean(isOwner));
                setPermissionKeys(permissionKeys);
              }
            }
          } catch {
            // ignore, user stays logged out
          }
        }

        const withToken = useAuthStore.getState();
        if (withToken.accessToken) {
          try {
            const me = await apiFetch<Record<string, unknown>>('/auth/users/me', { method: 'GET' });
            if (isMounted && me && typeof me === 'object') {
              setUser(me);
              const businesses = me.businesses as Array<{ id?: number; is_owner?: boolean; permission_keys?: string[] }> | undefined;
              const defaultId = withToken.defaultBusinessId;
              const currentBusiness =
                Array.isArray(businesses) && businesses.length > 0
                  ? (defaultId != null ? businesses.find((b) => b.id === defaultId) : null) ?? businesses[0]
                  : null;
              if (currentBusiness) {
                setIsOwner(Boolean(currentBusiness.is_owner));
                setPermissionKeys(Array.isArray(currentBusiness.permission_keys) ? currentBusiness.permission_keys : []);
              }
            }
          } catch {
            // ignore errors from /auth/users/me
          }
        }
      } finally {
        if (isMounted) {
          setInitialized(true);
        }
      }
    }

    init();

    const unsubscribe = subscribeAuthEvents((event) => {
      if (event.type === 'logout') {
        logout(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [
    isInitialized,
    setAccessToken,
    setUser,
    setOnboardingRequired,
    setDefaultBusinessId,
    setDefaultRole,
    setHasActiveBusinessAccess,
    setPermissionKeys,
    setIsOwner,
    setInitialized,
    logout,
  ]);

  return <>{children}</>;
}
