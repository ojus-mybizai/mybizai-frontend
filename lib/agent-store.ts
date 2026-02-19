'use client';

import { create } from 'zustand';
import {
  Agent,
  AgentStatus,
  bindChannels,
  bindKnowledgeBases,
  bindTools,
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  toggleAgentStatus,
  updateAgent,
  type CreateAgentInput,
  type UpdateAgentInput,
  type BindToolConfigInput,
} from '@/services/agents';

interface AgentState {
  agents: Agent[];
  current: Agent | null;
  loading: boolean;
  error: string | null;
  lastAgentId: string | null;
  list(): Promise<void>;
  select(id: string): Promise<void>;
  create(input: CreateAgentInput): Promise<Agent>;
  update(id: string, input: UpdateAgentInput): Promise<Agent>;
  remove(id: string): Promise<void>;
  setStatus(id: string, status: AgentStatus): Promise<Agent>;
  saveChannels(id: string, channelIds: string[]): Promise<Agent | null>;
  saveTools(id: string, toolIds: string[], toolConfigs?: Record<string, BindToolConfigInput>): Promise<Agent | null>;
  saveKB(id: string, kbIds: string[]): Promise<Agent | null>;
  resetError(): void;
  setLastAgentId(id: string | null): void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  current: null,
  loading: false,
  error: null,
  lastAgentId: null,

  async list() {
    set({ loading: true, error: null });
    try {
      const data = await listAgents();
      set({ agents: data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async select(id: string) {
    set({ loading: true, error: null });
    try {
      const agent = await getAgent(id);
      set({
        current: agent,
        loading: false,
        lastAgentId: agent ? String(agent.id) : null,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async create(input) {
    set({ loading: true, error: null });
    try {
      const agent = await createAgent(input);
      set({ agents: [agent, ...get().agents], current: agent, loading: false });
      return agent;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async update(id, input) {
    set({ loading: true, error: null });
    try {
      const payload: UpdateAgentInput = { ...input };
      const updated = await updateAgent(id, payload);
      set({
        agents: get().agents.map((a) => (a.id === id ? updated : a)),
        current: updated,
        loading: false,
      });
      return updated;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async remove(id) {
    set({ loading: true, error: null });
    try {
      await deleteAgent(id);
      set({
        agents: get().agents.filter((a) => a.id !== id),
        current: get().current?.id === id ? null : get().current,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async setStatus(id, status) {
    set({ loading: true, error: null });
    try {
      const updated = await toggleAgentStatus(id, status);
      set({
        agents: get().agents.map((a) => (a.id === id ? updated : a)),
        current: updated,
        lastAgentId: String(updated.id),
        loading: false,
      });
      return updated;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async saveChannels(id, channelIds) {
    set({ loading: true, error: null });
    try {
      await bindChannels(id, channelIds);
      const refreshed = await getAgent(id);
      if (refreshed) {
        set({
          agents: get().agents.map((a) => (a.id === id ? refreshed : a)),
          current: refreshed,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
      return refreshed;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async saveTools(id, toolIds, toolConfigs) {
    set({ loading: true, error: null });
    try {
      await bindTools(id, toolIds, toolConfigs);
      const refreshed = await getAgent(id);
      if (refreshed) {
        set({
          agents: get().agents.map((a) => (a.id === id ? refreshed : a)),
          current: refreshed,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
      return refreshed;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async saveKB(id, kbIds) {
    set({ loading: true, error: null });
    try {
      await bindKnowledgeBases(id, kbIds);
      const refreshed = await getAgent(id);
      if (refreshed) {
        set({
          agents: get().agents.map((a) => (a.id === id ? refreshed : a)),
          current: refreshed,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
      return refreshed;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  resetError() {
    set({ error: null });
  },

  setLastAgentId(id: string | null) {
    set({ lastAgentId: id });
  },
}));
