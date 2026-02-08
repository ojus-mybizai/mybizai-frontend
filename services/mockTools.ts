// Mock service layer for tools; swap with real API later.

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

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let tools: Tool[] = [
  {
    id: uid(),
    name: 'Live Search',
    description: 'Augment answers with real-time web search.',
    category: 'search',
    advanced: { priority: 3, rateLimitPerMin: 60 },
  },
  {
    id: uid(),
    name: 'Order Lookup',
    description: 'Fetch recent orders from your OMS.',
    category: 'ops',
    advanced: { priority: 2, rateLimitPerMin: 120 },
  },
  {
    id: uid(),
    name: 'CRM Notes',
    description: 'Read/write notes to your CRM.',
    category: 'crm',
    advanced: { priority: 1, rateLimitPerMin: 30 },
  },
];

function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export async function listTools(): Promise<Tool[]> {
  return delay([...tools]);
}

export async function getTool(id: string): Promise<Tool | null> {
  const tool = tools.find((t) => t.id === id) || null;
  return delay(tool);
}

export async function addTool(input: Omit<Tool, 'id'>): Promise<Tool> {
  const tool: Tool = { ...input, id: uid() };
  tools = [tool, ...tools];
  return delay(tool);
}

export async function updateTool(id: string, input: Partial<Omit<Tool, 'id'>>): Promise<Tool> {
  tools = tools.map((t) => (t.id === id ? { ...t, ...input } : t));
  const updated = tools.find((t) => t.id === id);
  if (!updated) {
    throw new Error('Tool not found');
  }
  return delay(updated);
}
