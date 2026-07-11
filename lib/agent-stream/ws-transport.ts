'use client';

/**
 * Dashboard Phase 3 — the REAL transport. Implements the same AgentStreamTransport
 * interface MockTransport does (lib/agent-stream/events.ts), so swapping it in on
 * the internal-chat surface is a one-line change with no store/renderer rewrite.
 *
 * Protocol (matches backend/app/modules/business_agents/api/internal_chat_ws.py):
 *   - open → send {type:'auth', token, conversation_id} as the FIRST frame
 *   - server replies {type:'ready'} (not part of the AgentStreamEvent union — it is
 *     swallowed here and resolves connect()), then streams coarse events
 *   - close codes 4401/4403/4404 = auth/forbidden/no-session → surface an error,
 *     DO NOT reconnect. Any other unexpected close → exponential-backoff reconnect.
 *   - on a successful RE-connect, `onReconnect` fires so the caller can re-sync the
 *     session via REST (getSession) and reconcile anything persisted while dropped.
 */
import { API_BASE_URL } from '@/lib/api-client';
import type { AgentStreamEvent, AgentStreamInput, AgentStreamTransport } from './events';

const WS_URL = API_BASE_URL.replace(/^http/, 'ws') + '/internal-chat/ws';
const AUTH_CLOSE_CODES = new Set([4401, 4403, 4404]);
const MAX_RETRIES = 5;

export interface WsTransportOpts {
  conversationId: number;
  /** Read lazily so a refreshed token is picked up on reconnect. */
  getToken: () => string | null;
  /** Called after a successful reconnect (not the first connect). */
  onReconnect?: () => void;
}

export class WebSocketTransport implements AgentStreamTransport {
  private ws: WebSocket | null = null;
  private listeners = new Set<(e: AgentStreamEvent) => void>();
  private retries = 0;
  private everReady = false;
  private ready = false; // true only between a completed handshake and close
  private closedByUser = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private outbox: AgentStreamInput[] = [];

  constructor(private opts: WsTransportOpts) {}

  connect(): Promise<void> {
    this.closedByUser = false;
    return this.open();
  }

  send(input: AgentStreamInput): void {
    // Only after the auth handshake ('ready') does the server process turns, and
    // a send from the grid hand-off can arrive before the socket even opens. Queue
    // until ready, then flush in order — nothing is silently dropped.
    if (this.ready && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(input));
    } else {
      this.outbox.push(input);
    }
  }

  private flushOutbox() {
    if (!this.ready || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const pending = this.outbox;
    this.outbox = [];
    for (const input of pending) this.ws.send(JSON.stringify(input));
  }

  onEvent(cb: (e: AgentStreamEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  disconnect(): void {
    this.closedByUser = true;
    this.ready = false;
    this.outbox = [];
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.listeners.clear();
  }

  // ── internals ──────────────────────────────────────────────────────────
  private emit(e: AgentStreamEvent) {
    for (const cb of this.listeners) cb(e);
  }

  private open(): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      let ws: WebSocket;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        this.scheduleReconnect();
        return done();
      }
      this.ws = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'auth',
            token: this.opts.getToken(),
            conversation_id: this.opts.conversationId,
          }),
        );
      };

      ws.onmessage = (ev) => {
        let data: unknown;
        try {
          data = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
        } catch {
          return;
        }
        const type = (data as { type?: string })?.type;
        if (type === 'ready') {
          const reconnected = this.everReady;
          this.everReady = true;
          this.ready = true;
          this.retries = 0;
          done();
          if (reconnected) this.opts.onReconnect?.();
          this.flushOutbox();
          return;
        }
        this.emit(data as AgentStreamEvent);
      };

      ws.onclose = (ev) => {
        this.ready = false;
        done(); // never let connect() hang on a failed handshake
        if (this.closedByUser) return;
        if (AUTH_CLOSE_CODES.has(ev.code)) {
          this.emit({ type: 'error', message: authMessage(ev.code) });
          return; // auth failures are terminal — don't reconnect
        }
        this.scheduleReconnect();
      };

      ws.onerror = () => {
        /* the browser fires onclose right after; handle reconnection there */
      };
    });
  }

  private scheduleReconnect() {
    if (this.closedByUser) return;
    if (this.retries >= MAX_RETRIES) {
      this.emit({ type: 'error', message: 'Lost connection to the agent. Please refresh the page.' });
      return;
    }
    const delay = Math.min(500 * 2 ** this.retries, 8000);
    this.retries += 1;
    this.reconnectTimer = setTimeout(() => {
      if (!this.closedByUser) void this.open();
    }, delay);
  }
}

function authMessage(code: number): string {
  if (code === 4401) return 'Your session expired. Please sign in again.';
  if (code === 4403) return 'The AI agent module is not enabled for your business.';
  return 'This chat session could not be found.';
}
