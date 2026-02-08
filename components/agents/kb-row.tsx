'use client';

import type { KnowledgeBase } from '@/services/knowledge-base';

interface KBRowProps {
  kb: KnowledgeBase;
  checked: boolean;
  onChange: (id: string, next: boolean) => void;
  disabled?: boolean;
}

export function KBRow({ kb, checked, onChange, disabled }: KBRowProps) {
  return (
    <label
      className={`flex items-start justify-between gap-3 rounded-xl border border-border-color bg-card-bg px-4 py-3 transition ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent'
      }`}
    >
      <div>
        <div className="text-sm font-semibold text-text-primary">{kb.title}</div>
        <div className="text-xs text-text-secondary">
          {kb.entries} entries · {kb.sourceType} · Updated {new Date(kb.updatedAt).toLocaleDateString()}
        </div>
      </div>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border-color text-accent focus:ring-accent"
        checked={checked}
        onChange={() => !disabled && onChange(kb.id, !checked)}
        disabled={disabled}
      />
    </label>
  );
}
