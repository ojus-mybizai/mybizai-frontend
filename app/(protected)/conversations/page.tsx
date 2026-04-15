'use client';

import { FormEvent, memo, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid, MessageCircle, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AIStatusBadge } from '@/components/customers/ai-status-badge';
import { MessageBubble } from '@/components/customers/message-bubble';
import { ConversationRowSkeleton } from '@/components/conversations/ConversationRowSkeleton';
import { TemplatePickerModal } from '@/components/conversations/TemplatePickerModal';
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
import { switchConversationAgent, listAgentsForBusiness, type AgentSummary } from '@/services/conversations';
import { useDebounce } from '@/lib/use-debounce';

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

const ConversationRow = memo(function ConversationRow({
  conv,
  isSelected,
  onSelect,
}: {
  conv: InboxConversation;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const displayName = conv.leadName || conv.customerId || 'Unknown';
  const initials = getInitials(conv.leadName ?? conv.customerId, 'Unknown');
  const hasUnread = (conv.unreadCount ?? 0) > 0;
  return (
    <li className="py-1">
      <button
        type="button"
        onClick={() => onSelect(conv.id)}
        aria-pressed={isSelected}
        className={`flex w-full items-start gap-3 rounded-lg px-4 py-3 text-left transition-colors min-h-[60px] ${
          isSelected
            ? 'border-l-4 border-l-(--accent) bg-(--accent-soft)'
            : 'border-l-4 border-l-transparent hover:bg-bg-secondary/50'
        }`}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-sm font-semibold text-text-secondary"
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-text-primary">
              {displayName}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {hasUnread && (
                <span className="h-2 w-2 rounded-full bg-(--accent)" aria-label="Unread" />
              )}
              <span className="text-xs text-text-secondary" title={formatTime(conv.updatedAt)}>
                {formatRelativeTime(conv.updatedAt)}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {conv.channelType && (
              <span className="text-xs font-medium capitalize text-text-secondary">
                {conv.channelType}
              </span>
            )}
            {conv.channelName && (
              <span className="text-xs text-text-secondary truncate max-w-[120px]">
                {conv.channelName}
              </span>
            )}
            <AIStatusBadge mode={conv.status} />
            {conv.agentName && conv.agentName !== '—' && (
              <span
                className="inline-flex items-center rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                title={`Agent: ${conv.agentName}`}
              >
                {conv.agentName}
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-sm text-text-secondary mt-1">
            {conv.lastMessagePreview || '—'}
          </p>
        </div>
      </button>
    </li>
  );
});

const CHANNEL_OPTIONS: { value: string; label: string; icon: typeof LayoutGrid; color: string }[] = [
  { value: '', label: 'All', icon: LayoutGrid, color: 'bg-accent text-white' },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'bg-emerald-600/90 text-white hover:bg-emerald-600' },
  { value: 'instagram', label: 'Instagram', icon: MessageCircle, color: 'bg-pink-600/90 text-white hover:bg-pink-600' },
  { value: 'messenger', label: 'Messenger', icon: MessageCircle, color: 'bg-blue-600/90 text-white hover:bg-blue-600' },
];

const MODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'ai', label: 'AI' },
  { value: 'manual', label: 'Manual' },
];


