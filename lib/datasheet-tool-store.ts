'use client';

import { create } from 'zustand';
import {
  listDataSheetTools,
  getDataSheetTool,
  createDataSheetTool,
  updateDataSheetTool,
  deleteDataSheetTool,
  type DataSheetToolOut,
  type DataSheetToolCreate,
  type DataSheetToolUpdate,
} from '@/services/datasheet-tools';

interface DataSheetToolState {
  tools: DataSheetToolOut[];
  loading: boolean;
  error: string | null;
  list(): Promise<void>;
  get(id: number): Promise<DataSheetToolOut | null>;
  create(payload: DataSheetToolCreate): Promise<DataSheetToolOut>;
  update(id: number, payload: DataSheetToolUpdate): Promise<DataSheetToolOut>;
  remove(id: number): Promise<void>;
  resetError(): void;
}

export const useDataSheetToolStore = create<DataSheetToolState>((set, get) => ({
  tools: [],
  loading: false,
  error: null,

  async list() {
    set({ loading: true, error: null });
    try {
      const data = await listDataSheetTools();
      set({ tools: data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async get(id) {
    set({ loading: true, error: null });
    try {
      const tool = await getDataSheetTool(id);
      set({ loading: false });
      return tool;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      return null;
    }
  },

  async create(payload) {
    set({ loading: true, error: null });
    try {
      const tool = await createDataSheetTool(payload);
      set({ tools: [tool, ...get().tools], loading: false });
      return tool;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async update(id, payload) {
    set({ loading: true, error: null });
    try {
      const updated = await updateDataSheetTool(id, payload);
      set({
        tools: get().tools.map((t) => (t.id === id ? updated : t)),
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
      await deleteDataSheetTool(id);
      set({ tools: get().tools.filter((t) => t.id !== id), loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  resetError() {
    set({ error: null });
  },
}));
