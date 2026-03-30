'use client';

import { useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import type { AuthSession } from '@/lib/server-api-client';

/**
 * Bridges server-fetched auth data into the client-side Zustand store.
 *
 * Runs synchronously during the initial render (before any useEffect),
 * which prevents AuthBootstrap from re-fetching because it checks
 * `isInitialized` at the top of its effect.
 *
 * Renders nothing — purely a side-effect component.
 */
export default function AuthHydration(props: AuthSession) {
  const hydrated = useRef(false);

  if (!hydrated.current) {
    hydrated.current = true;

    const store = useAuthStore.getState();

    // Only hydrate if the store hasn't been initialized yet
    if (!store.isInitialized) {
      store.setAccessToken(props.accessToken);
      store.setUser(props.user);
      store.setOnboardingRequired(props.onboardingRequired);
      store.setDefaultBusinessId(props.defaultBusinessId);
      store.setDefaultRole(props.defaultRole);
      store.setHasActiveBusinessAccess(props.hasActiveBusinessAccess);
      store.setIsOwner(props.isOwner);
      store.setPermissionKeys(props.permissionKeys);
      store.setInitialized(true);
    }
  }

  return null;
}
