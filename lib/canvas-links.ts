/**
 * Canvas link resolver — turns a typed {@link LinkRef} into a real app URL.
 *
 * The AI emits only an entity + id (e.g. {entity:'datasheet', id:7, record_id:42}),
 * never a raw URL, so links can't be hallucinated and survive route changes — the
 * route shapes live HERE, in one place. Mirrors the backend LINK_ENTITIES set in
 * app/modules/business_agents/ui/blocks.py.
 */
import type { LinkRef } from '@/lib/agent-blocks';

/** Base route per entity. `id` (and `record_id` for datasheets) are appended. */
const ROUTES: Record<LinkRef['entity'], string> = {
  contact: '/contacts',
  process: '/processes',
  datasheet: '/data-sheet',
  conversation: '/inbox',
  agent: '/agents',
  work: '/work/process',
};

function withParams(path: string, params?: Record<string, unknown>, recordId?: string | number): string {
  const qs = new URLSearchParams();
  if (recordId != null) qs.set('record', String(recordId));
  if (params) for (const [k, v] of Object.entries(params)) if (v != null) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export function resolveLink(link: LinkRef): string {
  const base = ROUTES[link.entity];
  if (!base) return '/';
  // No id → land on the list/index page for that entity.
  if (link.id == null) return withParams(base, link.params);
  const path = `${base}/${encodeURIComponent(String(link.id))}`;
  // Datasheets address a row via ?record=; other entities ignore record_id.
  const recordId = link.entity === 'datasheet' ? link.record_id : undefined;
  return withParams(path, link.params, recordId);
}
