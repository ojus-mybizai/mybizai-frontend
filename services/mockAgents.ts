// Mock service layer for agents; replace with real API later.

export type AgentStatus = 'draft' | 'active' | 'paused';

export interface Agent {
  id: string;
  name: string;
  role: 'sales' | 'support' | 'general';
  tone: string;
  instructions: string;
  model: string;
  capabilities: {
    search: boolean;
    tools: boolean;
    knowledge: boolean;
    smalltalk: boolean;
  };
  status: AgentStatus;
  deployed: boolean;
  channelIds: string[];
  toolIds: string[];
  kbIds: string[];
  createdAt: string;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export interface CreateAgentInput {
  name: string;
  role: Agent['role'];
  tone: string;
}

export interface UpdateAgentInput extends Partial<Omit<Agent, 'id' | 'createdAt'>> {}

let agents: Agent[] = [
  {
    id: uid(),
    name: 'Concierge AI',
    role: 'sales',
    tone: 'Warm and proactive',
    instructions:
      'Greet visitors, qualify leads, propose the right plan, and schedule a follow-up. Keep answers concise and trustworthy.',
    model: 'gpt-4o-mini',
    capabilities: { search: true, tools: true, knowledge: true, smalltalk: true },
    status: 'active',
    deployed: true,
    channelIds: ['whatsapp'],
    toolIds: [],
    kbIds: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    name: 'Support Guide',
    role: 'support',
    tone: 'Calm and clear',
    instructions: 'Answer support questions. Ask clarifying questions before proposing fixes.',
    model: 'gpt-4o-mini',
    capabilities: { search: false, tools: true, knowledge: true, smalltalk: false },
    status: 'paused',
    deployed: false,
    channelIds: [],
    toolIds: [],
    kbIds: [],
    createdAt: new Date().toISOString(),
  },
];

function delay<T>(data: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export async function listAgents(): Promise<Agent[]> {
  return delay([...agents]);
}

export async function getAgent(id: string): Promise<Agent | null> {
  const agent = agents.find((a) => a.id === id) || null;
  return delay(agent);
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  const newAgent: Agent = {
    id: uid(),
    name: input.name,
    role: input.role,
    tone: input.tone,
    instructions: 'Describe how this agent should operate.',
    model: 'gpt-4o-mini',
    capabilities: { search: false, tools: false, knowledge: false, smalltalk: false },
    status: 'draft',
    deployed: false,
    channelIds: [],
    toolIds: [],
    kbIds: [],
    createdAt: new Date().toISOString(),
  };
  agents = [newAgent, ...agents];
  return delay(newAgent);
}

export async function updateAgent(id: string, input: UpdateAgentInput): Promise<Agent> {
  agents = agents.map((agent) => (agent.id === id ? { ...agent, ...input } : agent));
  const updated = agents.find((a) => a.id === id);
  if (!updated) {
    throw new Error('Agent not found');
  }
  return delay(updated);
}

export async function deleteAgent(id: string): Promise<void> {
  agents = agents.filter((a) => a.id !== id);
  return delay(undefined);
}

export async function toggleAgentStatus(id: string, next: AgentStatus): Promise<Agent> {
  return updateAgent(id, {
    status: next,
    deployed: next === 'active',
  });
}

export async function bindChannels(id: string, channelIds: string[]): Promise<Agent> {
  return updateAgent(id, { channelIds });
}

export async function bindTools(id: string, toolIds: string[]): Promise<Agent> {
  return updateAgent(id, { toolIds });
}

export async function bindKnowledgeBases(id: string, kbIds: string[]): Promise<Agent> {
  return updateAgent(id, { kbIds });
}
