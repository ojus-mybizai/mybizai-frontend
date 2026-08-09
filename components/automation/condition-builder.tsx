'use client';

/**
 * ConditionBuilder — the ONE shared field / operator / value builder.
 *
 * Replaces the ECA rule editor's FieldSelect + ValueInput and the datasheet
 * filter builder's FilterRow. Both call sites feed it `FieldDef[]` (via the
 * adapters in condition-builder-adapters.ts) and consume `Condition[]` in the
 * canonical ECA operator vocab (`eq`/`neq`/`is_empty`/…). Datasheet-specific
 * op names (`ne`/`is_null`) are translated at that call site's save boundary.
 *
 * Value rendering delegates to the existing datasheet renderers — DateField for
 * dates and RelationRecordPicker for relations — so there is one place that
 * knows how each field type is edited. See AUTOMATION_REDESIGN_SPEC §5.3.
 */

import type { ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { DateField } from '@/components/ui/date-field';
import { RelationRecordPicker } from '@/components/data-sheet/relation-record-picker';
import type { DynamicField } from '@/services/dynamic-data';

export type FieldValueType = 'text' | 'number' | 'date' | 'enum' | 'boolean' | 'relation';

export interface FieldDef {
  /** Canonical field path (ECA: "contact.priority") or column name (datasheet: "renewal"). */
  value: string;
  label: string;
  valueType: FieldValueType;
  /** Enum options, when valueType === 'enum'. */
  options?: string[];
  /** For relation value pickers. */
  relationBuiltin?: string | null;
  /** Optgroup label (ECA groups by context root; datasheet leaves undefined). */
  group?: string;
  /** Raw datasheet field — lets the value input delegate to RelationRecordPicker. */
  raw?: DynamicField;
}

export interface OperatorDef {
  value: string;
  label: string;
  /** Field value_types this operator applies to. Empty/undefined = all. */
  applies_to?: string[];
}

export interface Condition {
  field: string;
  op: string;
  // Canonical value: string for scalars, string[] for list ops, number for
  // relations. `any` keeps the component reusable across both call sites.
  value: any;
}

/* ─── Canonical operator vocab (mirrors backend catalog.OPERATORS) ─────────── */

export const CANONICAL_OPERATORS: OperatorDef[] = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'contains', label: 'contains', applies_to: ['text'] },
  { value: 'contains_any', label: 'contains any of' },
  { value: 'in', label: 'is one of' },
  { value: 'not_in', label: 'is not one of' },
  { value: 'gt', label: 'greater than', applies_to: ['number'] },
  { value: 'gte', label: 'greater than or equal', applies_to: ['number'] },
  { value: 'lt', label: 'less than', applies_to: ['number'] },
  { value: 'lte', label: 'less than or equal', applies_to: ['number'] },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'days_since_gt', label: 'days since is more than', applies_to: ['date'] },
  { value: 'days_since_lt', label: 'days since is less than', applies_to: ['date'] },
  { value: 'days_until_gt', label: 'days until is more than', applies_to: ['date'] },
  { value: 'days_until_lt', label: 'days until is less than', applies_to: ['date'] },
];

/**
 * Datasheet-scoped canonical operators. Same vocab, but comparisons apply to
 * dates too (after/before), and the day-delta operators are dropped — the
 * datasheet /query path compares raw values, not day offsets.
 */
