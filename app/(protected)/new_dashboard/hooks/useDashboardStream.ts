'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';

/**
 * Subscribes to `/api/v1/widgets/stream` (SSE) and invokes `onTick` whenever
 * the backend signals a dashboard state change. Falls back silently if EventSource
 * isn't supported or the connection fails.
 *
 * The SSE endpoint requires auth via Bearer token. Native EventSource cannot
 * set headers, so we use fetch + streaming when a token is needed.
 */
export function useDashboardStream(onTick: () => void) {
  const token = useAuthStore((s) => s.accessToken);
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    let cancelled = false;

    async function connect() {
      try {
        const res = await fetch('/api/v1/widgets/stream', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // SSE events are separated by blank lines
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            if (chunk.includes('event: tick')) {
              tickRef.current();
            }
          }
        }
      } catch {
        // network error / abort — silent
      }
    }
    connect();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token]);
}
