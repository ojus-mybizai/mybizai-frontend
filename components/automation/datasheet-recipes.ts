/**
 * Curated static recipe catalog for datasheet automations (AUTOMATION_REDESIGN_SPEC §7).
 *
 * Each recipe is code-defined, gated on the sheet's real schema, and `applyRecipe`
 * is pure — given a recipe + the datasheet fields it returns a drawer form draft.
 * Power users ignore the chips and fill the form manually.
 */

import type { DynamicField } from '@/services/dynamic-data';
import type { Condition } from './condition-builder';

export type TriggerType = 'record.created' | 'record.updated' | 'record.date_reminder' | 'record.deleted';

export interface DatasheetRuleForm {
  name: string;
  triggerType: TriggerType;
  // record.date_reminder config
  dateField: string;
  offsetDays: number;
  direction: 'before' | 'after';
  conditions: Condition[];
  actions: Array<{ type: string; params: Record<string, string> }>;
}

export function emptyForm(): DatasheetRuleForm {
  return {
    name: '',
    triggerType: 'record.created',
    dateField: '',
    offsetDays: 3,
    direction: 'before',
    conditions: [],
    actions: [{ type: 'notify', params: { to: 'owner', title: '' } }],
  };
}

export interface Recipe {
  key: string;
  label: string;
  description: string;
  /** Gate: only show when the sheet has the field type this recipe needs. */
  showWhen: (fields: DynamicField[]) => boolean;
}

const DATE_TYPES = new Set(['date', 'datetime']);
const ENUM_TYPES = new Set(['enum', 'select', 'multi_select']);
const NUMBER_TYPES = new Set(['integer', 'float', 'currency', 'number']);

const firstOfType = (fields: DynamicField[], types: Set<string>): DynamicField | undefined =>
  fields.find((f) => types.has(f.field_type));

export const DATASHEET_RECIPES: Recipe[] = [
  {
    key: 'remind_before_date',
    label: 'Remind before a date',
    description: 'e.g. remind 3 days before a renewal / due date',
    showWhen: (fields) => !!firstOfType(fields, DATE_TYPES),
  },
  {
    key: 'alert_new_record',
    label: 'Alert on new record',
    description: 'Notify staff whenever a record is added',
    showWhen: () => true,
  },
  {
    key: 'flag_field_equals',
    label: 'Flag when field = value',
    description: 'Notify when a status/category field changes to a value',
    showWhen: (fields) => !!firstOfType(fields, ENUM_TYPES),
  },
  {
    key: 'number_threshold',
    label: 'Notify when number crosses a threshold',
    description: 'e.g. amount greater than a target',
    showWhen: (fields) => !!firstOfType(fields, NUMBER_TYPES),
  },
];

export function recipesForSchema(fields: DynamicField[]): Recipe[] {
  return DATASHEET_RECIPES.filter((r) => r.showWhen(fields));
}

/**
 * Pure: build a drawer form from a recipe + the sheet schema. Picks sensible
 * default fields (first date/enum/number field) that the user can then adjust.
 */
export function applyRecipe(recipeKey: string, fields: DynamicField[]): DatasheetRuleForm {
  const base = emptyForm();
  switch (recipeKey) {
    case 'remind_before_date': {
      const dateField = firstOfType(fields, DATE_TYPES);
      return {
        ...base,
        name: dateField ? `Remind before ${dateField.display_name}` : 'Date reminder',
        triggerType: 'record.date_reminder',
        dateField: dateField?.name ?? '',
        offsetDays: 3,
        direction: 'before',
        actions: [{ type: 'notify', params: { to: 'owner', title: 'Upcoming date reminder' } }],
      };
    }
    case 'alert_new_record':
      return {
        ...base,
        name: 'Alert on new record',
        triggerType: 'record.created',
        actions: [{ type: 'notify', params: { to: 'all_employees', title: 'New record added' } }],
      };
    case 'flag_field_equals': {
      const enumField = firstOfType(fields, ENUM_TYPES);
      const opt = (enumField?.config?.options as string[] | undefined)?.[0] ?? '';
      return {
        ...base,
        name: enumField ? `Flag when ${enumField.display_name} set` : 'Flag on field change',
        triggerType: 'record.updated',
        conditions: enumField
          ? [{ field: `record.${enumField.name}`, op: 'eq', value: opt }]
          : [],
        actions: [{ type: 'notify', params: { to: 'owner', title: 'Field flagged' } }],
      };
    }
    case 'number_threshold': {
      const numField = firstOfType(fields, NUMBER_TYPES);
      return {
        ...base,
        name: numField ? `${numField.display_name} threshold alert` : 'Threshold alert',
        triggerType: 'record.updated',
        conditions: numField ? [{ field: `record.${numField.name}`, op: 'gt', value: '' }] : [],
        actions: [{ type: 'notify', params: { to: 'owner', title: 'Threshold crossed' } }],
      };
    }
    default:
      return base;
  }
}
