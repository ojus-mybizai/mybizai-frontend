import { apiFetch } from '@/lib/api-client';

export interface Contact {
  id: number;
  business_id: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  company: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string | null;
}

export interface ListContactsParams {
  search?: string;
  phone?: string;
  email?: string;
}

export interface ContactCreatePayload {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  company?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export async function listContacts(params: ListContactsParams = {}): Promise<Contact[]> {
  const search = new URLSearchParams();
  if (params.search) search.set('search', params.search);
  if (params.phone) search.set('phone', params.phone);
  if (params.email) search.set('email', params.email);
  const qs = search.toString();
  const path = qs ? `/contacts/?${qs}` : '/contacts/';
  return apiFetch<Contact[]>(path, { method: 'GET' });
}

export async function createContact(payload: ContactCreatePayload): Promise<Contact> {
  return apiFetch<Contact>('/contacts/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
