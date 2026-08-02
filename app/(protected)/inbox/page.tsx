'use client';

import { FormEvent, KeyboardEvent, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, Search, RefreshCw, ArrowLeft, ExternalLink, MessageCircle, Bot, ChevronDown, BookmarkCheck, SlidersHorizontal, X, Send, Lock, MessageSquarePlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime as fmtDateTime, formatDayMonth as fmtDayMonth } from '@/lib/format-date';
import { AIStatusBadge } from '@/components/customers/ai-status-badge';
import { MessageBubble } from '@/components/customers/message-bubble';
import { ConversationRowSkeleton } from '@/components/conversations/ConversationRowSkeleton';
import { TemplatePickerModal } from '@/components/conversations/TemplatePickerModal';
import { SavedViewsPanel } from '@/components/conversations/SavedViewsPanel';
import PinToSystemButton from '@/components/system-builder/PinToSystemButton';
import type { ParsedScope } from '@/lib/system-scoped-links';
import { NewConversationModal } from '@/components/conversations/NewConversationModal';
import { ContactRail, ContactRailOverlay } from '@/components/inbox/contact-rail';
import { useUIStore } from '@/lib/ui-store';
import {
  listAllConversations,
  listMessages,
  listConversationSessions,
  appendMessage,
  toggleConversationStatus,
  type InboxConversation,
  type Message,
  type ConversationSession,
  type ConversationListFilters,
} from '@/services/customers';
import { getConversationAnalytics, type ConversationAnalyticsResponse } from '@/services/analytics';
import { switchConversationAgent, listAgentsForBusiness, type AgentSummary } from '@/services/conversations';
import {
  listConversationViews,
  createConversationView,
  updateConversationView,
  deleteConversationView,
  type ConversationSavedView,
  type ConversationSavedViewCreate,
  type ConversationSavedViewUpdate,
} from '@/services/conversationViews';
import { contactGroupsService, type ContactGroup } from '@/services/contactGroups';
import { listChannels, type Channel as BusinessChannel } from '@/services/channels';
import { listConversationTopics, type ConversationTopic } from '@/services/conversationTopics';
import { useDebounce } from '@/lib/use-debounce';
import { contactTagService, type ContactTag, type CustomFilter } from '@/services/contacts-v2';
import { listSourceDefs, type ContactSourceDef } from '@/services/contact-source-defs';
import { listFieldDefs, type ContactFieldDef } from '@/services/contact-field-defs';

function formatTime(dateStr: string | undefined): string {
  return fmtDateTime(dateStr);
}

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return fmtDayMonth(d);
}

/**
 * Format remaining time in the WhatsApp 24h customer-service window.
 * Returns e.g. "23h 14m", "47m", "<1m", or null if the window is closed.
 */
function formatSessionRemaining(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return '<1m';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getInitials(name: string | undefined, fallback: string): string {
  if (!name || !name.trim()) return fallback.charAt(0).toUpperCase();
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  return name.charAt(0).toUpperCase();
}

// ── Channel brand icons ──────────────────────────────────────────

function ChannelIcon({ type, size = 16 }: { type?: string; size?: number }) {
  const s = String(size);
  switch (type?.toLowerCase()) {
    case 'whatsapp':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className="shrink-0">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#25D366"/>
          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.106-1.138l-.294-.176-2.868.852.852-2.868-.176-.294A7.96 7.96 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" fill="#25D366"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className="shrink-0">
          <defs>
            <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFDC80"/>
              <stop offset="25%" stopColor="#F77737"/>
              <stop offset="50%" stopColor="#E1306C"/>
              <stop offset="75%" stopColor="#C13584"/>
              <stop offset="100%" stopColor="#833AB4"/>
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad)" strokeWidth="2" fill="none"/>
          <circle cx="12" cy="12" r="4.5" stroke="url(#ig-grad)" strokeWidth="2" fill="none"/>
          <circle cx="17.5" cy="6.5" r="1.25" fill="url(#ig-grad)"/>
        </svg>
      );
    case 'messenger':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className="shrink-0">
          <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.2 5.42 3.15 7.18.16.15.26.36.27.58l.05 1.82c.02.64.68 1.06 1.27.8l2.03-.9c.17-.08.37-.09.55-.05.94.26 1.94.4 2.98.4h.3c5.34-.22 9.4-4.24 9.4-9.53C22 6.13 17.64 2 12 2z" fill="#0084FF"/>
          <path d="M6.53 14.42l2.69-4.27a1.5 1.5 0 012.17-.4l2.14 1.6a.6.6 0 00.72 0l2.89-2.2c.39-.29.89.18.63.6l-2.69 4.27a1.5 1.5 0 01-2.17.4l-2.14-1.6a.6.6 0 00-.72 0l-2.89 2.2c-.39.29-.89-.18-.63-.6z" fill="white"/>
        </svg>
      );
    default:
      return <MessageCircle className="h-4 w-4 shrink-0 text-text-secondary" />;
  }
}

const CHANNEL_RING: Record<string, string> = {
  whatsapp: 'ring-emerald-400',
  instagram: 'ring-pink-400',
  messenger: 'ring-blue-400',
};

