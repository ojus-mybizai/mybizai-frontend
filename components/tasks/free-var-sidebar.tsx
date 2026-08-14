'use client';

import { Braces } from 'lucide-react';
import type { TemplateVariable } from '@/services/taskTemplates';

export function FreeVarSidebar({
  names,
  variables,
  onChange,
}: {
  names: string[];
  variables: TemplateVariable[];
  onChange: (next: TemplateVariable[]) => void;
}) {
  const byName = new Map(variables.map((v) => [v.name, v]));

  const patch = (name: string, delta: Partial<TemplateVariable>) => {
    const current = byName.get(name) ?? { name, label: titleize(name), required: false };
    const merged: TemplateVariable = { ...current, ...delta };
    const next = variables.filter((v) => v.name !== name).concat(merged);
    onChange(next);
  };

  if (names.length === 0) {
    return (
      <div className="rounded-tc-panel border border-dashed border-tc-rule p-3 text-center text-[11px] text-tc-ink-muted">
        Free variables appear here. Add one with the <span className="font-mono">+ Free</span>{' '}
        button below the editor.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-tc-ink-muted">
        <Braces className="h-3 w-3" /> Free variables
      </div>
      {names.map((name) => {
        const v = byName.get(name) ?? { name, label: titleize(name), required: false };
        return (
          <div
            key={name}
            className="space-y-1 rounded-tc-panel border border-tc-rule bg-tc-bg-card p-2"
          >
            <div className="font-mono text-[11px] text-tc-ink">{`{{${name}}}`}</div>
            <input
              value={v.label ?? ''}
              onChange={(e) => patch(name, { label: e.target.value })}
              placeholder={titleize(name)}
              className="w-full rounded border border-tc-rule bg-tc-bg-ground px-1.5 py-1 text-[11px] text-tc-ink focus:border-tc-accent focus:outline-none"
            />
            <input
              value={v.hint ?? ''}
              onChange={(e) => patch(name, { hint: e.target.value })}
              placeholder="Hint (optional)"
              className="w-full rounded border border-tc-rule bg-tc-bg-ground px-1.5 py-1 text-[11px] text-tc-ink focus:border-tc-accent focus:outline-none"
            />
            <label className="flex cursor-pointer items-center gap-1 text-[11px] text-tc-ink-2">
              <input
                type="checkbox"
                checked={v.required ?? false}
                onChange={(e) => patch(name, { required: e.target.checked })}
                className="accent-tc-accent"
              />
              Required
            </label>
          </div>
        );
      })}
    </div>
  );
}

function titleize(s: string): string {
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
