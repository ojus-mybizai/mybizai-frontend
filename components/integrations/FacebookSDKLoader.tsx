'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    FB?: {
      init: (config: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
      login: (
        cb: (response: { authResponse?: { accessToken: string } | null }) => void,
        opts: { scope: string }
      ) => void;
    };
    fbAsyncInit?: () => void;
    __fbReady?: boolean;
  }
}

const GRAPH_API_VERSION = 'v18.0';

export function FacebookSDKLoader() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // If already initialized, nothing to do
    if (window.__fbReady) {
      return;
    }

    // If SDK script already loaded but init not yet done, just wait — fbAsyncInit will fire
    if (window.FB && !window.__fbReady) {
      return;
    }

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID?.trim();
    if (!appId) {
      return;
    }

    // SDK expects #fb-root; create it if missing
    if (!document.getElementById('fb-root')) {
      const root = document.createElement('div');
      root.id = 'fb-root';
      document.body.insertBefore(root, document.body.firstChild);
    }

    // Official pattern: define fbAsyncInit BEFORE loading the script.
    // The SDK calls fbAsyncInit when it's ready; only then is window.FB available and init valid.
    window.fbAsyncInit = function () {
      if (!window.FB) return;
      try {
        window.FB.init({
          appId,
          cookie: true,
          xfbml: false,
          version: GRAPH_API_VERSION,
        });
        window.__fbReady = true;
      } catch (e) {
        console.warn('[FacebookSDK] init failed:', e);
      }
    };

    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    // Load SDK without hash params — fbAsyncInit handles all initialization
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    document.body.appendChild(script);
  }, []);

  return null;
}

export default FacebookSDKLoader;

