'use client';

import { useState, useEffect, useRef } from 'react';
import type { DynamicField, ReverseRelationMeta } from '@/services/dynamic-data';
import { RelationRecordPicker } from './relation-record-picker';
import { DateField } from '@/components/ui/date-field';

export interface QueryFilter {
  field: string;
  op: string;
  value?: unknown;
}

/* ── Operator definitions per field type ─────────────────────────────────── */

interface OpDef { value: string; label: string; needsValue: boolean }

const TEXT_OPS: OpDef[] = [
  { value: 'eq', label: 'is', needsValue: true },
  { value: 'ne', label: 'is not', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'is_null', label: 'is empty', needsValue: false },
  { value: 'is_not_null', label: 'is not empty', needsValue: false },
];

const NUMBER_OPS: OpDef[] = [
  { value: 'eq', label: 'equals', needsValue: true },
  { value: 'ne', label: 'not equals', needsValue: true },
  { value: 'gt', label: 'greater than', needsValue: true },
  { value: 'gte', label: 'at least', needsValue: true },
  { value: 'lt', label: 'less than', needsValue: true },
  { value: 'lte', label: 'at most', needsValue: true },
  { value: 'is_null', label: 'is empty', needsValue: false },
  { value: 'is_not_null', label: 'has value', needsValue: false },
];

const DATE_OPS: OpDef[] = [
  { value: 'eq', label: 'is', needsValue: true },
  { value: 'gt', label: 'after', needsValue: true },
  { value: 'lt', label: 'before', needsValue: true },
  { value: 'gte', label: 'on or after', needsValue: true },
  { value: 'lte', label: 'on or before', needsValue: true },
  { value: 'is_null', label: 'is empty', needsValue: false },
  { value: 'is_not_null', label: 'has date', needsValue: false },
];

const ENUM_OPS: OpDef[] = [
  { value: 'eq', label: 'is', needsValue: true },
  { value: 'ne', label: 'is not', needsValue: true },
  { value: 'in', label: 'is any of', needsValue: true },
  { value: 'is_null', label: 'is empty', needsValue: false },
  { value: 'is_not_null', label: 'has value', needsValue: false },
];

const BOOL_OPS: OpDef[] = [
  { value: 'eq', label: 'is', needsValue: true },
  { value: 'is_null', label: 'is empty', needsValue: false },
];

const RELATION_OPS: OpDef[] = [
  { value: 'eq', label: 'is', needsValue: true },
  { value: 'ne', label: 'is not', needsValue: true },
  { value: 'is_null', label: 'not linked', needsValue: false },
  { value: 'is_not_null', label: 'is linked', needsValue: false },
];

function opsForField(field: DynamicField): OpDef[] {
  switch (field.field_type) {
    case 'string': case 'phone': case 'email': case 'long_text': return TEXT_OPS;
    case 'integer': case 'float': case 'currency': case 'number': return NUMBER_OPS;
    case 'date': case 'datetime': return DATE_OPS;
    case 'enum': return ENUM_OPS;
    case 'boolean': return BOOL_OPS;
    case 'relation': return RELATION_OPS;
    default: return TEXT_OPS;
  }
}

/* ── Field type icons ────────────────────────────────────────────────────── */

function FieldIcon({ type }: { type: string }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  switch (type) {
    case 'string': case 'phone': case 'email': case 'long_text':
      return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>;
    case 'integer': case 'float': case 'currency': case 'number':
      return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>;
    case 'date': case 'datetime':
      return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>;
    case 'enum':
      return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>;
    case 'boolean':
      return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case 'relation':
      return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>;
    default:
      return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>;
  }
}

/* ── Value input component ───────────────────────────────────────────────── */

