import { apiFetch } from '@/lib/api-client';

export type EmployeeRole = 'owner' | 'manager' | 'executive';
export type ManagedEmployeeRole = 'manager' | 'executive';
export type EmployeeInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Employee {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: EmployeeRole;
  is_active: boolean;
}

export interface EmployeeReportRow {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: EmployeeRole;
  is_active: boolean;
  assigned_lead_count: number;
  assigned_work_count: number;
}

export interface EmployeeWorkBreakdown {
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  overdue: number;
}

export interface EmployeeDetail {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: EmployeeRole;
  is_active: boolean;
  assigned_lead_count: number;
  assigned_work_count: number;
  work_breakdown: EmployeeWorkBreakdown;
}

export interface EmployeeLifecycleEvent {
  id: number;
  event_type: string;
  actor_user_id?: number | null;
  actor_name?: string | null;
  metadata_json?: Record<string, unknown> | null;
  created_at: string;
}

export interface EmployeeActivityListResponse {
  items: EmployeeLifecycleEvent[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface EmployeeInviteCreate {
  email: string;
  name?: string;
  role: ManagedEmployeeRole;
  expires_in_hours?: number;
}

export interface EmployeeInvite {
  id: number;
  business_id: number;
  email: string;
  name?: string | null;
  role: ManagedEmployeeRole;
  status: EmployeeInviteStatus;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  send_count: number;
  created_at?: string | null;
  invited_by_user_id: number;
}

export interface EmployeeInviteValidateResult {
  valid: boolean;
  email?: string | null;
  name?: string | null;
  role?: ManagedEmployeeRole | null;
  expires_at?: string | null;
  status?: EmployeeInviteStatus | null;
}

export interface EmployeeInviteAcceptPayload {
  token: string;
  name?: string;
  password: string;
}

export interface EmployeeInviteAcceptResult {
  message: string;
  access_token: string;
  token_type: string;
  refresh_token: string;
  role: ManagedEmployeeRole;
}

export interface EmployeeDeactivatePayload {
  reason?: string;
  reassign_to_user_id?: number;
  reassign_open_leads?: boolean;
  reassign_open_work?: boolean;
  force?: boolean;
}

export interface EmployeeDeactivateResult {
  employee_id: number;
  user_id: number;
  is_active: boolean;
  reassigned_leads: number;
  reassigned_work: number;
}

export async function getEmployeesReport(): Promise<EmployeeReportRow[]> {
  return apiFetch<EmployeeReportRow[]>('/employees/report', { method: 'GET', auth: true });
}

export async function listEmployees(): Promise<Employee[]> {
  return apiFetch<Employee[]>('/employees', { method: 'GET', auth: true });
}

export async function getEmployeeDetail(employeeId: number): Promise<EmployeeDetail> {
  return apiFetch<EmployeeDetail>(`/employees/${employeeId}`, { method: 'GET', auth: true });
}

export async function getEmployeeActivity(
  employeeId: number,
  params: { page?: number; per_page?: number } = {},
): Promise<EmployeeActivityListResponse> {
  const query = new URLSearchParams();
  if (params.page != null) query.set('page', String(params.page));
  if (params.per_page != null) query.set('per_page', String(params.per_page));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<EmployeeActivityListResponse>(`/employees/${employeeId}/activity${suffix}`, {
    method: 'GET',
    auth: true,
  });
}

/**
 * @deprecated Prefer invite-based onboarding via createEmployeeInvite().
 */
export async function createEmployee(payload: { email: string; name?: string; role: ManagedEmployeeRole }): Promise<Employee> {
  return apiFetch<Employee>('/employees', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateEmployee(
  employeeId: number,
  payload: { role?: ManagedEmployeeRole; is_active?: boolean }
): Promise<Employee> {
  return apiFetch<Employee>(`/employees/${employeeId}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function createEmployeeInvite(payload: EmployeeInviteCreate): Promise<EmployeeInvite> {
  return apiFetch<EmployeeInvite>('/employees/invite', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function listEmployeeInvites(): Promise<EmployeeInvite[]> {
  return apiFetch<EmployeeInvite[]>('/employees/invites', { method: 'GET', auth: true });
}

export async function validateEmployeeInvite(token: string): Promise<EmployeeInviteValidateResult> {
  const query = new URLSearchParams({ token });
  return apiFetch<EmployeeInviteValidateResult>(`/employees/invites/validate?${query.toString()}`, {
    method: 'GET',
    auth: false,
  });
}

export async function resendEmployeeInvite(inviteId: number): Promise<EmployeeInvite> {
  return apiFetch<EmployeeInvite>(`/employees/invites/${inviteId}/resend`, {
    method: 'POST',
    auth: true,
  });
}

export async function revokeEmployeeInvite(inviteId: number): Promise<EmployeeInvite> {
  return apiFetch<EmployeeInvite>(`/employees/invites/${inviteId}/revoke`, {
    method: 'POST',
    auth: true,
  });
}

export async function acceptEmployeeInvite(
  payload: EmployeeInviteAcceptPayload
): Promise<EmployeeInviteAcceptResult> {
  return apiFetch<EmployeeInviteAcceptResult>('/employees/invites/accept', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function deactivateEmployee(
  employeeId: number,
  payload: EmployeeDeactivatePayload
): Promise<EmployeeDeactivateResult> {
  return apiFetch<EmployeeDeactivateResult>(`/employees/${employeeId}/deactivate`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function removeEmployee(employeeId: number): Promise<void> {
  return apiFetch<void>(`/employees/${employeeId}`, {
    method: 'DELETE',
    auth: true,
  });
}
