import { create } from 'zustand';
import {
  listNotifications,
  getUnreadCount,
  markAsRead as apiMarkAsRead,
  markAllRead as apiMarkAllRead,
  type NotificationItem,
} from '@/services/notifications';
import { API_BASE_URL } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export interface NotificationState {
  unreadCount: number;
  notifications: NotificationItem[];
  isOpen: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  page: number;
  hasMore: boolean;

  /* Actions */
  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  togglePanel: () => void;
  closePanel: () => void;

  /* SSE lifecycle */
  connectSSE: () => void;
  disconnectSSE: () => void;
}

const PER_PAGE = 30;

/* ── SSE connection state (outside Zustand to avoid reactivity overhead) ── */
let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30_000;

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  notifications: [],
  isOpen: false,
  isLoading: false,
  isLoadingMore: false,
  page: 1,
  hasMore: false,

  fetchUnreadCount: async () => {
    try {
      const res = await getUnreadCount();
      set({ unreadCount: res.count });
    } catch {
      // silently ignore
    }
  },

  fetchNotifications: async () => {
    set({ isLoading: true, page: 1 });
    try {
      const res = await listNotifications(1, PER_PAGE);
      set({
        notifications: res.items,
        unreadCount: res.unread_count,
        isLoading: false,
        page: 1,
        hasMore: res.total > PER_PAGE,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { page, notifications, isLoadingMore } = get();
    if (isLoadingMore) return;
    const nextPage = page + 1;
    set({ isLoadingMore: true });
    try {
      const res = await listNotifications(nextPage, PER_PAGE);
      set((s) => ({
        notifications: [...s.notifications, ...res.items],
        isLoadingMore: false,
        page: nextPage,
        hasMore: s.notifications.length + res.items.length < res.total,
      }));
    } catch {
      set({ isLoadingMore: false });
    }
  },

  markAsRead: async (id: number) => {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
    try {
      await apiMarkAsRead(id);
    } catch {
      get().fetchNotifications();
    }
  },

  markAllRead: async () => {
    const prevNotifications = get().notifications;
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
    try {
      await apiMarkAllRead();
    } catch {
      set({ notifications: prevNotifications });
      get().fetchUnreadCount();
    }
  },

  togglePanel: () => {
    const wasOpen = get().isOpen;
    set({ isOpen: !wasOpen });
    if (!wasOpen) {
      get().fetchNotifications();
    }
  },

  closePanel: () => set({ isOpen: false }),

  connectSSE: () => {
    if (eventSource) return;

    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    clearReconnectTimer();

    const url = `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSource = es;

    es.addEventListener('notification', (e: MessageEvent) => {
      try {
        const notification: NotificationItem = JSON.parse(e.data);
        set((s) => ({
          notifications:
            s.notifications.length > 0
              ? [notification, ...s.notifications]
              : s.notifications,
          unreadCount: s.unreadCount + 1,
        }));
      } catch {
        // malformed SSE data — ignore
      }
    });

    es.addEventListener('unread_count', (e: MessageEvent) => {
      try {
        const { count } = JSON.parse(e.data);
        if (typeof count === 'number') {
          set({ unreadCount: count });
        }
      } catch {
        // ignore
      }
    });

    es.onopen = () => {
      reconnectAttempts = 0;
    };

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        eventSource = null;
        es.close();
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
        clearReconnectTimer();
        reconnectTimer = setTimeout(() => {
          const currentToken = useAuthStore.getState().accessToken;
          if (currentToken) {
            get().connectSSE();
          }
        }, delay);
      }
    };
  },

  disconnectSSE: () => {
    clearReconnectTimer();
    reconnectAttempts = 0;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  },
}));
