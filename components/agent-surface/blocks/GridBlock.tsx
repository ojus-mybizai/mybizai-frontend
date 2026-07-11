'use client';

/**
 * Arranges children (typically cards) across `columns` via CSS grid. Children
 * render through the one registry, so a grid can hold cards, stats, anything.
 *
 * Responsive to the CANVAS width, not the viewport. The canvas renders in a
 * narrow inline preview, a wide expanded modal AND a side pane, so viewport
 * breakpoints (sm/lg) give unpredictable, often-cramped columns. Instead we use
 * an `auto-fit` track: as many columns as fit at the per-card min width, so a
 * board fans out only when it's actually wide — and never orphans a lone card.
 * The `columns` prop tunes the min width (a density hint), not a hard count.
 */
import type { GridBlock } from '@/lib/agent-blocks';
import type { BlockProps } from './types';
import { BlockRenderer } from './index';

// Higher requested column count → smaller min track (packs more per row when wide).
const MIN_TRACK: Record<1 | 2 | 3 | 4, string> = {
  1: '100%',
  2: '240px',
  3: '200px',
  4: '168px',
};

export default function GridBlockView({ block, onCallback, disabled }: BlockProps<GridBlock>) {
  if (!block.blocks?.length) return null;
  const min = MIN_TRACK[block.columns] ?? MIN_TRACK[2];
  return (
    <div
      className="grid gap-3.5"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}), 1fr))` }}
    >
      {block.blocks.map((b) => (
        <BlockRenderer key={b.id} block={b} onCallback={onCallback} disabled={disabled} />
      ))}
    </div>
  );
}
