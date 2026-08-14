import { apiFetch } from '@/lib/api-client';

export interface Employee {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface EmployeeReportRow extends Employee {
  assigned_lead_count: number;
  assigned_work_count: number;
}

export interface EmployeeInviteValidateResult {
  valid: boolean;
  email: string | null;
  name: string | null;
  role: string | null;
  expires_at: string | null;
  status: string | null;
}

export interface EmployeeInviteAcceptResult {
  message: string;
  access_token: string;
  token_type: string;
  refresh_token: string;
  role: string;
}

export async function listEmployees(): Promise<Employee[]> {
  return apiFetch<Employee[]>('/employees', { method: 'GET', auth: true });
}

export async function getEmployeesReport(): Promise<EmployeeReportRow[]> {
  return apiFetch<EmployeeReportRow[]>('/employees/report', { method: 'GET', auth: true });
}

export async function validateEmployeeInvite(token: string): Promise<EmployeeInviteValidateResult> {
  return apiFetch<EmployeeInviteValidateResult>(`/employees/invites/validate?token=${encodeURIComponent(token)}`, {
    method: 'GET',
  });
}

export async function acceptEmployeeInvite(payload: {
  token: string;
  name?: string;
  password: string;
}): Promise<EmployeeInviteAcceptResult> {
  return apiFetch<EmployeeInviteAcceptResult>('/employees/invites/accept', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
