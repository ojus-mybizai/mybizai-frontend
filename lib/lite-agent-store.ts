/**
 * Zustand store for Lite Agent state management.
 */
import { create } from 'zustand';
import {
  listLiteAgents,
  getLiteAgent,
  createLiteAgent,
  updateLiteAgent,
  deleteLiteAgent,
  deployLiteAgent,
  pauseLiteAgent,
  bindLiteAgentChannels,
  type LiteAgent,
  type CreateLiteAgentInput,
  type UpdateLiteAgentInput,
} from '@/services/lite-agents';

interface LiteAgentState {
  agents: LiteAgent[];
  current: LiteAgent | null;
  loading: boolean;
  error: string | null;

  list(): Promise<void>;
  select(id: string): Promise<void>;
  create(input: CreateLiteAgentInput): Promise<LiteAgent>;
  update(id: string, input: UpdateLiteAgentInput): Promise<LiteAgent>;
  remove(id: string): Promise<void>;
  setStatus(id: string, status: 'active' | 'paused'): Promise<LiteAgent>;
  saveChannels(id: string, channelIds: string[]): Promise<LiteAgent | null>;
  resetError(): void;
}

export const useLiteAgentStore = create<LiteAgentState>((set, get) => ({
  agents: [],
  current: null,
  loading: false,
  error: null,

  async list() {
    set({ loading: true, error: null });
    try {
      const agents = await listLiteAgents();
      set({ agents, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async select(id) {
    set({ loading: true, error: null });
    try {
      const agent = await getLiteAgent(id);
      set({ current: agent, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async create(input) {
    set({ loading: true, error: null });
    try {
      const agent = await createLiteAgent(input);
      set((s) => ({ agents: [agent, ...s.agents], loading: false }));
      return agent;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async update(id, input) {
    set({ loading: true, error: null });
    try {
      const agent = await updateLiteAgent(id, input);
      set((s) => ({
        agents: s.agents.map((a) => (a.id === id ? agent : a)),
        current: s.current?.id === id ? agent : s.current,
        loading: false,
      }));
      return agent;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async remove(id) {
    set({ loading: true, error: null });
    try {
      await deleteLiteAgent(id);
      set((s) => ({
        agents: s.agents.filter((a) => a.id !== id),
        current: s.current?.id === id ? null : s.current,
        loading: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async setStatus(id, status) {
    set({ loading: true, error: null });
    try {
      const agent = status === 'active' ? await deployLiteAgent(id) : await pauseLiteAgent(id);
      set((s) => ({
        agents: s.agents.map((a) => (a.id === id ? agent : a)),
        current: s.current?.id === id ? agent : s.current,
        loading: false,
      }));
      return agent;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async saveChannels(id, channelIds) {
    set({ loading: true, error: null });
    try {
      await bindLiteAgentChannels(id, channelIds);
      const agent = await getLiteAgent(id);
      if (agent) {
        set((s) => ({
          agents: s.agents.map((a) => (a.id === id ? agent : a)),
          current: s.current?.id === id ? agent : s.current,
          loading: false,
        }));
      } else {
        set({ loading: false });
      }
      return agent;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      return null;
    }
  },

  resetError() {
    set({ error: null });
  },
}));
