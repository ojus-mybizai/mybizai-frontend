'use client';

import { create } from 'zustand';
import {
  KnowledgeBase,
  CreateTextKnowledgeBaseInput,
  UploadKnowledgeBaseFileInput,
  UpdateKnowledgeBaseInput,
  createKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBase,
  listKnowledgeBases,
  updateKnowledgeBase,
  uploadKnowledgeBaseFile,
} from '@/services/knowledge-base';

interface KBState {
  items: KnowledgeBase[];
  current: KnowledgeBase | null;
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  list(): Promise<void>;
  select(id: string): Promise<void>;
  createText(input: CreateTextKnowledgeBaseInput): Promise<KnowledgeBase>;
  uploadFile(input: UploadKnowledgeBaseFileInput): Promise<KnowledgeBase>;
  updateItem(id: string, input: UpdateKnowledgeBaseInput): Promise<KnowledgeBase>;
  deleteItem(id: string): Promise<void>;
  resetError(): void;
}

export const useKBStore = create<KBState>((set, get) => ({
  items: [],
  current: null,
  loading: false,
  actionLoading: false,
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

  async createText(input) {
    const optimistic: KnowledgeBase = {
      id: `temp-${Date.now()}`,
      title: input.title,
      sourceType: 'text',
      entries: Math.max(
        1,
        input.content
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean).length,
      ),
      category: input.category?.trim() || null,
      content: input.content,
      fileUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const previousItems = get().items;
    set({ actionLoading: true, error: null, items: [optimistic, ...previousItems] });
    try {
      const created = await createKnowledgeBase(input);
      set((state) => ({
        items: state.items.map((item) => (item.id === optimistic.id ? created : item)),
        actionLoading: false,
      }));
      return created;
    } catch (err) {
      set({ items: previousItems, actionLoading: false, error: (err as Error).message });
      throw err;
    }
  },

  async uploadFile(input) {
    const optimistic: KnowledgeBase = {
      id: `temp-${Date.now()}`,
      title: input.title,
      sourceType: 'file',
      entries: 1,
      category: input.category?.trim() || null,
      content: null,
      fileUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const previousItems = get().items;
    set({ actionLoading: true, error: null, items: [optimistic, ...previousItems] });
    try {
      const created = await uploadKnowledgeBaseFile(input);
      set((state) => ({
        items: state.items.map((item) => (item.id === optimistic.id ? created : item)),
        actionLoading: false,
      }));
      return created;
    } catch (err) {
      set({ items: previousItems, actionLoading: false, error: (err as Error).message });
      throw err;
    }
  },

  async updateItem(id, input) {
    const previousItems = get().items;
    const target = previousItems.find((item) => item.id === id);
    if (!target) {
      throw new Error('Knowledge base entry not found.');
    }
    const optimistic: KnowledgeBase = {
      ...target,
      title: input.title ?? target.title,
      category: input.category === undefined ? target.category : input.category,
      content: target.sourceType === 'text' ? (input.content ?? target.content) : null,
      entries:
        target.sourceType === 'text'
          ? Math.max(
              1,
              (input.content ?? target.content ?? '')
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean).length,
            )
          : target.entries,
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      actionLoading: true,
      error: null,
      items: state.items.map((item) => (item.id === id ? optimistic : item)),
      current: state.current?.id === id ? optimistic : state.current,
    }));
    try {
      const updated = await updateKnowledgeBase(id, input);
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? updated : item)),
        current: state.current?.id === id ? updated : state.current,
        actionLoading: false,
      }));
      return updated;
    } catch (err) {
      set({
        items: previousItems,
        current: get().current?.id === id ? target : get().current,
        actionLoading: false,
        error: (err as Error).message,
      });
      throw err;
    }
  },

  async deleteItem(id) {
    const previousItems = get().items;
    const previousCurrent = get().current;
    set((state) => ({
      actionLoading: true,
      error: null,
      items: state.items.filter((item) => item.id !== id),
      current: state.current?.id === id ? null : state.current,
    }));
    try {
      await deleteKnowledgeBase(id);
      set({ actionLoading: false });
    } catch (err) {
      set({
        items: previousItems,
        current: previousCurrent,
        actionLoading: false,
        error: (err as Error).message,
      });
      throw err;
    }
  },

  resetError() {
    set({ error: null });
  },
}));
