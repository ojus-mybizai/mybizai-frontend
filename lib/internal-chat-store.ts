'use client';

/**
 * P3b — Internal chat thread store (the live session for <AgentSurface>).
 *
 * Mirrors lib/datasheet-designer-store.ts: the active thread lives here in the
 * client; each turn POSTs to the same session endpoint and appends the assistant
 * messages it returns. Cacheable lists (agents, sessions, saved) are NOT here —
 * those use TanStack Query (see lib/hooks/use-internal-chat.ts).
 */
import { create } from 'zustand';
import type { Callback, MessageOut, SavedViewOut } from '@/lib/agent-blocks';
import {
  getSession,
  sendMessage as apiSend,
  saveMessage as apiSave,
  deleteSaved as apiDeleteSaved,
} from '@/services/internal-chat';

type SendBody = { message: string } | { callback: Callback };

/** Readable optimistic user bubble for a callback (matches the backend's wording). */
function callbackLabel(cb: Callback): string {
  if (cb.action === 'confirm') return 'Confirmed.';
  if (cb.action === 'skip') return 'Skip — use the default.';
  if (cb.action === 'change') return "I'd like to change that.";
  if (cb.values && Object.keys(cb.values).length) {
    return `Submitted: ${JSON.stringify(cb.values)}`;
  }
  return `(${cb.action})`;
}

let _tempId = -1;
const nextTempId = () => _tempId--;

interface InternalChatState {
  conversationId: number | null;
  agentId: number | null;
  title: string;
  messages: MessageOut[];
  isThinking: boolean;
  error: string | null;
  loading: boolean;
  /** messageId -> savedId, so we can DELETE on un-star. Seeded from the Saved list. */
  savedIds: Record<number, number>;
  /** Last send body, for retry after a failed turn. */
  lastBody: SendBody | null;
  /** Panel-injected hook to refresh the Saved list (TanStack query) after star changes. */
  onSavedChanged: (() => void) | null;

  reset(): void;
  loadSession(conversationId: number): Promise<void>;
  sendText(text: string, command?: string): Promise<void>;
  sendCallback(cb: Callback): Promise<void>;
  retryLast(): Promise<void>;
  toggleSave(messageId: number): Promise<void>;
  setSavedIds(list: Pick<SavedViewOut, 'id' | 'source_message_id'>[]): void;
  setOnSavedChanged(fn: (() => void) | null): void;
  clearError(): void;
}

export const useInternalChatStore = create<InternalChatState>((set, get) => ({
  conversationId: null,
  agentId: null,
  title: '',
  messages: [],
  isThinking: false,
  error: null,
  loading: false,
  savedIds: {},
  lastBody: null,
  onSavedChanged: null,

  reset() {
    set({
      conversationId: null,
      agentId: null,
      title: '',
      messages: [],
      isThinking: false,
      error: null,
      loading: false,
      lastBody: null,
    });
  },

  async loadSession(conversationId) {
    set({ loading: true, error: null, conversationId });
    try {
      const out = await getSession(conversationId);
      // Ignore a stale response if the user switched sessions while loading.
      if (get().conversationId !== conversationId) return;
      set({
        agentId: out.agent_id,
        title: out.title,
        messages: out.messages,
        loading: false,
        isThinking: false,
        lastBody: null,
      });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Failed to load chat.' });
    }
  },

  async sendText(text, command) {
    const trimmed = text.trim();
    if (!trimmed) return;
    // The full text (incl. the leading /slug) goes to the server, which parses
    // the command. The optimistic bubble strips the slug and shows a chip.
    const display = command ? trimmed.replace(/^\/\S+\s*/, '') : trimmed;
    await sendBody(set, get, { message: trimmed }, {
      id: nextTempId(),
      role: 'user',
      content: display,
      blocks: [],
      command: command ?? null,
      created_at: null,
      saved: false,
    });
  },

  async sendCallback(cb) {
    await sendBody(set, get, { callback: cb }, {
      id: nextTempId(),
      role: 'user',
      content: callbackLabel(cb),
      blocks: [],
      created_at: null,
      saved: false,
    });
  },

  async retryLast() {
    const { lastBody, isThinking } = get();
    if (!lastBody || isThinking) return;
    const optimistic: MessageOut = {
      id: nextTempId(),
      role: 'user',
      content: 'message' in lastBody ? lastBody.message : callbackLabel(lastBody.callback),
      blocks: [],
      created_at: null,
      saved: false,
    };
    await sendBody(set, get, lastBody, optimistic);
  },

  async toggleSave(messageId) {
    const { messages, savedIds } = get();
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    if (msg.saved) {
      const savedId = savedIds[messageId];
      // Optimistic un-star.
      set({
        messages: messages.map((m) => (m.id === messageId ? { ...m, saved: false } : m)),
      });
      try {
        if (savedId) await apiDeleteSaved(savedId);
        const rest = { ...get().savedIds };
        delete rest[messageId];
        set({ savedIds: rest });
        get().onSavedChanged?.();
      } catch (e) {
        // Revert on failure.
        set((s) => ({
          messages: s.messages.map((m) => (m.id === messageId ? { ...m, saved: true } : m)),
          error: e instanceof Error ? e.message : 'Failed to remove saved view.',
        }));
      }
    } else {
      set({
        messages: messages.map((m) => (m.id === messageId ? { ...m, saved: true } : m)),
      });
      try {
        const { saved_id } = await apiSave(messageId);
        set((s) => ({ savedIds: { ...s.savedIds, [messageId]: saved_id } }));
        get().onSavedChanged?.();
      } catch (e) {
        set((s) => ({
          messages: s.messages.map((m) => (m.id === messageId ? { ...m, saved: false } : m)),
          error: e instanceof Error ? e.message : 'Failed to save view.',
        }));
      }
    }
  },

  setSavedIds(list) {
    const map: Record<number, number> = {};
    for (const s of list) {
      if (s.source_message_id != null) map[s.source_message_id] = s.id;
    }
    set({ savedIds: map });
  },

  setOnSavedChanged(fn) {
    set({ onSavedChanged: fn });
  },

  clearError() {
    set({ error: null });
  },
}));

/**
 * Shared send path: optimistically append the user turn + a "thinking" flag,
 * POST, then append the assistant messages from the turn. Kept out of the store
 * object so sendText / sendCallback / retryLast don't duplicate it.
 */
async function sendBody(
  set: (partial: Partial<InternalChatState> | ((s: InternalChatState) => Partial<InternalChatState>)) => void,
  get: () => InternalChatState,
  body: SendBody,
  optimisticUser: MessageOut,
) {
  const conversationId = get().conversationId;
  if (conversationId == null || get().isThinking) return;
  set((s) => ({
    messages: [...s.messages, optimisticUser],
    isThinking: true,
    error: null,
    lastBody: body,
  }));
  try {
    const res = await apiSend(conversationId, body);
    if (get().conversationId !== conversationId) return; // switched away mid-flight
    set((s) => ({ messages: [...s.messages, ...res.messages], isThinking: false }));
  } catch (e) {
    set({ isThinking: false, error: e instanceof Error ? e.message : 'The agent could not respond.' });
  }
}
