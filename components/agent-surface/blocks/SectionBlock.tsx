'use client';

/**
 * A labeled group on the canvas. The title renders as a coloured eyebrow (icon +
 * tone-tinted label + a short accent rule) then its children render through the
 * one registry (recursion). Sections nest (a section can hold grids, cards, or
 * more sections).
 */
import type { SectionBlock } from '@/lib/agent-blocks';
import type { BlockProps } from './types';
import { BlockList } from './index';
import { toneOf, isColoredTone } from './tones';

export default function SectionBlockView({ block, onCallback, disabled }: BlockProps<SectionBlock>) {
  const colored = isColoredTone(block.tone);
  const t = toneOf(block.tone);
  return (
    <section className="space-y-3.5">
      {block.title && (
        <div className="flex items-center gap-2">
          {block.icon && (
            <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[13px] ${t.chip}`} aria-hidden>
              {block.icon}
            </span>
          )}
          <h2
            className={`text-[12.5px] font-bold uppercase tracking-wider ${
              colored ? t.text : 'text-text-secondary'
            }`}
          >
            {block.title}
          </h2>
          <span className={`h-px flex-1 ${colored ? t.bar : 'bg-border-color'} opacity-40`} aria-hidden />
        </div>
      )}
      <BlockList blocks={block.blocks} onCallback={onCallback} disabled={disabled} />
    </section>
  );
}
