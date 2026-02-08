'use client';

import { create } from 'zustand';
import {
  KnowledgeBase,
  getKnowledgeBase,
  listKnowledgeBases,
} from '@/services/knowledge-base';

interface KBState {
  items: KnowledgeBase[];
  current: KnowledgeBase | null;
  loading: boolean;
  error: string | null;
  list(): Promise<void>;
  select(id: string): Promise<void>;
  resetError(): void;
}

export const useKBStore = create<KBState>((set, get) => ({
  items: [],
  current: null,
  loading: false,
  error: null,

  async list() {
    set({ loading: true, error: null });
    try {
      const data = await listKnowledgeBases();
      set({ items: data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async select(id) {
    set({ loading: true, error: null });
    try {
      const kb = await getKnowledgeBase(id);
      set({ current: kb, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  resetError() {
    set({ error: null });
  },
}));