export function ConversationsView({ initialConversationId, agentFilter }: { initialConversationId?: string; agentFilter?: string }) {
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
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [intentFilter, setIntentFilter] = useState('');
  const debouncedIntent = useDebounce(intentFilter, 300);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(!!initialConversationId);
  const [detailTab, setDetailTab] = useState<'chat' | 'analytics'>('chat');
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
      intent: debouncedIntent.trim() || undefined,
      unread_only: unreadOnly || undefined,
      agent_name: agentFilter || undefined,
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
  }, [channelFilter, modeFilter, debouncedIntent, unreadOnly, agentFilter]);

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

  const sortedConversations = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
        <div className="flex h-[calc(100vh-3.5rem)] min-h-0 w-full flex-col md:flex-row">
          {/* Left: conversation list — full width on small when list visible; hidden when chat open on small */}
          <div
            className={`flex min-h-0 w-full flex-col border-r border-border-color bg-card-bg md:w-80 md:shrink-0 ${showChatPanel ? 'hidden md:flex' : 'flex'}`}
          >
            <div className="flex items-start justify-between px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Conversations</h2>
                <p className="text-sm text-text-secondary mt-1">Select one to view and reply</p>
              </div>
              <Link
                href="/message-templates"
                title="Manage message templates"
                className="mt-0.5 flex-none rounded-lg border border-border-color bg-bg-primary p-2 text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
              >
                <FileText className="h-4 w-4" />
              </Link>
            </div>
            {/* Channel filter buttons */}
            <div className="flex flex-wrap gap-1.5 px-3 py-2" role="group" aria-label="Filter by channel">
              {CHANNEL_OPTIONS.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value || 'all'}
                  type="button"
                  onClick={() => setChannelFilter(value)}
                  aria-label={value ? `Filter by channel: ${label}` : 'Show all channels'}
                  aria-pressed={channelFilter === value}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    channelFilter === value ? color : 'bg-bg-secondary text-text-secondary hover:bg-bg-primary hover:text-text-primary'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            {/* Smart filters: collapsible on small screens */}
            <div>
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-text-primary md:hidden"
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
                className={`flex flex-col gap-2 p-3 ${filtersOpen ? 'flex' : 'hidden'} md:flex`}
              >
                <p className="hidden px-0 text-xs font-medium uppercase tracking-wide text-text-secondary md:block">Filters</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={modeFilter}
                    onChange={(e) => setModeFilter(e.target.value)}
                    aria-label="Filter by mode (AI or Manual)"
                    className="rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {MODE_OPTIONS.map(({ value, label }) => (
                      <option key={value || 'all'} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={unreadOnly}
                      onChange={(e) => setUnreadOnly(e.target.checked)}
                      aria-label="Unread only"
                      className="rounded border-border-color text-accent focus:ring-accent"
                    />
                    <span className="ml-2">Unread only</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={intentFilter}
                  onChange={(e) => setIntentFilter(e.target.value)}
                  placeholder="Filter by intent…"
                  aria-label="Filter by intent"
                  className="min-w-0 flex-1 rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                />
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
                <div className="flex flex-col items-center p-4 text-center">
                  <span className="text-4xl text-text-secondary/60" aria-hidden>💬</span>
                  <p className="text-sm font-medium text-text-primary">No conversations yet</p>
                  <p className="text-sm text-text-secondary">
                    When customers message your connected channels, conversations will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border-color px-2 pb-2" role="list">
                  {sortedConversations.map((conv) => (
                    <ConversationRow
                      key={conv.id}
                      conv={conv}
                      isSelected={selectedId === conv.id}
                      onSelect={(id) => {
                        setSelectedId(id);
                        setShowChatPanel(true);
                        setTimeout(() => chatHeaderRef.current?.focus({ preventScroll: true }), 0);
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right: chat — hidden on small until a conversation is selected; no right border to avoid gap */}
          <div
            className={`flex min-w-0 flex-1 flex-col border-y border-l border-border-color border-r-0 bg-card-bg ${showChatPanel ? 'flex' : 'hidden md:flex'}`}
          >
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center p-4 text-center text-text-secondary">
                <span className="text-4xl text-text-secondary/60" aria-hidden>💬</span>
                <p className="text-base font-medium text-text-primary">Select a conversation from the list</p>
                <p className="text-sm">Choose a conversation to view and reply.</p>
              </div>
            ) : (
              <>
                <div
                  ref={chatHeaderRef}
                  tabIndex={-1}
                  className="sticky top-0 z-10 flex flex-wrap items-center justify-between border-b border-border-color bg-card-bg px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowChatPanel(false)}
                      className="shrink-0 rounded-md p-2 text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary md:hidden"
                      aria-label="Back to conversation list"
                    >
                      ← Back
                    </button>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-text-primary">
                        {selected.leadName || selected.customerId || 'Unknown'}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {selected.channelType && (
                          <span className="rounded-md bg-bg-secondary px-2 py-0.5 text-xs font-medium capitalize text-text-secondary">
                            {selected.channelType}
                          </span>
                        )}
                        {selected.channelName && (
                          <span className="text-sm text-text-secondary">{selected.channelName}</span>
                        )}
                        <AIStatusBadge mode={selected.status} />
                        {selected.agentName && selected.agentName !== '—' && (
                          <span className="inline-flex items-center rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            Agent: {selected.agentName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Agent switch dropdown */}
                    <div className="relative" data-agent-dropdown>
                      <button
                        type="button"
                        onClick={() => setAgentSwitchOpen((o) => !o)}
                        disabled={switchingAgent}
                        className="shrink-0 rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                      >
                        {switchingAgent ? 'Switching...' : 'Switch Agent'}
                      </button>
                      {agentSwitchOpen && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-border-color bg-card-bg shadow-lg">
                          <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-secondary border-b border-border-color">
                            Select Agent
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
                    <button
                      type="button"
                      onClick={handleToggleMode}
                      className="shrink-0 rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      Toggle to {selected.status === 'ai' ? 'Manual' : 'AI'}
                    </button>
                  </div>
                </div>

                {/* Tab bar: Chat | Session analytics */}
                <div className="flex gap-1 border-b border-border-color bg-bg-primary/50 px-4 py-2" role="tablist" aria-label="Conversation view">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={detailTab === 'chat'}
                    aria-controls="conversation-chat-panel"
                    id="tab-chat"
                    onClick={() => setDetailTab('chat')}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      detailTab === 'chat'
                        ? 'bg-accent text-white'
                        : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                    }`}
                  >
                    Chat
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={detailTab === 'analytics'}
                    aria-controls="conversation-analytics-panel"
                    id="tab-analytics"
                    onClick={() => setDetailTab('analytics')}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      detailTab === 'analytics'
                        ? 'bg-accent text-white'
                        : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                    }`}
                  >
                    Session analytics
                  </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {detailTab === 'chat' && (
                    <>
                      <div
                        id="conversation-chat-panel"
                        role="tabpanel"
                        aria-labelledby="tab-chat"
                        className="flex-1 overflow-y-auto bg-(--bg-secondary)/50 p-4"
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
                        className="flex items-center gap-2 border-t border-border-color bg-card-bg p-4"
                      >
                        {/* Template message button */}
                        <button
                          type="button"
                          onClick={() => setTemplateModalOpen(true)}
                          title="Send template message"
                          className="flex-none rounded-lg border border-border-color bg-bg-primary p-2.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                          <FileText className="h-5 w-5" />
                        </button>
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
                  )}

                  {detailTab === 'analytics' && (
                    <div
                      id="conversation-analytics-panel"
                      role="tabpanel"
                      aria-labelledby="tab-analytics"
                      className="flex-1 overflow-y-auto p-4"
                    >
                      <div className="space-y-4">
                        {loadingConversationAnalytics ? (
                          <p className="text-sm text-text-secondary">Loading conversation analytics…</p>
                        ) : conversationAnalytics ? (
                          <div className="rounded-lg border border-border-color bg-card-bg p-4 text-text-secondary">
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                              <div>
                                <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary">Messages</span>
                                <span className="mt-1 block text-sm font-semibold text-text-primary">
                                  {conversationAnalytics.message_count} total
                                </span>
                              </div>
                              <div>
                                <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary">Response</span>
                                <span className="mt-1 block text-sm font-semibold text-text-primary">
                                  {conversationAnalytics.avg_response_time != null
                                    ? `${conversationAnalytics.avg_response_time.toFixed(1)}s avg`
                                    : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary">First reply</span>
                                <span className="mt-1 block text-sm font-semibold text-text-primary">
                                  {conversationAnalytics.first_response_time != null
                                    ? `${conversationAnalytics.first_response_time.toFixed(1)}s`
                                    : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary">Status</span>
                                <span className="mt-1 block text-sm font-semibold capitalize text-text-primary">
                                  {conversationAnalytics.status}
                                </span>
                              </div>
                              {/* LLM cost total across all sessions */}
                              {sessions.length > 0 && (() => {
                                const totalCost = sessions.reduce((s, sess) => s + (sess.llmCostUsd || 0), 0);
                                const totalRuns = sessions.reduce((s, sess) => s + (sess.llmRunsCount || 0), 0);
                                const totalTok = sessions.reduce((s, sess) => s + (sess.llmInputTokens || 0) + (sess.llmOutputTokens || 0), 0);
                                if (totalRuns === 0) return null;
                                return (
                                  <div>
                                    <span className="block text-xs font-medium uppercase tracking-wide text-text-secondary">LLM Cost</span>
                                    <span className="mt-1 block text-sm font-semibold text-text-primary">
                                      {totalCost < 0.01 ? `$${totalCost.toFixed(6)}` : `$${totalCost.toFixed(4)}`}
                                    </span>
                                    <span className="block text-xs text-text-secondary">
                                      {totalRuns} runs · {totalTok.toLocaleString()} tok
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="mt-4 flex justify-end">
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
                                className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent disabled:opacity-60"
                              >
                                {recalculatingConversationAnalytics ? 'Recalculating…' : 'Recalculate'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-text-secondary">
                            Conversation analytics not generated yet. Session timeline is still available below.
                          </p>
                        )}
                        <div>
                          <h4 className="text-sm font-semibold text-text-primary mb-2">Session timeline</h4>
                          {loadingSessions ? (
                            <p className="text-sm text-text-secondary">Loading sessions…</p>
                          ) : sessions.length === 0 ? (
                            <p className="text-sm text-text-secondary">No sessions found for this conversation yet.</p>
                          ) : (
                            <ul className="space-y-2">
                              {sessions.map((session) => {
                                const hasCost = session.llmCostUsd > 0 || session.llmRunsCount > 0;
                                const costStr = session.llmCostUsd < 0.01
                                  ? `$${session.llmCostUsd.toFixed(6)}`
                                  : `$${session.llmCostUsd.toFixed(4)}`;
                                const totalTok = (session.llmInputTokens || 0) + (session.llmOutputTokens || 0);
                                return (
                                  <li
                                    key={session.id}
                                    className="rounded-lg border border-border-color bg-card-bg p-3 text-sm text-text-secondary"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-text-primary">Session #{session.id}</span>
                                      <span className="capitalize text-text-primary">{session.status}</span>
                                    </div>
                                    <div className="mt-1 text-xs">
                                      {new Date(session.startedAt).toLocaleString()} · {formatDuration(session.durationSeconds)} · {session.messagesCount} msgs
                                    </div>
                                    {hasCost && (
                                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                                        <span className="font-medium text-text-primary">LLM: {costStr}</span>
                                        <span>{session.llmRunsCount} run{session.llmRunsCount === 1 ? '' : 's'}</span>
                                        {totalTok > 0 && <span>{totalTok.toLocaleString()} tok</span>}
                                        {session.llmCachedInputTokens > 0 && (
                                          <span className="text-emerald-600">{session.llmCachedInputTokens.toLocaleString()} cached</span>
                                        )}
                                      </div>
                                    )}
                                    {session.summary && (
                                      <div className="mt-1 line-clamp-2 text-text-secondary">{session.summary}</div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Toast notification */}
          {toastMessage && (
            <div className={`fixed bottom-6 right-6 z-50 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
              toastType === 'error'
                ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300'
                : 'border-border-color bg-card-bg text-text-primary'
            }`}>
              {toastMessage}
            </div>
          )}
        </div>
  );
}

export default function ConversationsPage() {
  // Read ?agent= query parameter for agent-filtered conversation views
  const [agentFilter, setAgentFilter] = useState<string | undefined>();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const agent = params.get('agent');
      if (agent) setAgentFilter(agent);
    }
  }, []);

  return <ConversationsView agentFilter={agentFilter} />;
}
