'use client';

import { useState } from 'react';
import type { Tool } from '@/services/tools';

function humanizeToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getCategoryBadge(category: Tool['category']): { label: string; class: string } {
  if (category === 'datasheet') {
    return { label: 'Data Sheet', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' };
  }
  if (category === 'search' || category === 'crm' || category === 'ops') {
    return { label: 'System', class: 'bg-bg-secondary text-text-secondary' };
  }
  return { label: 'Custom', class: 'bg-bg-secondary text-text-secondary' };
}

interface ToolRowProps {
  tool: Tool;
  enabled: boolean;
  onToggle: (id: string, next: boolean) => void;
  ruleText?: string;
  onRuleTextChange?: (id: string, next: string) => void;
  disabled?: boolean;
}

export function ToolRow({
  tool,
  enabled,
  onToggle,
  ruleText,
  onRuleTextChange,
  disabled,
}: ToolRowProps) {
  const [expandDescription, setExpandDescription] = useState(false);
  const mode = tool.executionMode ?? 'realtime';
  const displayName = humanizeToolName(tool.name);
  const badge = getCategoryBadge(tool.category);
  const description = tool.description ?? '';
  const isLongDescription = description.length > 120;
  const showDescription = description
    ? expandDescription || !isLongDescription
      ? description
      : `${description.slice(0, 120)}…`
    : '';

  return (
    <div className="rounded-xl border border-border-color bg-bg-primary/50 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.class}`}
            >
              {badge.label}
            </span>
            <span className="text-sm font-semibold text-text-primary">{displayName}</span>
            {mode !== 'realtime' && (
              <span className="text-[11px] text-text-secondary">
                {mode === 'post_process' ? 'Background' : mode}
              </span>
            )}
          </div>
          {description && (
            <div className="mt-1.5">
              <p className="text-xs text-text-secondary leading-relaxed">{showDescription}</p>
              {isLongDescription && (
                <button
                  type="button"
                  onClick={() => setExpandDescription((e) => !e)}
                  className="mt-0.5 text-[11px] font-medium text-accent hover:underline"
                >
                  {expandDescription ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}
          {tool.advanced && (
            <div className="mt-1.5 text-[11px] text-text-secondary">
              Priority: {tool.advanced.priority ?? '—'} · Rate limit:{' '}
              {tool.advanced.rateLimitPerMin ?? '—'}/min
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => !disabled && onToggle(tool.id, !enabled)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            enabled
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-border-color bg-bg-primary text-text-secondary'
          } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-accent'}`}
        >
          {enabled ? 'Enabled' : 'Enable'}
        </button>
      </div>

      {onRuleTextChange && (
        <div className="mt-3.5 border-t border-border-color/60 pt-3">
          <label className="text-[11px] font-medium text-text-secondary">
            When to use (optional) — save below to apply
          </label>
          <textarea
            value={ruleText ?? ''}
            disabled={disabled}
            onChange={(e) => onRuleTextChange(tool.id, e.target.value)}
            rows={2}
            placeholder={
              mode === 'post_process'
                ? 'e.g. Run only when user asks for follow-up/reminder.'
                : 'e.g. Use only when user explicitly asks to check catalog.'
            }
            className="mt-1.5 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary/80 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
          />
        </div>
      )}
    </div>
  );
}
