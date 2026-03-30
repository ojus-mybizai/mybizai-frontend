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

  /* Actions */
  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  togglePanel: () => void;
  closePanel: () => void;

  /* SSE lifecycle */
  connectSSE: () => void;
  disconnectSSE: () => void;
}

/* ── SSE connection state (outside Zustand to avoid reactivity overhead) ── */
let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30_000; // 30s cap

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

  fetchUnreadCount: async () => {
    try {
      const res = await getUnreadCount();
      set({ unreadCount: res.count });
    } catch {
      // silently ignore
    }
  },

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const res = await listNotifications(1, 20);
      set({ notifications: res.items, unreadCount: res.unread_count, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: number) => {
    // Optimistic update
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
    try {
      await apiMarkAsRead(id);
    } catch {
      // Revert on failure
      get().fetchNotifications();
    }
  },

  markAllRead: async () => {
    // Optimistic update
    const prevNotifications = get().notifications;
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
    try {
      await apiMarkAllRead();
    } catch {
      // Revert on failure
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

  /* ─────────────────────────────────────────────────────────
   * SSE — Server-Sent Events connection management
   *
   * EventSource doesn't support Authorization headers natively.
   * We pass the token as a query parameter. The backend accepts
   * both header and query-based auth for the SSE endpoint.
   * ───────────────────────────────────────────────────────── */
  connectSSE: () => {
    // Avoid duplicate connections
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
          // Prepend new notification to list (if panel was loaded)
          notifications:
            s.notifications.length > 0
              ? [notification, ...s.notifications].slice(0, 50)
              : s.notifications,
          // Increment unread count
          unreadCount: s.unreadCount + 1,
        }));
      } catch {
        // Malformed SSE data — ignore
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
      reconnectAttempts = 0; // Reset backoff on successful connection
    };

    es.onerror = () => {
      // EventSource auto-reconnects on transient errors, but if it
      // enters CLOSED state we need to manually reconnect with backoff.
      if (es.readyState === EventSource.CLOSED) {
        eventSource = null;
        es.close();

        // Exponential backoff: 1s, 2s, 4s, 8s ... capped at 30s
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);

        clearReconnectTimer();
        reconnectTimer = setTimeout(() => {
          // Only reconnect if user is still authenticated
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
