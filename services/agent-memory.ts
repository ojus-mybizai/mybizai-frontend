/**
 * P3b — Business-agent memory API client (brief §4.3). One fn per endpoint.
 * Memory files are markdown facts that can be attached to agents (or all agents)
 * and injected into their prompts either always or on demand.
 */
import { apiFetch } from '@/lib/api-client';

export type MemoryKind = 'profile' | 'note';
export type InjectionMode = 'always' | 'on_demand';

export interface MemoryFileOut {
  id: number;
  business_id: number;
  kind: MemoryKind;
  title: string;
  description: string | null;
  content: string; // markdown
  attach_all_agents: boolean;
  default_injection: InjectionMode;
  is_active: boolean;
}

export interface MemoryFileCreate {
  title: string;
  content?: string;
  description?: string | null;
  kind?: MemoryKind;
  attach_all_agents?: boolean;
  default_injection?: InjectionMode;
}

export interface MemoryFileUpdate {
  title?: string;
  content?: string;
  description?: string | null;
  attach_all_agents?: boolean;
  default_injection?: InjectionMode;
  is_active?: boolean;
}

const BASE = '/business-agents/memory';

export function listMemory(): Promise<MemoryFileOut[]> {
  return apiFetch<MemoryFileOut[]>(BASE, { method: 'GET' });
}

export function createMemory(body: MemoryFileCreate): Promise<MemoryFileOut> {
  return apiFetch<MemoryFileOut>(BASE, { method: 'POST', body: JSON.stringify(body) });
}

export function updateMemory(id: number, body: MemoryFileUpdate): Promise<MemoryFileOut> {
  return apiFetch<MemoryFileOut>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteMemory(id: number): Promise<void> {
  return apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' });
}

export function attachMemory(
  memoryId: number,
  agentId: number,
  injectionMode: InjectionMode,
): Promise<void> {
  return apiFetch<void>(`${BASE}/${memoryId}/attach`, {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, injection_mode: injectionMode }),
  });
}

export function detachMemory(memoryId: number, agentId: number): Promise<void> {
  return apiFetch<void>(`${BASE}/${memoryId}/attach/${agentId}`, { method: 'DELETE' });
}
