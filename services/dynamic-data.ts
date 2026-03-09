import { apiFetch } from '@/lib/api-client';

// Types (aligned with backend schemas)
export interface DynamicModel {
  id: number;
  business_id: number;
  name: string;
  display_name: string;
  description: string | null;
  status: string;
  schema_version: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface DynamicModelCreate {
  name: string;
  display_name: string;
  description?: string | null;
}

export interface DynamicModelUpdate {
  display_name?: string;
  description?: string | null;
  status?: 'active' | 'archived';
}

export interface DynamicField {
  id: number;
  business_id: number;
  dynamic_model_id: number;
  name: string;
  display_name: string;
  field_type: string;
  is_required: boolean;
  is_unique: boolean;
  is_editable: boolean;
  is_searchable: boolean;
  order_index: number;
  default_value: unknown;
  config: Record<string, unknown>;
  relation_model_id: number | null;
  relation_kind: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DynamicFieldCreate {
  name: string;
  display_name: string;
  field_type: string;
  is_required?: boolean;
  is_unique?: boolean;
  is_editable?: boolean;
  is_searchable?: boolean;
  order_index?: number;
  default_value?: unknown;
  config?: Record<string, unknown>;
  relation_model_id?: number | null;
  relation_kind?: 'many_to_one' | 'one_to_many' | 'many_to_many' | null;
}

export interface DynamicFieldUpdate {
  display_name?: string;
  is_required?: boolean;
  is_unique?: boolean;
  is_editable?: boolean;
  is_searchable?: boolean;
  order_index?: number;
  default_value?: unknown;
  config?: Record<string, unknown>;
}

export interface DynamicRecord {
  id: number;
  business_id: number;
  dynamic_model_id: number;
  record_key: string;
  data: Record<string, unknown>;
  normalized_data: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

export interface QueryRequest {
  filters?: Array<{ field: string; op?: string; value?: unknown }>;
  sort?: Array<{ field: string; direction?: string }>;
  page?: number;
  per_page?: number;
  include_relations?: boolean;
  relation_fields?: string[];
  keyword?: string | null;
  semantic_query?: string | null;
  hybrid_mode?: 'structured_first' | 'semantic_rerank';
}

export interface QueryResponse {
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  aggregates: Record<string, unknown>;
  meta: Record<string, unknown>;
}

export interface BatchUpsertItem {
  record_id?: number | null;
  data: Record<string, unknown>;
}

export interface BatchUpsertRequest {
  items: BatchUpsertItem[];
  mode?: 'merge' | 'replace';
  partial_success?: boolean;
}

export interface BatchUpsertResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<Record<string, unknown>>;
}

export interface DynamicImportOut {
  id: number;
  business_id: number;
  dynamic_model_id: number;
  status: string;
  source_storage_key: string;
  source_file_name: string;
  mapping_config: Record<string, unknown>;
  stats: Record<string, unknown>;
  error_report: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

export interface DynamicViewOut {
  id: number;
  business_id: number;
  dynamic_model_id: number;
  name: string;
  config: Record<string, unknown>;
  is_default: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface DeleteImpact {
  blocked: boolean;
  references: Array<Record<string, unknown>>;
}

// Models
export async function listModels(): Promise<DynamicModel[]> {
  return apiFetch<DynamicModel[]>('/dynamic-data/models', { method: 'GET', auth: true });
}

export async function getModel(id: number | string): Promise<DynamicModel> {
  return apiFetch<DynamicModel>(`/dynamic-data/models/${id}`, { method: 'GET', auth: true });
}

export async function createModel(payload: DynamicModelCreate): Promise<DynamicModel> {
  return apiFetch<DynamicModel>('/dynamic-data/models', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateModel(
  id: number | string,
  payload: DynamicModelUpdate
): Promise<DynamicModel> {
  return apiFetch<DynamicModel>(`/dynamic-data/models/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteModel(id: number | string): Promise<void> {
  await apiFetch(`/dynamic-data/models/${id}`, { method: 'DELETE' });
}

// Fields
export async function listFields(modelId: number | string): Promise<DynamicField[]> {
  return apiFetch<DynamicField[]>(`/dynamic-data/models/${modelId}/fields`, {
    method: 'GET',
    auth: true,
  });
}

export async function createField(
  modelId: number | string,
  payload: DynamicFieldCreate
): Promise<DynamicField> {
  return apiFetch<DynamicField>(`/dynamic-data/models/${modelId}/fields`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createFieldsBatch(
  modelId: number | string,
  fields: DynamicFieldCreate[]
): Promise<DynamicField[]> {
  return apiFetch<DynamicField[]>(`/dynamic-data/models/${modelId}/fields/batch`, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
}

export async function updateField(
  fieldId: number | string,
  payload: DynamicFieldUpdate
): Promise<DynamicField> {
  return apiFetch<DynamicField>(`/dynamic-data/fields/${fieldId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteField(fieldId: number | string): Promise<void> {
  await apiFetch(`/dynamic-data/fields/${fieldId}`, { method: 'DELETE' });
}

// Records
export async function createRecord(
  modelId: number | string,
  data: Record<string, unknown>
): Promise<DynamicRecord> {
  return apiFetch<DynamicRecord>(`/dynamic-data/models/${modelId}/records`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
}

export async function updateRecord(
  modelId: number | string,
  recordId: number | string,
  payload: { data: Record<string, unknown>; mode?: 'merge' | 'replace'; change_reason?: string }
): Promise<DynamicRecord> {
  return apiFetch<DynamicRecord>(
    `/dynamic-data/models/${modelId}/records/${recordId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteRecord(
  modelId: number | string,
  recordId: number | string
): Promise<void> {
  await apiFetch(`/dynamic-data/models/${modelId}/records/${recordId}`, {
    method: 'DELETE',
  });
}

export async function getDeleteImpact(
  modelId: number | string,
  recordId: number | string
): Promise<DeleteImpact> {
  return apiFetch<DeleteImpact>(
    `/dynamic-data/models/${modelId}/records/${recordId}/delete-impact`,
    { method: 'GET' }
  );
}

export async function batchUpsert(
  modelId: number | string,
  payload: BatchUpsertRequest
): Promise<BatchUpsertResult> {
  return apiFetch<BatchUpsertResult>(
    `/dynamic-data/models/${modelId}/records/batch`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

// Query
export async function queryRecords(
  modelId: number | string,
  request: QueryRequest
): Promise<QueryResponse> {
  return apiFetch<QueryResponse>(`/dynamic-data/models/${modelId}/query`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function hybridSearch(
  modelId: number | string,
  request: QueryRequest
): Promise<QueryResponse> {
  return apiFetch<QueryResponse>(`/dynamic-data/models/${modelId}/search/hybrid`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function fullTextSearch(
  modelId: number | string,
  request: QueryRequest
): Promise<QueryResponse> {
  return apiFetch<QueryResponse>(
    `/dynamic-data/models/${modelId}/search/full-text`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );
}

export async function semanticSearch(
  modelId: number | string,
  request: QueryRequest
): Promise<QueryResponse> {
  return apiFetch<QueryResponse>(
    `/dynamic-data/models/${modelId}/search/semantic`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );
}

// Attachments
export interface UploadFileForAttachmentResult {
  storage_key: string;
  original_file_name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
}

export async function uploadFileForAttachment(
  modelId: number | string,
  file: File
): Promise<UploadFileForAttachmentResult> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<UploadFileForAttachmentResult>(
    `/dynamic-data/models/${modelId}/upload-file`,
    { method: 'POST', body: formData }
  );
}

export async function bindAttachment(
  modelId: number | string,
  payload: {
    dynamic_record_id: number;
    field_id: number;
    storage_key: string;
    original_file_name: string;
    mime_type?: string;
    size_bytes?: number;
    metadata_json?: Record<string, unknown>;
  }
): Promise<unknown> {
  return apiFetch(`/dynamic-data/models/${modelId}/attachments/bind`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listAttachments(recordId: number | string): Promise<unknown[]> {
  return apiFetch<unknown[]>(`/dynamic-data/records/${recordId}/attachments`, {
    method: 'GET',
  });
}

export async function deleteAttachment(attachmentId: number | string): Promise<void> {
  await apiFetch(`/dynamic-data/attachments/${attachmentId}`, { method: 'DELETE' });
}

// Import
export async function createImportJob(
  modelId: number | string,
  payload: {
    source_storage_key: string;
    source_file_name: string;
    mapping_config: Record<string, unknown>;
  }
): Promise<DynamicImportOut> {
  return apiFetch<DynamicImportOut>(`/dynamic-data/models/${modelId}/import`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadImport(
  modelId: number | string,
  file: File,
  mappingConfig: Record<string, unknown>
): Promise<DynamicImportOut> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mapping_config', JSON.stringify(mappingConfig));

  return apiFetch<DynamicImportOut>(
    `/dynamic-data/models/${modelId}/import/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );
}

export async function getImportJob(
  modelId: number | string,
  jobId: number | string
): Promise<DynamicImportOut> {
  return apiFetch<DynamicImportOut>(
    `/dynamic-data/models/${modelId}/imports/${jobId}`,
    { method: 'GET' }
  );
}

// Views
export async function listViews(modelId: number | string): Promise<DynamicViewOut[]> {
  return apiFetch<DynamicViewOut[]>(`/dynamic-data/models/${modelId}/views`, {
    method: 'GET',
  });
}

export async function createView(
  modelId: number | string,
  payload: { name: string; config: Record<string, unknown>; is_default?: boolean }
): Promise<DynamicViewOut> {
  return apiFetch<DynamicViewOut>(`/dynamic-data/models/${modelId}/views`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Record history
export async function getRecordHistory(
  modelId: number | string,
  recordId: number | string
): Promise<Array<{ id: number; action: string; data_snapshot: Record<string, unknown>; actor_user_id: number | null; change_reason: string | null; created_at: string | null }>> {
  return apiFetch(
    `/dynamic-data/models/${modelId}/records/${recordId}/history`,
    { method: 'GET' }
  );
}
