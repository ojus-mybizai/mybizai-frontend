import { apiFetch } from '@/lib/api-client';

/**
 * Canonical agent-role registry (Slice 3c). A role is BOTH a WhatsApp dispatch
 * pool and the agent-routing key, so the FE must never hardcode the six values —
 * every picker fetches them from `GET /members/roles` (backed by the single
 * `app/core/agent_roles.py` source of truth).
 */
export interface AgentRoleOption {
  value: string;
  label: string;
}

export async function listAgentRoles(): Promise<AgentRoleOption[]> {
  const res = await apiFetch<{ roles: AgentRoleOption[] }>('/members/roles');
  return res.roles;
}
