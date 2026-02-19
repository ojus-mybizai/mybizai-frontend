import { apiFetch } from '@/lib/api-client';

export interface WorkType {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Work {
  id: number;
  business_id: number;
  work_type_id: number;
  work_type_name: string;
  assigned_to_id: number;
  assigned_to_name: string;
  lead_id: number | null;
  lead_name: string | null;
  title: string | null;
  notes: string | null;
  status: string;
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WorkCreate {
  work_type_id: number;
  assigned_to_id: number;
  lead_id?: number | null;
  title?: string | null;
  notes?: string | null;
  priority?: 'low' | 'medium' | 'high';
  due_date?: string | null;
}

export interface WorkUpdate {
  work_type_id?: number;
  assigned_to_id?: number;
  lead_id?: number | null;
  title?: string | null;
  notes?: string | null;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  due_date?: string | null;
}

export interface WorkBulkUpdate {
  work_ids: number[];
  assigned_to_id?: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
}

export interface WorkListFilters {
  page?: number;
  per_page?: number;
  assigned_to_id?: number | null;
  lead_id?: number | null;
  work_type_id?: number | null;
  status?: string | null;
  priority?: 'low' | 'medium' | 'high' | null;
  overdue?: boolean | null;
  q?: string | null;
}

export interface WorkListResponse {
  items: Work[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface WorkStatsByType {
  work_type_id: number;
  work_type_name: string;
  count: number;
}

export interface WorkStatsByEmployee {
  user_id: number;
  name: string;
  count: number;
}

export interface WorkStats {
  total: number;
  by_status: Record<string, number>;
  by_type: WorkStatsByType[];
  by_employee: WorkStatsByEmployee[];
}

export interface WorkTemplate {
  id: number;
  business_id: number;
  name: string;
  work_type_id: number;
  work_type_name: string;
  default_assigned_to_id: number | null;
  default_assigned_to_name: string | null;
  default_title: string | null;
  default_notes: string | null;
  default_due_days: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WorkTemplateCreate {
  name: string;
  work_type_id: number;
  default_assigned_to_id?: number | null;
  default_title?: string | null;
  default_notes?: string | null;
  default_due_days?: number | null;
  is_active?: boolean;
}

export type WorkTemplateUpdate = Partial<WorkTemplateCreate>;

export interface WorkCreateFromTemplate {
  work_type_id?: number;
  assigned_to_id?: number;
  lead_id?: number | null;
  title?: string | null;
  notes?: string | null;
  priority?: 'low' | 'medium' | 'high';
  due_date?: string | null;
}

export async function listWorkTypes(): Promise<WorkType[]> {
  return apiFetch<WorkType[]>('/work/types', { method: 'GET', auth: true });
}

export async function createWorkType(payload: { name: string; description?: string | null; is_active?: boolean }): Promise<WorkType> {
  return apiFetch<WorkType>('/work/types', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateWorkType(
  typeId: number,
  payload: { name?: string; description?: string | null; is_active?: boolean }
): Promise<WorkType> {
  return apiFetch<WorkType>(`/work/types/${typeId}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function listWork(filters: WorkListFilters = {}): Promise<WorkListResponse> {
  const params = new URLSearchParams();
  if (filters.page != null) params.set('page', String(filters.page));
  if (filters.per_page != null) params.set('per_page', String(filters.per_page));
  if (filters.assigned_to_id != null) params.set('assigned_to_id', String(filters.assigned_to_id));
  if (filters.lead_id != null) params.set('lead_id', String(filters.lead_id));
  if (filters.work_type_id != null) params.set('work_type_id', String(filters.work_type_id));
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.overdue != null) params.set('overdue', String(filters.overdue));
  if (filters.q) params.set('q', filters.q);
  const qs = params.toString();
  return apiFetch<WorkListResponse>(`/work${qs ? `?${qs}` : ''}`, { method: 'GET', auth: true });
}

export async function getWork(workId: number): Promise<Work> {
  return apiFetch<Work>(`/work/${workId}`, { method: 'GET', auth: true });
}

export async function createWork(payload: WorkCreate): Promise<Work> {
  return apiFetch<Work>('/work', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateWork(workId: number, payload: WorkUpdate): Promise<Work> {
  return apiFetch<Work>(`/work/${workId}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteWork(workId: number): Promise<void> {
  await apiFetch<void>(`/work/${workId}`, { method: 'DELETE', auth: true });
}

export async function bulkCreateWork(payload: { items: WorkCreate[] }): Promise<Work[]> {
  return apiFetch<Work[]>('/work/bulk', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function bulkUpdateWork(payload: WorkBulkUpdate): Promise<Work[]> {
  return apiFetch<Work[]>('/work/bulk', {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getWorkStats(): Promise<WorkStats> {
  return apiFetch<WorkStats>('/work/stats', { method: 'GET', auth: true });
}

export async function listWorkTemplates(): Promise<WorkTemplate[]> {
  return apiFetch<WorkTemplate[]>('/work/templates', { method: 'GET', auth: true });
}

export async function createWorkTemplate(payload: WorkTemplateCreate): Promise<WorkTemplate> {
  return apiFetch<WorkTemplate>('/work/templates', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateWorkTemplate(templateId: number, payload: WorkTemplateUpdate): Promise<WorkTemplate> {
  return apiFetch<WorkTemplate>(`/work/templates/${templateId}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteWorkTemplate(templateId: number): Promise<void> {
  await apiFetch<void>(`/work/templates/${templateId}`, { method: 'DELETE', auth: true });
}

export async function createWorkFromTemplate(templateId: number, payload: WorkCreateFromTemplate): Promise<Work> {
  return apiFetch<Work>(`/work/templates/${templateId}/create-work`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}
