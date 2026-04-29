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

    const hasAppId = typeof process.env.NEXT_PUBLIC_FACEBOOK_APP_ID === 'string' && process.env.NEXT_PUBLIC_FACEBOOK_APP_ID.trim().length > 0;

    if (typeof window === 'undefined' || !window.FB) {
      setError(
        hasAppId
          ? 'Facebook SDK not loaded yet. Refresh the page and try again.'
          : 'Facebook App ID is not configured. Add NEXT_PUBLIC_FACEBOOK_APP_ID to .env.local and restart the dev server.'
      );
      return;
    }

    if (!window.__fbReady) {
      setError('Facebook SDK is still initializing. Please wait a moment and try again.');
      return;
    }

    setLoading(true);

    // Safety timeout: if FB.login() never calls its callback (e.g. popup blocked
    // by browser), reset the loading state. 3 minutes to account for slow
    // backend processing (WABA fetch + webhook subscription).
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError(
        'The connection timed out. Please allow pop-ups for this site in your browser and try again.'
      );
    }, 180000);

    // Build login options based on channel type
    const isWhatsApp = channel === 'whatsapp';
    const whatsappConfigId = process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID?.trim();

    // WhatsApp uses Embedded Signup (config_id + code flow) so Meta registers the
    // phone number on the Cloud API automatically.
    // Instagram/Messenger use regular FB Login with scopes.
    const loginOptions: Record<string, unknown> = isWhatsApp && whatsappConfigId
      ? {
          config_id: whatsappConfigId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            version: 'v4',
            featureType: 'whatsapp_business_app_onboarding',
            sessionInfoVersion: '3',
          },
        }
      : { scope: getScope(channel) };

    try {
      window.FB.login((response) => {
        clearTimeout(timeoutId);
        (async () => {
          try {
            if (!response.authResponse) {
              setError('Login was cancelled or failed.');
              return;
            }

            const { accessToken, code } = response.authResponse;

            if (!accessToken && !code) {
              setError('No credentials received from Meta. Please try again.');
              return;
            }

            await apiFetch('/auth/facebook/exchange', {
              method: 'POST',
              body: JSON.stringify({
                accessToken: accessToken || null,
                code: code || null,
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
      }, loginOptions);
    } catch (err) {
      clearTimeout(timeoutId);
      setLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('init')) {
        setError('Meta login is not ready. Refresh the page and try again.');
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
