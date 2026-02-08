'use client';

import { create } from 'zustand';
import { addTool, getTool, listTools, updateTool, type Tool } from '@/services/tools';

interface ToolState {
  tools: Tool[];
  current: Tool | null;
  loading: boolean;
  error: string | null;
  list(): Promise<void>;
  select(id: string): Promise<void>;
  add(input: Omit<Tool, 'id'>): Promise<Tool>;
  update(id: string, input: Partial<Omit<Tool, 'id'>>): Promise<Tool>;
  resetError(): void;
}

export const useToolStore = create<ToolState>((set, get) => ({
  tools: [],
  current: null,
  loading: false,
  error: null,

  async list() {
    set({ loading: true, error: null });
    try {
      const data = await listTools();
      set({ tools: data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async select(id) {
    set({ loading: true, error: null });
    try {
      const tool = await getTool(id);
      set({ current: tool, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async add(input) {
    set({ loading: true, error: null });
    try {
      const tool = await addTool(input);
      set({ tools: [tool, ...get().tools], loading: false });
      return tool;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async update(id, input) {
    set({ loading: true, error: null });
    try {
      const updated = await updateTool(id, input);
      set({
        tools: get().tools.map((t) => (t.id === id ? updated : t)),
        current: updated,
        loading: false,
      });
      return updated;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  resetError() {
    set({ error: null });
  },
}));
