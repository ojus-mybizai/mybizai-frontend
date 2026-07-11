'use client';

import { useState } from 'react';
import type { TabsBlock } from '@/lib/agent-blocks';
import type { BlockProps } from './types';
import { BlockList } from './index';

export default function TabsBlockView({ block, onCallback, disabled }: BlockProps<TabsBlock>) {
  const [active, setActive] = useState(0);
  if (!block.tabs?.length) return null;
  const current = block.tabs[Math.min(active, block.tabs.length - 1)];

  return (
    <div className="rounded-xl border border-border-color bg-card-bg">
      <div className="flex flex-wrap gap-1 border-b border-border-color px-2 pt-2">
        {block.tabs.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-t-lg px-3 py-1.5 text-sm font-medium transition ${
              i === active
                ? 'border-b-2 border-accent text-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.title}
          </button>
        ))}
      </div>
      <div className="p-3">
        {/* Nested blocks render recursively through the same registry. */}
        <BlockList blocks={current.blocks} onCallback={onCallback} disabled={disabled} />
      </div>
    </div>
  );
}
