'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { MetaChannelType } from '@/services/channels';

interface MetaConnectButtonProps {
  channel: MetaChannelType;
  onConnected?: () => void;
}

function getScope(channel: MetaChannelType): string {
  switch (channel) {
    case 'instagram':
      return 'pages_show_list,pages_manage_metadata,instagram_basic,instagram_manage_messages,pages_messaging';
    case 'messenger':
      return 'pages_show_list,pages_manage_metadata,pages_messaging';
    case 'whatsapp':
    default:
      return 'whatsapp_business_management,whatsapp_business_messaging,business_management';
  }
}

export function MetaConnectButton({ channel, onConnected }: MetaConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);

    if (typeof window === 'undefined' || !window.FB) {
      const hasAppId = typeof process.env.NEXT_PUBLIC_FACEBOOK_APP_ID === 'string' && process.env.NEXT_PUBLIC_FACEBOOK_APP_ID.length > 0;
      setError(
        hasAppId
          ? 'Facebook SDK not loaded yet. Refresh the page and try again.'
          : 'Facebook SDK not available. Add NEXT_PUBLIC_FACEBOOK_APP_ID to .env.local and restart the dev server.'
      );
      return;
    }

    setLoading(true);

    try {
      window.FB.login((response) => {
        (async () => {
          try {
            if (!response.authResponse) {
              setError('Login was cancelled or failed.');
              return;
            }

            const accessToken = response.authResponse.accessToken;

            await apiFetch('/auth/facebook/exchange', {
              method: 'POST',
              body: JSON.stringify({
                accessToken,
                state: { channel },
              }),
            });

            if (onConnected) {
              onConnected();
            }
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'Something went wrong while connecting the channel.';
            setError(message);
          } finally {
            setLoading(false);
          }
        })();
      }, { scope: getScope(channel) });
    } catch (err) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('init') && msg.includes('version')) {
        setError('Meta login is not ready. Refresh the page and try again, or check that NEXT_PUBLIC_FACEBOOK_APP_ID is set.');
      } else {
        setError(msg || 'Failed to open Meta login.');
      }
    }
  };

  const label = `Connect ${channel.charAt(0).toUpperCase()}${channel.slice(1)}`;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {loading ? `Connecting ${channel}…` : label}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export default MetaConnectButton;

