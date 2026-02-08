import { apiFetch } from '@/lib/api-client';

export interface Employee {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface EmployeeReportRow {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  assigned_lead_count: number;
  assigned_work_count: number;
}

export async function getEmployeesReport(): Promise<EmployeeReportRow[]> {
  return apiFetch<EmployeeReportRow[]>('/employees/report', { method: 'GET', auth: true });
}

export async function listEmployees(): Promise<Employee[]> {
  return apiFetch<Employee[]>('/employees', { method: 'GET', auth: true });
}

export async function createEmployee(payload: { email: string; name?: string; role: string }): Promise<Employee> {
  return apiFetch<Employee>('/employees', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function updateEmployee(
  employeeId: number,
  payload: { role?: string; is_active?: boolean }
): Promise<Employee> {
  return apiFetch<Employee>(`/employees/${employeeId}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
}
