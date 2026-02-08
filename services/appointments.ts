import { apiFetch } from '@/lib/api-client';

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Appointment {
  id: number;
  business_id: number;
  contact_id: number;
  service_id: number;
  date_time: string;
  status: AppointmentStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AppointmentCreatePayload {
  contact_id?: number;
  lead_id?: number;
  service_id: number;
  date_time: string;
  status?: AppointmentStatus;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AppointmentUpdatePayload {
  contact_id?: number;
  service_id?: number;
  date_time?: string;
  status?: AppointmentStatus;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ListAppointmentsParams {
  status?: AppointmentStatus;
  contact_id?: number;
  date_from?: string;
  date_to?: string;
}

export async function listAppointments(params: ListAppointmentsParams = {}): Promise<Appointment[]> {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.contact_id !== undefined) search.set('contact_id', String(params.contact_id));
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);

  const qs = search.toString();
  const path = qs ? `/appointments/?${qs}` : '/appointments/';
  return apiFetch<Appointment[]>(path, { method: 'GET' });
}

export async function getAppointment(id: number | string): Promise<Appointment> {
  const appointmentId = Number(id);
  return apiFetch<Appointment>(`/appointments/${appointmentId}`, { method: 'GET' });
}

export async function createAppointment(payload: AppointmentCreatePayload): Promise<Appointment> {
  return apiFetch<Appointment>('/appointments/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAppointment(
  id: number | string,
  payload: AppointmentUpdatePayload
): Promise<Appointment> {
  const appointmentId = Number(id);
  return apiFetch<Appointment>(`/appointments/${appointmentId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAppointment(id: number | string): Promise<void> {
  const appointmentId = Number(id);
  await apiFetch(`/appointments/${appointmentId}`, {
    method: 'DELETE',
  });
}
