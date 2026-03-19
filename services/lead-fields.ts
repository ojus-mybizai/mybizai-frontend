import { apiFetch } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FieldType =
  | 'text' | 'number' | 'date' | 'datetime' | 'select'
  | 'boolean' | 'email' | 'phone' | 'url' | 'textarea' | 'relation';

export type RelationTarget = 'work' | 'order' | 'appointment' | 'contact' | 'datasheet' | 'user' | 'employee';

export type DisplayMode = 'count' | 'badge' | 'list';

export interface SelectConfig {
  options: string[];
}

export interface RelationConfig {
  target: RelationTarget;
  datasheet_id?: number;
  display_mode?: DisplayMode;
}

export type FieldConfig = SelectConfig | RelationConfig | Record<string, unknown>;

export interface SourceMappings {
  [source: string]: string;  // source name → source field key
}

export interface LeadFieldConfig {
  id: number;
  business_id: number;
  field_key: string;
  display_name: string;
  field_type: FieldType;
  is_system: boolean;
  is_visible: boolean;
  column_order: number;
  column_width?: number;
  is_required: boolean;
  default_value?: string;
  config?: FieldConfig;
  source_mappings?: SourceMappings;
}

export interface LeadFieldConfigCreate {
  field_key: string;
  display_name: string;
  field_type: FieldType;
  is_visible?: boolean;
  column_order?: number;
  column_width?: number;
  is_required?: boolean;
  default_value?: string;
  config?: FieldConfig;
  source_mappings?: SourceMappings;
}

export interface LeadFieldConfigUpdate {
  display_name?: string;
  field_type?: FieldType;
  is_visible?: boolean;
  column_order?: number;
  column_width?: number;
  is_required?: boolean;
  default_value?: string;
  config?: FieldConfig;
  source_mappings?: SourceMappings;
}

export interface FieldOrderItem {
  id: number;
  column_order: number;
}

// Entity link types
export type EntityType = 'order' | 'appointment' | 'contact' | 'datasheet_record' | 'employee';

export interface LeadEntityLink {
  id: number;
  lead_id: number;
  entity_type: EntityType;
  entity_id: number;
  field_config_id?: number;
}

// Source preview
export interface SourceFieldSample {
  key: string;
  sample_value: string;
}

export interface SourceMappingPreview {
  source: string;
  available_fields: SourceFieldSample[];
  current_mappings: Record<string, string>;
  lead_fields: Array<{ field_key: string; display_name: string }>;
}

// ─── API functions ────────────────────────────────────────────────────────────

/** List all field configs for the business (system + custom), ordered by column_order. */
export async function listLeadFields(): Promise<LeadFieldConfig[]> {
  return apiFetch('/leads/fields/');
}

/** Create a new custom field. */
export async function createLeadField(data: LeadFieldConfigCreate): Promise<LeadFieldConfig> {
  return apiFetch('/leads/fields/', { method: 'POST', body: JSON.stringify(data) });
}

/** Update a field config (partial). System fields: only display_name, is_visible, column_order, source_mappings. */
export async function updateLeadField(id: number, data: LeadFieldConfigUpdate): Promise<LeadFieldConfig> {
  return apiFetch(`/leads/fields/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

/** Delete a custom field (system fields cannot be deleted). */
export async function deleteLeadField(id: number): Promise<void> {
  await apiFetch(`/leads/fields/${id}`, { method: 'DELETE' });
}

/** Bulk reorder columns. */
export async function reorderLeadFields(fields: FieldOrderItem[]): Promise<void> {
  await apiFetch('/leads/fields/reorder', { method: 'POST', body: JSON.stringify({ fields }) });
}

/** Toggle visibility of a field. */
export async function toggleFieldVisibility(id: number, is_visible: boolean): Promise<LeadFieldConfig> {
  return updateLeadField(id, { is_visible });
}

// ─── Source mapping ───────────────────────────────────────────────────────────

/** Get available source fields + current mappings for a source (e.g. "whatsapp", "indiamart"). */
export async function getSourceMappingPreview(source: string): Promise<SourceMappingPreview> {
  return apiFetch(`/leads/fields/source-preview/${source}`);
}

/** Save source mappings: {source_field_key → lead_field_key}. */
export async function saveSourceMapping(source: string, mappings: Record<string, string>): Promise<void> {
  await apiFetch(`/leads/fields/source-mapping/${source}`, {
    method: 'POST',
    body: JSON.stringify(mappings),
  });
}

// ─── Entity links ─────────────────────────────────────────────────────────────

/** List all entity links for a lead. */
export async function listLeadEntityLinks(leadId: number, entityType?: EntityType): Promise<LeadEntityLink[]> {
  const params = entityType ? `?entity_type=${entityType}` : '';
  return apiFetch(`/leads/fields/${leadId}/links${params}`);
}

/** Link a lead to an entity (order/appointment/contact/datasheet_record). */
export async function createLeadEntityLink(
  leadId: number,
  data: { entity_type: EntityType; entity_id: number; field_config_id?: number }
): Promise<LeadEntityLink> {
  return apiFetch(`/leads/fields/${leadId}/links`, { method: 'POST', body: JSON.stringify(data) });
}

/** Remove a lead-entity link. */
export async function deleteLeadEntityLink(leadId: number, linkId: number): Promise<void> {
  await apiFetch(`/leads/fields/${leadId}/links/${linkId}`, { method: 'DELETE' });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns only visible fields sorted by column_order. */
export function getVisibleFields(fields: LeadFieldConfig[]): LeadFieldConfig[] {
  return fields.filter((f) => f.is_visible).sort((a, b) => a.column_order - b.column_order);
}

/** Relation label for a given target type. */
export function relationTargetLabel(target: RelationTarget, datasheetName?: string): string {
  if (target === 'datasheet') return datasheetName ? datasheetName : 'Datasheet';
  const labels: Record<RelationTarget, string> = {
    work: 'Work Items',
    order: 'Orders',
    appointment: 'Appointments',
    contact: 'Contacts',
    datasheet: 'Datasheet',
    user: 'User',
    employee: 'Employees',
  };
  return labels[target] ?? target;
}

/** Get a field's value from a lead (system or custom). */
export function getLeadFieldValue(
  lead: Record<string, unknown>,
  field: LeadFieldConfig
): unknown {
  if (field.is_system) {
    // System field: map field_key to lead property
    const systemKeyMap: Record<string, string> = {
      name: 'name',
      phone: 'phone',
      email: 'email',
      status: 'status',
      priority: 'priority',
      source: 'source',
      notes: 'notes',
      created_at: 'created_at',
      score: 'leadScore',
      assigned_to: 'assigned_to_id',
    };
    const key = systemKeyMap[field.field_key] ?? field.field_key;
    return (lead as Record<string, unknown>)[key];
  }
  // Custom field: from custom_fields map
  const customFields = (lead.custom_fields ?? {}) as Record<string, unknown>;
  return customFields[field.field_key];
}