const ConversationRow = memo(function ConversationRow({
  conv,
  isSelected,
  onSelect,
  onLeadClick,
  topicColor,
}: {
  conv: InboxConversation;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onLeadClick?: (leadId: string, ownerType?: string, contactId?: number | null) => void;
  topicColor?: string;
}) {
  const displayName = conv.ownerName || conv.leadName || conv.contactName || conv.customerId || 'Unknown';
  const initials = getInitials(displayName, 'Unknown');
  const hasUnread = (conv.unreadCount ?? 0) > 0;
  const ringColor = CHANNEL_RING[conv.channelType?.toLowerCase() ?? ''] || 'ring-gray-300';
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(conv.id)}
        aria-pressed={isSelected}
        className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors border-b border-border-color ${
          isSelected
            ? 'bg-accent/10'
            : 'hover:bg-bg-secondary/60'
        }`}
      >
        {/* Avatar with channel ring */}
        <div className="relative shrink-0">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-bg-secondary text-sm font-semibold text-text-secondary ring-2 ${ringColor}`}
            aria-hidden
          >
            {initials}
          </div>
          {/* Channel icon badge (bottom-right) */}
          {conv.channelType && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-card-bg shadow-sm border border-border-color">
              <ChannelIcon type={conv.channelType} size={12} />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className="truncate text-sm font-semibold text-text-primary hover:underline cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onLeadClick?.(conv.customerId, conv.ownerType, conv.contactId);
              }}
              title={conv.ownerType === 'contact' ? 'View contact profile' : 'View lead profile'}
            >
              {displayName}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {hasUnread && (
                <span className="h-2 w-2 rounded-full bg-accent" aria-label="Unread" />
              )}
              <span className="text-[11px] text-text-secondary" title={formatTime(conv.updatedAt)}>
                {formatRelativeTime(conv.updatedAt)}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <AIStatusBadge mode={conv.status} />
            {conv.agentName && conv.agentName !== '—' && (
              <span
                className="inline-flex items-center rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                title={`Agent: ${conv.agentName}`}
              >
                {conv.agentName}
              </span>
            )}
            {conv.lastIntent && (
              <span
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border"
                style={{
                  backgroundColor: (topicColor ?? '#94a3b8') + '22',
                  borderColor: (topicColor ?? '#94a3b8') + '55',
                  color: topicColor ?? 'var(--text-secondary)',
                }}
                title={`Topic: ${conv.lastIntent}`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: topicColor ?? '#94a3b8' }}
                />
                {conv.lastIntent}
              </span>
            )}
            {/* WhatsApp 24h service window — only for WhatsApp conversations */}
            {conv.channelType?.toLowerCase() === 'whatsapp' && (() => {
              const remaining = formatSessionRemaining(conv.sessionWindowExpiresAt);
              if (conv.sessionActive && remaining) {
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 text-[10px] font-medium dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
                    title={`WhatsApp 24h window open · free-form messages allowed for ${remaining}`}
                  >
                    <MessageCircle className="h-2.5 w-2.5" />
                    {remaining}
                  </span>
                );
              }
              return (
                <span
                  className="inline-flex items-center gap-1 rounded-md bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                  title="WhatsApp 24h window closed · only approved templates can be sent"
                >
                  <Lock className="h-2.5 w-2.5" />
                  Closed
                </span>
              );
            })()}
          </div>
          <p className="line-clamp-1 text-[13px] text-text-secondary mt-0.5">
            {conv.lastMessagePreview || '—'}
          </p>
        </div>
      </button>
    </li>
  );
});

const CHANNEL_OPTIONS: { value: string; label: string; color: string; activeColor: string }[] = [
  { value: '',          label: 'All',       color: 'bg-bg-secondary text-text-secondary',  activeColor: 'bg-accent text-white' },
  { value: 'whatsapp',  label: 'WhatsApp',  color: 'bg-bg-secondary text-text-secondary',  activeColor: 'bg-emerald-600 text-white' },
  { value: 'instagram', label: 'Instagram', color: 'bg-bg-secondary text-text-secondary',  activeColor: 'bg-pink-600 text-white' },
  { value: 'messenger', label: 'Messenger', color: 'bg-bg-secondary text-text-secondary',  activeColor: 'bg-blue-600 text-white' },
];

const MODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'ai', label: 'AI' },
  { value: 'manual', label: 'Manual' },
];

/* ─── Filters popover ─────────────────────────────────────────────── */

type SessionFilter = '' | 'open' | 'closed';

