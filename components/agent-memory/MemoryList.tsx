'use client';

/**
 * P3b — the ONE memory-list component, reused by the business Memory library
 * page and the per-agent Memory tab. Row rendering lives here exactly once; the
 * two surfaces differ only by the action slot they pass via `renderActions`.
 */
import { FileText, User } from 'lucide-react';
import type { MemoryFileOut } from '@/services/agent-memory';

interface Props {
  items: MemoryFileOut[];
  selectedId?: number | null;
  onSelect?: (m: MemoryFileOut) => void;
  renderActions?: (m: MemoryFileOut) => React.ReactNode;
  emptyText?: string;
}

export default function MemoryList({ items, selectedId, onSelect, renderActions, emptyText }: Props) {
  if (!items.length) {
    return <p className="px-1 py-6 text-sm text-text-secondary">{emptyText ?? 'No memory files yet.'}</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((m) => {
        const Icon = m.kind === 'profile' ? User : FileText;
        const selected = selectedId === m.id;
        const clickable = !!onSelect;
        return (
          <div
            key={m.id}
            onClick={clickable ? () => onSelect?.(m) : undefined}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
              selected ? 'border-accent bg-accent/5' : 'border-border-color hover:border-accent/40'
            } ${clickable ? 'cursor-pointer' : ''}`}
          >
            <div className="mt-0.5 rounded-md bg-bg-secondary p-1.5 text-text-secondary">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-medium text-text-primary">{m.title}</span>
                {m.kind === 'profile' && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    Profile
                  </span>
                )}
                {m.attach_all_agents && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    All agents
                  </span>
                )}
                <span className="rounded-full bg-bg-secondary px-1.5 py-0.5 text-[10px] text-text-secondary">
                  {m.default_injection === 'always' ? 'Always injected' : 'On demand'}
                </span>
              </div>
              {m.description && <p className="mt-0.5 truncate text-xs text-text-secondary">{m.description}</p>}
            </div>
            {renderActions && <div className="shrink-0" onClick={(e) => e.stopPropagation()}>{renderActions(m)}</div>}
          </div>
        );
      })}
    </div>
  );
}
