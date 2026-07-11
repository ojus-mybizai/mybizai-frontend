/**
 * Dashboard Phase 2 — the unified streaming-agent event protocol (single source
 * of truth). This is the Phase 3/4 BACKEND CONTRACT: the mock transport emits
 * exactly the events the real WebSocket transport will emit, so swapping the
 * transport in Phase 3 is a one-line change with no UI rewrite.
 *
 * Blocks are NOT redefined here — the canvas + rich blocks reuse the existing
 * agent-surface block catalog (lib/agent-blocks). CanvasBlock / UiBlock are
 * aliases of that `Block` union so the renderers (BlockList / CanvasPreview)
 * consume them verbatim.
 */
import type { Block } from '@/lib/agent-blocks';

/** The designed canvas layout (render_ui target='canvas'). Alias of Block. */
export type CanvasBlock = Block;
/** A non-canvas rich block streamed inline in the reply. Alias of Block. */
export type UiBlock = Block;

// ─── Server → client (what the transport emits) ─────────────────────────
export type AgentStreamEvent =
  | { type: 'run_started'; runId: string }
  | { type: 'tool_started'; runId: string; toolId: string; name: string; label: string }
  | { type: 'tool_finished'; runId: string; toolId: string; ms: number; ok: boolean }
  | { type: 'token'; runId: string; delta: string }                    // streamed final text
  | { type: 'canvas'; runId: string; canvas: CanvasBlock[] }           // whole canvas, once
  | { type: 'blocks'; runId: string; blocks: UiBlock[] }               // non-canvas rich blocks
  | { type: 'message_saved'; runId: string; messageId: number }        // durable id (real backend)
  | { type: 'run_finished'; runId: string }
  | { type: 'error'; runId?: string; message: string };

// ─── Client → server (what the composer sends) ──────────────────────────
export type AgentStreamInput =
  | { type: 'user_message'; text: string; context: ContextRef[]; attachments: AttachmentRef[] }
  // Phase 3: a block/canvas action (mirrors REST SendRequest.callback). The
  // internal_chat_ws backend accepts these top-level fields on a `callback` frame.
  | { type: 'callback'; block_id: string; action: string; values: Record<string, unknown> }
  | { type: 'cancel'; runId: string };

export interface ContextRef {
  kind: 'datasheet' | 'pipeline' | 'channel' | 'agent';
  id: string | number;
  label: string;
}

/** Phase 2: `url` is a local object URL; Phase 4 uploads to S3 and swaps it. */
export interface AttachmentRef {
  id: string;
  name: string;
  kind: 'image';
  url?: string;
}

// ─── The transport seam (Phase 2 = MockTransport, Phase 3 = WebSocketTransport) ─
export interface AgentStreamTransport {
  connect(): Promise<void>;
  send(input: AgentStreamInput): void;
  onEvent(cb: (e: AgentStreamEvent) => void): () => void; // returns unsubscribe
  disconnect(): void;
}
