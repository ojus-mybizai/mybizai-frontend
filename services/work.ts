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
  template_type?: 'simple' | 'checklist' | 'datasheet' | 'calling' | null;
  started_at?: string | null;
  completed_at?: string | null;
  form_data?: Record<string, unknown> | null;
  datasheet_progress?: {
    assignment_mode: string;
    target_count: number | null;
    created_count: number;
    dynamic_model_id: number | null;
    completed: boolean;
  } | null;
  steps_completed?: number | null;
  steps_total?: number | null;
  template_name?: string | null;
  duration_hours?: number | null;
  project_id?: number | null;
  project_name?: string | null;
  parent_work_id?: number | null;
  subtask_count?: number | null;
  subtasks_completed?: number | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
}

export interface WorkStepOut {
  id: number;
  work_id: number;
  order: number;
  label: string;
  completed_at: string | null;
  completed_by_id: number | null;
  form_data?: Record<string, unknown> | null;
}

export interface AssignedRecordOut {
  dynamic_record_id: number;
  data: Record<string, unknown>;
  status: string;
  sort_order: number;
  updated_at: string | null;
  form_data?: Record<string, unknown> | null;
}

export type FormFieldType = 'text' | 'textarea' | 'number' | 'image' | 'location' | 'datetime' | 'select' | 'phone' | 'lead';

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];  // for select type
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
  work_template_id?: number | null;
  status?: string | null;
  priority?: 'low' | 'medium' | 'high' | null;
  overdue?: boolean | null;
  template_type?: 'simple' | 'checklist' | 'datasheet' | 'calling' | null;
  project_id?: number | null;
  due_date_from?: string | null;
  due_date_to?: string | null;
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
  template_type?: 'simple' | 'checklist' | 'datasheet' | 'calling';
  steps_schema?: Array<{ order: number; label: string; form_schema?: FormField[] }> | null;
  linked_dynamic_model_id?: number | null;
  datasheet_ui_schema?: DatasheetUiSchema | null;
  form_schema?: FormField[] | null;
  execution_rules?: Record<string, unknown> | null;
}

export interface DatasheetUiSchema {
  display_fields?: string[];
  editable_fields?: string[];
  record_actions?: Array<{ type: string; label: string; field: string }>;
  auto_complete_work_when_all_done?: boolean;
  /** Controls how form_schema is applied. 'per_record' = employee fills same form for each row (default). 'single' = one form for the whole work. */
  form_mode?: 'per_record' | 'single';
}

