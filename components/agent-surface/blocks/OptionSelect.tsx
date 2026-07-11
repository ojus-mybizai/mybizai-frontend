'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

/**
 * Phase 1 — the dedicated option-block look (the user's UI complaint). Kept
 * separate from the SHARED `AskOptions` (which the agent builder still uses) so
 * this restyle never ripples into the builder.
 *
 * Single-select  → radio chips (a pill row; click sends immediately).
 * Multi-select   → checkbox cards (icon rows + a Continue button).
 *
 * Purely presentational: works in option VALUES, funnels the pick up through
 * `onSelect`. Custom free-text answers still flow through the main composer.
 */
export interface OptionSelectProps {
  prompt?: string;
  options: { label: string; value: string }[];
  multi: boolean;
  allowCustom: boolean;
  disabled: boolean;
  /** Selected option value(s). Single-select passes a 1-element array. */
  onSelect: (values: string[]) => void;
}

export default function OptionSelect({
  prompt,
  options,
  multi,
  allowCustom,
  disabled,
  onSelect,
}: OptionSelectProps) {
  const [selected, setSelected] = useState<string[]>([]);
  if (!options.length) return null;

  const toggle = (value: string) => {
    if (disabled) return;
    if (!multi) {
      onSelect([value]);
      return;
    }
    setSelected((s) => (s.includes(value) ? s.filter((v) => v !== value) : [...s, value]));
  };

  return (
    <div className="space-y-2.5">
      {prompt && (
        <p className="text-[15px] font-medium leading-snug text-text-primary">{prompt}</p>
      )}
      <p className="text-[12px] font-medium uppercase tracking-wide text-text-secondary/70">
        {multi ? 'Choose all that apply' : 'Pick one'}
      </p>

      {multi ? (
        // Checkbox cards
        <div className="space-y-2">
          {options.map((o) => {
            const isSel = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                disabled={disabled}
                onClick={() => toggle(o.value)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-[15px] transition disabled:opacity-50 ${
                  isSel
                    ? 'border-accent bg-accent-soft text-text-primary'
                    : 'border-border-color bg-card-bg text-text-primary hover:border-accent/50'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                    isSel ? 'border-accent bg-accent text-white' : 'border-border-color'
                  }`}
                >
                  {isSel && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">{o.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        // Radio chips
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              onClick={() => toggle(o.value)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-color bg-card-bg px-4 py-2 text-[14px] font-medium text-text-primary transition hover:border-accent hover:bg-accent-soft disabled:opacity-50"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {multi && (
        <button
          type="button"
          disabled={disabled || selected.length === 0}
          onClick={() => onSelect(selected)}
          className="rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          Continue{selected.length ? ` (${selected.length})` : ''}
        </button>
      )}

      {allowCustom && (
        <p className="text-[12px] text-text-secondary/80">…or type your own answer below.</p>
      )}
    </div>
  );
}
