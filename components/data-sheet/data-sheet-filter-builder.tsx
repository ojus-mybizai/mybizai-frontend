'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { DynamicField, ReverseRelationMeta } from '@/services/dynamic-data';
import {
  ConditionBuilder,
  DATASHEET_OPERATORS,
  type Condition,
} from '@/components/automation/condition-builder';
import {
  fieldDefsFromDatasheetSchema,
  canonicalToDatasheetFilter,
  datasheetFilterToCanonical,
} from '@/components/automation/condition-builder-adapters';

export interface QueryFilter {
  field: string;
  op: string;
  value?: unknown;
}

/** Reverse-relation pseudo-filters live outside the field-condition builder. */
const REVERSE_FIELD = '__reverse_relation';
const isReverse = (f: QueryFilter) => f.field === REVERSE_FIELD;

/* ── Quick filter chips (most common filters) ────────────────────────────── */

function QuickFilters({ fields, onAdd }: { fields: DynamicField[]; onAdd: (f: QueryFilter) => void }) {
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

  useEffect(() => {
    if (open) setLocalFilters(filters);
  }, [open, filters]);

  // Split field-conditions (edited via the shared builder) from reverse-relation
  // pseudo-filters (kept as removable chips).
  const reverseFilters = localFilters.filter(isReverse);
  const fieldConditions: Condition[] = localFilters
    .filter((f) => !isReverse(f))
    .map((f) => datasheetFilterToCanonical(f as { field: string; op: string; value: any }));

  const fieldDefs = fieldDefsFromDatasheetSchema(fields);

  const setFieldConditions = (next: Condition[]) => {
    const asFilters = next
      .filter((c) => c.field)
      .map((c) => canonicalToDatasheetFilter(c) as QueryFilter);
    setLocalFilters([...reverseFilters, ...asFilters]);
  };

  const addQuick = (preset: QueryFilter) => setLocalFilters([...localFilters, preset]);
  const removeReverse = (idx: number) =>
    setLocalFilters(localFilters.filter((f, i) => !(isReverse(f) && reverseFilters.indexOf(f) === idx)));

  const handleApply = () => {
    // Empty operators already carry their boolean value via canonicalToDatasheetFilter.
    onChange(localFilters.filter((r) => r.field && r.op));
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
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Quick filters */}
          {!hasRules && <QuickFilters fields={fields} onAdd={addQuick} />}

          {/* Reverse-relation quick filters */}
          {reverseRelations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Related records</p>
              <div className="flex flex-wrap gap-1.5">
                {reverseRelations.map((rel) => (
                  <button
                    key={`rev-${rel.source_model_id}-${rel.field_id}`}
                    type="button"
                    onClick={() => addQuick({ field: REVERSE_FIELD, op: 'has_related', value: { source_model_id: rel.source_model_id } })}
                    className="rounded-full border border-border-color bg-bg-secondary/50 px-3 py-1 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent transition-colors"
                  >
                    Has {rel.source_model_display_name}
                  </button>
                ))}
                {reverseRelations.map((rel) => (
                  <button
                    key={`norev-${rel.source_model_id}-${rel.field_id}`}
                    type="button"
                    onClick={() => addQuick({ field: REVERSE_FIELD, op: 'has_no_related', value: { source_model_id: rel.source_model_id } })}
                    className="rounded-full border border-border-color bg-bg-secondary/50 px-3 py-1 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent transition-colors"
                  >
                    No {rel.source_model_display_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active reverse-relation filters (removable) */}
          {reverseFilters.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {reverseFilters.map((rf, i) => {
                const srcId = (rf.value as { source_model_id?: number } | undefined)?.source_model_id;
                const rel = reverseRelations.find((r) => r.source_model_id === srcId);
                const label = rel?.source_model_display_name ?? `#${srcId}`;
                return (
                  <span key={`active-rev-${i}`}
                    className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent ring-1 ring-inset ring-accent/20">
                    {rf.op === 'has_related' ? `Has ${label}` : `No ${label}`}
                    <button type="button" onClick={() => removeReverse(i)} className="hover:text-red-400">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Field conditions — the shared builder */}
          <ConditionBuilder
            fields={fieldDefs}
            value={fieldConditions}
            onChange={setFieldConditions}
            operators={DATASHEET_OPERATORS}
            addLabel="Add filter"
            emptyHint="This datasheet has no fields to filter on yet."
          />
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
