'use client';

import { Check, Pencil, SkipForward } from 'lucide-react';
import type { ProposalAction, ProposalBlock } from '@/lib/agent-blocks';
import type { BlockProps } from './types';
import { toneOf } from './tones';

const ACTION_META: Record<ProposalAction, { label: string; icon: typeof Check; primary?: boolean }> = {
  confirm: { label: 'Confirm', icon: Check, primary: true },
  change: { label: 'Change', icon: Pencil },
  skip: { label: 'Skip', icon: SkipForward },
};

export default function ProposalBlockView({ block, onCallback, disabled }: BlockProps<ProposalBlock>) {
  const actions = block.actions?.length ? block.actions : (['confirm', 'change', 'skip'] as ProposalAction[]);
  // Proposals default to the brand accent tone.
  const t = toneOf(block.tone ?? 'accent');
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${t.border} ${t.tint} p-5 shadow-sm`}>
      <span className={`absolute inset-y-0 left-0 w-1.5 ${t.bar}`} aria-hidden />
      <div className="flex items-center gap-2.5">
        {block.icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${t.chip}`} aria-hidden>
            {block.icon}
          </span>
        )}
        <h3 className="text-base font-semibold tracking-tight text-text-primary">{block.title}</h3>
      </div>
      {block.summary && <p className="mt-1.5 text-[15px] leading-relaxed text-text-secondary">{block.summary}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((a) => {
          const meta = ACTION_META[a];
          const Icon = meta.icon;
          return (
            <button
              key={a}
              type="button"
              disabled={disabled}
              onClick={() => onCallback({ block_id: block.id, action: a, values: {} })}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[14px] font-semibold shadow-sm transition disabled:opacity-50 ${
                meta.primary
                  ? 'bg-accent text-white hover:opacity-90'
                  : 'border border-border-color bg-card-bg text-text-primary hover:border-accent'
              }`}
            >
              <Icon className="h-4 w-4" />
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
