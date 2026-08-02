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
  parent_model_id: number | null;
  enable_embeddings: boolean;
  created_at: string | null;
  updated_at: string | null;
  /** Computed by list_models — true when any field has relation_builtin_model = "leads" */
  has_lead_relation: boolean;
  lead_relation_field: string | null;
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
  enable_embeddings?: boolean;
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
  relation_builtin_model?: string | null;
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
  relation_builtin_model?: string | null;
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

export interface DeleteImpactReference {
  relation_id: number;
  source_record_id: number;
  source_record_label: string;
  target_record_id: number;
  field_id: number;
  field_name?: string | null;
  field_display_name: string;
  source_model_id: number | null;
  source_model_name: string;
  relation_kind: string;
}

export interface DeleteImpactGroup {
  source_model_id: number | null;
  source_model_name: string;
  field_id: number;
  field_display_name: string;
  /** How many records from this (source_model, field) point at the target */
  count: number;
  /** Up to 5 sample labels for display in the error UI */
  sample_labels: string[];
}

export interface DeleteImpact {
  blocked: boolean;
  total?: number;
  references: DeleteImpactReference[];
  by_source_model?: DeleteImpactGroup[];
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

export async function deleteModel(id: number | string, detach = false): Promise<void> {
  const suffix = detach ? '?detach=true' : '';
  await apiFetch(`/dynamic-data/models/${id}${suffix}`, { method: 'DELETE' });
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
export async function getRecord(
  modelId: number | string,
  recordId: number | string
): Promise<DynamicRecord> {
  return apiFetch<DynamicRecord>(
    `/dynamic-data/models/${modelId}/records/${recordId}`,
    { method: 'GET', auth: true }
  );
}

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
  // GET so a filtered view is a shareable URL and benefits from in-flight
  // dedup/caching. The query is passed as a single URL-encoded JSON param `q`
  // (mirrors the POST body, validated by the same schema server-side).
  const q = encodeURIComponent(JSON.stringify(request ?? {}));
  return apiFetch<QueryResponse>(`/dynamic-data/models/${modelId}/query?q=${q}`, {
    method: 'GET',
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

// Built-in model search
export async function searchBuiltinModel(
  modelKey: string,
  keyword: string = '',
  page: number = 1,
  perPage: number = 20,
  ids?: number[]
) {
  let url = `/dynamic-data/builtin-models/${modelKey}/search?keyword=${encodeURIComponent(keyword)}&page=${page}&per_page=${perPage}`;
  if (ids && ids.length > 0) url += `&ids=${ids.join(',')}`;
  return apiFetch<{ items: { id: number; label: string }[]; total: number }>(
    url,
    { method: 'GET', auth: true }
  );
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

// ── Reverse Relations ─────────────────────────────────────────────

export interface ReverseRelationMeta {
  field_id: number;
  field_name: string;
  field_display_name: string;
  source_model_id: number;
  source_model_name: string;
  source_model_display_name: string;
  relation_kind: string;
}

export interface ReverseRelationResponse {
  items: Array<{
    id: number;
    record_key: string;
    dynamic_model_id: number;
    data: Record<string, unknown>;
    created_at: string | null;
    updated_at: string | null;
  }>;
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  source_field: ReverseRelationMeta | null;
}

// ── Records linked TO a built-in record (contact / work / …) ──────

export interface LinkedRecordItem {
  id: number;
  record_key: string;
  title: string;
  data: Record<string, unknown>;
  created_at: string | null;
}

export interface LinkedRecordGroup {
  model_id: number;
  model_name: string;
  model_display_name: string;
  field_display_name: string | null;
  records: LinkedRecordItem[];
}

export interface LinkedRecordsResponse {
  groups: LinkedRecordGroup[];
  total: number;
}

/**
 * Datasheet records that link TO a contact via a relation field whose target
 * is the built-in `contacts` model. Grouped by source datasheet model.
 * Powers the "Datasheets" section on the contact profile.
 */
export async function getRecordsLinkedToContact(
  contactId: number | string,
): Promise<LinkedRecordsResponse> {
  return apiFetch<LinkedRecordsResponse>(
    `/dynamic-data/linked-records/contacts/${contactId}`,
    { method: 'GET' },
  );
}

/**
 * Get metadata about all fields on OTHER models that point TO this model.
 * Powers the "Related Records" section headers in the detail panel.
 */
export async function getReverseRelations(
  modelId: number | string
): Promise<ReverseRelationMeta[]> {
  return apiFetch<ReverseRelationMeta[]>(
    `/dynamic-data/models/${modelId}/reverse-relations`,
    { method: 'GET' }
  );
}

/**
 * Query paginated child records that link TO a specific parent record.
 * Powers the inline sub-table rows in the detail panel.
 */
export async function queryReverseRecords(
  modelId: number | string,
  recordId: number | string,
  params: {
    source_model_id?: number;
    source_field_id?: number;
    page?: number;
    per_page?: number;
  } = {}
): Promise<ReverseRelationResponse> {
  const qs = new URLSearchParams();
  if (params.source_model_id) qs.set('source_model_id', String(params.source_model_id));
  if (params.source_field_id) qs.set('source_field_id', String(params.source_field_id));
  if (params.page) qs.set('page', String(params.page));
  if (params.per_page) qs.set('per_page', String(params.per_page));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<ReverseRelationResponse>(
    `/dynamic-data/models/${modelId}/records/${recordId}/reverse-records${suffix}`,
    { method: 'GET' }
  );
}

/**
 * Create a new record in sourceModelId and auto-link it to a parent via
 * the specified relation field.  The relation field value is set server-side.
 */
export async function createLinkedRecord(
  sourceModelId: number | string,
  data: Record<string, unknown>,
  linkFieldId: number,
  linkTargetRecordId: number
): Promise<DynamicRecord> {
  return apiFetch<DynamicRecord>(
    `/dynamic-data/models/${sourceModelId}/records/linked`,
    {
      method: 'POST',
      body: JSON.stringify({
        data,
        link_field_id: linkFieldId,
        link_target_record_id: linkTargetRecordId,
      }),
    }
  );
}

// ── Contact Profile "Data" tab ────────────────────────────────────

export interface ContactDataSection {
  model_id: number;
  model_name: string;
  model_display_name: string;
  relation_field_id: number;
  relation_field_name: string;
  relation_field_display_name: string;
  relation_kind: string;
  fields: DynamicField[];
  title_field: string | null;
  records: LinkedRecordItem[];
}

export interface ContactDataResponse {
  sections: ContactDataSection[];
  total: number;
}

/**
 * All datasheet sections that can hold records linked to a contact — one per
 * (datasheet × contact-relation field), each carrying the sheet's full field
 * schema and its linked records (including empty sheets). Powers the contact
 * profile "Data" tab.
 */
export async function getContactData(
  contactId: number | string,
): Promise<ContactDataResponse> {
  return apiFetch<ContactDataResponse>(
    `/dynamic-data/contact-data/${contactId}`,
    { method: 'GET' },
  );
}

// ── Child Datasheets ──────────────────────────────────────────────

export interface ChildModelCreatePayload {
  name: string;
  display_name: string;
  description?: string | null;
  fields: DynamicFieldCreate[];
}

/**
 * Get all child models whose parent_model_id equals this model.
 */
export async function getChildModels(
  modelId: number | string
): Promise<DynamicModel[]> {
  return apiFetch<DynamicModel[]>(
    `/dynamic-data/models/${modelId}/children`,
    { method: 'GET' }
  );
}

/**
 * Create a new child datasheet under a parent model.
 * The server auto-creates a relation field pointing back to the parent.
 */
export async function createChildModel(
  parentModelId: number | string,
  payload: ChildModelCreatePayload
): Promise<DynamicModel> {
  return apiFetch<DynamicModel>(
    `/dynamic-data/models/${parentModelId}/children`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}
