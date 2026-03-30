import { apiFetch } from '@/lib/api-client';

export interface NotificationItem {
  id: number;
  event_type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string | null;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  unread_count: number;
  page: number;
  per_page: number;
}

export interface UnreadCountResponse {
  count: number;
}

export interface NotificationPreferences {
  [eventType: string]: { in_app: boolean; email: boolean; push: boolean };
}

export async function listNotifications(
  page = 1,
  perPage = 20,
  unreadOnly = false,
): Promise<NotificationListResponse> {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (perPage) params.set('per_page', String(perPage));
  if (unreadOnly) params.set('unread_only', 'true');
  const qs = params.toString();
  return apiFetch<NotificationListResponse>(`/notifications${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    auth: true,
  });
}

export async function getUnreadCount(): Promise<UnreadCountResponse> {
  return apiFetch<UnreadCountResponse>('/notifications/unread-count', {
    method: 'GET',
    auth: true,
  });
}

export async function markAsRead(id: number): Promise<void> {
  return apiFetch<void>(`/notifications/${id}/read`, {
    method: 'PATCH',
    auth: true,
  });
}

export async function markAllRead(): Promise<void> {
  return apiFetch<void>('/notifications/mark-all-read', {
    method: 'POST',
    auth: true,
  });
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return apiFetch<NotificationPreferences>('/notifications/preferences', {
    method: 'GET',
    auth: true,
  });
}

export async function updateNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<NotificationPreferences> {
  return apiFetch<NotificationPreferences>('/notifications/preferences', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(prefs),
  });
}
