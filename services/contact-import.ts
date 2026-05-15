import { apiFetch } from '@/lib/api-client';

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface ContactImportSettings {
  id: number;
  business_id: number;
  duplicate_check_fields: ('phone' | 'email' | 'name')[];
  duplicate_scope: 'business' | 'employee';
  on_duplicate: 'skip' | 'update' | 'create_anyway';
  allow_cross_employee_phone: boolean;
  allow_cross_employee_email: boolean;
}

export async function getImportSettings(): Promise<ContactImportSettings> {
  return apiFetch<ContactImportSettings>('/contacts/import/settings');
}

export async function updateImportSettings(
  payload: Omit<ContactImportSettings, 'id' | 'business_id'>,
): Promise<ContactImportSettings> {
  return apiFetch<ContactImportSettings>('/contacts/import/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ─── Preview ──────────────────────────────────────────────────────────────────

export interface ColumnMappingEntry {
  raw_column: string;
  contact_field: 'name' | 'phone' | 'email' | 'priority' | 'source' | 'notes' | null;
}

export interface ImportRowData {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  priority?: string | null;
  source?: string | null;
  notes?: string | null;
}

export interface DuplicateInfo {
  contact_id: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  matched_field: string;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
}

export interface ImportRowPreview {
  row_index: number;
  data: ImportRowData;
  import_status: 'new' | 'duplicate' | 'error';
  duplicate_info?: DuplicateInfo | null;
  row_action: 'import' | 'update' | 'skip';
  errors: string[];
}

export interface ContactImportPreviewResponse {
  total: number;
  new_count: number;
  duplicate_count: number;
  error_count: number;
  columns_found: string[];
  column_mapping: ColumnMappingEntry[];
  rows: ImportRowPreview[];
}

export async function previewImport(
  file: File,
  columnMapping?: ColumnMappingEntry[],
  settingsOverride?: Partial<ContactImportSettings>,
): Promise<ContactImportPreviewResponse> {
  const form = new FormData();
  form.append('file', file);
  if (columnMapping) form.append('column_mapping', JSON.stringify(columnMapping));
  if (settingsOverride) form.append('settings_override', JSON.stringify(settingsOverride));

  return apiFetch<ContactImportPreviewResponse>('/contacts/import/preview', {
    method: 'POST',
    body: form,
  });
}

// ─── Confirm ──────────────────────────────────────────────────────────────────

export interface ImportRowAction {
  row_index: number;
  action: 'import' | 'update' | 'skip';
  data: ImportRowData;
}

export interface ContactImportConfirmResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  error_details: { row_index: number; error: string }[];
  contact_ids: number[];
}

export async function confirmImport(payload: {
  rows: ImportRowAction[];
  assigned_to_id?: number | null;
  default_source?: string | null;
}): Promise<ContactImportConfirmResult> {
  return apiFetch<ContactImportConfirmResult>('/contacts/import/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Single-contact duplicate check ──────────────────────────────────────────

export interface DuplicateCheckResponse {
  has_duplicate: boolean;
  duplicate_info?: DuplicateInfo | null;
  on_duplicate: 'skip' | 'update' | 'create_anyway';
}

export async function checkDuplicate(payload: {
  name?: string;
  phone?: string;
  email?: string;
}): Promise<DuplicateCheckResponse> {
  return apiFetch<DuplicateCheckResponse>('/contacts/import/check-duplicate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
