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
  }
}

// Use a Facebook Graph API version that is known to be supported by the JS SDK.
// Backend HTTP calls can use a different version; the SDK only needs any valid one.
const GRAPH_API_VERSION = 'v19.0';

export function FacebookSDKLoader() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.FB) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      if (!window.FB) return;
      const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
      if (!appId) {
        // Fail silently in UI; configuration will be handled by ops.
        return;
      }
      window.FB.init({
        appId,
        cookie: true,
        xfbml: true,
        version: GRAPH_API_VERSION,
      });
    };

    document.body.appendChild(script);

    // No cleanup needed; SDK is singleton on the page.
  }, []);

  return null;
}

export default FacebookSDKLoader;

