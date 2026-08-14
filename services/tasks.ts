import { apiFetch } from '@/lib/api-client';

export interface Task {
  id: number;
  title: string;
  instructions: string | null;
  type: 'simple' | 'app_action';
  assignee_member_id: number | null;
  assignee_name: string | null;
  created_by_member_id: number | null;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  due_at: string | null;
  delivery_channel: string;
  contact_id: number | null;
  datasheet_id: number | null;
  record_id: number | null;
  completion_condition: Record<string, unknown> | null;
  deep_link_path: string | null;
  source: string;
  is_overdue: boolean;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Task Reminder Spec §2.3
  next_reminder_at: string | null;
  last_reminded_at: string | null;
  reminder_count: number;
  snoozed_until: string | null;
  reminder_status: 'active' | 'snoozed' | 'pending_wa_window' | 'escalated' | 'off';
  snooze_hours_override: number | null;
}

export interface TaskComment {
  id: number;
  task_id: number;
  author_member_id: number | null;
  author_name: string | null;
  body: string;
  channel: string;
  created_at: string | null;
}

export interface TaskEvent {
  id: number;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  channel: string | null;
  actor_member_id: number | null;
  actor_name: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
}

export interface TaskCreatePayload {
  title: string;
  instructions?: string;
  type?: 'simple' | 'app_action';
  assignee_member_id: number;
  priority?: 'low' | 'normal' | 'high';
  due_at?: string;
  delivery_channel?: string;
  contact_id?: number;
  datasheet_id?: number;
  record_id?: number;
  completion_condition?: Record<string, unknown>;
  deep_link_path?: string;
  source?: string;
  snooze_hours_override?: number | null;
}

export async function listTasks(params?: {
  status?: string;
  assignee_member_id?: number;
  contact_id?: number;
  datasheet_id?: number;
  type?: string;
  priority?: string;
}): Promise<Task[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.assignee_member_id) qs.set('assignee_member_id', String(params.assignee_member_id));
  if (params?.contact_id) qs.set('contact_id', String(params.contact_id));
  if (params?.datasheet_id) qs.set('datasheet_id', String(params.datasheet_id));
  if (params?.type) qs.set('type', params.type);
  if (params?.priority) qs.set('priority', params.priority);
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch<Task[]>(`/tasks${query}`, { method: 'GET', auth: true });
}

export async function getTask(id: number): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`, { method: 'GET', auth: true });
}

export async function createTask(payload: TaskCreatePayload): Promise<Task> {
  return apiFetch<Task>('/tasks', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function startTask(id: number): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/start`, { method: 'POST', auth: true });
}

export async function completeTask(id: number): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/complete`, { method: 'POST', auth: true });
}

export async function cancelTask(id: number): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/cancel`, { method: 'POST', auth: true });
}

export async function reassignTask(id: number, assignee_member_id: number): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/reassign`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ assignee_member_id }),
  });
}

export async function listTaskComments(taskId: number): Promise<TaskComment[]> {
  return apiFetch<TaskComment[]>(`/tasks/${taskId}/comments`, { method: 'GET', auth: true });
}

export async function addTaskComment(taskId: number, body: string): Promise<TaskComment> {
  return apiFetch<TaskComment>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ body }),
  });
}

export async function listTaskEvents(taskId: number): Promise<TaskEvent[]> {
  return apiFetch<TaskEvent[]>(`/tasks/${taskId}/events`, { method: 'GET', auth: true });
}
