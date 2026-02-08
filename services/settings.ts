import { apiFetch } from '@/lib/api-client';

export interface ProfileSettings {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  avatar_url?: string | null;
  current_business_id: number | null;
  current_business_name: string | null;
  current_role: string;
}

export interface ProfileUpdate {
  name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

export interface WorkspaceSettings {
  id: number;
  name: string;
  timezone?: string | null;
  default_currency?: string | null;
  default_channel_id?: number | null;
  lead_auto_assign_strategy?: string | null;
  working_hours?: Record<string, any> | null;
  lms_enabled: boolean;
  agents_enabled: boolean;
}

export interface WorkspaceUpdate {
  name?: string;
  timezone?: string;
  default_currency?: string;
  default_channel_id?: number;
  lead_auto_assign_strategy?: string;
  working_hours?: Record<string, any>;
}

export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
}

export interface RoleMember {
  id: number;
  user_id: number;
  name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  assigned_lead_count: number;
  assigned_work_count: number;
}

export interface RolesOverview {
  roles: RoleDefinition[];
  members: RoleMember[];
}

export interface Permission {
  id: number;
  key: string;
  label: string;
  description?: string | null;
}

export interface CustomRole {
  id: number;
  name: string;
  description?: string | null;
  permission_keys: string[];
}

export interface RoleSummary {
  id: number;
  name: string;
}

export interface RoleAssignment {
  business_user_id: number;
  user_id: number;
  name: string | null;
  email: string | null;
  base_role: string;
  assigned_roles: RoleSummary[];
}

export interface RoleAssignmentsResponse {
  employees: RoleAssignment[];
}

export interface BusinessInfo {
  id: number;
  name: string;
  website?: string | null;
  address?: string | null;
  phone_number: string;
  number_of_employees?: string | null;
  business_type: 'product' | 'service' | 'both';
  description?: string | null;
  industry?: string | null;
  sub_industry?: string | null;
  target_audience?: string | null;
}

export async function getProfileSettings(): Promise<ProfileSettings> {
  return apiFetch<ProfileSettings>('/settings/profile', { method: 'GET' });
}

export async function updateProfileSettings(payload: ProfileUpdate): Promise<ProfileSettings> {
  return apiFetch<ProfileSettings>('/settings/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await apiFetch<void>('/settings/password', {
    method: 'PUT',
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  return apiFetch<WorkspaceSettings>('/settings/workspace', { method: 'GET' });
}

export async function updateWorkspaceSettings(payload: WorkspaceUpdate): Promise<WorkspaceSettings> {
  return apiFetch<WorkspaceSettings>('/settings/workspace', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getRolesOverview(): Promise<RolesOverview> {
  return apiFetch<RolesOverview>('/settings/roles', { method: 'GET' });
}

export async function getPermissionsCatalog(): Promise<Permission[]> {
  return apiFetch<Permission[]>('/settings/permissions', { method: 'GET' });
}

export async function getCustomRoles(): Promise<CustomRole[]> {
  return apiFetch<CustomRole[]>('/settings/custom_roles', { method: 'GET' });
}

export async function createCustomRole(payload: {
  name: string;
  description?: string;
  permission_keys: string[];
}): Promise<CustomRole> {
  return apiFetch<CustomRole>('/settings/custom_roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCustomRole(
  id: number,
  payload: { name?: string; description?: string; permission_keys?: string[] },
): Promise<CustomRole> {
  return apiFetch<CustomRole>(`/settings/custom_roles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteCustomRole(id: number): Promise<void> {
  await apiFetch<void>(`/settings/custom_roles/${id}`, { method: 'DELETE' });
}

export async function getRoleAssignments(): Promise<RoleAssignmentsResponse> {
  return apiFetch<RoleAssignmentsResponse>('/settings/custom_roles/assignments', {
    method: 'GET',
  });
}

export async function updateRoleAssignments(
  businessUserId: number,
  roleIds: number[],
): Promise<void> {
  await apiFetch<void>(`/settings/custom_roles/assignments/${businessUserId}`, {
    method: 'PUT',
    body: JSON.stringify({ role_ids: roleIds }),
  });
}

export async function getBusinessInfo(businessId: number): Promise<BusinessInfo> {
  return apiFetch<BusinessInfo>(`/business/${businessId}`, { method: 'GET' });
}

export async function updateBusinessInfo(
  businessId: number,
  payload: Partial<BusinessInfo>,
): Promise<BusinessInfo> {
  // Map BusinessInfo fields to BusinessUpdate payload (same keys except type -> business_type)
  const body: any = {};
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.website !== undefined) body.website = payload.website;
  if (payload.address !== undefined) body.address = payload.address;
  if (payload.phone_number !== undefined) body.phone_number = payload.phone_number;
  if (payload.number_of_employees !== undefined) {
    body.number_of_employees = payload.number_of_employees;
  }
  if (payload.business_type !== undefined) {
    body.business_type = payload.business_type;
  }
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.industry !== undefined) body.industry = payload.industry;
  if (payload.sub_industry !== undefined) body.sub_industry = payload.sub_industry;
  if (payload.target_audience !== undefined) body.target_audience = payload.target_audience;

  return apiFetch<BusinessInfo>(`/business/${businessId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

