'use client';

import Script from 'next/script';

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
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID?.trim();
  if (!appId) return null;

  return (
    <>
      <div id="fb-root" />
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="lazyOnload"
        crossOrigin="anonymous"
        onLoad={() => {
          if (!window.FB || window.__fbReady) return;
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
        }}
      />
    </>
  );
}

export default FacebookSDKLoader;
