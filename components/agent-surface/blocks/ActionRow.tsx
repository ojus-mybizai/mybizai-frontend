'use client';

/**
 * A row of card actions. Each Action either NAVIGATES (`href` → internal route
 * via next/link, or external URL in a new tab) or sends a CALLBACK to the agent
 * (`action` + optional `values`). Callbacks reuse the same round-trip as inline
 * interactive blocks; `block_id` is the owning card's id.
 */
import Link from 'next/link';
import type { Action, Callback } from '@/lib/agent-blocks';
import { resolveLink } from '@/lib/canvas-links';

const STYLES: Record<NonNullable<Action['style']>, string> = {
  primary: 'bg-accent text-white hover:opacity-90',
  secondary: 'border border-border-color bg-card-bg text-text-primary hover:border-accent',
  ghost: 'text-accent hover:bg-accent/10',
};

function classFor(style?: Action['style']): string {
  return `inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[14px] font-medium transition disabled:opacity-50 ${
    STYLES[style ?? 'secondary']
  }`;
}

function isExternal(href: string): boolean {
  return /^(https?:)?\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:');
}

export default function ActionRow({
  blockId,
  actions,
  onCallback,
  disabled,
}: {
  blockId: string;
  actions?: Action[];
  onCallback: (cb: Callback) => void;
  disabled: boolean;
}) {
  if (!actions?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a, i) => {
        // Navigate — a typed link (resolver-built) or a raw href. Links always work
        // (even on read-only/old canvases); disabled only gates callbacks.
        const href = a.href ?? (a.link ? resolveLink(a.link) : undefined);
        if (href) {
          return isExternal(href) ? (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={classFor(a.style)}>
              {a.label}
            </a>
          ) : (
            <Link key={i} href={href} className={classFor(a.style)}>
              {a.label}
            </Link>
          );
        }
        // Callback — round-trip to the agent. block_id = the owning card's id.
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() =>
              onCallback({ block_id: blockId, action: a.action ?? 'select', values: a.values ?? {} })
            }
            className={classFor(a.style)}
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
