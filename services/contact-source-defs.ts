import { apiFetch } from '@/lib/api-client';

export interface ContactSourceDef {
  id: number;
  business_id: number;
  key: string;
  label: string;
  color: string | null;
  is_system: boolean;
  is_default: boolean;
  sort_order: number;
}

export interface CreateSourceDefPayload {
  label: string;
  color?: string;
  sort_order?: number;
}

export interface UpdateSourceDefPayload {
  label?: string;
  color?: string;
  sort_order?: number;
}

export async function listSourceDefs(): Promise<ContactSourceDef[]> {
  return apiFetch<ContactSourceDef[]>('/contact-source-defs', { method: 'GET' });
}

export async function createSourceDef(payload: CreateSourceDefPayload): Promise<ContactSourceDef> {
  return apiFetch<ContactSourceDef>('/contact-source-defs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSourceDef(id: number, payload: UpdateSourceDefPayload): Promise<ContactSourceDef> {
  return apiFetch<ContactSourceDef>(`/contact-source-defs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteSourceDef(id: number): Promise<void> {
  await apiFetch<void>(`/contact-source-defs/${id}`, { method: 'DELETE' });
}