export interface WorkTemplateCreate {
  name: string;
  work_type_id: number;
  default_assigned_to_id?: number | null;
  default_title?: string | null;
  default_notes?: string | null;
  default_due_days?: number | null;
  is_active?: boolean;
  template_type?: 'simple' | 'checklist' | 'datasheet' | 'calling';
  steps_schema?: Array<{ order: number; label: string; form_schema?: FormField[] }> | null;
  linked_dynamic_model_id?: number | null;
  datasheet_ui_schema?: DatasheetUiSchema | null;
  execution_rules?: Record<string, unknown> | null;
  form_schema?: FormField[] | null;
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
  /** For calling: specific lead IDs to assign */
  lead_ids?: number[] | null;
  /** For datasheet: create N new records instead of assigning existing ones */
  create_record_count?: number;
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
  if (filters.work_template_id != null) params.set('work_template_id', String(filters.work_template_id));
  if (filters.template_type) params.set('template_type', filters.template_type);
  if (filters.project_id != null) params.set('project_id', String(filters.project_id));
  if (filters.due_date_from) params.set('due_date_from', filters.due_date_from);
  if (filters.due_date_to) params.set('due_date_to', filters.due_date_to);
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

export async function submitWorkForm(workId: number, formData: Record<string, unknown>): Promise<Work> {
  return apiFetch<Work>(`/work/${workId}/submit-form`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ form_data: formData }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function submitRecordFormData(
  workId: number,
  dynamicRecordId: number,
  formData: Record<string, unknown>
): Promise<AssignedRecordOut> {
  return apiFetch<AssignedRecordOut>(`/work/${workId}/records/${dynamicRecordId}/form-data`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ form_data: formData }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function submitStepFormData(
  workId: number,
  stepOrder: number,
  formData: Record<string, unknown>
): Promise<WorkStepOut> {
  return apiFetch<WorkStepOut>(`/work/${workId}/steps/${stepOrder}/form-data`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ form_data: formData }),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------- Create-records datasheet mode ----------

export async function createWorkRecord(workId: number, data: Record<string, unknown>): Promise<unknown> {
  return apiFetch<unknown>(`/work/${workId}/create-record`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ data }),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------- Employee activity feed ----------

export interface WorkActivityItem {
  id: number;
  work_id: number;
  work_title: string | null;
  work_type_name: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string | null;
}

export interface WorkActivityListOut {
  items: WorkActivityItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface LogMyWorkPayload {
  title?: string | null;
  notes?: string | null;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
  lead_id?: number | null;
}

export async function getMyActivity(
  page = 1,
  perPage = 20,
): Promise<WorkActivityListOut> {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  return apiFetch<WorkActivityListOut>(`/work/my-activity?${params}`, { method: 'GET', auth: true });
}

export async function logMyWork(templateId: number, payload: LogMyWorkPayload): Promise<Work> {
  return apiFetch<Work>(`/work/templates/${templateId}/log-my-work`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}


// ---------- Calling work: lead assignments ----------

export interface WorkLeadAssignment {
  id: number;
  work_id: number;
  lead_id: number;
  lead_name: string | null;
  lead_phone: string | null;
  lead_status: string | null;
  sort_order: number;
  status: 'pending' | 'called' | 'skipped' | 'callback';
  call_log_id: number | null;
  last_disposition: string | null;
  updated_at: string | null;
}

export async function getAssignedLeads(workId: number): Promise<WorkLeadAssignment[]> {
  return apiFetch<WorkLeadAssignment[]>(`/work/${workId}/assigned-leads`, { method: 'GET', auth: true });
}

export async function updateLeadAssignmentStatus(
  workId: number,
  leadId: number,
  status: string,
): Promise<WorkLeadAssignment> {
  return apiFetch<WorkLeadAssignment>(`/work/${workId}/assigned-leads/${leadId}/status`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ status }),
    headers: { 'Content-Type': 'application/json' },
  });
}


// ---------- Projects ----------

export interface WorkProject {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  status: string;
  color: string | null;
  owner_id: number | null;
  owner_name: string | null;
  due_date: string | null;
  sort_order: number;
  work_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface WorkProjectCreate {
  name: string;
  description?: string | null;
  status?: string;
  color?: string | null;
  owner_id?: number | null;
  due_date?: string | null;
  sort_order?: number;
}

export async function listProjects(): Promise<WorkProject[]> {
  return apiFetch<WorkProject[]>('/work/projects', { method: 'GET', auth: true });
}

export async function createProject(payload: WorkProjectCreate): Promise<WorkProject> {
  return apiFetch<WorkProject>('/work/projects', {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateProject(projectId: number, payload: Partial<WorkProjectCreate>): Promise<WorkProject> {
  return apiFetch<WorkProject>(`/work/projects/${projectId}`, {
    method: 'PUT', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteProject(projectId: number): Promise<void> {
  await apiFetch(`/work/projects/${projectId}`, { method: 'DELETE', auth: true });
}


// ---------- Subtasks ----------

export async function getSubtasks(workId: number): Promise<Work[]> {
  return apiFetch<Work[]>(`/work/${workId}/subtasks`, { method: 'GET', auth: true });
}

export async function createSubtask(parentWorkId: number, payload: {
  work_type_id: number;
  assigned_to_id: number;
  title?: string;
  priority?: string;
  due_date?: string | null;
}): Promise<Work> {
  return apiFetch<Work>('/work', {
    method: 'POST', auth: true,
    body: JSON.stringify({ ...payload, parent_work_id: parentWorkId }),
    headers: { 'Content-Type': 'application/json' },
  });
}


// ---------- Comments ----------

export interface WorkComment {
  id: number;
  work_id: number;
  user_id: number;
  user_name: string;
  content: string;
  mentioned_user_ids: number[] | null;
  parent_comment_id: number | null;
  created_at?: string;
  updated_at?: string;
  replies?: WorkComment[] | null;
}

export async function listComments(workId: number): Promise<WorkComment[]> {
  return apiFetch<WorkComment[]>(`/work/${workId}/comments`, { method: 'GET', auth: true });
}

export async function createComment(workId: number, payload: {
  content: string;
  mentioned_user_ids?: number[];
  parent_comment_id?: number | null;
}): Promise<WorkComment> {
  return apiFetch<WorkComment>(`/work/${workId}/comments`, {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteComment(workId: number, commentId: number): Promise<void> {
  await apiFetch(`/work/${workId}/comments/${commentId}`, { method: 'DELETE', auth: true });
}


// ---------- Attachments ----------

export interface WorkAttachment {
  id: number;
  business_id: number;
  work_id: number;
  storage_key: string;
  original_file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_by_user_id: number | null;
  created_by_name: string | null;
  download_url: string | null;
  created_at?: string;
}

export async function listAttachments(workId: number): Promise<WorkAttachment[]> {
  return apiFetch<WorkAttachment[]>(`/work/${workId}/attachments`, { method: 'GET', auth: true });
}

export async function uploadAttachment(workId: number, file: File): Promise<WorkAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<WorkAttachment>(`/work/${workId}/upload-attachment`, {
    method: 'POST', auth: true,
    body: formData,
    // Don't set Content-Type — browser sets multipart boundary automatically
  });
}

export async function deleteAttachment(workId: number, attachmentId: number): Promise<void> {
  await apiFetch(`/work/${workId}/attachments/${attachmentId}`, { method: 'DELETE', auth: true });
}


// ---------- Quick Task ----------

export async function createQuickTask(payload: {
  text: string;
  assigned_to_id: number;
  priority?: string;
  due_date?: string | null;
}): Promise<Work> {
  return apiFetch<Work>('/work/quick-task', {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}


// ---------- Log Entry ----------

export async function createLogEntry(payload: {
  content: string;
  notes?: string | null;
}): Promise<Work> {
  return apiFetch<Work>('/work/log-entry', {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}
