'use client';

/**
 * Dashboard Phase 2 — MockTransport: a scripted, backend-free implementation of
 * AgentStreamTransport. It inspects the user's text and plays one of two event
 * sequences via setTimeout, emitting exactly the events (§4 events.ts) the real
 * WebSocketTransport will emit in Phase 3. All timers are tracked so `cancel`
 * clears them with no orphaned callbacks (and emits nothing further).
 *
 * Phase 3 swaps `new MockTransport()` for `new WebSocketTransport(...)`; nothing
 * upstream (store / renderer / composer) changes.
 */
import type {
  AgentStreamEvent,
  AgentStreamInput,
  AgentStreamTransport,
  CanvasBlock,
  ContextRef,
  AttachmentRef,
} from './events';

/** Word-stream cadence — a constant so tests can speed it up. */
const WORD_MS = 55;

let _runSeq = 0;
let _toolSeq = 0;
const nextRunId = () => `run_${++_runSeq}`;
const nextToolId = () => `tool_${++_toolSeq}`;

const DESIGN_HINTS = /dashboard|widget|revenue|metric|chart|pipeline|team|sales|focus|kpi|report/i;

/** A sample designed dashboard canvas, rendered by the existing <CanvasPreview>. */
function sampleCanvas(): CanvasBlock[] {
  return [
    {
      type: 'section',
      id: 'sec_dash',
      title: 'Proposed Dashboard',
      blocks: [
        {
          type: 'grid',
          id: 'grid_dash',
          columns: 2,
          blocks: [
            {
              type: 'stat',
              id: 'st_contacts',
              items: [{ label: 'New contacts · 7d', value: 128, delta: '+12%' }],
            },
            {
              type: 'stat',
              id: 'st_pipeline',
              items: [{ label: 'Open pipeline', value: '₹4.2L', delta: '+8%' }],
            },
            {
              type: 'chart',
              id: 'ch_rev',
              kind: 'bar',
              title: 'Revenue by week',
              x_key: 'week',
              series: [{ key: 'revenue', label: 'Revenue', color: '#6366F1' }],
              data: [
                { week: 'W1', revenue: 82 },
                { week: 'W2', revenue: 105 },
                { week: 'W3', revenue: 98 },
                { week: 'W4', revenue: 141 },
              ],
            },
            {
              type: 'card',
              id: 'card_team',
              heading: 'Team focus',
              body: 'Priya and Arjun are carrying **62%** of open replies — consider rebalancing.',
              actions: [
                { label: 'Apply to dashboard', action: 'apply', values: {}, style: 'primary' },
              ],
            },
          ],
        },
      ],
    },
  ];
}

function echoOf(context: ContextRef[], attachments: AttachmentRef[]): string {
  const parts: string[] = [];
  if (context.length) parts.push(`context: ${context.map((c) => `${c.kind}:${c.label}`).join(', ')}`);
  if (attachments.length) parts.push(`images: ${attachments.map((a) => a.name).join(', ')}`);
  return parts.length ? `\n\n_(received ${parts.join(' · ')})_` : '';
}

/**
 * Shared singleton — both the grid (/dashboard) and chat (/dashboard/chat) views
 * connect to the SAME instance so an in-flight run started from the grid keeps
 * streaming into the (module-level) store after the client-side navigation. In
 * Phase 3 this factory returns a WebSocketTransport bound to a chat session.
 */
let _singleton: MockTransport | null = null;
export function getMockTransport(): MockTransport {
  if (!_singleton) _singleton = new MockTransport();
  return _singleton;
}

export class MockTransport implements AgentStreamTransport {
  private listeners = new Set<(e: AgentStreamEvent) => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private activeRunId: string | null = null;

  connect(): Promise<void> {
    return Promise.resolve();
  }

  onEvent(cb: (e: AgentStreamEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  disconnect(): void {
    this.clearTimers();
    this.listeners.clear();
  }

  send(input: AgentStreamInput): void {
    if (input.type === 'cancel') {
      this.clearTimers();
      this.activeRunId = null;
      return;
    }
    // The mock only scripts free-text turns; ignore callback frames (real backend only).
    if (input.type !== 'user_message') return;
    // A fresh message supersedes any in-flight run.
    this.clearTimers();
    const design = DESIGN_HINTS.test(input.text) || input.text.trim().length === 0;
    if (design) this.playDesign(input);
    else this.playQna(input);
  }

  // ── internals ────────────────────────────────────────────────────────

  private emit(e: AgentStreamEvent) {
    for (const cb of this.listeners) cb(e);
  }

  private at(ms: number, fn: () => void) {
    const h = setTimeout(() => {
      this.timers.delete(h);
      fn();
    }, ms);
    this.timers.add(h);
  }

  private clearTimers() {
    for (const h of this.timers) clearTimeout(h);
    this.timers.clear();
  }

  /** Schedule a word-by-word token stream starting at `startMs`; returns the end time. */
  private streamText(runId: string, text: string, startMs: number): number {
    const words = text.split(/(\s+)/); // keep whitespace tokens so spacing survives
    let t = startMs;
    for (const w of words) {
      const delta = w;
      this.at(t, () => this.emit({ type: 'token', runId, delta }));
      t += WORD_MS;
    }
    return t;
  }

  /** Scenario A — a full design turn: two tools → streamed reply → canvas. */
  private playDesign(input: Extract<AgentStreamInput, { type: 'user_message' }>) {
    const runId = nextRunId();
    this.activeRunId = runId;
    this.emit({ type: 'run_started', runId });

    const t1 = nextToolId();
    this.at(50, () =>
      this.emit({ type: 'tool_started', runId, toolId: t1, name: 'search_metrics', label: 'Searching your metrics…' }),
    );
    this.at(2500, () => this.emit({ type: 'tool_finished', runId, toolId: t1, ms: 2500, ok: true }));

    const t2 = nextToolId();
    this.at(2550, () =>
      this.emit({ type: 'tool_started', runId, toolId: t2, name: 'query_contacts', label: 'Searching user database…' }),
    );
    this.at(4050, () => this.emit({ type: 'tool_finished', runId, toolId: t2, ms: 1500, ok: true }));

    const reply =
      "Here's a dashboard focused on **growth and your team**. I pulled your last 7 days of " +
      'contacts, open pipeline, and weekly revenue, and flagged where replies are piling up.' +
      echoOf(input.context, input.attachments);
    const end = this.streamText(runId, reply, 4100);

    this.at(end + WORD_MS, () => this.emit({ type: 'canvas', runId, canvas: sampleCanvas() }));
    this.at(end + WORD_MS * 3, () => this.emit({ type: 'run_finished', runId }));
  }

  /** Scenario B — a plain Q&A turn: brief "working" → streamed paragraph. */
  private playQna(input: Extract<AgentStreamInput, { type: 'user_message' }>) {
    const runId = nextRunId();
    this.activeRunId = runId;
    this.emit({ type: 'run_started', runId });

    const reply =
      'Good question. The dashboard assistant can build and reshape your widget layout from ' +
      'plain language — try asking it to *focus on revenue* or *show my team\'s workload*.' +
      echoOf(input.context, input.attachments);
    // ~1s idle "working" pill before the first token.
    const end = this.streamText(runId, reply, 1000);
    this.at(end + WORD_MS * 2, () => this.emit({ type: 'run_finished', runId }));
  }
}
