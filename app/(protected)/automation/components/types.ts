import type { RuleCategory, EventOption, ActionOption } from '@/services/automation';

export interface ConditionDraft {
  field: string;
  op: string;
  value: string;
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

export const OP_OPTIONS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'in (comma list)' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'days_since_gt', label: 'days since >' },
  { value: 'days_until_lt', label: 'days until <' },
];

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

/* ─── Structured fields per trigger event type ────────────────────────── */

export interface FieldOption {
  value: string;
  label: string;
  /** Known values for this field (used for the value dropdown) */
  knownValues?: string[];
}

export interface FieldGroup {
  group: string;
  fields: FieldOption[];
}

const TRIGGER_FIELDS: Record<string, FieldGroup[]> = {
  'lead.': [
    {
      group: 'Lead Info',
      fields: [
        { value: 'lead.name', label: 'Lead Name' },
        { value: 'lead.email', label: 'Email' },
        { value: 'lead.phone', label: 'Phone' },
        { value: 'lead.source', label: 'Source', knownValues: ['website', 'referral', 'whatsapp', 'instagram', 'facebook', 'google', 'manual', 'import', 'api'] },
        { value: 'lead.tags', label: 'Tags' },
        { value: 'lead.score', label: 'Score' },
      ],
    },
    {
      group: 'Lead Stage',
      fields: [
        { value: 'lead.pipeline_stage', label: 'Pipeline Stage' },
        { value: 'lead.stage_type', label: 'Stage Type', knownValues: ['open', 'won', 'lost'] },
        { value: 'lead.assigned_to', label: 'Assigned To' },
      ],
    },
    {
      group: 'Lead Dates',
      fields: [
        { value: 'lead.created_at', label: 'Created At' },
        { value: 'lead.last_contacted_at', label: 'Last Contacted' },
      ],
    },
  ],
  'work.': [
    {
      group: 'Work Item',
      fields: [
        { value: 'work.title', label: 'Title' },
        { value: 'work.status', label: 'Status', knownValues: ['pending', 'in_progress', 'completed', 'cancelled'] },
        { value: 'work.priority', label: 'Priority', knownValues: ['low', 'medium', 'high', 'urgent'] },
        { value: 'work.type', label: 'Type' },
        { value: 'work.assigned_to', label: 'Assigned To' },
        { value: 'work.due_date', label: 'Due Date' },
      ],
    },
  ],
  'record.': [
    {
      group: 'Record',
      fields: [
        { value: 'record.datasheet', label: 'Datasheet Name' },
        { value: 'record.field_name', label: 'Field Name' },
        { value: 'record.created_by', label: 'Created By' },
      ],
    },
  ],
  'call.': [
    {
      group: 'Call',
      fields: [
        { value: 'call.disposition', label: 'Disposition', knownValues: ['answered', 'no_answer', 'busy', 'voicemail', 'failed'] },
        { value: 'call.duration', label: 'Duration (seconds)' },
        { value: 'call.direction', label: 'Direction', knownValues: ['inbound', 'outbound'] },
        { value: 'call.from', label: 'From Number' },
        { value: 'call.to', label: 'To Number' },
      ],
    },
  ],
  'schedule.': [],
};

export function getFieldGroups(triggerEvent: string): FieldGroup[] {
  for (const [prefix, groups] of Object.entries(TRIGGER_FIELDS)) {
    if (triggerEvent.startsWith(prefix)) return groups;
  }
  return [];
}

/** Get known values for a specific field (for value dropdown) */
export function getKnownValues(triggerEvent: string, fieldValue: string): string[] {
  const groups = getFieldGroups(triggerEvent);
  for (const group of groups) {
    const field = group.fields.find((f) => f.value === fieldValue);
    if (field?.knownValues) return field.knownValues;
  }
  return [];
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
      const op = OP_OPTIONS.find((o) => o.value === c.op)?.label || c.op || '?';
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
