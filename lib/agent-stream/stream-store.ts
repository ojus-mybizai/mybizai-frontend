'use client';

/**
 * Dashboard Phase 2 — the streaming chat store (module-level so it SURVIVES the
 * client-side route change from the widget grid → /dashboard/chat).
 *
 * Mirrors the seam in lib/internal-chat-store.ts (`sendBody`): optimistically
 * append the user turn, then drive an in-flight assistant message. The difference:
 * instead of one awaited POST, an in-flight turn is reduced from a SEQUENCE of
 * transport events (§4 events.ts). The transport is an interface — Phase 2 wires
 * MockTransport, Phase 3 swaps in WebSocketTransport with zero UI/store changes.
 */
import { create } from 'zustand';
import type { Block, Callback, MessageOut, SavedViewOut } from '@/lib/agent-blocks';
import {
  getSession,
  saveMessage as apiSave,
  deleteSaved as apiDeleteSaved,
} from '@/services/internal-chat';
import type {
  AgentStreamEvent,
  AgentStreamTransport,
  AttachmentRef,
  CanvasBlock,
  ContextRef,
  UiBlock,
} from './events';

let _tempId = -1;
const nextTempId = () => _tempId--;

/** Readable optimistic user bubble for a callback (matches the backend wording). */
function callbackLabel(cb: Callback): string {
  if (cb.action === 'confirm') return 'Confirmed.';
  if (cb.action === 'skip') return 'Skip — use the default.';
  if (cb.action === 'change') return "I'd like to change that.";
  if (cb.values && Object.keys(cb.values).length) return `Submitted: ${JSON.stringify(cb.values)}`;
  return `(${cb.action})`;
}

export type StreamPhase = 'idle' | 'working' | 'streaming' | 'done' | 'error';

export interface StreamToolEvent {
  toolId: string;
  name: string;
  label: string;
  startedAt: number;
  ms?: number;
  ok?: boolean;
}

interface StreamState {
  // Phase 3: 'mock' = dashboard scripted transport; 'session' = a real internal-chat
  // Conversation backed by REST (loadSession) + the WebSocket transport (turns).
  mode: 'mock' | 'session';
  conversationId: number | null;
  /** messageId -> savedId, so ⭐ un-star can DELETE the right row. Seeded from REST. */
  savedIds: Record<number, number>;
  /** Injected hook to refresh the Saved list (TanStack) after a star toggles. */
  onSavedChanged: (() => void) | null;

  messages: MessageOut[]; // committed turns (reuse MessageOut from agent-blocks)

  // in-flight assistant turn:
  runId: string | null;
  phase: StreamPhase;
  toolEvents: StreamToolEvent[];
  streamingText: string;
  streamingCanvas: CanvasBlock[] | null;
  streamingBlocks: UiBlock[] | null;
  savedMessageId: number | null; // durable id from `message_saved` (real backend)
  error: string | null;

  // composer staging:
  pendingContext: ContextRef[];
  pendingAttachments: AttachmentRef[];
  /** First message typed on the grid, replayed once the chat view's transport binds. */
  stagedText: string | null;

  // transport plumbing:
  transport: AgentStreamTransport | null;
  unsub: (() => void) | null;

  connect(transport: AgentStreamTransport): void;
  send(text: string, command?: string): void;
  stageText(text: string): void;
  flushStaged(): void;
  cancel(): void;
  seedGreeting(text: string): void;
  addContext(ref: ContextRef): void;
  removeContext(id: string | number): void;
  addAttachment(a: AttachmentRef): void;
  removeAttachment(id: string): void;
  reset(): void;

  // ── session mode (internal-chat over WebSocketTransport) ──
  loadSession(conversationId: number): Promise<void>;
  sendCallback(cb: Callback): void;
  toggleSave(messageId: number): Promise<void>;
  setSavedIds(list: Pick<SavedViewOut, 'id' | 'source_message_id'>[]): void;
  setOnSavedChanged(fn: (() => void) | null): void;
}

