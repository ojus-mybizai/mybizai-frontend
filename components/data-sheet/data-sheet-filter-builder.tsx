'use client';

import { useState, useEffect } from 'react';
import type { DynamicField } from '@/services/dynamic-data';

export interface QueryFilter {
  field: string;
  op: string;
  value?: unknown;
}

const ALL_OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'ne', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'in list' },
  { value: 'is_null', label: 'is empty' },
  { value: 'is_not_null', label: 'is not empty' },
];

function operatorsForFieldType(fieldType: string): typeof ALL_OPERATORS {
  switch (fieldType) {
    case 'text':
    case 'long_text':
      return ALL_OPERATORS.filter((o) => ['eq', 'ne', 'contains', 'is_null', 'is_not_null'].includes(o.value));
    case 'number':
    case 'currency':
      return ALL_OPERATORS.filter((o) => ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'is_null', 'is_not_null'].includes(o.value));
    case 'boolean':
      return ALL_OPERATORS.filter((o) => ['eq', 'ne', 'is_null', 'is_not_null'].includes(o.value));
    case 'date':
      return ALL_OPERATORS.filter((o) => ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'is_null', 'is_not_null'].includes(o.value));
    case 'enum':
      return ALL_OPERATORS.filter((o) => ['eq', 'ne', 'in', 'is_null', 'is_not_null'].includes(o.value));
    case 'relation':
    case 'image':
    case 'file':
      return ALL_OPERATORS.filter((o) => ['eq', 'ne', 'is_null', 'is_not_null'].includes(o.value));
    default:
      return ALL_OPERATORS;
  }
}

function FilterValueInput({
  field,
  value,
  onChange,
}: {
  field: DynamicField | undefined;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const inputClass = 'flex-1 rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary min-w-0';
  if (!field) {
    return (
      <input
        type="text"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Value"
        className={inputClass}
      />
    );
  }
  if (field.field_type === 'number' || field.field_type === 'currency') {
    const num = typeof value === 'number' ? value : value === '' || value === undefined ? '' : Number(value);
    return (
      <input
        type="number"
        value={num}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? undefined : Number(v));
        }}
        placeholder="Value"
        className={inputClass}
      />
    );
  }
  if (field.field_type === 'boolean') {
    const str = value === true ? 'true' : value === false ? 'false' : '';
    return (
      <select value={str} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'true')} className={inputClass}>
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (field.field_type === 'date') {
    const str = typeof value === 'string' && value ? value : '';
    return (
      <input
        type="date"
        value={str}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={inputClass}
      />
    );
  }
  if (field.field_type === 'enum') {
    const options = (field.config?.options as string[]) ?? [];
    const str = typeof value === 'string' ? value : '';
    return (
      <select value={str} onChange={(e) => onChange(e.target.value || undefined)} className={inputClass}>
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value"
      className={inputClass}
    />
  );
}

interface DataSheetFilterBuilderProps {
  fields: DynamicField[];
  filters: QueryFilter[];
  onChange: (filters: QueryFilter[]) => void;
  onApply: () => void;
  open: boolean;
  onClose: () => void;
}

export function DataSheetFilterBuilder({
  fields,
  filters,
  onChange,
  onApply,
  open,
  onClose,
}: DataSheetFilterBuilderProps) {
  const [localFilters, setLocalFilters] = useState<QueryFilter[]>(filters);

  useEffect(() => {
    if (open) setLocalFilters(filters);
  }, [open, filters]);

  const addRule = () => {
    const firstField = fields[0];
    if (!firstField) return;
    setLocalFilters([...localFilters, { field: firstField.name, op: 'eq', value: '' }]);
  };

  const filtersToApply = localFilters
    .filter((r) => r.field && r.op)
    .map((r) => {
      const selectedField = fields.find((f) => f.name === r.field);
      const operators = selectedField ? operatorsForFieldType(selectedField.field_type) : ALL_OPERATORS;
      const validOp = operators.some((o) => o.value === r.op) ? r.op : operators[0]?.value ?? 'eq';
      const base = { ...r, op: validOp };
      if (base.op === 'is_null') return { ...base, value: true };
      if (base.op === 'is_not_null') return { ...base, value: false };
      return base;
    });

  const updateRule = (index: number, updates: Partial<QueryFilter>) => {
    setLocalFilters(localFilters.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  const removeRule = (index: number) => {
    setLocalFilters(localFilters.filter((_, i) => i !== index));
  };

  const handleApply = () => {
    onChange(filtersToApply);
    onApply();
    onClose();
  };

  const handleClear = () => {
    setLocalFilters([]);
    onChange([]);
    onApply();
    onClose();
  };

  if (!open) return null;

  const ruleCount = localFilters.length;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border-color bg-card-bg p-6 shadow-lg space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">
            Filters {ruleCount > 0 ? `(${ruleCount} ${ruleCount === 1 ? 'rule' : 'rules'})` : ''}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {localFilters.length === 0 ? (
            <p className="text-sm text-text-secondary">No filters. Add a rule to filter results.</p>
          ) : (
            localFilters.map((rule, i) => {
              const selectedField = fields.find((f) => f.name === rule.field);
              const operators = selectedField ? operatorsForFieldType(selectedField.field_type) : ALL_OPERATORS;
              const currentOp = operators.some((o) => o.value === rule.op) ? rule.op : operators[0]?.value ?? 'eq';
              return (
                <div key={i} className="flex gap-2 items-start">
                  <select
                    value={rule.field}
                    onChange={(e) => {
                      const newFieldName = e.target.value;
                      const newField = fields.find((f) => f.name === newFieldName);
                      const ops = newField ? operatorsForFieldType(newField.field_type) : ALL_OPERATORS;
                      updateRule(i, { field: newFieldName, op: ops[0]?.value ?? 'eq' });
                    }}
                    className="flex-1 rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
                  >
                    {fields.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.display_name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={currentOp}
                    onChange={(e) => updateRule(i, { op: e.target.value })}
                    className="w-32 rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
                  >
                    {operators.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {rule.op !== 'is_null' && rule.op !== 'is_not_null' && (
                    <FilterValueInput
                      field={selectedField}
                      value={rule.value}
                      onChange={(v) => updateRule(i, { value: v })}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeRule(i)}
                    className="rounded p-1 text-text-secondary hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    aria-label="Remove rule"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addRule}
            className="rounded-lg border border-border-color bg-bg-secondary px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-accent-soft"
          >
            Add rule
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-border-color px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-secondary"
          >
            Clear all
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleApply}
            className="rounded-lg border border-border-color bg-bg-secondary px-4 py-1.5 text-sm font-medium text-text-primary hover:bg-accent-soft"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
