'use client';

import { useEffect, useState } from 'react';
import { listModels, listFields } from '@/features/data-sheet/api';
import type { DynamicModel } from '@/services/dynamic-data';
const RELATION_KINDS = [
  { value: 'one_to_one', label: 'One-to-one link', desc: 'Each record links to exactly one record in the other sheet (e.g., one lead becomes one patient)' },
  { value: 'many_to_one', label: 'Link to one record', desc: 'This record points to one record in the other sheet (e.g., an order links to one customer)' },
  { value: 'one_to_many', label: 'Link from other records', desc: 'Other records point back to this one (e.g., a customer has many orders)' },
  { value: 'many_to_many', label: 'Link to multiple records', desc: 'This record connects to many records in the other sheet (e.g., a product has many tags)' },
] as const;

const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];

const BUILTIN_RELATION_OPTIONS = [
  { value: '__builtin_contacts', label: 'Contacts' },
  { value: '__builtin_users', label: 'Employees' },
  { value: '__builtin_work', label: 'Work Items' },
] as const;

export interface AvailableDateField {
  name: string;
  display_name: string;
}

export interface FieldConfigPanelProps {
  fieldType: string;
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
  relationModelId: number | null;
  onRelationModelIdChange: (id: number | null) => void;
  relationKind: 'one_to_one' | 'many_to_one' | 'one_to_many' | 'many_to_many' | null;
  onRelationKindChange: (kind: 'one_to_one' | 'many_to_one' | 'one_to_many' | 'many_to_many' | null) => void;
  relationBuiltinModel?: string | null;
  onRelationBuiltinModelChange?: (model: string | null) => void;
  relationReadOnly?: boolean;
  defaultValue?: unknown;
  onDefaultValueChange?: (value: unknown) => void;
  /** When adding a relation field, exclude this model ID (e.g. current model) from the list */
  excludeModelId?: number | null;
  /** Date/datetime fields on the current model — powers the computed date-calc picker.
   *  When omitted (or empty), the picker falls back to a plain text input. */
  availableDateFields?: AvailableDateField[];
}

