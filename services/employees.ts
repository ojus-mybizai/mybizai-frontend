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

export async function listEmployees(): Promise<Employee[]> {
  return apiFetch<Employee[]>('/employees', { method: 'GET', auth: true });
}

export async function getEmployeesReport(): Promise<EmployeeReportRow[]> {
  return apiFetch<EmployeeReportRow[]>('/employees/report', { method: 'GET', auth: true });
}