function FilterValueInput({ field, op, value, onChange }: { field: DynamicField; op: string; value: unknown; onChange: (v: unknown) => void }) {
  const base = 'w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30';

  if (field.field_type === 'relation') {
    return <RelationRecordPicker field={field} value={value} onChange={(v) => onChange(v)} />;
  }
  if (field.field_type === 'integer' || field.field_type === 'float' || field.field_type === 'currency' || field.field_type === 'number') {
    return <input type="number" value={value === undefined || value === '' ? '' : Number(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} placeholder="Enter number..." className={base} />;
  }
  if (field.field_type === 'boolean') {
    return (
      <div className="flex gap-2">
        {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(({ v, l }) => (
          <button key={l} type="button" onClick={() => onChange(v)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${value === v ? 'border-accent bg-accent/10 text-accent' : 'border-border-color bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}>
            {l}
          </button>
        ))}
      </div>
    );
  }
  if (field.field_type === 'date' || field.field_type === 'datetime') {
    return <DateField value={typeof value === 'string' ? value : ''} onChange={(iso) => onChange(iso || undefined)} className={base} />;
  }
  if (field.field_type === 'enum') {
    const options = (field.config?.options as string[]) ?? [];
    const isMulti = op === 'in';
    const selectedVals: string[] = isMulti ? (Array.isArray(value) ? (value as string[]) : []) : [];
    const toggleMulti = (opt: string) => {
      const next = selectedVals.includes(opt) ? selectedVals.filter((v) => v !== opt) : [...selectedVals, opt];
      onChange(next);
    };
    return (
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        {options.map((opt) => {
          const selected = isMulti ? selectedVals.includes(opt) : value === opt;
          return (
            <button key={opt} type="button" onClick={() => (isMulti ? toggleMulti(opt) : onChange(opt))}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${selected ? 'border-accent bg-accent/10 text-accent' : 'border-border-color bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}>
              {opt}
            </button>
          );
        })}
      </div>
    );
  }
  return <input type="text" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder="Enter value..." className={base} />;
}

/* ── Quick filter chips (most common filters) ────────────────────────────── */

function QuickFilters({ fields, onAdd }: { fields: DynamicField[]; onAdd: (f: QueryFilter) => void }) {
  // Show quick chips for enum and boolean fields
  const quickFields = fields.filter((f) => f.field_type === 'enum' || f.field_type === 'boolean').slice(0, 4);
  if (quickFields.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Quick filters</p>
      <div className="flex flex-wrap gap-1.5">
        {quickFields.map((f) => {
          if (f.field_type === 'enum') {
            const options = (f.config?.options as string[]) ?? [];
            return options.slice(0, 3).map((opt) => (
              <button key={`${f.name}-${opt}`} type="button"
                onClick={() => onAdd({ field: f.name, op: 'eq', value: opt })}
                className="rounded-full border border-border-color bg-bg-secondary/50 px-3 py-1 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent transition-colors">
                {f.display_name}: {opt}
              </button>
            ));
          }
          if (f.field_type === 'boolean') {
            return (
              <button key={f.name} type="button"
                onClick={() => onAdd({ field: f.name, op: 'eq', value: true })}
                className="rounded-full border border-border-color bg-bg-secondary/50 px-3 py-1 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent transition-colors">
                {f.display_name}: Yes
              </button>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

/* ── Filter row component ────────────────────────────────────────────────── */

function FilterRow({
  rule, fields, onUpdate, onRemove, index,
}: {
  rule: QueryFilter; fields: DynamicField[]; onUpdate: (u: Partial<QueryFilter>) => void; onRemove: () => void; index: number;
}) {
  const field = fields.find((f) => f.name === rule.field);
  const ops = field ? opsForField(field) : TEXT_OPS;
  const currentOp = ops.find((o) => o.value === rule.op) || ops[0];
  const needsValue = currentOp?.needsValue !== false;

  return (
    <div className="group rounded-xl border border-border-color bg-bg-primary/50 p-3 space-y-2.5 hover:border-border-color/80 transition-colors">
      {/* Row header: field + delete */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-text-muted bg-bg-secondary rounded-full w-5 h-5 flex items-center justify-center shrink-0">{index + 1}</span>

        {/* Field selector - styled as a button-like dropdown */}
        <div className="flex-1 relative">
          <select
            value={rule.field}
            onChange={(e) => {
              const nf = fields.find((f) => f.name === e.target.value);
              const nOps = nf ? opsForField(nf) : TEXT_OPS;
              onUpdate({ field: e.target.value, op: nOps[0].value, value: undefined });
            }}
            className="w-full appearance-none rounded-lg border border-border-color bg-bg-primary pl-8 pr-8 py-2 text-sm font-medium text-text-primary focus:border-accent focus:outline-none cursor-pointer"
          >
            {fields.map((f) => (
              <option key={f.id} value={f.name}>{f.display_name}</option>
            ))}
          </select>
          {field && (
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
              <FieldIcon type={field.field_type} />
            </div>
          )}
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
        </div>

        {/* Remove button */}
        <button type="button" onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-text-muted hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-all"
          aria-label="Remove filter">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
        </button>
      </div>

      {/* Operator chips */}
      <div className="flex flex-wrap gap-1.5">
        {ops.map((o) => (
          <button key={o.value} type="button"
            onClick={() => {
              // 'in' carries an array value; scalar ops carry a single value — reset on transition
              const crossesArrayBoundary = (o.value === 'in') !== (rule.op === 'in');
              const nextValue = !o.needsValue || crossesArrayBoundary ? undefined : rule.value;
              onUpdate({ op: o.value, value: nextValue });
            }}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
              rule.op === o.value
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border-color bg-bg-secondary/50 text-text-secondary hover:border-accent/40 hover:text-text-primary'
            }`}>
            {o.label}
          </button>
        ))}
      </div>

      {/* Value input */}
      {needsValue && field && (
        <FilterValueInput field={field} op={rule.op} value={rule.value} onChange={(v) => onUpdate({ value: v })} />
      )}
    </div>
  );
}

/* ── Main filter builder ─────────────────────────────────────────────────── */

interface DataSheetFilterBuilderProps {
  fields: DynamicField[];
  filters: QueryFilter[];
  onChange: (filters: QueryFilter[]) => void;
  onApply: () => void;
  open: boolean;
  onClose: () => void;
  /** Reverse relations for "Has related X" filters */
  reverseRelations?: ReverseRelationMeta[];
}

export function DataSheetFilterBuilder({ fields, filters, onChange, onApply, open, onClose, reverseRelations = [] }: DataSheetFilterBuilderProps) {
  const [localFilters, setLocalFilters] = useState<QueryFilter[]>(filters);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setLocalFilters(filters);
  }, [open, filters]);

  const addRule = (preset?: QueryFilter) => {
    const firstField = fields[0];
    if (!firstField) return;
    const newRule = preset || { field: firstField.name, op: opsForField(firstField)[0].value, value: undefined };
    setLocalFilters([...localFilters, newRule]);
    // Scroll to bottom after adding
    setTimeout(() => containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' }), 100);
  };

  const updateRule = (index: number, updates: Partial<QueryFilter>) => {
    setLocalFilters(localFilters.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  const removeRule = (index: number) => {
    setLocalFilters(localFilters.filter((_, i) => i !== index));
  };

  const handleApply = () => {
    const clean = localFilters.filter((r) => r.field && r.op).map((r) => {
      if (r.op === 'is_null') return { ...r, value: true };
      if (r.op === 'is_not_null') return { ...r, value: false };
      return r;
    });
    onChange(clean);
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

  const hasRules = localFilters.length > 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border-color bg-card-bg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <svg className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Filter records</h3>
              <p className="text-xs text-text-muted">
                {hasRules ? `${localFilters.length} ${localFilters.length === 1 ? 'filter' : 'filters'} active` : 'Show records matching your criteria'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div ref={containerRef} className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Quick filters */}
          {!hasRules && <QuickFilters fields={fields} onAdd={addRule} />}

          {/* Reverse-relation quick filters */}
          {reverseRelations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Related records</p>
              <div className="flex flex-wrap gap-1.5">
                {reverseRelations.map((rel) => (
                  <button
                    key={`rev-${rel.source_model_id}-${rel.field_id}`}
                    type="button"
                    onClick={() =>
                      addRule({
                        field: '__reverse_relation',
                        op: 'has_related',
                        value: { source_model_id: rel.source_model_id },
                      })
                    }
                    className="rounded-full border border-border-color bg-bg-secondary/50 px-3 py-1 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent transition-colors"
                  >
                    Has {rel.source_model_display_name}
                  </button>
                ))}
                {reverseRelations.map((rel) => (
                  <button
                    key={`norev-${rel.source_model_id}-${rel.field_id}`}
                    type="button"
                    onClick={() =>
                      addRule({
                        field: '__reverse_relation',
                        op: 'has_no_related',
                        value: { source_model_id: rel.source_model_id },
                      })
                    }
                    className="rounded-full border border-border-color bg-bg-secondary/50 px-3 py-1 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent transition-colors"
                  >
                    No {rel.source_model_display_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter rules */}
          {hasRules && (
            <div className="space-y-3">
              {localFilters.map((rule, i) => (
                <FilterRow
                  key={i}
                  rule={rule}
                  fields={fields}
                  onUpdate={(u) => updateRule(i, u)}
                  onRemove={() => removeRule(i)}
                  index={i}
                />
              ))}
            </div>
          )}

          {/* Add filter button */}
          <button type="button" onClick={() => addRule()}
            className="w-full rounded-xl border-2 border-dashed border-border-color py-3 text-sm font-medium text-text-secondary hover:border-accent/40 hover:text-accent transition-colors flex items-center justify-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Add filter
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border-color bg-bg-secondary/30">
          <button type="button" onClick={handleClear}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${hasRules ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30' : 'text-text-muted cursor-not-allowed'}`}
            disabled={!hasRules}>
            Clear all
          </button>
          <button type="button" onClick={handleApply}
            className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity">
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );
}
