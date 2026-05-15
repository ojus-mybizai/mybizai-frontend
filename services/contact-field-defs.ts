import { apiFetch } from '@/lib/api-client';

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'date'
  | 'boolean' | 'select' | 'multi_select'
  | 'url' | 'phone' | 'email';

export interface ContactFieldDef {
  id: number;
  business_id: number;
  group_id: number | null;
  group_name: string | null;
  name: string;
  field_type: FieldType;
  options: string[] | null;
  required: boolean;
  sort_order: number;
  created_at: string;
}

export interface CreateFieldDefPayload {
  name: string;
  field_type: FieldType;
  group_id?: number | null;
  options?: string[] | null;
  required?: boolean;
  sort_order?: number;
}

export interface UpdateFieldDefPayload {
  name?: string;
  field_type?: FieldType;
  options?: string[] | null;
  required?: boolean;
  sort_order?: number;
}

// group_id=0 → global fields only; group_id=<n> → scoped to group; undefined → all
export async function listFieldDefs(groupId?: number | null): Promise<ContactFieldDef[]> {
  const params = new URLSearchParams();
  if (groupId !== undefined && groupId !== null) params.set('group_id', String(groupId));
  const qs = params.toString();
  return apiFetch<ContactFieldDef[]>(`/contact-field-defs${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export async function createFieldDef(payload: CreateFieldDefPayload): Promise<ContactFieldDef> {
  return apiFetch<ContactFieldDef>('/contact-field-defs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateFieldDef(id: number, payload: UpdateFieldDefPayload): Promise<ContactFieldDef> {
  return apiFetch<ContactFieldDef>(`/contact-field-defs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteFieldDef(id: number): Promise<void> {
  await apiFetch<void>(`/contact-field-defs/${id}`, { method: 'DELETE' });
}

export async function setContactCustomFields(
  contactId: number,
  fields: Record<string, unknown>,
): Promise<{ custom_fields: Record<string, unknown> }> {
  return apiFetch(`/contacts/${contactId}/custom-fields`, {
    method: 'PUT',
    body: JSON.stringify({ fields }),
  });
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text:         'Short Text',
  textarea:     'Long Text',
  number:       'Number',
  date:         'Date',
  boolean:      'Yes / No',
  select:       'Dropdown',
  multi_select: 'Multi-select',
  url:          'URL',
  phone:        'Phone',
  email:        'Email',
};