/** Pure reducer: fold one transport event into the in-flight streaming state. */
export function reduceEvent(s: StreamState, e: AgentStreamEvent): Partial<StreamState> {
  switch (e.type) {
    case 'run_started':
      return {
        runId: e.runId,
        phase: 'working',
        toolEvents: [],
        streamingText: '',
        streamingCanvas: null,
        streamingBlocks: null,
        savedMessageId: null,
        error: null,
      };
    case 'tool_started':
      return {
        phase: 'working',
        toolEvents: [
          ...s.toolEvents,
          { toolId: e.toolId, name: e.name, label: e.label, startedAt: Date.now() },
        ],
      };
    case 'tool_finished':
      return {
        toolEvents: s.toolEvents.map((t) =>
          t.toolId === e.toolId ? { ...t, ms: e.ms, ok: e.ok } : t,
        ),
      };
    case 'token':
      return { phase: 'streaming', streamingText: s.streamingText + e.delta };
    case 'canvas':
      return { streamingCanvas: e.canvas };
    case 'blocks':
      return { streamingBlocks: e.blocks };
    case 'message_saved':
      return { savedMessageId: e.messageId };
    case 'run_finished': {
      const committed: MessageOut = {
        id: s.savedMessageId ?? nextTempId(),
        role: 'assistant',
        content: s.streamingText,
        blocks: (s.streamingBlocks ?? []) as Block[],
        canvas: (s.streamingCanvas ?? []) as Block[],
        created_at: null,
        saved: false,
      };
      return {
        messages: [...s.messages, committed],
        runId: null,
        phase: 'idle',
        toolEvents: [],
        streamingText: '',
        streamingCanvas: null,
        streamingBlocks: null,
        savedMessageId: null,
      };
    }
    case 'error':
      return { phase: 'error', error: e.message };
    default:
      return {};
  }
}

