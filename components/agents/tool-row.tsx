'use client';

import type { Tool } from '@/services/tools';

interface ToolRowProps {
  tool: Tool;
  enabled: boolean;
  onToggle: (id: string, next: boolean) => void;
  ruleText?: string;
  onRuleTextChange?: (id: string, next: string) => void;
  disabled?: boolean;
}

export function ToolRow({ tool, enabled, onToggle, ruleText, onRuleTextChange, disabled }: ToolRowProps) {
  const mode = tool.executionMode ?? 'realtime';
  return (
    <div className="rounded-xl border border-border-color bg-card-bg px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
        <div className="text-sm font-semibold text-text-primary">{tool.name}</div>
        <div className="text-xs text-text-secondary">{tool.description}</div>
        <div className="mt-1 text-[11px] text-text-secondary">
          Mode: {mode === 'post_process' ? 'Background' : mode}
        </div>
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

      {enabled && (
        <div className="mt-3">
          <label className="text-[11px] font-medium text-text-secondary">Tool rule (optional)</label>
          <textarea
            value={ruleText ?? ''}
            disabled={disabled}
            onChange={(e) => onRuleTextChange?.(tool.id, e.target.value)}
            rows={2}
            placeholder={
              mode === 'post_process'
                ? 'Example: Run only when user asks for follow-up/reminder.'
                : 'Example: Use only when user explicitly asks to check catalog.'
            }
            className="mt-1 w-full rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
          />
        </div>
      )}
    </div>
  );
}
