'use client';

/**
 * Dashboard Phase 2 — the idle "thinking" pill shown while the agent is working
 * with no active tool. Live elapsed timer, matching the app's pill idiom.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function WorkingPill({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(h);
  }, []);
  const secs = Math.max(0, (now - startedAt) / 1000).toFixed(0);
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border-color bg-bg-secondary px-3 py-1.5 text-[13px] text-text-secondary">
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
      <span>Working…</span>
      <span className="tabular-nums text-text-secondary/70">{secs}s</span>
    </div>
  );
}
