'use client';

import { create } from 'zustand';
import {
  KnowledgeFile,
  KnowledgeFileCreateInput,
  KnowledgeFileUpdateInput,
  createKnowledgeFile,
  deleteKnowledgeFile,
  listKnowledgeFiles,
  updateKnowledgeFile,
} from '@/services/knowledge-files';

interface KnowledgeFileState {
  files: KnowledgeFile[];
  loading: boolean;
  error: string | null;
  currentAgentId: number | null;

  list(agentId: number | string): Promise<void>;
  create(payload: KnowledgeFileCreateInput): Promise<KnowledgeFile>;
  update(id: number, payload: KnowledgeFileUpdateInput): Promise<KnowledgeFile>;
  remove(id: number): Promise<void>;
  resetError(): void;
}

export const useKnowledgeFileStore = create<KnowledgeFileState>((set, get) => ({
  files: [],
  loading: false,
  error: null,
  currentAgentId: null,

  async list(agentId) {
    const agentIdNum = typeof agentId === 'string' ? Number(agentId) : agentId;
    set({ loading: true, error: null, currentAgentId: agentIdNum });
    try {
      const files = await listKnowledgeFiles(agentIdNum);
      set({ files, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async create(payload) {
    set({ loading: true, error: null });
    try {
      const created = await createKnowledgeFile(payload);
      set({ files: [created, ...get().files], loading: false });
      return created;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  async update(id, payload) {
    set({ loading: true, error: null });
    try {
      const updated = await updateKnowledgeFile(id, payload);
      set({
        files: get().files.map((f) => (f.id === id ? updated : f)),
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
      await deleteKnowledgeFile(id);
      set({ files: get().files.filter((f) => f.id !== id), loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  resetError() {
    set({ error: null });
  },
}));
