/**
 * Shared types, constants, and helpers for the inbox ContactRail.
 *
 * Kept TypeScript-only (no JSX) so both contact-rail.tsx (shell) and
 * contact-rail-views.tsx (view bodies) can import without circular deps.
 */

import { apiFetch } from '@/lib/api-client';
import type { LucideIcon } from 'lucide-react';
import type {
  Contact as ContactV2,
  Priority,
  RoutingMode,
} from '@/services/contacts-v2';
import type { AgentSummary } from '@/services/conversations';
import type { ConversationAnalyticsResponse } from '@/services/analytics';
import type { ConversationSession, InboxConversation } from '@/services/customers';

/* ─── View routing ────────────────────────────────────────────────── */

export type RailView =
  | 'summary'
  | 'notes'
  | 'compose-note'
  | 'followups'
  | 'compose-followup'
  | 'pipeline'
  | 'activity'
  | 'conversations'
  | 'insights'
  | 'data'
  | 'edit-routing';

/** Where the back arrow takes you from a given sub-view. */
export function getBackView(current: RailView): RailView {
  if (current === 'compose-note') return 'notes';
  if (current === 'compose-followup') return 'followups';
  return 'summary';
}

/* ─── Common view props ───────────────────────────────────────────── */

export interface ViewProps {
  contact: ContactV2;
  setContact: (next: ContactV2) => void;
  view: RailView;
  setView: (next: RailView) => void;
  agents: AgentSummary[];
  conversations: InboxConversation[];
  conversationId?: string | null;
  conversationAnalytics?: ConversationAnalyticsResponse | null;
  sessions?: ConversationSession[];
  onOpenConversation?: (id: string) => void;
}

/* ─── Follow-up types & API (legacy endpoint, kept stable) ────────── */

export interface ContactFollowUp {
  id: number;
  contact_id?: number | null;
  status: string;
  delivery_mode: string;
  scheduled_at: string;
  sent_at?: string | null;
  message_text: string;
  channel_type?: string | null;
}

export async function fetchFollowUps(contactId: number): Promise<ContactFollowUp[]> {
  const res = await apiFetch<{ items: ContactFollowUp[] }>(`/contacts/${contactId}/followups`);
  return res.items ?? [];
}

export async function createFollowUp(
  contactId: number,
  payload: { message_text: string; scheduled_at: string; delivery_mode?: string; channel_type?: string },
): Promise<ContactFollowUp> {
  return apiFetch<ContactFollowUp>(`/contacts/${contactId}/followups`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/* ─── Visual constants ────────────────────────────────────────────── */

/** Shared focus reset — suppress click-stuck ring, keyboard-only ring. */
export const BTN =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-card-bg';

export const PRIORITY_META: Record<Priority, { label: string; pill: string; ring: string; dot: string }> = {
  hot:    { label: 'Hot',    pill: 'bg-red-500/12 text-red-600 dark:text-red-300 border-red-500/30',          ring: 'ring-red-500',    dot: 'bg-red-500' },
  high:   { label: 'High',   pill: 'bg-orange-500/12 text-orange-600 dark:text-orange-300 border-orange-500/30', ring: 'ring-orange-500', dot: 'bg-orange-500' },
  medium: { label: 'Medium', pill: 'bg-blue-500/12 text-blue-600 dark:text-blue-300 border-blue-500/30',      ring: 'ring-blue-400',   dot: 'bg-blue-400' },
  low:    { label: 'Low',    pill: 'bg-bg-secondary text-text-secondary border-border-color',                 ring: 'ring-gray-300',   dot: 'bg-gray-300' },
};

export const ROUTING_META: Record<RoutingMode, { label: string; pill: string; iconName: 'Bot' | 'UserCheck' | 'UserX' }> = {
  ai:      { label: 'AI',      pill: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', iconName: 'Bot' },
  manual:  { label: 'Manual',  pill: 'bg-amber-500/12  text-amber-700  dark:text-amber-300  border-amber-500/30',  iconName: 'UserCheck' },
  blocked: { label: 'Blocked', pill: 'bg-red-500/12    text-red-600    dark:text-red-300    border-red-500/30',   iconName: 'UserX' },
};

export const CHANNEL_EMOJI: Record<string, string> = {
  whatsapp: '📱', instagram: '📸', messenger: '💬', telegram: '✈️', webchat: '🌐',
};

export const ACTIVITY_EMOJI: Record<string, string> = {
  note_added: '📝', stage_changed: '🔀', pipeline_added: '➕', pipeline_removed: '➖',
  pipeline_advanced: '⏩', call_logged: '📞', email_sent: '📧', contact_created: '👤',
  message_received: '💬', message_sent: '✉️',
};

export const NOTE_CATEGORIES = ['general', 'preference', 'complaint', 'follow-up'] as const;
export type NoteCategoryStr = typeof NOTE_CATEGORIES[number];

/* ─── Formatting helpers ──────────────────────────────────────────── */

export function getInitials(name: string | null | undefined, fallback: string): string {
  if (!name?.trim()) return fallback.charAt(0).toUpperCase() || '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
}

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/** Compact currency (₹). */
export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString()}`;
}

/* ─── Re-exports — convenience for view files ─────────────────────── */
export type { ContactV2, Priority, RoutingMode, LucideIcon, AgentSummary };
