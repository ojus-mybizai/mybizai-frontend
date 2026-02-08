import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { broadcastAuthEvent } from '@/lib/auth-events';

export async function performLogout() {
  try {
    await apiFetch('/auth/logout', {
      method: 'POST',
      auth: true,
    });
  } catch {
    // ignore logout errors
  }

  const { logout } = useAuthStore.getState();
  logout();

  if (typeof document !== 'undefined') {
    try {
      document.cookie = 'refresh_token=; Max-Age=0; path=/;';
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined') {
    broadcastAuthEvent('logout');
  }
}
