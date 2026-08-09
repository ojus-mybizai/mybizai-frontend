import type {
  RuleCategory,
  EventOption,
  ActionOption,
  FieldOption as MetaFieldOption,
  OperatorOption,
  AutomationMetadata,
} from '@/services/automation';

export interface ConditionDraft {
  field: string;
  op: string;
  // string for scalars; string[] for list ops (in / not_in / contains_any).
  value: string | string[];
}

export interface ActionDraft {
  type: string;
  params: Record<string, string>;
}

export interface RuleFormState {
  name: string;
  description: string;
  category: RuleCategory;
  trigger_event: string;
  trigger_filters: Record<string, string>;
  trigger_schedule_type: string;
  trigger_schedule_time: string;
  trigger_schedule_day: string;
  conditions: ConditionDraft[];
  actions: ActionDraft[];
  is_active: boolean;
}

export const EMPTY_FORM: RuleFormState = {
  name: '',
  description: '',
  category: 'general',
  trigger_event: '',
  trigger_filters: {},
  trigger_schedule_type: '',
  trigger_schedule_time: '',
  trigger_schedule_day: '',
  conditions: [],
  actions: [],
  is_active: true,
};

/**
 * Static operator-label map. Used only as a fallback for humanizing saved
 * rules in list views where live metadata may not be loaded. The rule editor
 * itself drives the operator dropdown from metadata.operators.
 */
export const OP_LABELS: Record<string, string> = {
  eq: 'equals',
  neq: 'not equals',
  contains: 'contains',
  in: 'is one of',
  not_in: 'is not one of',
  gt: 'greater than',
  gte: 'greater than or equal',
  lt: 'less than',
  lte: 'less than or equal',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  days_since_gt: 'days since is more than',
  days_since_lt: 'days since is less than',
  days_until_gt: 'days until is more than',
  days_until_lt: 'days until is less than',
};

/* ─── Event categories derived from backend metadata ─────────────────── */

export interface EventGroup {
  category: string;
  events: EventOption[];
}

export function groupEventsByCategory(events: EventOption[]): EventGroup[] {
  const map = new Map<string, EventOption[]>();
  for (const ev of events) {
    const cat = ev.category || 'Other';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(ev);
  }
  return Array.from(map.entries()).map(([category, events]) => ({ category, events }));
}

/* ─── Structured condition fields, driven by backend metadata ──────────── */

export interface FieldGroup {
  group: string;
  fields: MetaFieldOption[];
}

/** Friendly labels for condition-field context roots. */
const ROOT_LABELS: Record<string, string> = {
  contact: 'Contact',
  entry: 'Deal / Pipeline',
  record: 'Record',
  call: 'Call',
};

/**
 * Condition-field groups for the selected trigger, scoped to the roots the
 * event actually exposes (event.condition_roots). This is what guarantees the
 * "If" dropdown only offers fields that resolve against the live event context.
 */
export function getFieldGroups(triggerEvent: string, metadata: AutomationMetadata): FieldGroup[] {
  const ev = metadata.events.find((e) => e.event === triggerEvent);
  if (!ev || !ev.condition_roots?.length) return [];
  const groups: FieldGroup[] = [];
  for (const root of ev.condition_roots) {
    const fields = metadata.condition_fields?.[root] || [];
    if (fields.length > 0) {
      groups.push({ group: ROOT_LABELS[root] || root, fields });
    }
  }
  return groups;
}

/** Look up a single condition field's metadata across the trigger's roots. */
export function getFieldMeta(
  triggerEvent: string,
  fieldValue: string,
  metadata: AutomationMetadata,
): MetaFieldOption | undefined {
  for (const group of getFieldGroups(triggerEvent, metadata)) {
    const f = group.fields.find((x) => x.value === fieldValue);
    if (f) return f;
  }
  return undefined;
}

/** Enum values for a field (for the value dropdown), or [] if free-form. */
export function getKnownValues(
  triggerEvent: string,
  fieldValue: string,
  metadata: AutomationMetadata,
): string[] {
  const f = getFieldMeta(triggerEvent, fieldValue, metadata);
  return f?.value_type === 'enum' ? f.options || [] : [];
}

/** Operators valid for the chosen field's value_type (empty applies_to = all). */
export function getOperatorsForField(
  triggerEvent: string,
  fieldValue: string,
  metadata: AutomationMetadata,
): OperatorOption[] {
  const ops = metadata.operators || [];
  if (!fieldValue) return ops;
  const f = getFieldMeta(triggerEvent, fieldValue, metadata);
  if (!f) return ops;
  return ops.filter((o) => !o.applies_to?.length || o.applies_to.includes(f.value_type));
}

/* ─── Humanize helpers ────────────────────────────────────────────────── */

export function humanizeTrigger(
  trigger: { event: string; filters?: Record<string, any>; schedule?: { type: string; time?: string; day?: string } },
  events: EventOption[]
): string {
  const ev = events.find((e) => e.event === trigger.event);
  const label = ev?.label || trigger.event;
  const filters = trigger.filters;
  if (filters && Object.keys(filters).length > 0) {
    const parts = Object.entries(filters)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}="${v}"`);
    if (parts.length > 0) return `${label} (${parts.join(', ')})`;
  }
  if (trigger.schedule) {
    const s = trigger.schedule;
    const time = s.time || '';
    const day = s.day ? ` on ${s.day}` : '';
    return `${label} — ${s.type}${day}${time ? ` at ${time}` : ''}`;
  }
  return label;
}

export function humanizeConditions(
  conditions: Array<{ field?: string; op?: string; value?: any }>
): string {
  if (!conditions || conditions.length === 0) return 'Always';
  return conditions
    .map((c) => {
      const op = (c.op && OP_LABELS[c.op]) || c.op || '?';
      return `${c.field || '?'} ${op} ${c.value ?? ''}`;
    })
    .join(' AND ');
}

export function humanizeActions(
  actions: Array<{ type: string; params: Record<string, any> }>,
  actionOptions: ActionOption[]
): { label: string; description: string; params: { key: string; value: string }[] }[] {
  if (!actions || actions.length === 0) return [];
  return actions.map((a) => {
    const opt = actionOptions.find((o) => o.type === a.type);
    const paramEntries = Object.entries(a.params || {})
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .map(([key, value]) => {
        const schema = opt?.param_schema.find((p) => p.name === key);
        return { key: schema?.label || key, value: String(value) };
      });
    return {
      label: opt?.label || a.type,
      description: opt?.description || '',
      params: paramEntries,
    };
  });
}
