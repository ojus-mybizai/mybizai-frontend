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
  due_date?: string | null;
}

export interface WorkUpdate {
  work_type_id?: number;
  assigned_to_id?: number;
  lead_id?: number | null;
  title?: string | null;
  notes?: string | null;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string | null;
}

export interface WorkListFilters {
  page?: number;
  per_page?: number;
  assigned_to_id?: number | null;
  work_type_id?: number | null;
  status?: string | null;
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
  if (filters.work_type_id != null) params.set('work_type_id', String(filters.work_type_id));
  if (filters.status) params.set('status', filters.status);
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

export async function getWorkStats(): Promise<WorkStats> {
  return apiFetch<WorkStats>('/work/stats', { method: 'GET', auth: true });
}
