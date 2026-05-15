import { apiFetch } from '@/lib/api-client';

export interface GmailStatus {
  connected: boolean;
  lastSyncAt: string | null;
  contactsSynced: number;
}

export interface GmailSyncResult {
  imported: number;
  skipped: number;
  totalFetched: number;
}

function getRedirectUri(): string {
  const base = (typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL) ?? 'http://localhost:3000';
  return `${base}/integrations/gmail/callback`;
}

export const gmailIntegrationService = {
  getStatus: async (): Promise<GmailStatus> => {
    const data = await apiFetch<{ connected: boolean; last_sync_at: string | null; contacts_synced: number }>(
      '/integrations/gmail/status'
    );
    return {
      connected: data.connected,
      lastSyncAt: data.last_sync_at,
      contactsSynced: data.contacts_synced,
    };
  },

  getAuthUrl: async (): Promise<{ authUrl: string; state: string }> => {
    const redirectUri = getRedirectUri();
    const data = await apiFetch<{ auth_url: string; state: string }>(
      `/integrations/gmail/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`
    );
    return { authUrl: data.auth_url, state: data.state };
  },

  handleCallback: async (code: string): Promise<void> => {
    await apiFetch('/integrations/gmail/callback', {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: getRedirectUri() }),
    });
  },

  sync: async (groupId?: number): Promise<GmailSyncResult> => {
    const url = groupId
      ? `/integrations/gmail/sync?group_id=${groupId}`
      : '/integrations/gmail/sync';
    const data = await apiFetch<{ imported: number; skipped: number; total_fetched: number }>(
      url,
      { method: 'POST' }
    );
    return {
      imported: data.imported,
      skipped: data.skipped,
      totalFetched: data.total_fetched,
    };
  },

  disconnect: async (): Promise<void> => {
    await apiFetch('/integrations/gmail', { method: 'DELETE' });
  },
};
