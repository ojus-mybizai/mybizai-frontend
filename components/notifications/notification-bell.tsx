'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useNotificationStore } from '@/lib/notification-store';
import type { NotificationItem } from '@/services/notifications';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

/** Map event_type prefix to a colored dot class. */
function dotColor(eventType: string): string {
  if (eventType.startsWith('lead') || eventType.startsWith('crm')) return 'bg-blue-500';
  if (eventType.startsWith('work') || eventType.startsWith('task')) return 'bg-green-500';
  if (eventType.startsWith('message') || eventType.startsWith('conversation') || eventType.startsWith('chat'))
    return 'bg-purple-500';
  return 'bg-text-secondary';
}

/** Format ISO timestamp into a short relative string. */
function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function NotificationBell() {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const notifications = useNotificationStore((s) => s.notifications);
  const isOpen = useNotificationStore((s) => s.isOpen);
  const isLoading = useNotificationStore((s) => s.isLoading);
  const togglePanel = useNotificationStore((s) => s.togglePanel);
  const closePanel = useNotificationStore((s) => s.closePanel);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        closePanel();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closePanel]);

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.is_read) {
      markAsRead(item.id);
    }
    closePanel();
    if (item.data?.url_path && typeof item.data.url_path === 'string') {
      router.push(item.data.url_path);
    }
  };

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
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

      {/* Dropdown panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg border border-border-color bg-card-bg shadow-lg z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-color px-4 py-3">
            <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-sm text-text-secondary">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-sm text-text-secondary">
                <Bell className="h-8 w-8 mb-2 opacity-30" aria-hidden />
                No notifications yet
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-secondary ${
                    !item.is_read ? 'border-l-2 border-l-accent bg-accent/5' : 'border-l-2 border-l-transparent'
                  }`}
                >
                  {/* Colored dot */}
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor(item.event_type)}`}
                    aria-hidden
                  />

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-tight ${!item.is_read ? 'font-semibold text-text-primary' : 'text-text-primary'}`}>
                      {item.title}
                    </p>
                    {item.body && (
                      <p className="mt-0.5 text-xs text-text-secondary line-clamp-2 leading-snug">
                        {item.body}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-text-secondary/70">{relativeTime(item.created_at)}</p>
                  </div>

                  {/* Read indicator */}
                  {!item.is_read && (
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-accent opacity-50" aria-hidden />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
