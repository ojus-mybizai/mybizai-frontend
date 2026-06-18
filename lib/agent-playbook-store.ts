'use client';

import { create } from 'zustand';
import {
  ResponsePlayItem,
  ResponsePlayUpsertInput,
  getPlaybook,
  upsertPlay,
  deletePlay,
  autodraftPlaybook,
} from '@/services/agent-playbook';
import { createConversationTopic } from '@/services/conversationTopics';

interface PlaybookState {
  items: ResponsePlayItem[];
  loading: boolean;
  drafting: boolean;
  error: string | null;
  currentAgentId: number | null;

  load(agentId: number | string): Promise<void>;
  save(agentId: number | string, topicId: number, payload: ResponsePlayUpsertInput): Promise<void>;
  clear(agentId: number | string, topicId: number): Promise<void>;
  autodraft(agentId: number | string): Promise<number>;
  addTopic(agentId: number | string, name: string, description?: string): Promise<void>;
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

  async save(agentId, topicId, payload) {
    set({ error: null });
    try {
      const updated = await upsertPlay(agentId, topicId, payload);
      set({ items: get().items.map((i) => (i.topic_id === topicId ? updated : i)) });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  async clear(agentId, topicId) {
    set({ error: null });
    try {
      await deletePlay(agentId, topicId);
      set({
        items: get().items.map((i) =>
          i.topic_id === topicId
            ? { ...i, play_id: null, guidance: '', example_reply: null, reply_mode: 'guide', knowledge_file_id: null }
            : i,
        ),
      });
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

  async addTopic(agentId, name, description) {
    set({ error: null });
    try {
      await createConversationTopic({ name: name.trim(), description: description?.trim() || null });
      // Reload so the new topic shows up as an (empty) playbook card.
      await get().load(agentId);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  resetError() {
    set({ error: null });
  },
}));
