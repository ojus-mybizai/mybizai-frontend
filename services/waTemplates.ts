import { apiFetch } from '@/lib/api-client';

export type WaTemplateType = 'simple_task' | 'whatsapp_form' | 'lead_list' | 'checklist';
export type MetaFlowStatus = 'draft' | 'published' | 'deprecated';
export type MetaTemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED';

export interface ButtonDef {
  id: string;
  title: string;
}

export type FlowFieldType =
  | 'TextInput'
  | 'TextArea'
  | 'number'
  | 'phone'
  | 'DatePicker'
  | 'Dropdown'
  | 'RadioButtonsGroup'
  | 'CheckboxGroup'
  | 'OptIn';

export interface DatasheetFieldMappingEntry {
  flow_field_name: string;
  flow_field_type: FlowFieldType;
  dynamic_field_id: number;
  dynamic_field_name: string;
}

export interface DatasheetFieldMap {
  version: 1;
  mappings: DatasheetFieldMappingEntry[];
}

// ── Contact form mapping (submit_action="create_contact") ──────────────────
export type ContactTarget =
  | 'name' | 'phone' | 'email' | 'company' | 'source' | 'note' | 'custom';

export interface ContactFieldMappingEntry {
  flow_field_name: string;
  target: ContactTarget;
  custom_field_def_id?: number | null;
}

export interface ContactFieldMap {
  version: 1;
  mappings: ContactFieldMappingEntry[];
}

export interface ContactFieldTarget {
  target: string;                 // attribute name, or 'custom'
  label: string;
  kind: 'attribute' | 'custom';
  custom_field_def_id?: number;
  field_type?: string;
  options?: string[] | null;
  group_id?: number | null;
  required?: boolean;
}

export interface ContactFieldTargetsResponse {
  core: ContactFieldTarget[];
  custom: ContactFieldTarget[];
}

/** Mappable contact targets for the Create-Contact form builder. Pass groupId
 *  to include that group's group-scoped custom fields. */
export async function getContactFieldTargets(groupId?: number): Promise<ContactFieldTargetsResponse> {
  const q = groupId ? `?group_id=${groupId}` : '';
  return apiFetch<ContactFieldTargetsResponse>(`/wa/templates/contact-field-targets${q}`);
}

export interface WaTemplate {
  id: number;
  name: string;
  description: string | null;
  type: WaTemplateType;
  message_body: string | null;
  buttons: ButtonDef[] | null;
  flow_json: Record<string, unknown> | null;
  meta_flow_id: string | null;
  meta_flow_status: MetaFlowStatus | null;
  meta_template_name: string | null;
  meta_template_status: MetaTemplateStatus | null;
  meta_template_language: string | null;
  meta_category: string | null;
  // What a form submission does: "datasheet" (default) | "create_contact"
  submit_action?: string;
  // Contact integration (submit_action="create_contact")
  contact_field_map?: ContactFieldMap | null;
  target_group_id?: number | null;
  target_process_id?: number | null;
  pipeline_in_form?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  // Datasheet integration (whatsapp_form only)
  linked_dynamic_model_id?: number | null;
  datasheet_write_enabled?: boolean;
  datasheet_field_map?: DatasheetFieldMap | null;
  // Keyword-triggered self-service (whatsapp_form only)
  trigger_enabled?: boolean;
  trigger_keywords?: string[] | null;
  trigger_cooldown_sec?: number;
}

export interface WaTemplateCreate {
  name: string;
  description?: string;
  type: WaTemplateType;
  message_body?: string;
  buttons?: ButtonDef[];
  flow_json?: Record<string, unknown>;
  meta_category?: string;
  meta_template_language?: string;
  submit_action?: string;
  contact_field_map?: ContactFieldMap | null;
  target_group_id?: number | null;
  target_process_id?: number | null;
  pipeline_in_form?: boolean;
  linked_dynamic_model_id?: number | null;
  datasheet_write_enabled?: boolean;
  datasheet_field_map?: DatasheetFieldMap | null;
  trigger_enabled?: boolean;
  trigger_keywords?: string[] | null;
  trigger_cooldown_sec?: number;
}

export interface WaTemplateUpdate {
  name?: string;
  description?: string;
  message_body?: string;
  buttons?: ButtonDef[];
  flow_json?: Record<string, unknown>;
  is_active?: boolean;
  meta_category?: string;
  meta_template_language?: string;
  submit_action?: string;
  contact_field_map?: ContactFieldMap | null;
  target_group_id?: number | null;
  target_process_id?: number | null;
  pipeline_in_form?: boolean;
  linked_dynamic_model_id?: number | null;
  datasheet_write_enabled?: boolean;
  datasheet_field_map?: DatasheetFieldMap | null;
  trigger_enabled?: boolean;
  trigger_keywords?: string[] | null;
  trigger_cooldown_sec?: number;
}

export interface FlowFieldInfo {
  name: string;
  type: string;
  label: string;
  required: boolean;
  supported: boolean;
}

export interface FlowFieldsResponse {
  mappable: FlowFieldInfo[];
  unmappable: FlowFieldInfo[];
}

export interface MappingSuggestionsResponse {
  version: 1;
  mappings: DatasheetFieldMappingEntry[];
  unmatched_flow_fields: FlowFieldInfo[];
  unmappable_flow_fields: FlowFieldInfo[];
  available_datasheet_fields: Array<{
    id: number;
    name: string;
    display_name: string;
    field_type: string;
    is_required: boolean;
  }>;
}

export type ButtonPresets = Record<string, ButtonDef[]>;

export async function getButtonPresets(): Promise<ButtonPresets> {
  return apiFetch('/wa/templates/presets');
}

export async function getDailyReportScaffold(): Promise<Record<string, unknown>> {
  return apiFetch('/wa/templates/scaffold/daily-report');
}

/**
 * One-click create of the prebuilt "Add Contact" WhatsApp form (idempotent —
 * returns the existing template if one already exists). After this, call
 * publishFlow(template.id) to push it to Meta.
 */
export async function seedAddContactTemplate(): Promise<WaTemplate> {
  return apiFetch('/wa/templates/seed/add-contact', { method: 'POST' });
}

export async function createTemplate(data: WaTemplateCreate): Promise<WaTemplate> {
  return apiFetch('/wa/templates', { method: 'POST', body: JSON.stringify(data) });
}

export async function listTemplates(type?: WaTemplateType): Promise<WaTemplate[]> {
  const query = type ? `?type=${type}` : '';
  return apiFetch(`/wa/templates${query}`);
}

export async function getTemplate(id: number): Promise<WaTemplate> {
  return apiFetch(`/wa/templates/${id}`);
}

export async function updateTemplate(id: number, data: WaTemplateUpdate): Promise<WaTemplate> {
  return apiFetch(`/wa/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteTemplate(id: number): Promise<void> {
  return apiFetch(`/wa/templates/${id}`, { method: 'DELETE' });
}

export async function publishFlow(id: number): Promise<{ success: boolean; flow_id: string; message: string }> {
  return apiFetch(`/wa/templates/${id}/publish-flow`, { method: 'POST' });
}

export async function getFlowFields(id: number): Promise<FlowFieldsResponse> {
  return apiFetch(`/wa/templates/${id}/flow-fields`);
}

export async function getMappingSuggestions(
  id: number,
  dynamicModelId: number,
): Promise<MappingSuggestionsResponse> {
  return apiFetch(
    `/wa/templates/${id}/datasheet-mapping-suggestions?dynamic_model_id=${dynamicModelId}`,
  );
}
