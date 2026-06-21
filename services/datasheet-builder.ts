import { apiFetch } from '@/lib/api-client';

// Mirrors backend app/modules/datasheet_builder/spec.py
export const DATASHEET_FIELD_TYPES = [
  'text',
  'long_text',
  'number',
  'currency',
  'boolean',
  'date',
  'time',
  'enum',
  'multi_select',
  'phone',
  'relation',
] as const;

export type DatasheetFieldType = (typeof DATASHEET_FIELD_TYPES)[number];

export const RELATION_KINDS = ['one_to_one', 'many_to_one', 'one_to_many', 'many_to_many'] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

/** Built-in relation targets the designer can link to. */
export const BUILTIN_TARGETS = ['@contacts', '@work', '@users', '@leads'] as const;

export interface FieldSpec {
  display_name: string;
  field_type: DatasheetFieldType;
  is_required?: boolean;
  options?: string[];
  relation_target?: string | null;
  relation_kind?: RelationKind | null;
}

export interface DatasheetSpec {
  display_name: string;
  description?: string | null;
  is_child_of?: string | null;
  fields: FieldSpec[];
}

export interface SchemaDesign {
  datasheets: DatasheetSpec[];
}

// Reuses the agent builder's structured-question shape so we can share AskOptions.
// Fields are required to stay assignable to that component's prop type (backend
// always serialises them — multi defaults false, allow_custom defaults true).
export interface AskQuestion {
  text: string;
  options: string[];
  multi: boolean;
  allow_custom: boolean;
}

export interface DraftResponse {
  mode: 'ask' | 'propose';
  message: string;
  question?: AskQuestion | null;
  design?: SchemaDesign | null;
  issues?: string[];
}

export interface ApplySheetResponse {
  model_id: number;
  display_name: string;
  skipped_relations: string[];
}

export interface ApplyAllResponse {
  created: { model_id: number; display_name: string }[];
}

export interface ExistingDatasheet {
  slug: string;
  display_name: string;
  fields: { name: string; type: string }[];
}

export interface ContactModel {
  note: string;
  standard_fields: string[];
  custom_fields: { name: string; type: string }[];
  groups: string[];
}

export interface DesignerContext {
  business_profile?: Record<string, unknown>;
  existing_datasheets: ExistingDatasheet[];
  contact_model: ContactModel;
}

export function getDesignerContext(): Promise<DesignerContext> {
  return apiFetch<DesignerContext>('/datasheet-builder/context', { method: 'GET' });
}

export function draftDesign(
  message: string,
  history?: { role: string; content: string }[],
  design?: SchemaDesign | null
): Promise<DraftResponse> {
  return apiFetch<DraftResponse>('/datasheet-builder/draft', {
    method: 'POST',
    body: JSON.stringify({ message, history, design: design ?? undefined }),
  });
}

export function applySheet(design: SchemaDesign, displayName: string): Promise<ApplySheetResponse> {
  return apiFetch<ApplySheetResponse>('/datasheet-builder/apply-sheet', {
    method: 'POST',
    body: JSON.stringify({ design, display_name: displayName }),
  });
}

export function applyAll(design: SchemaDesign): Promise<ApplyAllResponse> {
  return apiFetch<ApplyAllResponse>('/datasheet-builder/apply-all', {
    method: 'POST',
    body: JSON.stringify({ design }),
  });
}