export const useStreamStore = create<StreamState>((set, get) => ({
  mode: 'mock',
  conversationId: null,
  savedIds: {},
  onSavedChanged: null,
  messages: [],
  runId: null,
  phase: 'idle',
  toolEvents: [],
  streamingText: '',
  streamingCanvas: null,
  streamingBlocks: null,
  savedMessageId: null,
  error: null,
  pendingContext: [],
  pendingAttachments: [],
  stagedText: null,
  transport: null,
  unsub: null,

  connect(transport) {
    // Re-connecting to the same transport is a no-op (route re-mounts the page).
    if (get().transport === transport) return;
    get().unsub?.();
    const unsub = transport.onEvent((e) => set((s) => reduceEvent(s, e)));
    set({ transport, unsub });
    void transport.connect();
  },

  send(text, command) {
    const trimmed = text.trim();
    const { transport, pendingContext, pendingAttachments, phase } = get();
    if (!trimmed || !transport || phase === 'working' || phase === 'streaming') return;
    // A slash command's full text (incl. the leading /slug) goes to the server,
    // which parses it; the optimistic bubble strips the slug and shows a chip.
    const display = command ? trimmed.replace(/^\/\S+\s*/, '') : trimmed;
    const optimistic: MessageOut = {
      id: nextTempId(),
      role: 'user',
      content: display,
      blocks: [],
      command: command ?? null,
      created_at: null,
      saved: false,
    };
    set((s) => ({
      messages: [...s.messages, optimistic],
      error: null,
      pendingContext: [],
      pendingAttachments: [],
    }));
    transport.send({
      type: 'user_message',
      text: trimmed,
      context: pendingContext,
      attachments: pendingAttachments,
    });
  },

  // Grid → chat hand-off: stash the first message, navigate, then flushStaged()
  // once the chat view has bound a transport (avoids sending into a dead socket).
  stageText(text) {
    const trimmed = text.trim();
    if (trimmed) set({ stagedText: trimmed });
  },
  flushStaged() {
    const { stagedText, transport } = get();
    if (!stagedText || !transport) return;
    set({ stagedText: null });
    get().send(stagedText);
  },

  cancel() {
    const { transport, runId } = get();
    if (transport && runId) transport.send({ type: 'cancel', runId });
    // Drop the in-flight turn without committing a partial bubble.
    set({
      runId: null,
      phase: 'idle',
      toolEvents: [],
      streamingText: '',
      streamingCanvas: null,
      streamingBlocks: null,
      savedMessageId: null,
    });
  },

  seedGreeting(text) {
    if (get().messages.length > 0) return;
    set({
      messages: [
        {
          id: nextTempId(),
          role: 'assistant',
          content: text,
          blocks: [],
          created_at: null,
          saved: false,
        },
      ],
    });
  },

  addContext(ref) {
    set((s) =>
      s.pendingContext.some((c) => c.kind === ref.kind && String(c.id) === String(ref.id))
        ? {}
        : { pendingContext: [...s.pendingContext, ref] },
    );
  },
  removeContext(id) {
    set((s) => ({ pendingContext: s.pendingContext.filter((c) => String(c.id) !== String(id)) }));
  },
  addAttachment(a) {
    set((s) =>
      s.pendingAttachments.some((x) => x.id === a.id)
        ? {}
        : { pendingAttachments: [...s.pendingAttachments, a] },
    );
  },
  removeAttachment(id) {
    set((s) => ({ pendingAttachments: s.pendingAttachments.filter((x) => x.id !== id) }));
  },

  reset() {
    get().unsub?.();
    set({
      mode: 'mock',
      conversationId: null,
      savedIds: {},
      messages: [],
      runId: null,
      phase: 'idle',
      toolEvents: [],
      streamingText: '',
      streamingCanvas: null,
      streamingBlocks: null,
      savedMessageId: null,
      error: null,
      pendingContext: [],
      pendingAttachments: [],
      stagedText: null,
      transport: null,
      unsub: null,
    });
  },

  // ── session mode ────────────────────────────────────────────────────────
  async loadSession(conversationId) {
    set({ mode: 'session', conversationId, error: null });
    try {
      const out = await getSession(conversationId);
      // Ignore a stale response if the user switched sessions while loading.
      if (get().conversationId !== conversationId) return;
      set({ messages: out.messages });
    } catch (e) {
      if (get().conversationId !== conversationId) return;
      set({ error: e instanceof Error ? e.message : 'Failed to load chat.' });
    }
  },

  sendCallback(cb) {
    const { transport, phase } = get();
    if (!transport || phase === 'working' || phase === 'streaming') return;
    const optimistic: MessageOut = {
      id: nextTempId(),
      role: 'user',
      content: callbackLabel(cb),
      blocks: [],
      created_at: null,
      saved: false,
    };
    set((s) => ({ messages: [...s.messages, optimistic], error: null }));
    transport.send({
      type: 'callback',
      block_id: cb.block_id,
      action: cb.action,
      values: cb.values ?? {},
    });
  },

  async toggleSave(messageId) {
    const { messages, savedIds } = get();
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    if (msg.saved) {
      const savedId = savedIds[messageId];
      set({ messages: messages.map((m) => (m.id === messageId ? { ...m, saved: false } : m)) });
      try {
        if (savedId) await apiDeleteSaved(savedId);
        const rest = { ...get().savedIds };
        delete rest[messageId];
        set({ savedIds: rest });
        get().onSavedChanged?.();
      } catch (e) {
        set((s) => ({
          messages: s.messages.map((m) => (m.id === messageId ? { ...m, saved: true } : m)),
          error: e instanceof Error ? e.message : 'Failed to remove saved view.',
        }));
      }
    } else {
      set({ messages: messages.map((m) => (m.id === messageId ? { ...m, saved: true } : m)) });
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
}));
