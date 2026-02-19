'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import ProtectedShell from '@/components/protected-shell';
import { AIStatusBadge } from '@/components/customers/ai-status-badge';
import { MessageBubble } from '@/components/customers/message-bubble';
import { ConversationRowSkeleton } from '@/components/conversations/ConversationRowSkeleton';
import {
  listAllConversations,
  listMessages,
  listConversationSessions,
  appendMessage,
  recalcConversationAnalytics,
  toggleConversationStatus,
  type InboxConversation,
  type Message,
  type ConversationSession,
  type ConversationListFilters,
} from '@/services/customers';
import { getConversationAnalytics, type ConversationAnalyticsResponse } from '@/services/analytics';

function formatTime(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
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
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric' });
}

function getInitials(name: string | undefined, fallback: string): string {
  if (!name || !name.trim()) return fallback.charAt(0).toUpperCase();
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  return name.charAt(0).toUpperCase();
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'messenger', label: 'Messenger' },
];

const MODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'ai', label: 'AI' },
  { value: 'manual', label: 'Manual' },
];

const LEAD_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'lost', label: 'Lost' },
  { value: 'won', label: 'Won' },
];

export function ConversationsView({ initialConversationId }: { initialConversationId?: string }) {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [conversationAnalytics, setConversationAnalytics] = useState<ConversationAnalyticsResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingConversationAnalytics, setLoadingConversationAnalytics] = useState(false);
  const [recalculatingConversationAnalytics, setRecalculatingConversationAnalytics] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [input, setInput] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState('');
  const [intentFilter, setIntentFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(!!initialConversationId);
  const endRef = useRef<HTMLDivElement | null>(null);
  const chatHeaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialConversationId) {
      setSelectedId(initialConversationId);
      setShowChatPanel(true);
    }
  }, [initialConversationId]);

  const selected = selectedId ? conversations.find((c) => c.id === selectedId) : null;

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    const filters: ConversationListFilters = {
      channel_type: channelFilter || undefined,
      mode: modeFilter || undefined,
      lead_status: leadStatusFilter || undefined,
      intent: intentFilter.trim() || undefined,
      unread_only: unreadOnly || undefined,
    };
    listAllConversations(filters)
      .then((list) => {
        if (!cancelled) setConversations(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channelFilter, modeFilter, leadStatusFilter, intentFilter, unreadOnly]);

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
    return () => {
      cancelled = true;
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !selectedId || sendingMessage) return;
    setSendingMessage(true);
    setInput('');
    try {
      const created = await appendMessage(selectedId, 'assistant', trimmed);
      setMessages((prev) => [...prev, created]);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleToggleMode = async () => {
    if (!selectedId || !selected) return;
    const next = selected.status === 'ai' ? 'manual' : 'ai';
    await toggleConversationStatus(selectedId, next);
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, status: next } : c)),
    );
  };

  const sortedConversations = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
        <div className="flex h-[calc(100vh-8rem)] w-full flex-col gap-4 md:flex-row">
          {/* Left: conversation list — full width on small when list visible; hidden when chat open on small */}
          <div
            className={`flex min-h-0 w-full flex-col rounded-xl border border-border-color bg-card-bg md:w-80 md:shrink-0 ${showChatPanel ? 'hidden md:flex' : 'flex'}`}
          >
            <div className="border-b border-border-color px-4 py-3">
              <h2 className="text-lg font-semibold text-text-primary">Conversations</h2>
              <p className="text-sm text-text-secondary">Select a conversation to view and reply</p>
            </div>
            {/* Channel filter buttons */}
            <div className="flex flex-wrap gap-1.5 border-b border-border-color p-2" role="group" aria-label="Filter by channel">
              {CHANNEL_OPTIONS.map(({ value, label }) => (
                <button
                  key={value || 'all'}
                  type="button"
                  onClick={() => setChannelFilter(value)}
                  aria-label={value ? `Filter by channel: ${label}` : 'Show all channels'}
                  aria-pressed={channelFilter === value}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    channelFilter === value
                      ? 'bg-accent text-white'
                      : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Smart filters: collapsible on small screens */}
            <div className="border-b border-border-color">
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium text-text-primary md:hidden"
                aria-expanded={filtersOpen}
                aria-controls="conversations-filters"
                id="filters-toggle"
              >
                Filters
                <span className="text-text-secondary" aria-hidden>{filtersOpen ? '▼' : '▶'}</span>
              </button>
              <div
                id="conversations-filters"
                role="region"
                aria-labelledby="filters-toggle"
                className={`flex flex-col gap-2 p-2 ${filtersOpen ? 'flex' : 'hidden'} md:flex`}
              >
                <p className="hidden px-2 text-xs font-medium uppercase tracking-wide text-text-secondary md:block">Filters</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={modeFilter}
                    onChange={(e) => setModeFilter(e.target.value)}
                    aria-label="Filter by mode (AI or Manual)"
                    className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {MODE_OPTIONS.map(({ value, label }) => (
                      <option key={value || 'all'} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={leadStatusFilter}
                    onChange={(e) => setLeadStatusFilter(e.target.value)}
                    aria-label="Filter by lead status"
                    className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {LEAD_STATUS_OPTIONS.map(({ value, label }) => (
                      <option key={value || 'all'} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={unreadOnly}
                      onChange={(e) => setUnreadOnly(e.target.checked)}
                      aria-label="Unread only"
                      className="rounded border-border-color text-accent focus:ring-accent"
                    />
                    Unread only
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={intentFilter}
                    onChange={(e) => setIntentFilter(e.target.value)}
                    placeholder="Filter by intent…"
                    aria-label="Filter by intent"
                    className="min-w-0 flex-1 rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingList ? (
                <ul className="divide-y divide-border-color" role="list">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <ConversationRowSkeleton key={i} />
                  ))}
                </ul>
              ) : sortedConversations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-6 text-center">
                  <span className="text-4xl text-text-secondary/60" aria-hidden>💬</span>
                  <p className="text-sm font-medium text-text-primary">No conversations yet</p>
                  <p className="text-sm text-text-secondary">
                    When customers message your connected channels, conversations will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border-color" role="list">
                  {sortedConversations.map((conv) => {
                    const displayName = conv.leadName || conv.customerId || 'Unknown';
                    const initials = getInitials(conv.leadName ?? conv.customerId, 'Unknown');
                    const hasUnread = (conv.unreadCount ?? 0) > 0;
                    const isSelected = selectedId === conv.id;
                    return (
                      <li key={conv.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(conv.id);
                            setShowChatPanel(true);
                            setTimeout(() => chatHeaderRef.current?.focus({ preventScroll: true }), 0);
                          }}
                          aria-pressed={isSelected}
                          className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors min-h-[44px] ${
                            isSelected
                              ? 'border-l-4 border-l-(--accent) bg-(--accent-soft)'
                              : 'border-l-4 border-l-transparent hover:bg-bg-secondary/70'
                          }`}
                        >
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-sm font-semibold text-text-secondary"
                            aria-hidden
                          >
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-semibold text-text-primary">
                                {displayName}
                              </span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                {hasUnread && (
                                  <span
                                    className="h-2 w-2 rounded-full bg-(--accent)"
                                    aria-label="Unread"
                                  />
                                )}
                                <span
                                  className="text-xs text-text-secondary"
                                  title={formatTime(conv.updatedAt)}
                                >
                                  {formatRelativeTime(conv.updatedAt)}
                                </span>
                                <AIStatusBadge mode={conv.status} />
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {conv.channelType && (
                                <span className="rounded bg-bg-secondary px-1.5 py-0.5 text-xs font-medium capitalize text-text-secondary">
                                  {conv.channelType}
                                </span>
                              )}
                              {conv.channelName && (
                                <span className="text-xs text-text-secondary">{conv.channelName}</span>
                              )}
                            </div>
                            <p className="line-clamp-2 text-sm text-text-secondary">
                              {conv.lastMessagePreview || '—'}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right: chat — hidden on small until a conversation is selected */}
          <div
            className={`flex min-w-0 flex-1 flex-col rounded-xl border border-border-color bg-card-bg ${showChatPanel ? 'flex' : 'hidden md:flex'}`}
          >
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-text-secondary">
                <span className="text-4xl text-text-secondary/60" aria-hidden>💬</span>
                <p className="text-base font-medium text-text-primary">Select a conversation from the list</p>
                <p className="text-sm">Choose a conversation to view and reply.</p>
              </div>
            ) : (
              <>
                <div
                  ref={chatHeaderRef}
                  tabIndex={-1}
                  className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border-color bg-card-bg p-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowChatPanel(false)}
                      className="shrink-0 rounded-lg p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary md:hidden"
                      aria-label="Back to conversation list"
                    >
                      ← Back
                    </button>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-text-primary">
                        {selected.leadName || selected.customerId || 'Unknown'}
                      </h3>
                      <div className="flex items-center gap-2">
                        {selected.channelType && (
                          <span className="rounded bg-bg-secondary px-1.5 py-0.5 text-xs font-medium capitalize text-text-secondary">
                            {selected.channelType}
                          </span>
                        )}
                        {selected.channelName && (
                          <span className="text-sm text-text-secondary">{selected.channelName}</span>
                        )}
                        <AIStatusBadge mode={selected.status} />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleMode}
                    className="shrink-0 rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    Toggle to {selected.status === 'ai' ? 'Manual' : 'AI'}
                  </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="border-b border-border-color bg-bg-primary/60 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      Session timeline
                    </div>
                    {loadingConversationAnalytics ? (
                      <div className="mb-2 text-xs text-text-secondary">Loading conversation analytics…</div>
                    ) : conversationAnalytics ? (
                      <div className="mb-2 space-y-2 rounded-md border border-border-color bg-card-bg p-2 text-xs text-text-secondary">
                        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <span className="block text-[11px] uppercase tracking-wide">Messages</span>
                            <span className="font-semibold text-text-primary">
                              {conversationAnalytics.message_count} total
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] uppercase tracking-wide">Response</span>
                            <span className="font-semibold text-text-primary">
                              {conversationAnalytics.avg_response_time != null
                                ? `${conversationAnalytics.avg_response_time.toFixed(1)}s avg`
                                : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] uppercase tracking-wide">First reply</span>
                            <span className="font-semibold text-text-primary">
                              {conversationAnalytics.first_response_time != null
                                ? `${conversationAnalytics.first_response_time.toFixed(1)}s`
                                : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[11px] uppercase tracking-wide">Status</span>
                            <span className="font-semibold capitalize text-text-primary">
                              {conversationAnalytics.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={recalculatingConversationAnalytics}
                            onClick={async () => {
                              if (!selectedId) return;
                              setRecalculatingConversationAnalytics(true);
                              try {
                                await recalcConversationAnalytics(selectedId);
                                const updated = await getConversationAnalytics(selectedId);
                                setConversationAnalytics(updated);
                              } finally {
                                setRecalculatingConversationAnalytics(false);
                              }
                            }}
                            className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-[11px] font-semibold text-text-primary hover:border-accent disabled:opacity-60"
                          >
                            {recalculatingConversationAnalytics ? 'Recalculating…' : 'Recalculate'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-2 text-xs text-text-secondary">
                        Conversation analytics not generated yet. Session timeline is still available.
                      </div>
                    )}
                    {loadingSessions ? (
                      <div className="text-xs text-text-secondary">Loading sessions…</div>
                    ) : sessions.length === 0 ? (
                      <div className="text-xs text-text-secondary">
                        No sessions found for this conversation yet.
                      </div>
                    ) : (
                      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                        {sessions.map((session) => (
                          <div
                            key={session.id}
                            className="rounded-md border border-border-color bg-card-bg px-2 py-1.5 text-xs text-text-secondary"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-text-primary">Session #{session.id}</span>
                              <span className="capitalize">{session.status}</span>
                            </div>
                            <div className="mt-0.5">
                              {new Date(session.startedAt).toLocaleString()} · {formatDuration(session.durationSeconds)} · {session.messagesCount} msgs
                            </div>
                            {session.summary && (
                              <div className="mt-0.5 line-clamp-1 text-text-secondary">{session.summary}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto bg-(--bg-secondary)/50 p-4">
                    {loadingMessages ? (
                      <div className="space-y-3" aria-label="Loading messages">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`flex ${i % 2 === 0 ? 'justify-end' : ''}`}
                            aria-hidden
                          >
                            <div className="h-12 w-48 max-w-[80%] animate-pulse rounded-2xl bg-bg-secondary" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {messages.map((m) => (
                          <MessageBubble key={m.id} message={m} />
                        ))}
                        <div ref={endRef} />
                      </>
                    )}
                  </div>
                  <form
                    onSubmit={handleSend}
                    className="flex gap-2 border-t border-border-color bg-card-bg p-4"
                  >
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a reply…"
                      className="min-w-0 flex-1 rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || sendingMessage}
                      className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {sendingMessage ? 'Sending…' : 'Send'}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
  );
}

export default function ConversationsPage() {
  return (
    <ProtectedShell>
      <ConversationsView />
    </ProtectedShell>
  );
}
