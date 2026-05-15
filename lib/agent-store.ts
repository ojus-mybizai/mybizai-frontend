'use client';

import { create } from 'zustand';
import {
  Agent,
  AgentStatus,
  bindChannels,
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  setAgentSkills,
  toggleAgentStatus,
  updateAgent,
  listAvailableSkills,
  listAgentTemplates,
  createAgentFromTemplate,
  type CreateAgentInput,
  type UpdateAgentInput,
  type SkillDefinition,
  type AgentTemplate,
  type SkillOverridesMap,
} from '@/services/agents';

interface AgentState {
  agents: Agent[];
  current: Agent | null;
  skills: SkillDefinition[];
  templates: AgentTemplate[];
  loading: boolean;
  error: string | null;
  lastAgentId: string | null;
  list(): Promise<void>;
  select(id: string): Promise<void>;
  create(input: CreateAgentInput): Promise<Agent>;
  createFromTemplate(templateId: string): Promise<Agent>;
  update(id: string, input: UpdateAgentInput): Promise<Agent>;
  remove(id: string): Promise<void>;
  setStatus(id: string, status: AgentStatus): Promise<Agent>;
  saveChannels(id: string, channelIds: string[]): Promise<Agent | null>;
  saveSkills(
    id: string,
    skills: string[],
    skillOverrides?: SkillOverridesMap,
  ): Promise<Agent | null>;
  loadSkills(): Promise<void>;
  loadTemplates(): Promise<void>;
  resetError(): void;
  setLastAgentId(id: string | null): void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  current: null,
  skills: [],
  templates: [],
  loading: false,
  error: null,
  lastAgentId: null,

  async list() {
    // Guard: if a list request is already in-flight, skip to avoid duplicate network calls
    if (get().loading) return;
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

  async saveSkills(id, skills, skillOverrides) {
    set({ loading: true, error: null });
    try {
      // Phase-4: pass per-skill overrides through in the same atomic call
      // so the skills page never has to fire two requests.
      await setAgentSkills(id, skills, skillOverrides);
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


  async createFromTemplate(templateId: string) {
    set({ loading: true, error: null });
    try {
      const agent = await createAgentFromTemplate(templateId);
      set({ agents: [agent, ...get().agents], current: agent, loading: false });
      return agent;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async loadSkills() {
    try {
      const skills = await listAvailableSkills();
      set({ skills });
    } catch (err) {
      console.error('Failed to load skills:', err);
    }
  },

  async loadTemplates() {
    try {
      const templates = await listAgentTemplates();
      set({ templates });
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  },

  resetError() {
    set({ error: null });
  },

  setLastAgentId(id: string | null) {
    set({ lastAgentId: id });
  },
}));
