'use client';

import type { StatBlock } from '@/lib/agent-blocks';
import type { BlockProps } from './types';
import { toneOf, isColoredTone } from './tones';

function fmt(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Heuristic delta colouring: leading '-' or 'down' is bad, otherwise good. */
function deltaClasses(delta: string): string {
  const d = delta.trim().toLowerCase();
  if (d.startsWith('-') || d.startsWith('▼') || d.includes('down'))
    return 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400';
  if (d.startsWith('+') || d.startsWith('▲') || d.includes('up'))
    return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
  return 'bg-bg-secondary text-text-secondary';
}

export default function StatBlockView({ block }: BlockProps<StatBlock>) {
  if (!block.items?.length) return null;
  // Auto-fit tiles: as many columns as fit at ≥150px, keyed off the canvas
  // width (not the viewport), so a KPI row never orphans a lone tile — in a
  // narrow pane it's 2-up, in a wide modal it spreads to 4+.
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))' }}
    >
      {block.items.map((item, i) => {
        const colored = isColoredTone(item.tone);
        const t = toneOf(item.tone);
        return (
          <div
            key={i}
            className={`relative overflow-hidden rounded-2xl border bg-card-bg p-4 shadow-sm ${
              colored ? `${t.border} ${t.tint}` : 'border-border-color'
            }`}
          >
            {colored && <span className={`absolute inset-y-0 left-0 w-1 ${t.bar}`} aria-hidden />}
            <div className="flex items-center gap-1.5">
              {item.icon && (
                <span className={`flex h-5 w-5 items-center justify-center rounded-md text-[11px] ${t.chip}`} aria-hidden>
                  {item.icon}
                </span>
              )}
              <div className="truncate text-xs font-medium text-text-secondary" title={item.label}>
                {item.label}
              </div>
            </div>
            <div
              className={`mt-1.5 truncate text-[26px] font-bold leading-none tracking-tight ${
                colored ? t.text : 'text-text-primary'
              }`}
              title={fmt(item.value)}
            >
              {fmt(item.value)}
            </div>
            {item.delta && (
              <span
                className={`mt-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${deltaClasses(
                  item.delta,
                )}`}
              >
                {item.delta}
              </span>
            )}
            {item.hint && <div className="mt-1 text-[11px] text-text-secondary">{item.hint}</div>}
          </div>
        );
      })}
    </div>
  );
}
