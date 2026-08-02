'use client';

import type { DynamicField } from '@/services/dynamic-data';
import { DateField } from '@/components/ui/date-field';

/**
 * Single source of truth for rendering an editable input for a datasheet
 * field's VALUE (not its schema). Every record-entry form in the app —
 * the table "Add row" form, the record detail editor, the create-linked-record
 * modal, and the reverse-relation child-record modal — renders scalar inputs
 * through this component, so a fix here (e.g. a proper <input type="time">)
 * lands everywhere at once.
 *
 * Returns `null` for `relation`, `image`, and `file`: those are inherently
 * context-specific (async option pickers, upload state, a record id) and each
 * caller renders them with its own widget. Callers therefore branch on those
 * three types first and delegate everything else here.
 */

const DEFAULT_INPUT_CLASS =
  'block w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors';

export interface DatasheetFieldInputProps {
  field: DynamicField;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Override the input's classes (each form keeps its own look). */
  className?: string;
  autoFocus?: boolean;
}

/** Chip-based editor for `multi_select` fields. Exported for direct reuse. */
export function MultiSelectChips({
  options,
  value,
  onChange,
  className,
}: {
  options: string[];
  value: unknown;
  onChange: (v: string[]) => void;
  className?: string;
}) {
  const selected: string[] = Array.isArray(value)
    ? (value as unknown[]).map(String)
    : typeof value === 'string' && value
      ? value.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  const remaining = options.filter((o) => !selected.includes(o));
  return (
    <div className={`${className ?? DEFAULT_INPUT_CLASS} flex min-h-[38px] flex-wrap items-center gap-1`}>
      {selected.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/20"
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(selected.filter((_, idx) => idx !== i))}
            className="ml-0.5 text-accent/70 hover:text-accent"
            aria-label={`Remove ${v}`}
          >
            ×
          </button>
        </span>
      ))}
      <select
        className="min-w-[80px] flex-1 border-none bg-transparent text-sm text-text-primary focus:outline-none"
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v && !selected.includes(v)) onChange([...selected, v]);
        }}
      >
        <option value="">{remaining.length ? '+ Add…' : 'All selected'}</option>
        {remaining.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DatasheetFieldInput({
  field,
  value,
  onChange,
  className,
  autoFocus,
}: DatasheetFieldInputProps): React.ReactElement | null {
  const cls = className ?? DEFAULT_INPUT_CLASS;
  const type = field.field_type;

  // Caller-owned types.
  if (type === 'relation' || type === 'image' || type === 'file') return null;

  if (type === 'computed') {
    return <div className={`${cls} cursor-not-allowed text-text-secondary`}>Calculated automatically</div>;
  }

  if (type === 'long_text') {
    return (
      <textarea
        className={cls}
        rows={3}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value || null)}
        autoFocus={autoFocus}
      />
    );
  }

  if (type === 'boolean') {
    const str = value === true ? 'true' : value === false ? 'false' : '';
    return (
      <select
        className={cls}
        value={str}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')}
        autoFocus={autoFocus}
      >
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (type === 'date') {
    return (
      <DateField
        className={cls}
        value={typeof value === 'string' ? value : ''}
        onChange={(iso) => onChange(iso || null)}
      />
    );
  }

  if (type === 'time') {
    return (
      <input
        type="time"
        className={cls}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value || null)}
        autoFocus={autoFocus}
      />
    );
  }

  if (type === 'number') {
    const num = typeof value === 'number' && Number.isFinite(value) ? value : '';
    return (
      <input
        type="number"
        className={cls}
        value={num}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        autoFocus={autoFocus}
      />
    );
  }

  if (type === 'currency') {
    const num = typeof value === 'number' && Number.isFinite(value) ? value : '';
    const code = (field.config?.currency_code as string) ?? 'USD';
    return (
      <div className={`${cls} flex items-stretch overflow-hidden !px-0 !py-0`}>
        <span className="flex items-center bg-bg-secondary px-2 text-xs font-medium text-text-secondary">{code}</span>
        <input
          type="number"
          className="w-full bg-transparent px-3 py-2 text-sm text-text-primary focus:outline-none"
          value={num}
          placeholder="0.00"
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          autoFocus={autoFocus}
        />
      </div>
    );
  }

  if (type === 'phone') {
    const code = (field.config?.default_country_code as string) ?? '+91';
    return (
      <input
        type="tel"
        className={cls}
        value={typeof value === 'string' ? value : ''}
        placeholder={`${code} 98765 43210`}
        onChange={(e) => onChange(e.target.value || null)}
        autoFocus={autoFocus}
      />
    );
  }

  if (type === 'enum') {
    const options = (field.config?.options as string[]) ?? [];
    return (
      <select
        className={cls}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value || null)}
        autoFocus={autoFocus}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (type === 'multi_select') {
    const options = (field.config?.options as string[]) ?? [];
    return <MultiSelectChips options={options} value={value} onChange={onChange} className={cls} />;
  }

  // text and any unrecognised scalar type → plain text input.
  return (
    <input
      type="text"
      className={cls}
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value || null)}
      autoFocus={autoFocus}
    />
  );
}