// Compact custom-field filter control for the inbox filter panel.
function InboxCustomFieldFilter({
  field, current, onSet,
}: {
  field: ContactFieldDef;
  current: CustomFilter | undefined;
  onSet: (fieldId: number, op: CustomFilter['op'], value: CustomFilter['value'] | null) => void;
}) {
  const selectCls = "w-full rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent";
  const label = (
    <p className="mb-1 text-[10px] text-text-secondary">
      {field.name}
      {field.group_name && <span className="ml-1 text-text-secondary/60">· {field.group_name}</span>}
    </p>
  );

  if ((field.field_type === 'select' || field.field_type === 'multi_select') && field.options?.length) {
    const op = field.field_type === 'multi_select' ? 'has' : 'eq';
    const val = typeof current?.value === 'string' ? current.value : '';
    return (
      <div>
        {label}
        <select value={val} onChange={(e) => onSet(field.id, op, e.target.value || null)} className={selectCls}>
          <option value="">Any</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (field.field_type === 'boolean') {
    const val = typeof current?.value === 'boolean' ? String(current.value) : '';
    return (
      <div>
        {label}
        <select
          value={val}
          onChange={(e) => onSet(field.id, 'bool', e.target.value === '' ? null : e.target.value === 'true')}
          className={selectCls}
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    );
  }

  const op: CustomFilter['op'] = (field.field_type === 'number' || field.field_type === 'date') ? 'eq' : 'contains';
  const inputType = field.field_type === 'date' ? 'date' : field.field_type === 'number' ? 'number' : 'text';
  const val = typeof current?.value === 'string' ? current.value : '';
  return (
    <div>
      {label}
      <input
        type={inputType}
        value={val}
        onChange={(e) => onSet(field.id, op, e.target.value)}
        placeholder={op === 'contains' ? `Search ${field.name.toLowerCase()}…` : undefined}
        className={selectCls}
      />
    </div>
  );
}

function FiltersPopover({
  modeFilter, setModeFilter,
  unreadOnly, setUnreadOnly,
  intentFilter, setIntentFilter,
  contactGroupId, setContactGroupId,
  contactGroups, clearActiveView,
  channelInstanceId, setChannelInstanceId, channelInstances,
  topics, topicSuggestions, activeCount,
  sessionFilter, setSessionFilter,
  priorityFilter, setPriorityFilter,
  sourceFilter, setSourceFilter,
  tagFilter, setTagFilter,
  contactRoutingFilter, setContactRoutingFilter,
  customFilters, setCustomFilters,
  sourceDefs, contactTags, fieldDefs,
}: {
  modeFilter: string;
  setModeFilter: (v: string) => void;
  unreadOnly: boolean;
  setUnreadOnly: (v: boolean) => void;
  intentFilter: string;
  setIntentFilter: (v: string) => void;
  contactGroupId: number | null;
  setContactGroupId: (id: number | null) => void;
  contactGroups: ContactGroup[];
  clearActiveView: () => void;
  channelInstanceId: number | null;
  setChannelInstanceId: (id: number | null) => void;
  channelInstances: BusinessChannel[];
  topics: ConversationTopic[];
  topicSuggestions: ConversationTopic[];
  activeCount: number;
  sessionFilter: SessionFilter;
  setSessionFilter: (v: SessionFilter) => void;
  priorityFilter: string;
  setPriorityFilter: (v: string) => void;
  sourceFilter: string;
  setSourceFilter: (v: string) => void;
  tagFilter: number | null;
  setTagFilter: (v: number | null) => void;
  contactRoutingFilter: string;
  setContactRoutingFilter: (v: string) => void;
  customFilters: CustomFilter[];
  setCustomFilters: (v: CustomFilter[]) => void;
  sourceDefs: ContactSourceDef[];
  contactTags: ContactTag[];
  fieldDefs: ContactFieldDef[];
}) {
  // Upsert/remove a single custom-field condition (one per field).
  const setCF = (fieldId: number, op: CustomFilter['op'], value: CustomFilter['value'] | null) => {
    const others = customFilters.filter((f) => f.field_id !== fieldId);
    const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0);
    setCustomFilters(empty ? others : [...others, { field_id: fieldId, op, value }]);
  };
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const clearAll = () => {
    setModeFilter('');
    setUnreadOnly(false);
    setIntentFilter('');
    setContactGroupId(null);
    setChannelInstanceId(null);
    setSessionFilter('');
    setPriorityFilter('');
    setSourceFilter('');
    setTagFilter(null);
    setContactRoutingFilter('');
    setCustomFilters([]);
    clearActiveView();
  };

  const SESSION_OPTIONS: { value: SessionFilter; label: string }[] = [
    { value: '',       label: 'All' },
    { value: 'open',   label: 'Open' },
    { value: 'closed', label: 'Closed' },
  ];

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
          activeCount > 0
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-border-color bg-bg-primary text-text-secondary hover:text-text-primary'
        }`}
      >
        <SlidersHorizontal className="h-3 w-3" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-border-color bg-card-bg shadow-lg p-3 space-y-3">
          {/* Mode */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary mb-1">Mode</p>
            <div className="flex gap-1">
              {MODE_OPTIONS.map(({ value, label }) => {
                const active = modeFilter === value;
                return (
                  <button
                    key={value || 'all'}
                    type="button"
                    onClick={() => setModeFilter(value)}
                    className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                      active
                        ? 'border-accent bg-accent text-white'
                        : 'border-border-color bg-bg-primary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unread */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="rounded border-border-color text-accent focus:ring-accent"
            />
            <span className="text-xs text-text-primary">Unread only</span>
          </label>

          {/* WhatsApp 24h service window */}
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary mb-1"
              title="WhatsApp's 24-hour customer service window. While Open, you can send any free-form message. Once Closed, only approved templates work."
            >
              WhatsApp Session
            </p>
            <div className="flex gap-1">
              {SESSION_OPTIONS.map(({ value, label }) => {
                const active = sessionFilter === value;
                return (
                  <button
                    key={value || 'all'}
                    type="button"
                    onClick={() => { setSessionFilter(value); clearActiveView(); }}
                    className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                      active
                        ? value === 'open'
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : value === 'closed'
                            ? 'border-gray-500 bg-gray-500 text-white'
                            : 'border-accent bg-accent text-white'
                        : 'border-border-color bg-bg-primary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-text-secondary/70">
              Implicitly scopes to WhatsApp conversations.
            </p>
          </div>

          {/* Topic — business-defined taxonomy */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Topic</p>
              <Link
                href="/settings/topics"
                className="text-[10px] text-text-secondary hover:text-accent"
                title="Manage topics"
              >
                Manage
              </Link>
            </div>
            {topicSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {topicSuggestions.map((t) => {
                  const active = intentFilter === t.name;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setIntentFilter(active ? '' : t.name)}
                      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        active
                          ? 'border-transparent text-white'
                          : 'border-border-color bg-bg-primary text-text-secondary hover:text-text-primary'
                      }`}
                      style={active ? { backgroundColor: t.color ?? '#6366f1' } : {}}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: active ? '#ffffff' : (t.color ?? '#94a3b8') }}
                      />
                      {t.name}
                      {t.usage_count != null && t.usage_count > 0 && (
                        <span className={active ? 'opacity-80' : 'opacity-50'}>· {t.usage_count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <select
              value={intentFilter}
              onChange={(e) => setIntentFilter(e.target.value)}
              className="w-full rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All topics</option>
              {topics.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
            {topics.length === 0 && (
              <p className="mt-1 text-[10px] text-text-secondary/70">
                No topics defined yet. <Link href="/settings/topics" className="text-accent hover:underline">Add some</Link> so the agent can classify conversations.
              </p>
            )}
          </div>

          {/* Channel instance */}
          {channelInstances.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary mb-1">Channel</p>
              <select
                value={channelInstanceId ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setChannelInstanceId(v ? Number(v) : null);
                  clearActiveView();
                }}
                className="w-full rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">All channels</option>
                {channelInstances.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} ({ch.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Contact group */}
          {contactGroups.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary mb-1">Contact group</p>
              <select
                value={contactGroupId ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setContactGroupId(v ? Number(v) : null);
                  clearActiveView();
                }}
                className="w-full rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">All contact groups</option>
                {contactGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* ── Contact attributes (mirrors the contacts page filter rail) ── */}
          <div className="border-t border-border-color pt-3 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Contact</p>

            {/* Priority */}
            <div>
              <p className="mb-1 text-[10px] text-text-secondary">Priority</p>
              <div className="flex flex-wrap gap-1">
                {(['hot', 'high', 'medium', 'low'] as const).map((p) => {
                  const active = priorityFilter === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriorityFilter(active ? '' : p)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize transition-colors ${
                        active
                          ? 'border-transparent bg-accent text-white'
                          : 'border-border-color bg-bg-primary text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Source */}
            <div>
              <p className="mb-1 text-[10px] text-text-secondary">Source</p>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">All sources</option>
                {sourceDefs.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>

            {/* Tag */}
            {contactTags.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] text-text-secondary">Tag</p>
                <select
                  value={tagFilter ?? ''}
                  onChange={(e) => setTagFilter(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">All tags</option>
                  {contactTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {/* Contact routing */}
            <div>
              <p className="mb-1 text-[10px] text-text-secondary">Contact routing</p>
              <select
                value={contactRoutingFilter}
                onChange={(e) => setContactRoutingFilter(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Any routing</option>
                <option value="ai">AI auto-reply</option>
                <option value="manual">Manual inbox</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            {/* Custom fields */}
            {fieldDefs.map((fd) => (
              <InboxCustomFieldFilter
                key={fd.id}
                field={fd}
                current={customFilters.find((f) => f.field_id === fd.id)}
                onSet={setCF}
              />
            ))}
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center justify-center gap-1 w-full rounded-md border border-border-color px-2 py-1.5 text-xs text-text-secondary hover:text-red-500 hover:border-red-300 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}


export function ConversationsView({ initialConversationId, agentFilter, initialViewId, initialNew }: { initialConversationId?: string; agentFilter?: string; initialViewId?: number; initialNew?: { phone?: string; name?: string } }) {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId ?? null);
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [conversationAnalytics, setConversationAnalytics] = useState<ConversationAnalyticsResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [, setLoadingSessions] = useState(false);
  const [, setLoadingConversationAnalytics] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [input, setInput] = useState('');
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [intentFilter, setIntentFilter] = useState('');
  const debouncedIntent = useDebounce(intentFilter, 300);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('');
  const [nameSearch, setNameSearch] = useState('');
  const debouncedNameSearch = useDebounce(nameSearch, 200);
  const [showChatPanel, setShowChatPanel] = useState(!!initialConversationId);
  const [savedViews, setSavedViews] = useState<ConversationSavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<number | null>(null);
  const [contactGroupId, setContactGroupId] = useState<number | null>(null);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [channelInstanceId, setChannelInstanceId] = useState<number | null>(null);
  const [channelInstances, setChannelInstances] = useState<BusinessChannel[]>([]);
  // Contact-attribute filters (mirror the contacts page filter rail)
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [tagFilter, setTagFilter] = useState<number | null>(null);
  const [contactRoutingFilter, setContactRoutingFilter] = useState('');
  const [customFilters, setCustomFilters] = useState<CustomFilter[]>([]);
  const [sourceDefs, setSourceDefs] = useState<ContactSourceDef[]>([]);
  const [contactTags, setContactTags] = useState<ContactTag[]>([]);
  const [fieldDefs, setFieldDefs] = useState<ContactFieldDef[]>([]);
  const [topics, setTopics] = useState<ConversationTopic[]>([]);
  const [showViewsPanel, setShowViewsPanel] = useState(false);
  const { data: agentsData } = useQuery({
    queryKey: ['agents-summary'],
    queryFn: () => listAgentsForBusiness(),
    staleTime: 5 * 60 * 1000,
  });
  const agents = agentsData ?? ([] as AgentSummary[]);
  const [switchingAgent, setSwitchingAgent] = useState(false);
  const [agentSwitchOpen, setAgentSwitchOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'info' | 'error'>('info');
  const [railOverlayOpen, setRailOverlayOpen] = useState(false);
  const inboxRailCollapsed = useUIStore((s) => s.inboxRailCollapsed);
  const toggleInboxRail = useUIStore((s) => s.toggleInboxRail);
  const endRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const prevMsgCountRef = useRef(0);
  const prevSelectedRef = useRef<string | null>(null);
  const chatHeaderRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (initialConversationId) {
      setSelectedId(initialConversationId);
      setShowChatPanel(true);
    }
  }, [initialConversationId]);

  // Deep-linked from a contact with no existing conversation — open the
  // New Conversation composer prefilled with that contact.
  useEffect(() => {
    if (initialNew && (initialNew.phone || initialNew.name)) {
      setShowNewConvo(true);
    }
  }, [initialNew]);

  // Apply all filter states from a saved view (null = clear to defaults)
  const applyView = useCallback((view: ConversationSavedView | null) => {
    setActiveViewId(view?.id ?? null);
    setChannelFilter(view?.channel_type ?? '');
    setModeFilter(view?.mode ?? '');
    setIntentFilter(view?.intent ?? '');
    setUnreadOnly(view?.unread_only ?? false);
    setContactGroupId(view?.contact_group_id ?? null);
  }, []);

  // Load saved views + contact groups once on mount; pre-apply initialViewId if provided
  useEffect(() => {
    listConversationViews().then((views) => {
      setSavedViews(views);
      if (initialViewId) {
        const target = views.find((v) => v.id === initialViewId);
        if (target) applyView(target);
      }
    }).catch(() => {});
    contactGroupsService.list().then(setContactGroups).catch(() => {});
    listChannels().then((chs) => setChannelInstances(chs.filter((c) => c.isConnected))).catch(() => {});
    listConversationTopics().then(setTopics).catch(() => {});
    // Contact-attribute filter reference data
    listSourceDefs().then(setSourceDefs).catch(() => {});
    contactTagService.list().then(setContactTags).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Custom-field defs applicable to the current context: global always, plus
  // the selected contact group's scoped fields. Prune stale custom filters.
  useEffect(() => {
    const calls = [listFieldDefs(0)];
    if (contactGroupId != null) calls.push(listFieldDefs(contactGroupId));
    Promise.all(calls)
      .then((results) => {
        const seen = new Set<number>();
        const merged = results.flat().filter((f) => (seen.has(f.id) ? false : seen.add(f.id)));
        setFieldDefs(merged);
        setCustomFilters((prev) => {
          const valid = prev.filter((cf) => seen.has(cf.field_id));
          return valid.length === prev.length ? prev : valid;
        });
      })
      .catch(() => setFieldDefs([]));
  }, [contactGroupId]);

  // Sync active view id to ?view= URL param
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (activeViewId) {
      url.searchParams.set('view', String(activeViewId));
    } else {
      url.searchParams.delete('view');
    }
    window.history.replaceState({}, '', url.toString());
  }, [activeViewId]);

  // Scope for "Pin to system": the inbox reflects its active filter via
  // history.replaceState (not the router), so we build the scope explicitly from
  // the active saved-view / agent filter rather than parsing searchParams.
  const inboxPinScope: ParsedScope | null = useMemo(() => {
    if (activeViewId) {
      const v = savedViews.find((x) => x.id === activeViewId);
      const params: Record<string, string | number> = { view: activeViewId };
      return {
        descriptor: { module: 'inbox', params },
        icon: 'MessageSquare',
        autoLabel: v ? `Inbox · ${v.name}` : 'Inbox · Saved view',
      };
    }
    if (agentFilter) {
      const params: Record<string, string | number> = { agent: agentFilter };
      return {
        descriptor: { module: 'inbox', params },
        icon: 'MessageSquare',
        autoLabel: `Inbox · ${agentFilter}`,
      };
    }
    return null;
  }, [activeViewId, savedViews, agentFilter]);

  const selected = selectedId ? conversations.find((c) => c.id === selectedId) : null;

  const fetchConversations = useCallback(
    (silent = false) => {
      if (!silent) setLoadingList(true);
      const filters: ConversationListFilters = {
        channel_type: channelFilter || undefined,
        channel_id: channelInstanceId ?? undefined,
        mode: modeFilter || undefined,
        intent: debouncedIntent.trim() || undefined,
        unread_only: unreadOnly || undefined,
        agent_name: agentFilter || undefined,
        contact_group_id: contactGroupId ?? undefined,
        priority: priorityFilter || undefined,
        source: sourceFilter || undefined,
        tag_id: tagFilter ?? undefined,
        contact_routing_mode: contactRoutingFilter || undefined,
        custom_filters: customFilters.length ? JSON.stringify(customFilters) : undefined,
        session_active:
          sessionFilter === 'open' ? true
          : sessionFilter === 'closed' ? false
          : undefined,
      };
      return listAllConversations(filters)
        .then((list) => setConversations(list))
        .finally(() => { if (!silent) setLoadingList(false); });
    },
    [channelFilter, channelInstanceId, modeFilter, debouncedIntent, unreadOnly, agentFilter, contactGroupId, sessionFilter, priorityFilter, sourceFilter, tagFilter, contactRoutingFilter, customFilters],
  );

  /* Initial load */
  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  /* Auto-poll every 30s (silent refresh — no spinner) */
  useEffect(() => {
    const id = setInterval(() => fetchConversations(true), 30_000);
    return () => clearInterval(id);
  }, [fetchConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    listMessages(selectedId)
      .then((msgs) => {
        if (!cancelled) setMessages(msgs);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });

    // Silent poll every 15s so Meta delivery-receipt updates (delivered/read/
    // failed) and incoming inbound replies show up without manual refresh.
    const pollId = setInterval(() => {
      listMessages(selectedId).then((msgs) => {
        if (!cancelled) setMessages(msgs);
      }).catch(() => {});
    }, 15_000);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    setLoadingSessions(true);
    listConversationSessions(selectedId)
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingSessions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setConversationAnalytics(null);
      return;
    }
    let cancelled = false;
    setLoadingConversationAnalytics(true);
    getConversationAnalytics(selectedId)
      .then((row) => {
        if (!cancelled) setConversationAnalytics(row);
      })
      .catch(() => {
        if (!cancelled) setConversationAnalytics(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingConversationAnalytics(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Smart auto-scroll: jump to the bottom when opening a conversation, and on
  // new messages only if the user is already near the bottom — so scrolling up
  // to read history isn't yanked back down by the 15s poll.
  useEffect(() => {
    const convoChanged = prevSelectedRef.current !== selectedId;
    const grew = messages.length > prevMsgCountRef.current;
    prevSelectedRef.current = selectedId;
    prevMsgCountRef.current = messages.length;

    const container = messagesScrollRef.current;
    if (convoChanged || !container) {
      endRef.current?.scrollIntoView();
      return;
    }
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (grew && distanceFromBottom < 140) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedId]);

  // Auto-grow the composer textarea up to ~6 lines so long replies are visible
  // without scrolling, while a short reply keeps the panel slim.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 144; // ~6 lines at 24px line-height
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [input]);

  // Agents for agent-switch dropdown loaded via React Query above

  // Close agent dropdown when clicking outside
  useEffect(() => {
    if (!agentSwitchOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-agent-dropdown]')) setAgentSwitchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [agentSwitchOpen]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const handleSwitchAgent = async (agentId: number) => {
    if (!selectedId || switchingAgent) return;
    setSwitchingAgent(true);
    try {
      await switchConversationAgent(Number(selectedId), agentId);
      const agent = agents.find((a) => a.id === agentId);
      // Update local state
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? { ...c, agentId: agentId, agentName: agent?.name ?? '—' }
            : c,
        ),
      );
      setToastMessage(`Agent switched to ${agent?.name ?? 'new agent'}`);
    } catch {
      setToastMessage('Failed to switch agent');
    } finally {
      setSwitchingAgent(false);
      setAgentSwitchOpen(false);
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !selectedId || sendingMessage) return;
    setSendingMessage(true);
    setInput('');
    const result = await appendMessage(selectedId, 'assistant', trimmed);
    if (result.ok) {
      setMessages((prev) => [...prev, result.message]);
    } else {
      setToastType('error');
      setToastMessage(result.error);
      setInput(trimmed);
    }
    setSendingMessage(false);
  };

  const handleToggleMode = async () => {
    if (!selectedId || !selected) return;
    const next = selected.status === 'ai' ? 'manual' : 'ai';
    await toggleConversationStatus(selectedId, next);
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, status: next } : c)),
    );
  };

  // ── Saved views CRUD ──────────────────────────────────────────────────────
  const handleCreateView = async (data: ConversationSavedViewCreate) => {
    const created = await createConversationView(data);
    setSavedViews((prev) => [...prev, created]);
    applyView(created);
  };

  const handleUpdateView = async (id: number, data: ConversationSavedViewUpdate) => {
    const updated = await updateConversationView(id, data);
    setSavedViews((prev) => prev.map((v) => (v.id === id ? updated : v)));
    // If this is the active view, reapply its (updated) filters
    if (activeViewId === id) applyView(updated);
  };

  const handleDeleteView = async (id: number) => {
    await deleteConversationView(id);
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
    if (activeViewId === id) applyView(null);
  };

  const totalUnread = conversations.reduce((n, c) => n + (c.unreadCount ?? 0), 0);

  // Top-6 topics to show as quick-filter chips. Prefer business-wide usage
  // (from the topics catalog) so chips are stable across filters; fall back
  // to in-view `lastIntent` counts when no usage data is available yet.
  const topicSuggestions = useMemo(() => {
    if (topics.length === 0) return [] as ConversationTopic[];
    const withUsage = topics.filter((t) => (t.usage_count ?? 0) > 0);
    if (withUsage.length > 0) {
      return [...withUsage]
        .sort((a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0))
        .slice(0, 6);
    }
    // Fall back to in-view lastIntent counts mapped onto topic objects so
    // chips can still render colors.
    const counts: Record<string, number> = {};
    for (const c of conversations) {
      const intent = c.lastIntent?.trim();
      if (!intent) continue;
      counts[intent] = (counts[intent] ?? 0) + 1;
    }
    const byName = new Map(topics.map((t) => [t.name, t]));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => byName.get(name))
      .filter((t): t is ConversationTopic => !!t);
  }, [topics, conversations]);

  const activeFilterCount =
    (modeFilter ? 1 : 0) +
    (unreadOnly ? 1 : 0) +
    (intentFilter.trim() ? 1 : 0) +
    (contactGroupId != null ? 1 : 0) +
    (channelInstanceId != null ? 1 : 0) +
    (sessionFilter ? 1 : 0) +
    (priorityFilter ? 1 : 0) +
    (sourceFilter ? 1 : 0) +
    (tagFilter != null ? 1 : 0) +
    (contactRoutingFilter ? 1 : 0) +
    customFilters.length;

  const topicColorByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of topics) {
      if (t.color) m.set(t.name, t.color);
    }
    return m;
  }, [topics]);

  const sortedConversations = [...conversations]
    .filter((c) => {
      if (!debouncedNameSearch.trim()) return true;
      const q = debouncedNameSearch.toLowerCase();
      const name = (c.ownerName || c.leadName || c.contactName || c.customerId || '').toLowerCase();
      const phone = (c.customerId || '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
        <div className="flex h-[calc(100vh-3.5rem)] min-h-0 w-full flex-col md:flex-row">
          {/* Left: conversation list — full width on small when list visible; hidden when chat open on small */}
          <div
            className={`flex min-h-0 w-full flex-col border-r border-border-color bg-card-bg md:w-80 md:shrink-0 ${showChatPanel ? 'hidden md:flex' : 'flex'}`}
          >
            {/* ── Saved views (collapsible) ── */}
            {showViewsPanel && (
              <SavedViewsPanel
                views={savedViews}
                activeViewId={activeViewId}
                contactGroups={contactGroups}
                onSelect={applyView}
                onCreate={handleCreateView}
                onUpdate={handleUpdateView}
                onDelete={handleDeleteView}
              />
            )}

            {/* ── Panel header ── */}
            <div className="px-3 pt-3 pb-2 border-b border-border-color shrink-0 space-y-2">
              {/* Title row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-text-primary shrink-0">Conversations</h2>
                  <span
                    className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white shrink-0"
                    title="Conversations matching current filters"
                  >
                    {sortedConversations.length}
                  </span>
                  {/* Active view badge */}
                  {activeViewId && (() => {
                    const activeView = savedViews.find((v) => v.id === activeViewId);
                    if (!activeView) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => applyView(null)}
                        title="Clear active view"
                        className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent truncate min-w-0 hover:bg-accent/20 transition-colors"
                      >
                        <span className="truncate">{activeView.emoji} {activeView.name}</span>
                        <span className="shrink-0 opacity-60">×</span>
                      </button>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-1">
                  <PinToSystemButton
                    override={inboxPinScope}
                    compact
                    className="p-1.5 rounded-lg text-text-secondary hover:bg-bg-secondary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewConvo(true)}
                    title="Start a new conversation"
                    className="p-1.5 rounded-lg text-accent hover:bg-accent/10 transition-colors"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fetchConversations()}
                    title="Refresh conversations"
                    className="p-1.5 rounded-lg text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowViewsPanel((v) => !v)}
                    title={showViewsPanel ? 'Hide saved views' : 'Show saved views'}
                    className={`p-1.5 rounded-lg transition-colors ${showViewsPanel ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}`}
                  >
                    <BookmarkCheck className="h-3.5 w-3.5" />
                  </button>
                  <Link
                    href="/message-templates"
                    title="Manage message templates"
                    className="p-1.5 rounded-lg text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary pointer-events-none" />
                <input
                  type="text"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  placeholder="Search by name or number…"
                  className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-border-color bg-bg-secondary text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Channel filter chips */}
              <div className="flex gap-1 overflow-x-auto scrollbar-none" role="group" aria-label="Filter by channel">
                {CHANNEL_OPTIONS.map(({ value, label, color, activeColor }) => {
                  const isActive = channelFilter === value;
                  return (
                    <button
                      key={value || 'all'}
                      type="button"
                      onClick={() => setChannelFilter(value)}
                      aria-pressed={isActive}
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${isActive ? activeColor : color + ' hover:text-text-primary'}`}
                    >
                      {value ? <ChannelIcon type={value} size={11} /> : null}
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Filters popover + active-filter chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <FiltersPopover
                  modeFilter={modeFilter}
                  setModeFilter={setModeFilter}
                  unreadOnly={unreadOnly}
                  setUnreadOnly={setUnreadOnly}
                  intentFilter={intentFilter}
                  setIntentFilter={setIntentFilter}
                  contactGroupId={contactGroupId}
                  setContactGroupId={setContactGroupId}
                  contactGroups={contactGroups}
                  channelInstanceId={channelInstanceId}
                  setChannelInstanceId={setChannelInstanceId}
                  channelInstances={channelInstances}
                  clearActiveView={() => setActiveViewId(null)}
                  topics={topics}
                  topicSuggestions={topicSuggestions}
                  activeCount={activeFilterCount}
                  sessionFilter={sessionFilter}
                  setSessionFilter={setSessionFilter}
                  priorityFilter={priorityFilter}
                  setPriorityFilter={(v) => { setPriorityFilter(v); setActiveViewId(null); }}
                  sourceFilter={sourceFilter}
                  setSourceFilter={(v) => { setSourceFilter(v); setActiveViewId(null); }}
                  tagFilter={tagFilter}
                  setTagFilter={(v) => { setTagFilter(v); setActiveViewId(null); }}
                  contactRoutingFilter={contactRoutingFilter}
                  setContactRoutingFilter={(v) => { setContactRoutingFilter(v); setActiveViewId(null); }}
                  customFilters={customFilters}
                  setCustomFilters={(v) => { setCustomFilters(v); setActiveViewId(null); }}
                  sourceDefs={sourceDefs}
                  contactTags={contactTags}
                  fieldDefs={fieldDefs}
                />
                {modeFilter && (
                  <button
                    type="button"
                    onClick={() => setModeFilter('')}
                    className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[10px] font-semibold hover:bg-accent/20"
                  >
                    Mode: {modeFilter.toUpperCase()} <X className="h-2.5 w-2.5" />
                  </button>
                )}
                {unreadOnly && (
                  <button
                    type="button"
                    onClick={() => setUnreadOnly(false)}
                    className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[10px] font-semibold hover:bg-accent/20"
                  >
                    Unread <X className="h-2.5 w-2.5" />
                  </button>
                )}
                {intentFilter && (
                  <button
                    type="button"
                    onClick={() => setIntentFilter('')}
                    className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[10px] font-semibold hover:bg-accent/20"
                  >
                    Topic: {intentFilter.length > 12 ? `${intentFilter.slice(0, 12)}…` : intentFilter} <X className="h-2.5 w-2.5" />
                  </button>
                )}
                {contactGroupId != null && (
                  <button
                    type="button"
                    onClick={() => { setContactGroupId(null); setActiveViewId(null); }}
                    className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[10px] font-semibold hover:bg-accent/20"
                  >
                    Group: {contactGroups.find((g) => g.id === contactGroupId)?.name ?? '—'} <X className="h-2.5 w-2.5" />
                  </button>
                )}
                {channelInstanceId != null && (
                  <button
                    type="button"
                    onClick={() => { setChannelInstanceId(null); setActiveViewId(null); }}
                    className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[10px] font-semibold hover:bg-accent/20"
                  >
                    Channel: {channelInstances.find((c) => Number(c.id) === channelInstanceId)?.name ?? '—'} <X className="h-2.5 w-2.5" />
                  </button>
                )}
                {sessionFilter && (
                  <button
                    type="button"
                    onClick={() => setSessionFilter('')}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      sessionFilter === 'open'
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    Session: {sessionFilter === 'open' ? 'Open' : 'Closed'} <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingList ? (
                <ul role="list">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <ConversationRowSkeleton key={i} />
                  ))}
                </ul>
              ) : sortedConversations.length === 0 ? (
                <div className="flex flex-col items-center p-4 text-center">
                  <span className="text-4xl text-text-secondary/60" aria-hidden>💬</span>
                  <p className="text-sm font-medium text-text-primary">No conversations yet</p>
                  <p className="text-sm text-text-secondary">
                    When customers message your connected channels, conversations will appear here.
                  </p>
                </div>
              ) : (
                <ul className="" role="list">
                  {sortedConversations.map((conv) => (
                    <ConversationRow
                      key={conv.id}
                      conv={conv}
                      isSelected={selectedId === conv.id}
                      topicColor={conv.lastIntent ? topicColorByName.get(conv.lastIntent) : undefined}
                      onSelect={(id) => {
                        setSelectedId(id);
                        setShowChatPanel(true);
                        setTimeout(() => chatHeaderRef.current?.focus({ preventScroll: true }), 0);
                      }}
                      onLeadClick={(_leadId, _ownerType, _contactId) => {
                        // Rail is already open and reactive to selectedId — opening overlay on mobile
                        setRailOverlayOpen(true);
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right: chat panel */}
          <div
            className={`flex min-w-0 flex-1 flex-col bg-card-bg ${showChatPanel ? 'flex' : 'hidden md:flex'}`}
          >
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center p-4 text-center text-text-secondary">
                <span className="text-4xl text-text-secondary/60" aria-hidden>💬</span>
                <p className="text-base font-medium text-text-primary">Select a conversation from the list</p>
                <p className="text-sm">Choose a conversation to view and reply.</p>
              </div>
            ) : (
              <>
                {/* Chat header — fixed single row, no wrap */}
                <div
                  ref={chatHeaderRef}
                  tabIndex={-1}
                  className="sticky top-0 z-10 flex items-center gap-2 border-b border-border-color bg-card-bg px-3 py-2 min-h-[52px]"
                >
                  {/* Back (mobile only) */}
                  <button
                    type="button"
                    onClick={() => setShowChatPanel(false)}
                    className="shrink-0 rounded-md p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors md:hidden"
                    aria-label="Back to conversation list"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  {/* Contact info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (inboxRailCollapsed) toggleInboxRail();
                          setRailOverlayOpen(true);
                        }}
                        className="flex items-center gap-1 min-w-0 font-bold text-sm text-text-primary hover:text-accent transition-colors cursor-pointer"
                        title="View contact details"
                      >
                        <span className="truncate">{selected.leadName || selected.customerId || 'Unknown'}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
                      </button>
                      {/* Channel badge — compact icon only */}
                      {selected.channelType && (
                        <span className="shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-bg-secondary border border-border-color" title={selected.channelName || selected.channelType}>
                          <ChannelIcon type={selected.channelType} size={11} />
                        </span>
                      )}
                      <AIStatusBadge mode={selected.status} />
                    </div>
                    {/* Agent name — subtitle only if present */}
                    {selected.agentName && selected.agentName !== '—' && (
                      <p className="text-[11px] text-text-secondary truncate mt-0.5">
                        <span className="text-indigo-500 font-medium">{selected.agentName}</span>
                      </p>
                    )}
                  </div>

                  {/* Right actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Agent switch — icon button with dropdown */}
                    <div className="relative" data-agent-dropdown>
                      <button
                        type="button"
                        onClick={() => setAgentSwitchOpen((o) => !o)}
                        disabled={switchingAgent}
                        title={switchingAgent ? 'Switching agent…' : 'Switch AI agent'}
                        className="flex items-center gap-1 rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-secondary hover:border-accent hover:text-text-primary transition-colors focus:outline-none disabled:opacity-50"
                      >
                        <Bot className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{switchingAgent ? '…' : 'Agent'}</span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </button>
                      {agentSwitchOpen && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-border-color bg-card-bg shadow-lg">
                          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary border-b border-border-color">
                            Switch Agent
                          </div>
                          <ul className="max-h-48 overflow-y-auto py-1" role="listbox">
                            {agents.length === 0 && (
                              <li className="px-3 py-2 text-sm text-text-secondary">No agents available</li>
                            )}
                            {agents
                              .filter((a) => a.status === 'active')
                              .map((agent) => {
                                const isCurrent = selected.agentId === agent.id;
                                return (
                                  <li key={agent.id}>
                                    <button
                                      type="button"
                                      role="option"
                                      aria-selected={isCurrent}
                                      disabled={isCurrent}
                                      onClick={() => handleSwitchAgent(agent.id)}
                                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                                        isCurrent
                                          ? 'bg-accent/10 text-accent font-medium cursor-default'
                                          : 'text-text-primary hover:bg-bg-secondary'
                                      }`}
                                    >
                                      <span>{agent.name}</span>
                                      <span className="text-xs capitalize text-text-secondary">{agent.role}</span>
                                    </button>
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* AI / Manual segmented control */}
                    <div className="flex shrink-0 overflow-hidden rounded-lg border border-border-color text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => { if (selected.status !== 'ai') handleToggleMode(); }}
                        title="Switch to AI mode"
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors focus:outline-none ${
                          selected.status === 'ai'
                            ? 'bg-emerald-500 text-white cursor-default'
                            : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                        }`}
                      >
                        {selected.status === 'ai' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse shrink-0" />
                        )}
                        AI
                      </button>
                      <div className="w-px self-stretch bg-border-color shrink-0" />
                      <button
                        type="button"
                        onClick={() => { if (selected.status !== 'manual') handleToggleMode(); }}
                        title="Switch to manual mode"
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors focus:outline-none ${
                          selected.status === 'manual'
                            ? 'bg-orange-500 text-white cursor-default'
                            : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                        }`}
                      >
                        {selected.status === 'manual' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white shrink-0" />
                        )}
                        Manual
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <>
                      <div
                        ref={messagesScrollRef}
                        className="flex-1 overflow-y-auto overflow-x-hidden bg-bg-secondary/40 px-3 py-4 sm:px-5"
                      >
                        {loadingMessages ? (
                          <div aria-label="Loading messages" className="space-y-3">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className={`flex ${i % 2 === 0 ? 'justify-end' : ''}`}
                                aria-hidden
                              >
                                <div className="h-14 w-56 max-w-[80%] rounded-2xl animate-pulse bg-bg-secondary" />
                              </div>
                            ))}
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10 gap-2">
                            <span className="text-3xl text-text-secondary/50" aria-hidden>💬</span>
                            <p className="text-sm font-medium text-text-primary">No messages yet</p>
                            <p className="text-xs text-text-secondary max-w-[28ch]">
                              Send the first reply or pick a pre-approved template to start the conversation.
                            </p>
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const peerInitial = getInitials(
                                selected.leadName || selected.customerId || 'Unknown',
                                'U',
                              );
                              const GROUP_GAP_MS = 4 * 60 * 1000;
                              return messages.map((m, i) => {
                                const msgDate = m.timestamp ? new Date(m.timestamp).toDateString() : null;
                                const prev = messages[i - 1];
                                const next = messages[i + 1];
                                const prevDate = prev?.timestamp ? new Date(prev.timestamp).toDateString() : null;
                                const showSeparator = !!msgDate && msgDate !== prevDate;
                                const today = new Date().toDateString();
                                const yesterday = new Date(Date.now() - 86400000).toDateString();
                                const separatorLabel = msgDate === today
                                  ? 'Today'
                                  : msgDate === yesterday
                                  ? 'Yesterday'
                                  : msgDate
                                    ? fmtDayMonth(m.timestamp)
                                    : null;

                                // Group consecutive same-sender messages sent close in time
                                // so they read as one block (tighter spacing, one avatar +
                                // timestamp per group, tail only on the last bubble).
                                const msgTime = m.timestamp ? new Date(m.timestamp).getTime() : 0;
                                const sameAsPrev = !!prev && prev.role === m.role && !showSeparator
                                  && msgTime - new Date(prev.timestamp).getTime() < GROUP_GAP_MS;
                                const nextDate = next?.timestamp ? new Date(next.timestamp).toDateString() : null;
                                const nextHasSeparator = !!nextDate && nextDate !== msgDate;
                                const sameAsNext = !!next && next.role === m.role && !nextHasSeparator
                                  && new Date(next.timestamp).getTime() - msgTime < GROUP_GAP_MS;

                                return (
                                  <div key={m.id}>
                                    {showSeparator && separatorLabel && (
                                      <div className="flex items-center gap-2 my-4">
                                        <div className="flex-1 h-px bg-border-color" />
                                        <span className="text-[10px] font-medium text-text-secondary px-2 py-0.5 rounded-full bg-bg-secondary border border-border-color shrink-0">
                                          {separatorLabel}
                                        </span>
                                        <div className="flex-1 h-px bg-border-color" />
                                      </div>
                                    )}
                                    <MessageBubble
                                      message={m}
                                      isFirstInGroup={!sameAsPrev}
                                      isLastInGroup={!sameAsNext}
                                      avatarInitial={peerInitial}
                                    />
                                  </div>
                                );
                              });
                            })()}
                            <div ref={endRef} />
                          </>
                        )}
                      </div>
                      <form
                        onSubmit={handleSend}
                        className="border-t border-border-color bg-card-bg px-3 py-2"
                      >
                        <div className="flex items-end gap-2">
                          {/* Template message button */}
                          <button
                            type="button"
                            onClick={() => setTemplateModalOpen(true)}
                            title="Send a pre-approved template message"
                            className="flex-none inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-primary px-2.5 h-10 text-xs font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="hidden sm:inline">Template</span>
                          </button>
                          <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                if (input.trim() && !sendingMessage) {
                                  void handleSend(e as unknown as FormEvent);
                                }
                              }
                            }}
                            rows={1}
                            placeholder="Type a reply…"
                            className="min-w-0 flex-1 resize-none rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-sm leading-6 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                            style={{ minHeight: '40px', maxHeight: '144px' }}
                          />
                          <button
                            type="submit"
                            disabled={!input.trim() || sendingMessage}
                            title={sendingMessage ? 'Sending…' : 'Send reply (Enter)'}
                            aria-label="Send reply"
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 sm:px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            <Send className="h-4 w-4" />
                            <span className="hidden sm:inline">{sendingMessage ? 'Sending…' : 'Send'}</span>
                          </button>
                        </div>
                        {/* Tiny helper hint — only when composer is empty, keeps chrome quiet otherwise */}
                        {!input && (
                          <p className="mt-1 text-[10px] text-text-secondary/70 select-none pl-1">
                            Enter to send · Shift+Enter for newline
                          </p>
                        )}
                      </form>
                      {/* Template Picker Modal */}
                      {templateModalOpen && selected && (
                        <TemplatePickerModal
                          conversationId={selected.id}
                          channelType={selected.channelType ?? 'generic'}
                          leadId={selected.customerId}
                          onClose={() => setTemplateModalOpen(false)}
                          onSent={(msg) => {
                            setMessages((prev) => [...prev, msg]);
                            setTemplateModalOpen(false);
                          }}
                        />
                      )}
                  </>
                </div>
              </>
            )}
          </div>

          {/* Right: persistent contact rail (desktop ≥ lg) */}
          <ContactRail
            contactId={selected?.contactId ?? null}
            fallback={{
              name: selected?.leadName ?? selected?.customerId ?? null,
              phone: selected?.customerId ?? null,
              channelType: selected?.channelType,
              leadId: selected?.ownerType === 'lead' ? selected?.customerId : null,
            }}
            agents={agents}
            collapsed={inboxRailCollapsed}
            onToggleCollapsed={toggleInboxRail}
            conversationId={selectedId}
            conversations={conversations}
            conversationAnalytics={conversationAnalytics}
            sessions={sessions}
            onOpenConversation={(id) => {
              setSelectedId(id);
              setShowChatPanel(true);
            }}
          />

          {/* Mobile/tablet rail overlay */}
          {railOverlayOpen && selected?.contactId && (
            <ContactRailOverlay
              contactId={selected.contactId}
              fallback={{
                name: selected.leadName ?? selected.customerId ?? null,
                phone: selected.customerId ?? null,
                channelType: selected.channelType,
                leadId: selected.ownerType === 'lead' ? selected.customerId : null,
              }}
              agents={agents}
              onClose={() => setRailOverlayOpen(false)}
              conversationId={selectedId}
              conversations={conversations}
              conversationAnalytics={conversationAnalytics}
              sessions={sessions}
              onOpenConversation={(id) => {
                setSelectedId(id);
                setRailOverlayOpen(false);
              }}
            />
          )}

          {/* Toast notification */}
          {toastMessage && (
            <div className={`fixed bottom-6 right-6 z-50 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
              toastType === 'error'
                ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300'
                : 'border-border-color bg-card-bg text-text-primary'
            }`}>
              {toastMessage}
            </div>
          )}

          <NewConversationModal
            open={showNewConvo}
            onClose={() => setShowNewConvo(false)}
            initialPhone={initialNew?.phone}
            initialName={initialNew?.name}
            onCreated={(result) => {
              setSelectedId(String(result.conversation_id));
              setShowChatPanel(true);
              fetchConversations();
            }}
          />
        </div>
  );
}

export default function ConversationsPage() {
  // Read ?agent=, ?view=, ?c= (conversation deep-link) and ?new= query parameters
  const [agentFilter, setAgentFilter] = useState<string | undefined>();
  const [initialViewId, setInitialViewId] = useState<number | undefined>();
  const [initialConversationId, setInitialConversationId] = useState<string | undefined>();
  const [initialNew, setInitialNew] = useState<{ phone?: string; name?: string } | undefined>();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const agent = params.get('agent');
      if (agent) setAgentFilter(agent);
      const view = params.get('view');
      if (view && !Number.isNaN(Number(view))) setInitialViewId(Number(view));
      const convo = params.get('c');
      if (convo && !Number.isNaN(Number(convo))) setInitialConversationId(convo);
      if (params.get('new') === '1') {
        setInitialNew({
          phone: params.get('phone') ?? undefined,
          name: params.get('name') ?? undefined,
        });
      }
    }
  }, []);

  return (
    <ConversationsView
      agentFilter={agentFilter}
      initialViewId={initialViewId}
      initialConversationId={initialConversationId}
      initialNew={initialNew}
    />
  );
}
