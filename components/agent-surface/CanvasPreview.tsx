'use client';

/**
 * The inline canvas — renders the FULL canvas directly in the chat thread (and
 * the saved tab) via the one block registry. A header offers "Expand" to open
 * the same canvas in a focused full-screen <CanvasModal>. The latest canvas is
 * interactive inline (links + callbacks); older / saved canvases render read-only.
 */
import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import type { Block, Callback } from '@/lib/agent-blocks';
import { BlockList } from './blocks';
import CanvasModal from './CanvasModal';

/** Best-effort title: first section title → first card heading → "Canvas". */
export function canvasTitle(blocks: Block[]): string {
  for (const b of blocks) if (b.type === 'section' && b.title) return b.title;
  const find = (bs: Block[]): string | null => {
    for (const b of bs) {
      if (b.type === 'card' && b.heading) return b.heading;
      const kids = (b as { blocks?: Block[] }).blocks;
      if (kids?.length) {
        const h = find(kids);
        if (h) return h;
      }
    }
    return null;
  };
  return find(blocks) ?? 'Canvas';
}

export default function CanvasPreview({
  canvas,
  interactive = false,
  onCallback,
  onToggleSave,
  saved,
}: {
  canvas: Block[];
  interactive?: boolean;
  onCallback?: (cb: Callback) => void;
  onToggleSave?: () => void;
  saved?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!canvas?.length) return null;
  const title = canvasTitle(canvas);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border-color bg-card-bg shadow-sm">
        {/* Header chrome with an Expand-to-modal affordance. */}
        <div className="flex items-center justify-between gap-2 border-b border-border-color bg-gradient-to-r from-accent-soft/70 to-transparent px-3.5 py-2">
          <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold tracking-tight text-text-primary">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent" aria-hidden>
              🎨
            </span>
            <span className="truncate">{title}</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            title="Expand canvas"
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-text-secondary transition hover:bg-accent-soft hover:text-accent"
          >
            <Maximize2 className="h-3 w-3" /> Expand
          </button>
        </div>
        {/* Full canvas, rendered inline through the one registry. Block grids
            use auto-fit tracks, so they respond to this board's own width. */}
        <div className="space-y-4 p-4">
          <BlockList blocks={canvas} onCallback={interactive ? onCallback : undefined} disabled={!interactive} />
        </div>
      </div>

      <CanvasModal
        canvas={canvas}
        title={title}
        open={open}
        onClose={() => setOpen(false)}
        interactive={interactive}
        onCallback={onCallback}
        onToggleSave={onToggleSave}
        saved={saved}
      />
    </>
  );
}
