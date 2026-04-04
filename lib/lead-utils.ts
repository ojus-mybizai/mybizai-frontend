/**
 * Shared helpers and constants for lead-related components.
 */

import type { LeadActivity, LeadNote } from '@/services/customers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const NOTE_CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  preference: 'Preference',
  complaint: 'Complaint',
  'follow-up': 'Follow-up',
};

export const NOTE_CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  preference: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  complaint: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'follow-up': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

export const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-gray-400',
};

export const BASE_TABS: { id: string; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'followups', label: 'Follow-ups' },
  { id: 'work', label: 'Work' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function relativeTime(d: string | undefined | null): string {
  if (!d) return '\u2014';
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatLastActivity(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export function formatShortDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function capitalize(s: string | undefined | null): string {
  if (!s) return '\u2014';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function channelTypeLabel(channelType: string): string {
  if (channelType === 'whatsapp') return 'WhatsApp';
  if (channelType === 'instagram') return 'Instagram';
  if (channelType === 'messenger') return 'Messenger';
  return channelType;
}

// ---------------------------------------------------------------------------
// Timeline builder
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  id: string;
  type: 'activity' | 'note';
  date: string;
  icon: string;
  iconColor: string;
  title: string;
  description?: string;
  actor?: string | null;
  category?: string | null;
  noteId?: number;
  noteSource?: string;
}

export function buildTimeline(activities: LeadActivity[], notes: LeadNote[]): TimelineEntry[] {
  const items: TimelineEntry[] = [];

  for (const a of activities) {
    let icon = '~';
    let iconColor = 'bg-blue-500';
    if (a.activity_type === 'stage_change' || a.activity_type === 'status_change') {
      icon = '\u2191'; iconColor = 'bg-indigo-500';
    } else if (a.activity_type === 'assignment_change') {
      icon = '\u2192'; iconColor = 'bg-purple-500';
    } else if (a.activity_type === 'followup_sent') {
      icon = '\u2709'; iconColor = 'bg-teal-500';
    } else if (a.activity_type === 'message_received' || a.activity_type === 'message_sent') {
      icon = '\u25AC'; iconColor = 'bg-green-500';
    }
    items.push({
      id: `act-${a.id}`,
      type: 'activity',
      date: a.created_at ?? '',
      icon, iconColor,
      title: a.description ?? a.activity_type.replace(/_/g, ' '),
      actor: a.user_name,
    });
  }

  for (const n of notes) {
    items.push({
      id: `note-${n.id}`,
      type: 'note',
      date: n.created_at ?? '',
      icon: '\u270E',
      iconColor: 'bg-amber-500',
      title: 'Note added',
      description: n.content,
      actor: n.source === 'agent' ? 'AI Agent' : undefined,
      category: n.category,
      noteId: n.id,
      noteSource: n.source,
    });
  }

  items.sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return tb - ta;
  });
  return items;
}
