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
  }
}

const GRAPH_API_VERSION = 'v18.0';

export function FacebookSDKLoader() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.FB) {
      return;
    }

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
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
          xfbml: true,
          version: GRAPH_API_VERSION,
        });
      } catch (e) {
        console.warn('[FacebookSDK] init failed:', e);
      }
    };

    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=${GRAPH_API_VERSION}`;
    document.body.appendChild(script);
  }, []);

  return null;
}

export default FacebookSDKLoader;

