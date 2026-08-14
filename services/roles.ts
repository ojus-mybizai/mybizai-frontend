import { apiFetch } from '@/lib/api-client';

export interface RoleScope {
  id: number;
  resource: string;
  scope_type: string;
  scope_config: Record<string, unknown> | null;
  allowed_actions: string[] | null;
}

export interface Role {
  id: number;
  name: string;
  is_system: boolean;
  task_scope: string;
  agent_template_id: number | null;
  member_count: number;
  scopes: RoleScope[];
}

export interface RoleScopeInput {
  resource: string;
  scope_type: string;
  scope_config?: Record<string, unknown>;
  allowed_actions?: string[];
}

export interface RoleCreatePayload {
  name: string;
  task_scope?: string;
  agent_template_id?: number;
  scopes?: RoleScopeInput[];
}

export interface RoleUpdatePayload {
  name?: string;
  task_scope?: string;
  agent_template_id?: number;
  scopes?: RoleScopeInput[];
}

/** What a role can be granted — served by the backend so the editor holds no
 *  permission vocabulary of its own (the two lists had already drifted). */
export interface PermissionCatalog {
  resources: Record<string, { scope_types: string[]; actions: string[] }>;
  task_scopes: string[];
  agent_templates: { id: number; name: string; kind: string }[];
}

export async function getRoleCatalog(): Promise<PermissionCatalog> {
  return apiFetch<PermissionCatalog>('/roles/catalog', { method: 'GET', auth: true });
}

export async function listRoles(): Promise<Role[]> {
  return apiFetch<Role[]>('/roles', { method: 'GET', auth: true });
}

export async function getRole(id: number): Promise<Role> {
  return apiFetch<Role>(`/roles/${id}`, { method: 'GET', auth: true });
}

export async function createRole(payload: RoleCreatePayload): Promise<Role> {
  return apiFetch<Role>('/roles', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function updateRole(id: number, payload: RoleUpdatePayload): Promise<Role> {
  return apiFetch<Role>(`/roles/${id}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function deleteRole(id: number): Promise<void> {
  await apiFetch(`/roles/${id}`, { method: 'DELETE', auth: true });
}
