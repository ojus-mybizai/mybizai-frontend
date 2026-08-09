/**
 * Adapters that feed the shared <ConditionBuilder> from the two schema sources,
 * plus the op-vocab translation between the canonical builder vocab and the
 * datasheet /query vocab. Two adapters = the seam is real (AUTOMATION_REDESIGN_SPEC §5.3).
 */

import type { AutomationMetadata } from '@/services/automation';
import type { DynamicField } from '@/services/dynamic-data';
import type { FieldDef, FieldValueType } from './condition-builder';

/* ─── (a) ECA metadata → FieldDef[] ────────────────────────────────────────── */

const ROOT_LABELS: Record<string, string> = {
  contact: 'Contact',
  entry: 'Deal / Pipeline',
  record: 'Record',
  call: 'Call',
};

const ECA_VALUE_TYPE: Record<string, FieldValueType> = {
  text: 'text', number: 'number', date: 'date', enum: 'enum',
};

export function fieldDefsFromEcaMetadata(
  triggerEvent: string,
  metadata: AutomationMetadata,
): FieldDef[] {
  const ev = metadata.events.find((e) => e.event === triggerEvent);
  if (!ev || !ev.condition_roots?.length) return [];
  const defs: FieldDef[] = [];
  for (const root of ev.condition_roots) {
    const group = ROOT_LABELS[root] || root;
    for (const f of metadata.condition_fields?.[root] || []) {
      defs.push({
        value: f.value,
        label: f.label,
        valueType: ECA_VALUE_TYPE[f.value_type] || 'text',
        options: f.options,
        group,
      });
    }
  }
  return defs;
}

/* ─── (b) Datasheet schema → FieldDef[] ────────────────────────────────────── */

const DATASHEET_VALUE_TYPE: Record<string, FieldValueType> = {
  string: 'text', phone: 'text', email: 'text', long_text: 'text', text: 'text',
  integer: 'number', float: 'number', currency: 'number', number: 'number',
  date: 'date', datetime: 'date',
  enum: 'enum', select: 'enum', multi_select: 'enum',
  boolean: 'boolean',
  relation: 'relation',
};

export function fieldDefsFromDatasheetSchema(
  fields: DynamicField[],
  opts?: { valuePrefix?: string },
): FieldDef[] {
  // `valuePrefix` is used for ECA record.* conditions, whose field path resolves
  // against context["record"] — so the builder emits "record.<name>". The
  // datasheet /query filter builder omits it (bare column names).
  const prefix = opts?.valuePrefix ?? '';
  return fields.map((f) => ({
    value: `${prefix}${f.name}`,
    label: f.display_name || f.name,
    valueType: DATASHEET_VALUE_TYPE[f.field_type] || 'text',
    options: (f.config?.options as string[]) ?? undefined,
    relationBuiltin: f.relation_builtin_model ?? undefined,
    raw: f,
  }));
}

/* ─── Op-vocab translation: canonical builder ⇄ datasheet /query ───────────── */

const CANON_TO_DATASHEET: Record<string, string> = {
  neq: 'ne',
  is_empty: 'is_null',
  is_not_empty: 'is_not_null',
};
const DATASHEET_TO_CANON: Record<string, string> = {
  ne: 'neq',
  is_null: 'is_empty',
  is_not_null: 'is_not_empty',
};

export interface DatasheetQueryFilter {
  field: string;
  op: string;
  value?: unknown;
}

/**
 * Translate a canonical condition into a datasheet /query filter. The empty
 * operators carry the boolean value the query path expects (is_null → true,
 * is_not_null → false), matching the old builder's apply logic.
 */
export function canonicalToDatasheetFilter(cond: { field: string; op: string; value: any }): DatasheetQueryFilter {
  const op = CANON_TO_DATASHEET[cond.op] || cond.op;
  if (op === 'is_null') return { field: cond.field, op, value: true };
  if (op === 'is_not_null') return { field: cond.field, op, value: false };
  return { field: cond.field, op, value: cond.value };
}

/** Translate a stored datasheet filter back into a canonical condition for editing. */
export function datasheetFilterToCanonical(filter: DatasheetQueryFilter): { field: string; op: string; value: any } {
  const op = DATASHEET_TO_CANON[filter.op] || filter.op;
  // Empty operators need no editable value.
  if (op === 'is_empty' || op === 'is_not_empty') return { field: filter.field, op, value: '' };
  return { field: filter.field, op, value: filter.value ?? '' };
}