export function FieldConfigPanel({
  fieldType,
  config,
  onConfigChange,
  relationModelId,
  onRelationModelIdChange,
  relationKind,
  onRelationKindChange,
  relationBuiltinModel,
  onRelationBuiltinModelChange,
  relationReadOnly = false,
  defaultValue,
  onDefaultValueChange,
  excludeModelId,
  availableDateFields,
}: FieldConfigPanelProps) {
  const [models, setModels] = useState<DynamicModel[]>([]);

  useEffect(() => {
    let cancelled = false;
    listModels()
      .then((list) => {
        if (!cancelled) setModels(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const filteredModels = excludeModelId != null
    ? models.filter((m) => m.id !== excludeModelId)
    : models;

  // ── Multi-select: same options editor as enum ──
  if (fieldType === 'multi_select') {
    const options = (config.options as string[]) ?? [];
    const addOption = () => onConfigChange({ ...config, options: [...options, ''] });
    const setOption = (index: number, value: string) => {
      const next = [...options]; next[index] = value;
      onConfigChange({ ...config, options: next });
    };
    const removeOption = (index: number) => onConfigChange({ ...config, options: options.filter((_, i) => i !== index) });
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">Multi-select options</label>
        <div className="flex flex-wrap gap-2">
          {options.map((opt, i) => (
            <span key={i} className="flex items-center gap-1 rounded-md border border-border-color bg-bg-primary px-2 py-1">
              <input type="text" value={opt} onChange={(e) => setOption(i, e.target.value)}
                placeholder="Option" className="min-w-[120px] w-40 rounded border-0 bg-transparent text-sm text-text-primary focus:ring-0" />
              <button type="button" onClick={() => removeOption(i)} className="text-text-secondary hover:text-text-primary" aria-label="Remove option">×</button>
            </span>
          ))}
          <button type="button" onClick={addOption}
            className="rounded-md border border-dashed border-border-color px-2 py-1 text-sm text-text-secondary hover:border-accent hover:text-text-primary">
            + Add option
          </button>
        </div>
        <p className="text-xs text-text-secondary">Users can select multiple values from this list.</p>
      </div>
    );
  }

  // ── Phone: default country code ──
  if (fieldType === 'phone') {
    const PHONE_COUNTRIES = [
      { code: 'IN', dial: '+91', name: 'India' },
      { code: 'US', dial: '+1', name: 'United States' },
      { code: 'GB', dial: '+44', name: 'United Kingdom' },
      { code: 'AE', dial: '+971', name: 'UAE' },
      { code: 'SG', dial: '+65', name: 'Singapore' },
      { code: 'AU', dial: '+61', name: 'Australia' },
      { code: 'CA', dial: '+1', name: 'Canada' },
      { code: 'SA', dial: '+966', name: 'Saudi Arabia' },
    ];
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-text-secondary">Default country</label>
          <select
            value={(config.default_country as string) ?? 'IN'}
            onChange={(e) => {
              const c = PHONE_COUNTRIES.find((p) => p.code === e.target.value);
              onConfigChange({ ...config, default_country: e.target.value, default_country_code: c?.dial ?? '+91' });
            }}
            className="mt-1 w-full rounded border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
          >
            {PHONE_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name} ({c.dial})</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-text-secondary">
          Numbers without a country code will automatically use {(config.default_country_code as string) ?? '+91'} as prefix.
        </p>
      </div>
    );
  }

  // ── Time: display format ──
  if (fieldType === 'time') {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-text-secondary">Display format</label>
          <select
            value={(config.format as string) ?? '24h'}
            onChange={(e) => onConfigChange({ ...config, format: e.target.value })}
            className="mt-1 w-full rounded border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
          >
            <option value="24h">24-hour (14:30)</option>
            <option value="12h">12-hour (2:30 PM)</option>
          </select>
        </div>
        <p className="text-xs text-text-secondary">Time is always stored in 24-hour format internally.</p>
      </div>
    );
  }

  // ── Computed: date-calc picker OR custom formula ──
  if (fieldType === 'computed') {
    return <ComputedFieldEditor
      config={config}
      onConfigChange={onConfigChange}
      availableDateFields={availableDateFields ?? []}
    />;
  }

  if (fieldType === 'enum') {
    const options = (config.options as string[]) ?? [];
    const addOption = () => {
      const next = [...options, ''];
      onConfigChange({ ...config, options: next });
    };
    const setOption = (index: number, value: string) => {
      const next = [...options];
      next[index] = value;
      onConfigChange({ ...config, options: next });
    };
    const removeOption = (index: number) => {
      const next = options.filter((_, i) => i !== index);
      onConfigChange({ ...config, options: next });
    };
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-secondary">Dropdown options</label>
        <div className="flex flex-wrap gap-2">
          {options.map((opt, i) => (
            <span key={i} className="flex items-center gap-1 rounded-md border border-border-color bg-bg-primary px-2 py-1">
              <input
                type="text"
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder="Option"
                className="min-w-[120px] w-40 rounded border-0 bg-transparent text-sm text-text-primary focus:ring-0"
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-text-secondary hover:text-text-primary"
                aria-label="Remove option"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="rounded-md border border-dashed border-border-color px-2 py-1 text-sm text-text-secondary hover:border-accent hover:text-text-primary"
          >
            + Add option
          </button>
        </div>
      </div>
    );
  }

  if (fieldType === 'relation') {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-text-secondary">Related model (data sheet)</label>
          {relationReadOnly ? (
            <p className="mt-1 text-sm text-text-primary">
              {relationBuiltinModel
                ? (BUILTIN_RELATION_OPTIONS.find((o) => o.value === `__builtin_${relationBuiltinModel}`)?.label ?? relationBuiltinModel)
                : relationModelId != null
                  ? (filteredModels.find((m) => m.id === relationModelId)?.display_name ?? `Model #${relationModelId}`)
                  : '—'}
            </p>
          ) : (
            <select
              value={relationBuiltinModel ? `__builtin_${relationBuiltinModel}` : (relationModelId ?? '')}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  onRelationModelIdChange(null);
                  onRelationBuiltinModelChange?.(null);
                  return;
                }
                if (v.startsWith('__builtin_')) {
                  const modelKey = v.replace('__builtin_', '');
                  onRelationModelIdChange(null);
                  onRelationBuiltinModelChange?.(modelKey);
                  return;
                }
                onRelationBuiltinModelChange?.(null);
                onRelationModelIdChange(Number(v));
              }}
              className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary"
            >
              <option value="">— Select model —</option>
              <optgroup label="Built-in Models">
                {BUILTIN_RELATION_OPTIONS.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                  >
                    {opt.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Your Data Sheets">
                {filteredModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name} ({m.name})
                  </option>
                ))}
              </optgroup>
            </select>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">How are these linked?</label>
          {relationReadOnly ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
                {relationKind ? RELATION_KINDS.find((k) => k.value === relationKind)?.label ?? relationKind : '—'}
              </span>
              <span className="text-xs text-text-muted">
                {relationKind ? RELATION_KINDS.find((k) => k.value === relationKind)?.desc ?? '' : ''}
              </span>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {RELATION_KINDS.map((k) => (
                <label
                  key={k.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
                    relationKind === k.value
                      ? 'border-accent bg-accent/5'
                      : 'border-border-color hover:border-accent/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="relation_kind"
                    value={k.value}
                    checked={relationKind === k.value}
                    onChange={() => onRelationKindChange(k.value as typeof relationKind)}
                    className="mt-0.5 text-accent focus:ring-accent"
                  />
                  <div>
                    <span className="text-sm font-medium text-text-primary">{k.label}</span>
                    <p className="mt-0.5 text-xs text-text-muted leading-relaxed">{k.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Display field selector for DynamicModel relations */}
        {relationModelId && (
          <>
            <DisplayFieldPicker
              modelId={relationModelId}
              selectedField={(config.relation_display_field as string) ?? ''}
              onChange={(fieldName) => onConfigChange({ ...config, relation_display_field: fieldName || undefined })}
            />
            <NestedDisplayFieldsPicker
              modelId={relationModelId}
              selected={(config.nested_display_fields as string[]) ?? []}
              onChange={(fields) => onConfigChange({ ...config, nested_display_fields: fields.length ? fields : undefined })}
            />
          </>
        )}
      </div>
    );
  }

  if (fieldType === 'currency') {
    const currencyCode = (config.currency_code as string) ?? 'USD';
    return (
      <div>
        <label className="block text-sm font-medium text-text-secondary">Currency code</label>
        <select
          value={currencyCode}
          onChange={(e) => onConfigChange({ ...config, currency_code: e.target.value })}
          className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary"
        >
          {CURRENCY_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (fieldType === 'boolean' && onDefaultValueChange) {
    return (
      <div>
        <label className="block text-sm font-medium text-text-secondary">Default value</label>
        <select
          value={defaultValue === true ? 'true' : defaultValue === false ? 'false' : ''}
          onChange={(e) => {
            const v = e.target.value;
            onDefaultValueChange(v === 'true' ? true : v === 'false' ? false : null);
          }}
          className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary"
        >
          <option value="">— None —</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    );
  }

  if (fieldType === 'image' || fieldType === 'file') {
    const multiple = config.multiple === true;
    return (
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={multiple}
            onChange={(e) => onConfigChange({ ...config, multiple: e.target.checked })}
            className="rounded border-border-color text-accent focus:ring-accent"
          />
          <span className="text-sm font-medium text-text-secondary">Allow multiple files</span>
        </label>
        <p className="text-sm text-text-secondary">
          Optional: max size and allowed types can be configured later in field settings.
        </p>
      </div>
    );
  }

  return null;
}

/** Lets user pick which fields to show in the nested detail view for a relation */
function NestedDisplayFieldsPicker({ modelId, selected, onChange }: { modelId: number; selected: string[]; onChange: (fields: string[]) => void }) {
  const [fields, setFields] = useState<Array<{ name: string; display_name: string; field_type: string }>>([]);

  useEffect(() => {
    listFields(modelId)
      .then((f) => setFields(f.filter((ff) => ff.field_type !== 'relation')))
      .catch(() => {});
  }, [modelId]);

  if (!fields.length) return null;

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((n) => n !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary">Fields to show in detail view</label>
      <p className="mb-2 text-xs text-text-muted">Select which fields appear when viewing this record&apos;s details in a linked record</p>
      <div className="max-h-40 overflow-y-auto rounded-lg border border-border-color bg-bg-primary p-2 space-y-1">
        {fields.map((f) => (
          <label key={f.name} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-secondary/50 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(f.name)}
              onChange={() => toggle(f.name)}
              className="rounded border-border-color text-accent focus:ring-accent"
            />
            <span className="text-sm text-text-primary">{f.display_name}</span>
            <span className="text-xs text-text-muted">({f.field_type})</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="mt-1 text-xs text-text-muted">{selected.length} field{selected.length > 1 ? 's' : ''} selected</p>
      )}
    </div>
  );
}

type DateCalcOperation = 'days_since' | 'days_until' | 'days_between' | 'add_days';

interface DateCalcBuilder {
  kind: 'date_calc';
  operation: DateCalcOperation;
  field_a: string | null;
  field_b: string | null;
  delta: number | null;
}

function buildFormulaFromBuilder(b: DateCalcBuilder): string {
  const refA = b.field_a
    ? (b.field_a === 'created_at' || b.field_a === 'updated_at' ? b.field_a : `fields.${b.field_a}`)
    : '';
  if (!refA) return '';
  if (b.operation === 'days_since') return `DAYS_SINCE(${refA})`;
  if (b.operation === 'days_until') return `DAYS_UNTIL(${refA})`;
  if (b.operation === 'days_between') {
    const refB = b.field_b
      ? (b.field_b === 'created_at' || b.field_b === 'updated_at' ? b.field_b : `fields.${b.field_b}`)
      : '';
    return refB ? `DAYS_BETWEEN(${refA}, ${refB})` : '';
  }
  if (b.operation === 'add_days') {
    const n = Number.isFinite(b.delta) ? Number(b.delta) : NaN;
    return Number.isFinite(n) ? `ADD_DAYS(${refA}, ${n})` : '';
  }
  return '';
}

function ComputedFieldEditor({
  config,
  onConfigChange,
  availableDateFields,
}: {
  config: Record<string, unknown>;
  onConfigChange: (c: Record<string, unknown>) => void;
  availableDateFields: AvailableDateField[];
}) {
  const existingBuilder = (config.builder as DateCalcBuilder | undefined) ?? null;
  const hasFormula = typeof config.formula === 'string' && (config.formula as string).length > 0;
  const [mode, setMode] = useState<'date_calc' | 'custom'>(
    existingBuilder?.kind === 'date_calc' ? 'date_calc'
      : hasFormula ? 'custom'
      : 'date_calc'
  );

  const builder: DateCalcBuilder = existingBuilder ?? {
    kind: 'date_calc',
    operation: 'days_since',
    field_a: null,
    field_b: null,
    delta: null,
  };

  const dateOptions = [
    ...availableDateFields.map((f) => ({ value: f.name, label: f.display_name })),
    { value: 'created_at', label: 'Created at (system)' },
    { value: 'updated_at', label: 'Updated at (system)' },
  ];

  const commitBuilder = (patch: Partial<DateCalcBuilder>) => {
    const next: DateCalcBuilder = { ...builder, ...patch };
    const formula = buildFormulaFromBuilder(next);
    onConfigChange({
      ...config,
      builder: next,
      formula,
      result_type: next.operation === 'add_days' ? 'date' : 'number',
    });
  };

  const setOperation = (op: DateCalcOperation) => {
    commitBuilder({
      operation: op,
      // clear irrelevant slots when switching op
      field_b: op === 'days_between' ? builder.field_b : null,
      delta: op === 'add_days' ? (builder.delta ?? 0) : null,
    });
  };

  const setCustomFormula = (formula: string) => {
    // Custom mode drops the builder entirely so we don't round-trip stale UI state.
    const next: Record<string, unknown> = { ...config, formula };
    delete next.builder;
    if (!next.result_type) next.result_type = 'number';
    onConfigChange(next);
  };

  const setResultType = (rt: string) => {
    onConfigChange({ ...config, result_type: rt });
  };

  const renderPicker = (val: string | null, onChange: (v: string) => void, placeholder = 'Pick a date field') => {
    if (dateOptions.length === 0) {
      // Fallback: raw text so the editor still works without model context.
      return (
        <input
          type="text"
          value={val ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="field name"
          className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
        />
      );
    }
    return (
      <select
        value={val ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
      >
        <option value="">{placeholder}</option>
        {dateOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="inline-flex rounded-md border border-border-color bg-bg-primary p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setMode('date_calc')}
          className={`rounded px-2.5 py-1 ${mode === 'date_calc' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Date calculation
        </button>
        <button
          type="button"
          onClick={() => setMode('custom')}
          className={`rounded px-2.5 py-1 ${mode === 'custom' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Custom formula
        </button>
      </div>

      {mode === 'date_calc' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary">Operation</label>
            <select
              value={builder.operation}
              onChange={(e) => setOperation(e.target.value as DateCalcOperation)}
              className="mt-1 w-full rounded border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
            >
              <option value="days_since">Days since a date</option>
              <option value="days_until">Days until a date</option>
              <option value="days_between">Days between two dates</option>
              <option value="add_days">A date offset by N days</option>
            </select>
          </div>

          {(builder.operation === 'days_since' || builder.operation === 'days_until') && (
            <div>
              <label className="block text-sm font-medium text-text-secondary">Date field</label>
              <div className="mt-1">
                {renderPicker(builder.field_a, (v) => commitBuilder({ field_a: v || null }))}
              </div>
            </div>
          )}

          {builder.operation === 'days_between' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary">From</label>
                <div className="mt-1">
                  {renderPicker(builder.field_a, (v) => commitBuilder({ field_a: v || null }))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">To</label>
                <div className="mt-1">
                  {renderPicker(builder.field_b, (v) => commitBuilder({ field_b: v || null }))}
                </div>
              </div>
            </div>
          )}

          {builder.operation === 'add_days' && (
            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <label className="block text-sm font-medium text-text-secondary">Date field</label>
                <div className="mt-1">
                  {renderPicker(builder.field_a, (v) => commitBuilder({ field_a: v || null }))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  {(builder.delta ?? 0) < 0 ? 'Minus N days' : 'Plus N days'}
                </label>
                <input
                  type="number"
                  value={builder.delta ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const n = raw === '' || raw === '-' ? 0 : Number(raw);
                    commitBuilder({ delta: Number.isFinite(n) ? n : 0 });
                  }}
                  placeholder="e.g. 14 or -30"
                  className="mt-1 w-full rounded border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                />
              </div>
            </div>
          )}

          <div className="rounded bg-bg-secondary p-2.5 text-xs">
            <div className="text-text-secondary">Preview</div>
            <div className="mt-1 font-mono text-text-primary">
              {buildFormulaFromBuilder(builder) || <span className="text-text-secondary">Pick a field to see the formula</span>}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary">Formula</label>
            <textarea
              value={(config.formula as string) ?? ''}
              onChange={(e) => setCustomFormula(e.target.value)}
              placeholder="fields.price * fields.quantity"
              rows={3}
              className="mt-1 w-full rounded border border-border-color bg-bg-primary px-3 py-2 font-mono text-sm text-text-primary focus:border-accent focus:outline-none"
            />
            <p className="mt-1 text-xs text-text-secondary">
              Use <code className="rounded bg-bg-secondary px-1">fields.field_name</code> to reference other fields.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Result type</label>
            <select
              value={(config.result_type as string) ?? 'number'}
              onChange={(e) => setResultType(e.target.value)}
              className="mt-1 w-full rounded border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
            >
              <option value="number">Number</option>
              <option value="text">Text</option>
              <option value="date">Date</option>
            </select>
          </div>
          <div className="rounded bg-bg-secondary p-3 text-xs text-text-secondary">
            <p className="font-medium text-text-primary">Available functions:</p>
            <p className="mt-1">ROUND, ABS, MIN, MAX, IF, CONCAT, SUM, UPPER, LOWER, COALESCE</p>
            <p className="mt-1">TODAY(), DAYS_SINCE(x), DAYS_UNTIL(x), DAYS_BETWEEN(a, b), ADD_DAYS(x, n)</p>
            <p className="mt-2 font-medium text-text-primary">Examples:</p>
            <p className="mt-1 font-mono">fields.price * fields.quantity</p>
            <p className="font-mono">DAYS_UNTIL(fields.due_date)</p>
            <p className="font-mono">ADD_DAYS(fields.start_date, 30)</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Lets user pick which field of the target model to display in the relation dropdown */
function DisplayFieldPicker({ modelId, selectedField, onChange }: { modelId: number; selectedField: string; onChange: (f: string) => void }) {
  const [fields, setFields] = useState<Array<{ name: string; display_name: string; field_type: string }>>([]);

  useEffect(() => {
    listFields(modelId)
      .then((f) => setFields(f.filter((ff) => ['text', 'long_text', 'number', 'email', 'phone', 'enum', 'currency'].includes(ff.field_type))))
      .catch(() => {});
  }, [modelId]);

  if (!fields.length) return null;

  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary">Display field in dropdown</label>
      <p className="mb-1 text-xs text-text-secondary/70">Which field to show as the label when selecting a related record</p>
      <select
        value={selectedField}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary"
      >
        <option value="">Auto (name, title, or record key)</option>
        {fields.map((f) => (
          <option key={f.name} value={f.name}>{f.display_name}</option>
        ))}
      </select>
    </div>
  );
}
