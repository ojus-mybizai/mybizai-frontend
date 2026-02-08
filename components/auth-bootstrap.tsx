'use client';

import { ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { apiFetch } from '@/lib/api-client';
import { subscribeAuthEvents } from '@/lib/auth-events';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

interface Props {
  children: ReactNode;
}

export default function AuthBootstrap({ children }: Props) {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const setOnboardingRequired = useAuthStore((s) => s.setOnboardingRequired);
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
              const accessToken = (data as any).access_token || (data as any).accessToken || null;
              const user = (data as any).user ?? null;
              const onboardingRequired =
                (data as any).onboarding_required ?? (data as any).onboardingRequired ?? false;

              if (isMounted) {
                setAccessToken(accessToken);
                setUser(user);
                setOnboardingRequired(Boolean(onboardingRequired));
              }
            }
          } catch {
            // ignore, user stays logged out
          }
        }

        const withToken = useAuthStore.getState();
        if (withToken.accessToken) {
          try {
            const me = await apiFetch('/auth/users/me', { method: 'GET' });
            if (isMounted) {
              setUser(me as any);
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
  }, [isInitialized, setAccessToken, setUser, setOnboardingRequired, setInitialized, logout]);

  return <>{children}</>;
}
