'use client';

/**
 * Dashboard Phase 2 — the streaming thread renderer. Renders committed turns
 * EXACTLY like <AgentSurface> (user bubble; assistant = Markdown + BlockList +
 * CanvasPreview) and, while a run is in flight, an extra "live" block:
 *   1. tool pills (spinner + label + live timer; freeze + ✓/✕ on finish)
 *   2. a Working… pill when thinking with no active tool
 *   3. streamed markdown text with a blinking cursor
 *   4. the streamed canvas (read-only until the turn commits)
 *
 * The renderers are REUSED verbatim — this file only adds the live in-flight state.
 */
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Bot, Star, Zap } from 'lucide-react';
import type { Callback } from '@/lib/agent-blocks';
import { useStreamStore } from '@/lib/agent-stream/stream-store';
import Markdown from '@/components/agent-surface/Markdown';
import { BlockList } from '@/components/agent-surface/blocks';
import CanvasPreview from '@/components/agent-surface/CanvasPreview';
import ToolPill from './ToolPill';
import WorkingPill from './WorkingPill';

export default function AgentChatStream({ onCallback }: { onCallback?: (cb: Callback) => void }) {
  const { messages, runId, phase, toolEvents, streamingText, streamingCanvas, streamingBlocks, error } =
    useStreamStore(
      useShallow((s) => ({
        messages: s.messages,
        runId: s.runId,
        phase: s.phase,
        toolEvents: s.toolEvents,
        streamingText: s.streamingText,
        streamingCanvas: s.streamingCanvas,
        streamingBlocks: s.streamingBlocks,
        error: s.error,
      })),
    );
  const cancel = useStreamStore((s) => s.cancel);
  const mode = useStreamStore((s) => s.mode);
  const toggleSave = useStreamStore((s) => s.toggleSave);

  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, phase, streamingText, toolEvents, streamingCanvas]);

  // Stable "working" start time per run, for the idle Working… pill.
  const [workStart, setWorkStart] = useState(() => Date.now());
  useEffect(() => {
    if (runId) setWorkStart(Date.now());
  }, [runId]);

  const inFlight = phase === 'working' || phase === 'streaming';
  const showWorkingPill = phase === 'working' && toolEvents.length === 0;

  // Only the newest assistant message's interactive blocks/canvas are live; older
  // ones render disabled (re-acting would double-submit).
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id ?? null;
  const latestCanvasId =
    [...messages].reverse().find((m) => m.role === 'assistant' && m.canvas?.length)?.id ?? null;

  return (
    <div ref={listRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
      {messages.map((m) => {
        if (m.role === 'user') {
          return (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-[14px] leading-relaxed text-white shadow-sm">
                {m.command && (
                  <span className="mb-1 mr-1 inline-flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 align-middle text-[11px] font-semibold">
                    <Zap className="h-3 w-3" />/{m.command}
                  </span>
                )}
                {m.content}
              </div>
            </div>
          );
        }
        // ⭐ save is only meaningful for real (server-persisted) messages in session mode.
        const savable = mode === 'session' && m.id > 0;
        return (
          <div key={m.id} className="flex items-start gap-2">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
              <Bot className="h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">{m.content && <Markdown text={m.content} />}</div>
                {savable && (
                  <button
                    type="button"
                    onClick={() => void toggleSave(m.id)}
                    title={m.saved ? 'Remove from saved' : 'Save this result'}
                    aria-pressed={m.saved}
                    className={`shrink-0 rounded-md p-1 transition ${
                      m.saved ? 'text-amber-500' : 'text-text-secondary hover:text-amber-500'
                    }`}
                  >
                    <Star className="h-4 w-4" fill={m.saved ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
              <BlockList blocks={m.blocks} onCallback={onCallback} disabled={m.id !== lastAssistantId} />
              {m.canvas?.length ? (
                <CanvasPreview
                  canvas={m.canvas}
                  interactive={m.id === latestCanvasId}
                  onCallback={onCallback}
                  onToggleSave={savable ? () => void toggleSave(m.id) : undefined}
                  saved={m.saved}
                />
              ) : null}
            </div>
          </div>
        );
      })}

      {/* In-flight assistant turn */}
      {inFlight && (
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
            <Bot className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            {(toolEvents.length > 0 || showWorkingPill) && (
              <div className="flex flex-wrap gap-2">
                {toolEvents.map((t) => (
                  <ToolPill key={t.toolId} tool={t} />
                ))}
                {showWorkingPill && <WorkingPill startedAt={workStart} />}
              </div>
            )}
            {streamingText && (
              <div className="relative">
                <Markdown text={streamingText} />
                {phase === 'streaming' && (
                  <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-accent align-middle" />
                )}
              </div>
            )}
            {streamingBlocks?.length ? (
              <BlockList blocks={streamingBlocks} disabled />
            ) : null}
            {streamingCanvas?.length ? (
              <CanvasPreview canvas={streamingCanvas} interactive={false} />
            ) : null}
            <button
              type="button"
              onClick={cancel}
              className="text-[12px] font-medium text-text-secondary underline-offset-2 transition hover:text-text-primary hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
