'use client';

import { create } from 'zustand';
import {
  ResponsePlayItem,
  ResponsePlayCreateInput,
  ResponsePlayUpdateInput,
  getPlaybook,
  createPlay,
  updatePlay,
  deletePlay,
  autodraftPlaybook,
} from '@/services/agent-playbook';

interface PlaybookState {
  items: ResponsePlayItem[];
  loading: boolean;
  drafting: boolean;
  error: string | null;
  currentAgentId: number | null;

  load(agentId: number | string): Promise<void>;
  add(agentId: number | string, payload: ResponsePlayCreateInput): Promise<void>;
  save(agentId: number | string, playId: number, payload: ResponsePlayUpdateInput): Promise<void>;
  remove(agentId: number | string, playId: number): Promise<void>;
  autodraft(agentId: number | string): Promise<number>;
  resetError(): void;
}

export const useAgentPlaybookStore = create<PlaybookState>((set, get) => ({
  items: [],
  loading: false,
  drafting: false,
  error: null,
  currentAgentId: null,

  async load(agentId) {
    const id = typeof agentId === 'string' ? Number(agentId) : agentId;
    set({ loading: true, error: null, currentAgentId: id });
    try {
      const view = await getPlaybook(id);
      set({ items: view.items, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async add(agentId, payload) {
    set({ error: null });
    try {
      const created = await createPlay(agentId, payload);
      set({ items: [...get().items, created] });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  async save(agentId, playId, payload) {
    set({ error: null });
    try {
      const updated = await updatePlay(agentId, playId, payload);
      set({ items: get().items.map((i) => (i.id === playId ? updated : i)) });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  async remove(agentId, playId) {
    set({ error: null });
    try {
      await deletePlay(agentId, playId);
      set({ items: get().items.filter((i) => i.id !== playId) });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  async autodraft(agentId) {
    set({ drafting: true, error: null });
    try {
      const res = await autodraftPlaybook(agentId);
      set({ items: res.items, drafting: false });
      return res.drafted;
    } catch (err) {
      set({ error: (err as Error).message, drafting: false });
      throw err;
    }
  },

  resetError() {
    set({ error: null });
  },
}));
