import { apiFetch } from '@/lib/api-client';

// Unified Tasks surface (Employee+Task Redesign V2 — Phase 4, Slice 3a: read).
// One list over `task_assignments`, grouped by source task, replacing the split
// between /work, /wa-work, /workstation and /employee-dashboard.

export type TaskChannel = 'in_app' | 'whatsapp';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export interface TaskAssignee {
  assignment_id: number;
  member_id: number;
  member_name: string;
  channel: TaskChannel;
  status: TaskStatus;
  status_raw: string | null;
  responded_at: string | null;
}

export interface TaskGroup {
  source_kind: 'work' | 'wa';
  source_task_id: number;
  channel: TaskChannel;
  title: string | null;
  body: string | null;
  due_at: string | null;
  priority: string | null;
  status: TaskStatus;
  created_at: string | null;
  assignee_count: number;
  done_count: number;
  assignees: TaskAssignee[];
}

export async function listTaskGroups(params?: {
  assignee_member_id?: number;
  channel?: TaskChannel;
  status?: TaskStatus | 'open';
  q?: string;
}): Promise<TaskGroup[]> {
  const qs = new URLSearchParams();
  if (params?.assignee_member_id) qs.set('assignee_member_id', String(params.assignee_member_id));
  if (params?.channel) qs.set('channel', params.channel);
  if (params?.status) qs.set('status', params.status);
  if (params?.q) qs.set('q', params.q);
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch<TaskGroup[]>(`/task-assignments${query}`, { method: 'GET', auth: true });
}

export async function getTaskGroup(sourceKind: 'work' | 'wa', sourceTaskId: number): Promise<TaskGroup> {
  return apiFetch<TaskGroup>(`/task-assignments/${sourceKind}/${sourceTaskId}`, {
    method: 'GET',
    auth: true,
  });
}

export interface TaskCreatePayload {
  title: string;
  assignee_member_id: number;
  channel?: TaskChannel | null;   // omit to auto-pick from member capability
  body?: string | null;
  due_at?: string | null;         // ISO datetime
  priority?: 'low' | 'medium' | 'high';
}

export async function createTask(payload: TaskCreatePayload): Promise<TaskGroup> {
  return apiFetch<TaskGroup>('/task-assignments', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}
