'use client';

/**
 * Resolve a datasheet attachment id → a fresh signed image URL, on demand.
 *
 * The canvas stores only a stable `attachment_id` (never a signed URL, which
 * would expire in a saved canvas). We fetch the URL via apiFetch (auth'd) the
 * first time it's needed and cache it for the page's lifetime; the returned S3
 * URL is signature-self-authenticating, so the browser can load it directly in
 * an <img>. A fresh page load re-resolves, so saved canvases never go stale.
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

const cache = new Map<number, string>();
const inflight = new Map<number, Promise<string>>();

function fetchUrl(id: number): Promise<string> {
  let p = inflight.get(id);
  if (!p) {
    p = apiFetch<{ url: string }>(`/dynamic-data/attachments/${id}/url`, { method: 'GET' })
      .then((r) => {
        cache.set(id, r.url);
        inflight.delete(id);
        return r.url;
      })
      .catch((e) => {
        inflight.delete(id);
        throw e;
      });
    inflight.set(id, p);
  }
  return p;
}

export function useAttachmentUrl(attachmentId?: number): string | null {
  const [url, setUrl] = useState<string | null>(
    () => (attachmentId != null ? cache.get(attachmentId) ?? null : null),
  );

  useEffect(() => {
    if (attachmentId == null) {
      setUrl(null);
      return;
    }
    const cached = cache.get(attachmentId);
    if (cached) {
      setUrl(cached);
      return;
    }
    let active = true;
    fetchUrl(attachmentId)
      .then((u) => active && setUrl(u))
      .catch(() => active && setUrl(null));
    return () => {
      active = false;
    };
  }, [attachmentId]);

  return url;
}
