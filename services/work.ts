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
  work_template_id?: number | null;
  template_type?: 'simple' | 'checklist' | 'datasheet' | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface WorkStepOut {
  id: number;
  work_id: number;
  order: number;
  label: string;
  completed_at: string | null;
  completed_by_id: number | null;
}

export interface AssignedRecordOut {
  dynamic_record_id: number;
  data: Record<string, unknown>;
  status: string;
  sort_order: number;
  updated_at: string | null;
}

export interface WorkEventOut {
  id: number;
  work_id: number;
  event_type: string;
  actor_user_id: number | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
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
  template_type?: 'simple' | 'checklist' | 'datasheet';
  steps_schema?: Array<{ order: number; label: string }> | null;
  linked_dynamic_model_id?: number | null;
  datasheet_ui_schema?: DatasheetUiSchema | null;
}

export interface DatasheetUiSchema {
  display_fields?: string[];
  editable_fields?: string[];
  record_actions?: Array<{ type: string; label: string; field: string }>;
  auto_complete_work_when_all_done?: boolean;
}

export interface WorkTemplateCreate {
  name: string;
  work_type_id: number;
  default_assigned_to_id?: number | null;
  default_title?: string | null;
  default_notes?: string | null;
  default_due_days?: number | null;
  is_active?: boolean;
  template_type?: 'simple' | 'checklist' | 'datasheet';
  steps_schema?: Array<{ order: number; label: string }> | null;
  linked_dynamic_model_id?: number | null;
  datasheet_ui_schema?: Record<string, unknown> | null;
  execution_rules?: Record<string, unknown> | null;
}

export type WorkTemplateUpdate = Partial<WorkTemplateCreate>;

export interface RecordFilterRow {
  field: string;
  op?: string;
  value?: unknown;
}

export interface WorkCreateFromTemplate {
  work_type_id?: number;
  assigned_to_id?: number;
  lead_id?: number | null;
  title?: string | null;
  notes?: string | null;
  priority?: 'low' | 'medium' | 'high';
  due_date?: string | null;
  record_ids?: number[] | null;
  record_limit?: number | null;
  /** For datasheet: filter which records to assign e.g. [{ field: "payment", op: "eq", value: "pending" }] */
  record_filters?: RecordFilterRow[] | null;
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

export async function getWorkTemplate(templateId: number): Promise<WorkTemplate> {
  const list = await apiFetch<WorkTemplate[]>('/work/templates', { method: 'GET', auth: true });
  const t = list.find((x) => x.id === templateId);
  if (!t) throw new Error('Template not found');
  return t;
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

export async function getWorkSteps(workId: number): Promise<WorkStepOut[]> {
  return apiFetch<WorkStepOut[]>(`/work/${workId}/steps`, { method: 'GET', auth: true });
}

export async function completeWorkStep(workId: number, stepOrder: number): Promise<WorkStepOut> {
  return apiFetch<WorkStepOut>(`/work/${workId}/steps/${stepOrder}/complete`, { method: 'POST', auth: true });
}

export async function revertWorkStep(workId: number, stepOrder: number): Promise<WorkStepOut> {
  return apiFetch<WorkStepOut>(`/work/${workId}/steps/${stepOrder}/revert`, { method: 'POST', auth: true });
}

export async function getWorkAssignedRecords(workId: number): Promise<AssignedRecordOut[]> {
  return apiFetch<AssignedRecordOut[]>(`/work/${workId}/assigned-records`, { method: 'GET', auth: true });
}

export async function updateWorkRecordStatus(
  workId: number,
  dynamicRecordId: number,
  status: 'pending' | 'in_progress' | 'done' | 'skipped'
): Promise<AssignedRecordOut> {
  return apiFetch<AssignedRecordOut>(`/work/${workId}/records/${dynamicRecordId}/status`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ status }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function startWork(workId: number): Promise<Work> {
  return apiFetch<Work>(`/work/${workId}/start`, { method: 'POST', auth: true });
}

export async function getWorkEvents(workId: number): Promise<WorkEventOut[]> {
  return apiFetch<WorkEventOut[]>(`/work/${workId}/events`, { method: 'GET', auth: true });
}
