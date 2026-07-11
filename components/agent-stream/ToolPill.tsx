'use client';

/**
 * Dashboard Phase 2 — one tool-status pill (Claude-style). While the tool runs
 * it shows a spinner + label + a LIVE elapsed timer; when `ms` arrives it freezes
 * the elapsed time and swaps the spinner for a ✓ / ✕.
 */
import { useEffect, useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import type { StreamToolEvent } from '@/lib/agent-stream/stream-store';

function useElapsed(startedAt: number, frozenMs?: number): number {
  const [now, setNow] = useState(() => Date.now());
  const done = frozenMs != null;
  useEffect(() => {
    if (done) return;
    const h = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(h);
  }, [done]);
  return done ? (frozenMs as number) : now - startedAt;
}

const fmt = (ms: number) => `${Math.max(0, ms / 1000).toFixed(0)}s`;

export default function ToolPill({ tool }: { tool: StreamToolEvent }) {
  const elapsed = useElapsed(tool.startedAt, tool.ms);
  const done = tool.ms != null;
  const ok = tool.ok !== false;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border-color bg-bg-secondary px-3 py-1.5 text-[13px] text-text-secondary">
      {!done ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
      ) : ok ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      ) : (
        <X className="h-3.5 w-3.5 shrink-0 text-red-500" />
      )}
      <span className="truncate">{tool.label}</span>
      <span className="tabular-nums text-text-secondary/70">{fmt(elapsed)}</span>
    </div>
  );
}
