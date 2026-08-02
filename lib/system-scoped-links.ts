/**
 * Scoped core-module links — frontend adapter registry (capture side).
 *
 * Mirrors the backend `app/modules/system_builder/scoped_links.py`. Each adapter
 * knows how to look at the *current* page (its pathname + query) and decide
 * whether that view is pinnable to a System as a filtered/scoped shortcut. If it
 * is, `parse` returns a structured {descriptor, icon, autoLabel}; the descriptor
 * is what gets sent to the attach endpoint, and the backend rebuilds the href +
 * a live label from it at /nav render.
 *
 * `parse` returning null ⇒ the current view isn't pinnable ⇒ the Pin button hides
 * (no dumb unfiltered "scoped" links).
 */

import type { ScopeDescriptor } from '@/services/system-builder';

export interface ParsedScope {
  descriptor: ScopeDescriptor;
  /** Default lucide icon name for the pinned child. */
  icon: string;
  /** Fallback preview label (a page may pass a nicer `labelHint`). */
  autoLabel: string;
}

type Adapter = (pathname: string, q: URLSearchParams) => ParsedScope | null;

/* ── contacts ──────────────────────────────────────────────────────────────
   Fully URL-driven. We pin whatever recognised filter params are present; a
   bare /contacts with no filters is NOT pinnable (nothing to scope). */
const CONTACTS_PARAM_KEYS = [
  'group_id', 'tag_id', 'assigned_to_id', 'channel_id',
  'source', 'priority', 'routing_mode', 'engagement',
  'created_within', 'attention', 'search', 'sort_by', 'sort_dir',
  'custom_filters',
] as const;

const contactsAdapter: Adapter = (pathname, q) => {
  if (pathname !== '/contacts') return null;
  const params: Record<string, string> = {};
  for (const k of CONTACTS_PARAM_KEYS) {
    const v = q.get(k);
    if (v != null && v !== '') params[k] = v;
  }
  if (Object.keys(params).length === 0) return null; // unfiltered → not pinnable
  const entity_id = params.group_id ? Number(params.group_id) : undefined;
  return {
    descriptor: { module: 'contacts', entity_id, params },
    icon: 'Users',
    autoLabel: 'Contacts · Filtered',
  };
};

/* ── campaigns ─────────────────────────────────────────────────────────────
   The list isn't URL-driven, but a specific campaign/sequence is a deep-link:
   /campaigns/{id} or /campaigns/seq-{id}. */
const campaignsAdapter: Adapter = (pathname) => {
  const m = pathname.match(/^\/campaigns\/(seq-)?(\d+)$/);
  if (!m) return null;
  const kind = m[1] ? 'sequence' : 'campaign';
  return {
    descriptor: { module: 'campaigns', entity_id: Number(m[2]), params: { kind } },
    icon: 'Megaphone',
    autoLabel: kind === 'sequence' ? 'Sequence' : 'Campaign',
  };
};

/* ── processes (pipelines) ──────────────────────────────────────────────────
   /processes/{id}. */
const processesAdapter: Adapter = (pathname) => {
  const m = pathname.match(/^\/processes\/(\d+)$/);
  if (!m) return null;
  return {
    descriptor: { module: 'processes', entity_id: Number(m[1]), params: {} },
    icon: 'Workflow',
    autoLabel: 'Pipeline',
  };
};

/* ── inbox ──────────────────────────────────────────────────────────────────
   /inbox?agent=<name>&view=<saved-view-id>. Scope by agent and/or saved view. */
const inboxAdapter: Adapter = (pathname, q) => {
  if (pathname !== '/inbox' && !pathname.startsWith('/inbox')) return null;
  const params: Record<string, string> = {};
  const agent = q.get('agent');
  const view = q.get('view');
  if (agent) params.agent = agent;
  if (view && !Number.isNaN(Number(view))) params.view = view;
  if (Object.keys(params).length === 0) return null; // unscoped inbox → not pinnable
  return {
    descriptor: { module: 'inbox', params },
    icon: 'MessageSquare',
    autoLabel: params.agent ? `Inbox · ${params.agent}` : 'Inbox · Saved view',
  };
};

const ADAPTERS: Adapter[] = [
  contactsAdapter, campaignsAdapter, processesAdapter, inboxAdapter,
];

/** Decide whether the current page is pinnable; null ⇒ hide the Pin button. */
export function parseScope(pathname: string, q: URLSearchParams): ParsedScope | null {
  for (const adapter of ADAPTERS) {
    const hit = adapter(pathname, q);
    if (hit) return hit;
  }
  return null;
}
