'use client';

/**
 * The full-canvas view — a centered modal overlay (full-screen sheet on mobile).
 * Renders the canvas through the one block registry. Links always navigate;
 * action callbacks fire only when `interactive` and CLOSE the modal so the user
 * sees the agent's reply land in chat. Opened from a chat message's preview
 * (live) or a saved view (read-only).
 */
import { Star, X } from 'lucide-react';
import type { Block, Callback } from '@/lib/agent-blocks';
import { BlockList } from './blocks';

export default function CanvasModal({
  canvas,
  title,
  open,
  onClose,
  interactive,
  onCallback,
  onToggleSave,
  saved,
}: {
  canvas: Block[];
  title: string;
  open: boolean;
  onClose: () => void;
  interactive: boolean;
  onCallback?: (cb: Callback) => void;
  onToggleSave?: () => void;
  saved?: boolean;
}) {
  if (!open) return null;

  // On a callback, close so the agent's reply / next canvas is visible in chat.
  const handle = (cb: Callback) => {
    onCallback?.(cb);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Close canvas" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full flex-col bg-bg-primary shadow-2xl sm:h-auto sm:max-h-[85vh] sm:max-w-4xl sm:rounded-2xl sm:border sm:border-border-color">
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border-color bg-gradient-to-r from-accent-soft/70 to-transparent px-4">
          <div className="flex min-w-0 items-center gap-2.5 text-[15px] font-semibold tracking-tight text-text-primary">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent" aria-hidden>
              🎨
            </span>
            <span className="truncate">{title}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onToggleSave && (
              <button
                type="button"
                onClick={onToggleSave}
                aria-pressed={saved}
                title={saved ? 'Remove from saved' : 'Save canvas'}
                className={`rounded-md p-1 transition ${saved ? 'text-amber-500' : 'text-text-secondary hover:text-amber-500'}`}
              >
                <Star className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="rounded-md p-1 text-text-secondary transition hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <BlockList blocks={canvas} onCallback={interactive ? handle : undefined} disabled={!interactive} />
        </div>
      </div>
    </div>
  );
}
