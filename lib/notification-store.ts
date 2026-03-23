import { create } from 'zustand';
import {
  listNotifications,
  getUnreadCount,
  markAsRead as apiMarkAsRead,
  markAllRead as apiMarkAllRead,
  type NotificationItem,
} from '@/services/notifications';

export interface NotificationState {
  unreadCount: number;
  notifications: NotificationItem[];
  isOpen: boolean;
  isLoading: boolean;
  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  togglePanel: () => void;
  closePanel: () => void;
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
      // silently ignore — poll will retry
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
}));
