'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, CheckCheck, ExternalLink, Loader2 } from 'lucide-react';
import { useNotificationStore } from '@/lib/notification-store';
import type { NotificationItem } from '@/services/notifications';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function dotColor(eventType: string): string {
  if (eventType.startsWith('lead') || eventType.startsWith('crm')) return 'bg-blue-500';
  if (eventType.startsWith('work') || eventType.startsWith('task')) return 'bg-green-500';
  if (
    eventType.startsWith('message') ||
    eventType.startsWith('conversation') ||
    eventType.startsWith('chat') ||
    eventType === 'new_conversation_message'
  )
    return 'bg-purple-500';
  if (eventType === 'template_status_updated') return 'bg-orange-500';
  if (eventType === 'agent_action') return 'bg-accent';
  return 'bg-text-secondary';
}

function categoryLabel(eventType: string): string {
  if (eventType === 'new_conversation_message') return 'Message';
  if (eventType.startsWith('lead')) return 'CRM';
  if (eventType.startsWith('work') || eventType.startsWith('task')) return 'Work';
  if (eventType === 'template_status_updated') return 'Template';
  if (eventType === 'agent_action') return 'Agent';
  return 'System';
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/* Render body text with newline support */
function NotificationBody({ text }: { text: string }) {
  return (
    <p className="mt-1 text-sm text-text-secondary whitespace-pre-wrap leading-relaxed break-words">
      {text}
    </p>
  );
}

/* ─── Single notification card ─────────────────────────────────────────────── */

function NotificationCard({
  item,
  onRead,
  onNavigate,
}: {
  item: NotificationItem;
  onRead: (id: number) => void;
  onNavigate: (item: NotificationItem) => void;
}) {
  const hasLink = !!item.data?.url_path;

  return (
    <div
      className={`group relative px-4 py-4 transition-colors hover:bg-bg-secondary ${
        !item.is_read ? 'border-l-2 border-l-accent bg-accent/[0.03]' : 'border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Colored dot */}
        <div className="mt-1.5 flex-shrink-0">
          <span className={`block h-2.5 w-2.5 rounded-full ${dotColor(item.event_type)}`} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Category + time row */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary/60">
              {categoryLabel(item.event_type)}
            </span>
            <span className="text-[10px] text-text-secondary/50 flex-shrink-0">
              {relativeTime(item.created_at)}
            </span>
          </div>

          {/* Title */}
          <p className={`text-sm leading-snug ${!item.is_read ? 'font-semibold text-text-primary' : 'font-medium text-text-primary'}`}>
            {item.title}
          </p>

          {/* Body — full text, newlines preserved */}
          {item.body && item.body.trim() && (
            <NotificationBody text={item.body} />
          )}

          {/* Action row */}
          <div className="mt-2.5 flex items-center gap-3">
            {hasLink && (
              <button
                type="button"
                onClick={() => onNavigate(item)}
                className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                View
              </button>
            )}
            {!item.is_read && (
              <button
                type="button"
                onClick={() => onRead(item.id)}
                className="text-xs text-text-secondary/60 hover:text-text-secondary transition-colors"
              >
                Mark read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export default function NotificationBell() {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount    = useNotificationStore((s) => s.unreadCount);
  const notifications  = useNotificationStore((s) => s.notifications);
  const isOpen         = useNotificationStore((s) => s.isOpen);
  const isLoading      = useNotificationStore((s) => s.isLoading);
  const isLoadingMore  = useNotificationStore((s) => s.isLoadingMore);
  const hasMore        = useNotificationStore((s) => s.hasMore);
  const togglePanel    = useNotificationStore((s) => s.togglePanel);
  const closePanel     = useNotificationStore((s) => s.closePanel);
  const markAsRead     = useNotificationStore((s) => s.markAsRead);
  const markAllRead    = useNotificationStore((s) => s.markAllRead);
  const loadMore       = useNotificationStore((s) => s.loadMore);
  const connectSSE     = useNotificationStore((s) => s.connectSSE);
  const disconnectSSE  = useNotificationStore((s) => s.disconnectSSE);

  useEffect(() => {
    connectSSE();
    return () => disconnectSSE();
  }, [connectSSE, disconnectSSE]);

  /* Close on Escape key */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, closePanel]);

  /* Prevent body scroll when panel is open */
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleNavigate = (item: NotificationItem) => {
    if (!item.is_read) markAsRead(item.id);
    closePanel();
    if (item.data?.url_path && typeof item.data.url_path === 'string') {
      router.push(item.data.url_path);
    }
  };

  const unread = notifications.filter((n) => !n.is_read);
  const read   = notifications.filter((n) =>  n.is_read);

  return (
    <>
      {/* ── Bell button ───────────────────────────────────────────── */}
      <button
        type="button"
        onClick={togglePanel}
        aria-label="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-color bg-bg-secondary text-text-secondary hover:bg-accent-soft hover:text-text-primary transition-colors"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Backdrop ──────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          onClick={closePanel}
          aria-hidden
        />
      )}

      {/* ── Slide-over panel ──────────────────────────────────────── */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-card-bg shadow-2xl transition-transform duration-300 ease-in-out sm:w-[460px] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Notifications panel"
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border-color px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Bell className="h-4 w-4 text-text-secondary" aria-hidden />
            <h2 className="text-base font-semibold text-text-primary">Notifications</h2>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close notifications"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-text-secondary">
              <Bell className="h-10 w-10 mb-3 opacity-20" aria-hidden />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="mt-1 text-xs opacity-60">You're all caught up!</p>
            </div>
          ) : (
            <>
              {/* Unread section */}
              {unread.length > 0 && (
                <div>
                  <div className="sticky top-0 z-10 bg-card-bg/90 backdrop-blur-sm border-b border-border-color px-5 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary/60">
                      Unread · {unread.length}
                    </span>
                  </div>
                  <div className="divide-y divide-border-color/50">
                    {unread.map((item) => (
                      <NotificationCard
                        key={item.id}
                        item={item}
                        onRead={markAsRead}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Read section */}
              {read.length > 0 && (
                <div>
                  <div className="sticky top-0 z-10 bg-card-bg/90 backdrop-blur-sm border-b border-border-color px-5 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary/60">
                      Earlier
                    </span>
                  </div>
                  <div className="divide-y divide-border-color/50">
                    {read.map((item) => (
                      <NotificationCard
                        key={item.id}
                        item={item}
                        onRead={markAsRead}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center px-5 py-5">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2 rounded-lg border border-border-color px-4 py-2 text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      'Load more'
                    )}
                  </button>
                </div>
              )}

              {/* End of list */}
              {!hasMore && notifications.length > 0 && (
                <p className="py-6 text-center text-xs text-text-secondary/40">
                  You've seen all notifications
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