export const DATASHEET_OPERATORS: OperatorDef[] = [
  { value: 'eq', label: 'is' },
  { value: 'neq', label: 'is not' },
  { value: 'contains', label: 'contains', applies_to: ['text'] },
  { value: 'in', label: 'is any of', applies_to: ['enum'] },
  { value: 'gt', label: 'greater than / after', applies_to: ['number', 'date'] },
  { value: 'gte', label: 'at least / on or after', applies_to: ['number', 'date'] },
  { value: 'lt', label: 'less than / before', applies_to: ['number', 'date'] },
  { value: 'lte', label: 'at most / on or before', applies_to: ['number', 'date'] },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

/* ─── Operator classification (drives value-input choice) ──────────────────── */

const NO_VALUE_OPS = new Set(['is_empty', 'is_not_empty']);
const LIST_OPS = new Set(['in', 'not_in', 'contains_any']);
const DAY_DELTA_OPS = new Set(['days_since_gt', 'days_since_lt', 'days_until_gt', 'days_until_lt']);

export function operatorNeedsNoValue(op: string): boolean {
  return NO_VALUE_OPS.has(op);
}

function operatorsForField(field: FieldDef | undefined, operators: OperatorDef[]): OperatorDef[] {
  if (!field) return operators;
  return operators.filter((o) => !o.applies_to?.length || o.applies_to.includes(field.valueType));
}

/* ─── Styling primitives (self-contained so both call sites match) ─────────── */

const INPUT_CLASS =
  'w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30';

function BareSelect({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT_CLASS} appearance-none cursor-pointer`}>
      {children}
    </select>
  );
}

/* ─── Value input — one place that knows how each field type is edited ─────── */

function ValueEditor({
  field, op, value, onChange,
}: { field: FieldDef; op: string; value: any; onChange: (v: any) => void }) {
  // Day-delta operators take a number of days regardless of field type.
  if (DAY_DELTA_OPS.has(op)) {
    return (
      <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        placeholder="0" className={INPUT_CLASS} />
    );
  }

  // List operators: multi-select chips for enums, comma text (→ array) otherwise.
  if (LIST_OPS.has(op)) {
    if (field.valueType === 'enum' && field.options?.length) {
      const selected: string[] = Array.isArray(value) ? value.map(String) : [];
      const toggle = (opt: string) =>
        onChange(selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt]);
      return (
        <div className="flex flex-wrap gap-1.5">
          {field.options.map((opt) => {
            const on = selected.includes(opt);
            return (
              <button key={opt} type="button" onClick={() => toggle(opt)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  on ? 'border-accent bg-accent/10 text-accent'
                     : 'border-border-color bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}>
                {opt}
              </button>
            );
          })}
        </div>
      );
    }
    const asText = Array.isArray(value) ? value.join(', ') : String(value ?? '');
    return (
      <input type="text" value={asText}
        onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
        placeholder="value1, value2, value3" className={INPUT_CLASS} />
    );
  }

  if (field.valueType === 'relation' && field.raw) {
    return <RelationRecordPicker field={field.raw} value={value} onChange={(v) => onChange(v)} />;
  }

  if (field.valueType === 'date') {
    return <DateField value={typeof value === 'string' ? value : ''} onChange={(iso) => onChange(iso || '')} className={INPUT_CLASS} />;
  }

  if (field.valueType === 'boolean') {
    return (
      <div className="flex gap-2">
        {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(({ v, l }) => (
          <button key={l} type="button" onClick={() => onChange(v)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              value === v ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border-color bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}>
            {l}
          </button>
        ))}
      </div>
    );
  }

  if (field.valueType === 'enum' && field.options?.length) {
    return (
      <BareSelect value={String(value ?? '')} onChange={onChange}>
        <option value="">Select value...</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </BareSelect>
    );
  }

  if (field.valueType === 'number') {
    return (
      <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        placeholder="0" className={INPUT_CLASS} />
    );
  }

  return (
    <input type="text" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}
      placeholder="Value" className={INPUT_CLASS} />
  );
}

/* ─── The builder ──────────────────────────────────────────────────────────── */

export interface ConditionBuilderProps {
  fields: FieldDef[];
  value: Condition[];
  onChange: (next: Condition[]) => void;
  /** Canonical operator set. Defaults to CANONICAL_OPERATORS. */
  operators?: OperatorDef[];
  /** Message + hint when no schema fields are available. */
  emptyHint?: string;
  /** Hide the header/add-button chrome (host renders its own). */
  addLabel?: string;
}

export function ConditionBuilder({
  fields, value, onChange, operators = CANONICAL_OPERATORS, emptyHint, addLabel = 'Add condition',
}: ConditionBuilderProps) {
  const hasFields = fields.length > 0;
  const groups = groupFields(fields);

  const firstOpFor = (fieldValue: string): string => {
    const f = fields.find((x) => x.value === fieldValue);
    return operatorsForField(f, operators)[0]?.value || 'eq';
  };

  const add = () => {
    const first = fields[0];
    const field = first?.value || '';
    onChange([...value, { field, op: field ? firstOpFor(field) : 'eq', value: '' }]);
  };
  const update = (idx: number, patch: Partial<Condition>) =>
    onChange(value.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  if (!hasFields) {
    return (
      <div className="rounded-xl border border-dashed border-border-color p-6 text-center">
        <p className="text-sm text-text-secondary">{emptyHint || 'No fields available for conditions.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {value.map((cond, idx) => {
        const field = fields.find((f) => f.value === cond.field);
        const ops = operatorsForField(field, operators);
        const showValue = !operatorNeedsNoValue(cond.op);
        return (
          <div key={idx} className="rounded-xl border border-border-color bg-bg-primary/50 p-3">
            <div className="flex items-start gap-2">
              <span className="mt-2 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                {idx + 1}
              </span>
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                <BareSelect
                  value={cond.field}
                  onChange={(v) => update(idx, { field: v, op: firstOpFor(v), value: '' })}
                >
                  <option value="">Select field...</option>
                  {groups.map((g) => (
                    g.group
                      ? (
                        <optgroup key={g.group} label={g.group}>
                          {g.fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </optgroup>
                      )
                      : g.fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)
                  ))}
                </BareSelect>

                <BareSelect value={cond.op} onChange={(v) => update(idx, { op: v, value: '' })}>
                  {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </BareSelect>

                {showValue && field ? (
                  <ValueEditor field={field} op={cond.op} value={cond.value}
                    onChange={(v) => update(idx, { value: v })} />
                ) : <div />}
              </div>
              <button type="button" onClick={() => remove(idx)}
                className="mt-1.5 shrink-0 rounded-md p-1.5 text-text-secondary transition-colors hover:bg-red-500/10 hover:text-red-400"
                title="Remove condition">
                <X className="h-4 w-4" />
              </button>
            </div>
            {idx < value.length - 1 && (
              <div className="ml-8 mt-3 flex items-center gap-2">
                <div className="flex-1 border-t border-border-color" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary/60">AND</span>
                <div className="flex-1 border-t border-border-color" />
              </div>
            )}
          </div>
        );
      })}

      <button type="button" onClick={add}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/20 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10">
        <Plus className="h-3 w-3" />
        {addLabel}
      </button>
    </div>
  );
}

function groupFields(fields: FieldDef[]): { group?: string; fields: FieldDef[] }[] {
  const anyGroup = fields.some((f) => f.group);
  if (!anyGroup) return [{ fields }];
  const map = new Map<string, FieldDef[]>();
  for (const f of fields) {
    const key = f.group || '';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  return Array.from(map.entries()).map(([group, fs]) => ({ group: group || undefined, fields: fs }));
}
