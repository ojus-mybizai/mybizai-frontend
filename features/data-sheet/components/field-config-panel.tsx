'use client';

import { useEffect, useState } from 'react';
import { listModels } from '@/features/data-sheet/api';
import type { DynamicModel } from '@/services/dynamic-data';
const RELATION_KINDS = [
  { value: 'many_to_one', label: 'Many to one' },
  { value: 'one_to_many', label: 'One to many' },
  { value: 'many_to_many', label: 'Many to many' },
] as const;

const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];

const BUILTIN_RELATION_OPTIONS = [
  { value: '__builtin_leads', label: 'Leads' },
  { value: '__builtin_contacts', label: 'Contacts' },
  { value: '__builtin_orders', label: 'Orders' },
  { value: '__builtin_appointments', label: 'Appointments' },
  { value: '__builtin_catalog', label: 'Catalog Items' },
  { value: '__builtin_work', label: 'Work Items' },
  { value: '__builtin_followups', label: 'Follow-ups' },
  { value: '__builtin_conversations', label: 'Conversations' },
] as const;

export interface FieldConfigPanelProps {
  fieldType: string;
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
  relationModelId: number | null;
  onRelationModelIdChange: (id: number | null) => void;
  relationKind: 'many_to_one' | 'one_to_many' | 'many_to_many' | null;
  onRelationKindChange: (kind: 'many_to_one' | 'one_to_many' | 'many_to_many' | null) => void;
  relationReadOnly?: boolean;
  defaultValue?: unknown;
  onDefaultValueChange?: (value: unknown) => void;
  /** When adding a relation field, exclude this model ID (e.g. current model) from the list */
  excludeModelId?: number | null;
}

export function FieldConfigPanel({
  fieldType,
  config,
  onConfigChange,
  relationModelId,
  onRelationModelIdChange,
  relationKind,
  onRelationKindChange,
  relationReadOnly = false,
  defaultValue,
  onDefaultValueChange,
  excludeModelId,
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
              {relationModelId != null
                ? (filteredModels.find((m) => m.id === relationModelId)?.display_name ?? `Model #${relationModelId}`)
                : '—'}
            </p>
          ) : (
            <select
              value={relationModelId ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  onRelationModelIdChange(null);
                  return;
                }
                if (v.startsWith('__builtin_')) return;
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
                    disabled
                    title="Support for built-in model relations coming soon"
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
          <label className="block text-sm font-medium text-text-secondary">Relation type</label>
          {relationReadOnly ? (
            <p className="mt-1 text-sm text-text-primary">
              {relationKind ? RELATION_KINDS.find((k) => k.value === relationKind)?.label ?? relationKind : '—'}
            </p>
          ) : (
            <select
              value={relationKind ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                onRelationKindChange(v ? (v as typeof relationKind) : null);
              }}
              className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary"
            >
              <option value="">— Select —</option>
              {RELATION_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          )}
        </div>
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

  if ((fieldType === 'image' || fieldType === 'file') && Object.keys(config).length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        Optional: max size and allowed types can be configured later in field settings.
      </p>
    );
  }

  return null;
}
