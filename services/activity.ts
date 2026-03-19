import { apiFetch } from '@/lib/api-client';

export interface ActivityLogItem {
  id: number;
  actor_user_id: number | null;
  actor_name: string | null;
  action_type: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_name: string | null;
  work_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

export interface ActivityLogPage {
  items: ActivityLogItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ActivityFilters {
  page?: number;
  per_page?: number;
  actor_user_id?: number | null;
  entity_type?: string | null;
  action_type?: string | null;
}

export async function listBusinessActivity(filters: ActivityFilters = {}): Promise<ActivityLogPage> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.per_page) params.set('per_page', String(filters.per_page));
  if (filters.actor_user_id) params.set('actor_user_id', String(filters.actor_user_id));
  if (filters.entity_type) params.set('entity_type', filters.entity_type);
  if (filters.action_type) params.set('action_type', filters.action_type);
  const qs = params.toString();
  return apiFetch<ActivityLogPage>(`/activity${qs ? `?${qs}` : ''}`, { method: 'GET', auth: true });
}

export async function listEmployeeActivity(
  userId: number,
  filters: Omit<ActivityFilters, 'actor_user_id'> = {},
): Promise<ActivityLogPage> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.per_page) params.set('per_page', String(filters.per_page));
  if (filters.entity_type) params.set('entity_type', filters.entity_type);
  if (filters.action_type) params.set('action_type', filters.action_type);
  const qs = params.toString();
  return apiFetch<ActivityLogPage>(`/activity/employee/${userId}${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    auth: true,
  });
}
