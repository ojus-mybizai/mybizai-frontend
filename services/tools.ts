import { apiFetch } from '@/lib/api-client';

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'search' | 'crm' | 'ops' | 'custom';
  advanced?: {
    priority?: number;
    rateLimitPerMin?: number;
  };
}

type ApiTool = {
  id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  enabled?: boolean;
};

function mapTool(t: ApiTool): Tool {
  const rawCat = (t.category ?? '').toLowerCase();
  const category: Tool['category'] =
    rawCat === 'search' ? 'search' : rawCat === 'crm' ? 'crm' : rawCat === 'ops' ? 'ops' : 'custom';

  return {
    id: String(t.id),
    name: t.name,
    description: t.description ?? '',
    category,
  };
}

export async function listTools(): Promise<Tool[]> {
  const data = await apiFetch<ApiTool[]>('/tools/', { method: 'GET' });
  return data.map(mapTool);
}

export async function getTool(id: string): Promise<Tool | null> {
  const data = await apiFetch<ApiTool>(`/tools/${id}`, { method: 'GET' });
  return mapTool(data);
}

export async function addTool(input: Omit<Tool, 'id'>): Promise<Tool> {
  const created = await apiFetch<ApiTool>('/tools/', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      category: input.category,
      type: 'custom',
      input_schema: {},
      output_schema: {},
      config: {},
      enabled: true,
    }),
  });
  return mapTool(created);
}

export async function updateTool(id: string, input: Partial<Omit<Tool, 'id'>>): Promise<Tool> {
  const updated = await apiFetch<ApiTool>(`/tools/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
    }),
  });
  return mapTool(updated);
}

