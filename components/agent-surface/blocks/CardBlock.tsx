'use client';

/**
 * The core canvas unit: heading + markdown body + optional media + nested
 * widgets + a row of actions. A `tone` (semantic colour) tints the border, an
 * icon chip and a left accent rail so a board reads at a glance — matching the
 * dashboard widgets. Nested blocks and the body reuse the existing renderers.
 */
import type { CardBlock } from '@/lib/agent-blocks';
import type { BlockProps } from './types';
import Markdown from '../Markdown';
import { BlockList } from './index';
import { MediaView } from './MediaBlock';
import ActionRow from './ActionRow';
import { toneOf, isColoredTone } from './tones';

export default function CardBlockView({ block, onCallback, disabled }: BlockProps<CardBlock>) {
  const colored = isColoredTone(block.tone);
  const t = toneOf(block.tone);

  return (
    <div
      className={`group relative flex h-full flex-col gap-3.5 overflow-hidden rounded-2xl border bg-card-bg p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        colored ? `${t.border} ${t.tint}` : 'border-border-color'
      }`}
    >
      {/* Left accent rail — only for toned cards. */}
      {colored && <span className={`absolute inset-y-0 left-0 w-1 ${t.bar}`} aria-hidden />}

      {block.media && <MediaView media={block.media} />}

      {(block.heading || block.icon || block.badge) && (
        <div className="flex items-start gap-2.5">
          {(block.icon || colored) && (
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[15px] ${t.chip}`}
              aria-hidden
            >
              {block.icon || '•'}
            </span>
          )}
          {block.heading && (
            <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug tracking-tight text-text-primary">
              {block.heading}
            </h3>
          )}
          {block.badge && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                colored ? t.chip : 'bg-bg-secondary text-text-secondary'
              }`}
            >
              {block.badge}
            </span>
          )}
        </div>
      )}

      {block.body && (
        <div className="text-[14.5px] leading-relaxed text-text-secondary">
          <Markdown text={block.body} />
        </div>
      )}
      {block.blocks?.length ? <BlockList blocks={block.blocks} onCallback={onCallback} disabled={disabled} /> : null}
      {block.actions?.length ? (
        <div className="mt-auto pt-1">
          <ActionRow blockId={block.id} actions={block.actions} onCallback={onCallback} disabled={disabled} />
        </div>
      ) : null}
    </div>
  );
}
