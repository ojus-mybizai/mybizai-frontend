/**
 * Lead Import Service
 * Handles duplicate-detection settings, file preview, and import confirmation.
 */

import { apiFetch } from '@/lib/api-client';

const BASE = '/leads/import';

// ─── Settings ─────────────────────────────────────────────────────────────────

export type DuplicateCheckField = 'phone' | 'email' | 'name';
export type DuplicateScope = 'business' | 'employee';
export type OnDuplicate = 'skip' | 'update' | 'create_anyway';

export interface LeadImportSettings {
  id: number;
  business_id: number;
  duplicate_check_fields: DuplicateCheckField[];
  duplicate_scope: DuplicateScope;
  on_duplicate: OnDuplicate;
  allow_cross_employee_phone: boolean;
  allow_cross_employee_email: boolean;
}

export interface LeadImportSettingsUpdate {
  duplicate_check_fields: DuplicateCheckField[];
  duplicate_scope: DuplicateScope;
  on_duplicate: OnDuplicate;
  allow_cross_employee_phone: boolean;
  allow_cross_employee_email: boolean;
}

export async function getImportSettings(): Promise<LeadImportSettings> {
  return apiFetch(`${BASE}/settings`);
}

export async function updateImportSettings(
  payload: LeadImportSettingsUpdate,
): Promise<LeadImportSettings> {
  return apiFetch(`${BASE}/settings`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ─── Preview ──────────────────────────────────────────────────────────────────

export type RowImportStatus = 'new' | 'duplicate' | 'error';
export type RowAction = 'import' | 'update' | 'skip';
export type LeadField = 'name' | 'phone' | 'email' | 'status' | 'priority' | 'source' | 'notes';

export interface ColumnMappingEntry {
  raw_column: string;
  lead_field: LeadField | null;
}

export interface ImportRowData {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  priority?: string | null;
  source?: string | null;
  notes?: string | null;
}

export interface DuplicateInfo {
  lead_id: number;
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
  import_status: RowImportStatus;
  duplicate_info?: DuplicateInfo | null;
  row_action: RowAction;
  errors: string[];
}

export interface LeadImportPreviewResponse {
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
  options?: {
    columnMapping?: ColumnMappingEntry[];
    settingsOverride?: LeadImportSettingsUpdate;
  },
): Promise<LeadImportPreviewResponse> {
  const form = new FormData();
  form.append('file', file);

  if (options?.columnMapping) {
    form.append('column_mapping', JSON.stringify(options.columnMapping));
  }
  if (options?.settingsOverride) {
    form.append('settings_override', JSON.stringify(options.settingsOverride));
  }

  return apiFetch(`${BASE}/preview`, {
    method: 'POST',
    body: form,
    // Don't set Content-Type — browser sets it with the correct multipart boundary
  });
}

// ─── Confirm ──────────────────────────────────────────────────────────────────

export interface ImportRowAction {
  row_index: number;
  action: RowAction;
  data: ImportRowData;
}

export interface LeadImportConfirmRequest {
  rows: ImportRowAction[];
  assigned_to_id?: number | null;
  default_source?: string | null;
}

export interface LeadImportConfirmResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  error_details: Array<{ row_index: number; error: string }>;
}

// ─── UI Duplicate Check ───────────────────────────────────────────────────────

export interface DuplicateCheckRequest {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface DuplicateCheckResponse {
  has_duplicate: boolean;
  duplicate_info?: DuplicateInfo | null;
  on_duplicate: OnDuplicate;
}

export async function checkDuplicateLead(
  payload: DuplicateCheckRequest,
): Promise<DuplicateCheckResponse> {
  return apiFetch(`${BASE}/check-duplicate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Confirm ──────────────────────────────────────────────────────────────────

export async function confirmImport(
  payload: LeadImportConfirmRequest,
): Promise<LeadImportConfirmResult> {
  return apiFetch(`${BASE}/confirm`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
