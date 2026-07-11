'use client';

import { useState } from 'react';
import type { FormBlock } from '@/lib/agent-blocks';
import type { BlockProps } from './types';

const INPUT_CLS =
  'w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent disabled:opacity-60';

export default function FormBlockView({ block, onCallback, disabled }: BlockProps<FormBlock>) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  const missingRequired = block.fields.some(
    (f) => f.required && (values[f.name] == null || String(values[f.name]).trim() === ''),
  );

  const submit = () => {
    if (disabled || missingRequired) return;
    onCallback({ block_id: block.id, action: 'submit', values });
  };

  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4">
      {block.title && <h3 className="mb-3 text-sm font-semibold text-text-primary">{block.title}</h3>}
      <div className="space-y-3">
        {block.fields.map((f) => {
          const val = (values[f.name] ?? '') as string | number;
          return (
            <div key={f.name}>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                {f.label}
                {f.required && <span className="text-red-500"> *</span>}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  className={INPUT_CLS}
                  rows={3}
                  placeholder={f.placeholder}
                  disabled={disabled}
                  value={val}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              ) : f.type === 'select' ? (
                <select className={INPUT_CLS} disabled={disabled} value={val} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">Select…</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={INPUT_CLS}
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  placeholder={f.placeholder}
                  disabled={disabled}
                  value={val}
                  onChange={(e) => set(f.name, f.type === 'number' ? e.target.valueAsNumber : e.target.value)}
                />
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={submit}
          disabled={disabled || missingRequired}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {block.submit_label || 'Submit'}
        </button>
      </div>
    </div>
  );
}
