// Adapts ProcessEntry[] into the shape the datasheet views (ListView / CardView /
// CalendarView) expect: { items: QueryResponse['items'], fields: DynamicField[] }.
//
// The datasheet views are field-driven; process entries have a fixed shape.
// We synthesise a stable virtual schema so those views work with zero fork.

import type { DynamicField } from '@/services/dynamic-data';
import type { ProcessEntry } from '@/services/processes';

// Negative synthetic ids so they never clash with real backend field ids.
const F = {
  title:        -1001,
  entity:       -1002,
  value:        -1003,
  priority:     -1004,
  assignee:     -1005,
  daysInStage:  -1006,
  stage:        -1007,
  closeDate:    -1008,
  source:       -1009,
  phone:        -1010,
} as const;

function synth(
  id: number,
  name: string,
  display_name: string,
  field_type: string,
  extra: Partial<DynamicField> = {},
): DynamicField {
  return {
    id,
    business_id: 0,
    dynamic_model_id: 0,
    name,
    display_name,
    field_type,
    is_required: false,
    is_unique: false,
    is_editable: false,
    is_searchable: true,
    order_index: id,
    default_value: null,
    config: {},
    relation_model_id: null,
    relation_kind: null,
    created_at: null,
    updated_at: null,
    ...extra,
  };
}

/** Virtual schema for a process entry — one field per surface-worthy attribute.
 *  Value/priority are 'text' (not 'currency'/'enum') because the pre-formatting
 *  in `entryToItem` already renders the display string, and the datasheet
 *  `FieldDisplay` for currency assumes USD unless configured per-field.
 */
export const ENTRY_FIELDS: DynamicField[] = [
  synth(F.title,       'title',        'Title',      'text'),
  synth(F.entity,      'entity_name',  'Entity',     'text'),
  synth(F.value,       'expected_value','Value',     'text'),
  synth(F.priority,    'priority',     'Priority',   'text'),
  synth(F.assignee,    'assignee',     'Assignee',   'text'),
  synth(F.daysInStage, 'days_in_stage','Days here',  'text'),
  synth(F.stage,       'stage',        'Stage',      'text'),
  synth(F.closeDate,   'expected_close_date', 'Expected close', 'date'),
  synth(F.source,      'source',       'Source',     'text'),
  synth(F.phone,       'phone',        'Phone',      'text'),
];

function formatINR(v: number | null | undefined): string {
  if (v == null) return '';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
  } catch { return `₹${v}`; }
}

export const ENTRY_TITLE_FIELD = 'title';
export const ENTRY_DEFAULT_DETAIL_FIELDS = [
  'entity_name', 'expected_value', 'priority', 'assignee', 'days_in_stage',
];
export const ENTRY_CARD_FIELDS = [
  'entity_name', 'expected_value', 'priority', 'assignee',
  'days_in_stage', 'expected_close_date',
];
export const ENTRY_CALENDAR_DATE_FIELD = 'expected_close_date';
export const ENTRY_CALENDAR_PILL_FIELDS = ['entity_name', 'expected_value'];

/** Adapt one process entry into the datasheet items row shape. */
export function entryToItem(entry: ProcessEntry): Record<string, unknown> {
  const daysStr = entry.days_in_stage != null ? `${entry.days_in_stage}d` : null;
  const priorityStr = entry.priority ? entry.priority.charAt(0).toUpperCase() + entry.priority.slice(1) : null;
  const data: Record<string, unknown> = {
    title: entry.title || entry.entity_name || `#${entry.id}`,
    entity_name: entry.entity_name || '—',
    expected_value: entry.expected_value != null ? formatINR(entry.expected_value) : null,
    priority: priorityStr,
    assignee: entry.assigned_member_name || entry.assigned_to_name || null,
    days_in_stage: daysStr,
    stage: entry.current_stage_name || null,
    expected_close_date: entry.expected_close_date ?? null,
    source: entry.source ?? null,
    phone: entry.entity_phone ?? null,
  };
  return {
    id: entry.id,
    record_key: `E-${entry.id}`,
    data,
    normalized_data: data,
    created_at: entry.created_at ?? null,
    updated_at: entry.stage_entered_at ?? entry.entered_at ?? entry.created_at ?? null,
    // Keep the original entry for callers that need the raw object.
    __entry: entry,
  };
}

export function entriesToItems(entries: ProcessEntry[]): Record<string, unknown>[] {
  return entries.map(entryToItem);
}
