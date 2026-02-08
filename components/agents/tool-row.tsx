'use client';

import type { Tool } from '@/services/tools';

interface ToolRowProps {
  tool: Tool;
  enabled: boolean;
  onToggle: (id: string, next: boolean) => void;
  disabled?: boolean;
}

export function ToolRow({ tool, enabled, onToggle, disabled }: ToolRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border-color bg-card-bg px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-text-primary">{tool.name}</div>
        <div className="text-xs text-text-secondary">{tool.description}</div>
        {tool.advanced && (
          <div className="mt-1 text-[11px] text-text-secondary">
            Priority: {tool.advanced.priority ?? '—'} · Rate limit: {tool.advanced.rateLimitPerMin ?? '—'}/min
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onToggle(tool.id, !enabled)}
        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
          enabled
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-border-color bg-bg-primary text-text-secondary'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent'}`}
      >
        {enabled ? 'Enabled' : 'Enable'}
      </button>
    </div>
  );
}
