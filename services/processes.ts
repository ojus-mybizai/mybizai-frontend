import { apiFetch } from '@/lib/api-client';

// ---------- Types ----------

export interface ProcessStageWork {
  id: number;
  stage_id: number;
  work_template_id: number | null;
  work_template_name: string | null;
  title: string | null;
  description: string | null;
  default_assigned_to_id: number | null;
  default_assigned_to_name: string | null;
  sort_order: number;
}

export interface ProcessStage {
  id: number;
  process_id: number;
  name: string;
  color: string | null;
  stage_type: 'active' | 'completed' | 'failed';
  sort_order: number;
  auto_advance_on_complete: boolean;
  entry_count: number;
  stage_works: ProcessStageWork[];
}

export interface BusinessProcess {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  entity_type: 'lead' | 'datasheet_record';
  dynamic_model_id: number | null;
  dynamic_model_name: string | null;
  status: string;
  color: string | null;
  total_entries: number;
  active_entries: number;
  stages: ProcessStage[];
  created_at?: string;
  updated_at?: string;
}

export interface BusinessProcessListItem {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  entity_type: string;
  dynamic_model_name: string | null;
  status: string;
  color: string | null;
  stage_count: number;
  total_entries: number;
  active_entries: number;
  created_at?: string;
}

export interface ProcessEntry {
  id: number;
  process_id: number;
  current_stage_id: number | null;
  current_stage_name: string | null;
  current_stage_color: string | null;
  entity_type: string;
  entity_id: number;
  entity_name: string | null;
  entity_phone: string | null;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  status: string;
  entered_at?: string;
  stage_entered_at?: string;
  completed_at?: string;
  notes: string | null;
  created_at?: string;
}

// ---------- Process CRUD ----------

export async function listProcesses(status?: string): Promise<BusinessProcessListItem[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<BusinessProcessListItem[]>(`/processes${qs}`, { method: 'GET', auth: true });
}

export async function getProcess(processId: number): Promise<BusinessProcess> {
  return apiFetch<BusinessProcess>(`/processes/${processId}`, { method: 'GET', auth: true });
}

export async function createProcess(payload: {
  name: string;
  description?: string;
  entity_type: string;
  dynamic_model_id?: number | null;
  color?: string;
  stages?: Array<{
    name: string;
    color?: string;
    stage_type?: string;
    sort_order?: number;
    stage_works?: Array<{
      work_template_id?: number | null;
      title?: string;
      description?: string;
      default_assigned_to_id?: number | null;
      sort_order?: number;
    }>;
  }>;
}): Promise<BusinessProcess> {
  return apiFetch<BusinessProcess>('/processes', {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateProcess(processId: number, payload: {
  name?: string; description?: string; status?: string; color?: string;
}): Promise<BusinessProcess> {
  return apiFetch<BusinessProcess>(`/processes/${processId}`, {
    method: 'PUT', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteProcess(processId: number): Promise<void> {
  await apiFetch(`/processes/${processId}`, { method: 'DELETE', auth: true });
}

// ---------- Stage CRUD ----------

export async function addStage(processId: number, payload: {
  name: string; color?: string; stage_type?: string; sort_order?: number;
  auto_advance_on_complete?: boolean;
  stage_works?: Array<{ work_template_id?: number | null; title?: string; default_assigned_to_id?: number | null }>;
}): Promise<ProcessStage> {
  return apiFetch<ProcessStage>(`/processes/${processId}/stages`, {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateStage(processId: number, stageId: number, payload: {
  name?: string; color?: string; stage_type?: string; sort_order?: number;
  auto_advance_on_complete?: boolean;
}): Promise<ProcessStage> {
  return apiFetch<ProcessStage>(`/processes/${processId}/stages/${stageId}`, {
    method: 'PUT', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteStage(processId: number, stageId: number): Promise<void> {
  await apiFetch(`/processes/${processId}/stages/${stageId}`, { method: 'DELETE', auth: true });
}

// ---------- Stage Works ----------

export async function addStageWork(processId: number, stageId: number, payload: {
  work_template_id?: number | null; title?: string; description?: string;
  default_assigned_to_id?: number | null; sort_order?: number;
}): Promise<ProcessStageWork> {
  return apiFetch<ProcessStageWork>(`/processes/${processId}/stages/${stageId}/works`, {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deleteStageWork(processId: number, stageId: number, workId: number): Promise<void> {
  await apiFetch(`/processes/${processId}/stages/${stageId}/works/${workId}`, { method: 'DELETE', auth: true });
}

// ---------- Process Entries ----------

export async function listEntries(processId: number, params?: {
  stage_id?: number; status?: string;
}): Promise<ProcessEntry[]> {
  const qs = new URLSearchParams();
  if (params?.stage_id) qs.set('stage_id', String(params.stage_id));
  if (params?.status) qs.set('status', params.status);
  const q = qs.toString();
  return apiFetch<ProcessEntry[]>(`/processes/${processId}/entries${q ? `?${q}` : ''}`, { method: 'GET', auth: true });
}

export async function addEntry(processId: number, payload: {
  entity_id: number; entity_name?: string; entity_phone?: string;
  stage_id?: number; assigned_to_id?: number; notes?: string;
}): Promise<ProcessEntry> {
  return apiFetch<ProcessEntry>(`/processes/${processId}/entries`, {
    method: 'POST', auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function moveEntry(processId: number, entryId: number, stageId: number): Promise<ProcessEntry> {
  return apiFetch<ProcessEntry>(`/processes/${processId}/entries/${entryId}/move`, {
    method: 'PUT', auth: true,
    body: JSON.stringify({ stage_id: stageId }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function removeEntry(processId: number, entryId: number): Promise<void> {
  await apiFetch(`/processes/${processId}/entries/${entryId}`, { method: 'DELETE', auth: true });
}
