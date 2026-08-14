'use client';

/**
 * DatasheetAutomationDrawer — contextual, schema-aware automation creation from
 * inside a datasheet (AUTOMATION_REDESIGN_SPEC §6). A right slide-over that
 * shows the sheet's existing rules (peek) and a one-screen When/If/Then form led
 * by curated recipe chips. Writes a normal AutomationRule with
 * trigger.filters.datasheet_id (+ trigger.config for reminders), which §8's
 * deriveScope groups back onto this sheet.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { X, Plus, Zap, Clock, Trash2 } from 'lucide-react';
import type { DynamicField } from '@/services/dynamic-data';
import {
  getAutomationMetadata,
  listAutomationRules,
  createAutomationRule,
  deleteAutomationRule,
  type AutomationMetadata,
  type ActionOption,
  type AutomationRule,
} from '@/services/automation';
import { ConditionBuilder, type Condition } from './condition-builder';
import { fieldDefsFromDatasheetSchema } from './condition-builder-adapters';
import { rulesForDatasheet } from './scope';
import {
  ChannelPicker, WaTemplatePicker, TemplateVariablePreview, RecipientPicker,
} from './action-widgets';
import { DatasheetFieldInput } from '@/components/data-sheet/datasheet-field-input';
import type { MessageTemplate } from '@/services/message-templates';
import {
  recipesForSchema,
  applyRecipe,
  emptyForm,
  type DatasheetRuleForm,
  type TriggerType,
} from './datasheet-recipes';

// Actions relevant inside a datasheet (§10). move_stage / assign_deal_* stay
// pipeline-scoped and are intentionally excluded.
const DATASHEET_ACTION_TYPES = new Set([
  'notify', 'send_whatsapp_template', 'send_whatsapp', 'schedule_followup',
  'add_tag', 'remove_tag', 'add_note', 'update_record', 'create_record',
  'dispatch_wa_work', 'log_activity',
]);

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'record.created', label: 'Record created' },
  { value: 'record.updated', label: 'Record updated' },
  { value: 'record.date_reminder', label: 'Date reminder (before/after a date)' },
  { value: 'record.deleted', label: 'Record deleted' },
];

const INPUT = 'w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30';

export function DatasheetAutomationDrawer({
  open, onClose, modelId, modelName, fields, onChanged,
}: {
  open: boolean;
  onClose: () => void;
  modelId: number;
  modelName: string;
  fields: DynamicField[];
  onChanged?: () => void;
}) {
  const [metadata, setMetadata] = useState<AutomationMetadata | null>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [form, setForm] = useState<DatasheetRuleForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Selected template per action index → drives the read-only variable preview.
  const [templateByAction, setTemplateByAction] = useState<Record<number, MessageTemplate | null>>({});

  const dateFields = useMemo(
    () => fields.filter((f) => f.field_type === 'date' || f.field_type === 'datetime'),
    [fields],
  );
  const conditionFields = useMemo(
    () => fieldDefsFromDatasheetSchema(fields, { valuePrefix: 'record.' }),
    [fields],
  );
  const recipes = useMemo(() => recipesForSchema(fields), [fields]);
  const datasheetActions: ActionOption[] = useMemo(
    () => (metadata?.actions ?? []).filter((a) => DATASHEET_ACTION_TYPES.has(a.type) && a.available !== false),
    [metadata],
  );

  const reload = () => {
    listAutomationRules()
      .then((res) => setRules(rulesForDatasheet(res.items, modelId)))
      .catch(() => setRules([]));
  };

  useEffect(() => {
    if (!open) return;
    if (!metadata) getAutomationMetadata().then(setMetadata).catch(() => {});
    reload();
    setCreating(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modelId]);

  const update = (patch: Partial<DatasheetRuleForm>) => setForm((f) => ({ ...f, ...patch }));

  const setParam = (idx: number, name: string, value: string) =>
    update({ actions: form.actions.map((a, i) => (i === idx ? { ...a, params: { ...a.params, [name]: value } } : a)) });

  /** Widget-aware render of one action parameter (channel/template/field/recipient/…). */
  const renderActionParam = (
    p: { name: string; type: string; label: string; required?: boolean; options?: string[]; widget?: string; hint?: string },
    action: { type: string; params: Record<string, string> },
    idx: number,
  ) => {
    const val = action.params[p.name] ?? '';
    const set = (v: string) => setParam(idx, p.name, v);

    let control: ReactNode;
    switch (p.widget) {
      case 'channel':
        control = <ChannelPicker value={val} onChange={set} />;
        break;
      case 'wa_message_template':
        control = (
          <WaTemplatePicker value={val} onChange={set}
            onTemplate={(t) => setTemplateByAction((m) => (m[idx] === t ? m : { ...m, [idx]: t }))} />
        );
        break;
      case 'recipient':
        control = <RecipientPicker value={val} onChange={set} />;
        break;
      case 'record_field':
        control = (
          <select value={val} onChange={(e) => set(e.target.value)} className={`${INPUT} appearance-none`}>
            <option value="">Select field…</option>
            {fields.filter((f) => f.field_type !== 'computed').map((f) => (
              <option key={f.id} value={f.name}>{f.display_name}</option>
            ))}
          </select>
        );
        break;
      case 'record_value': {
        const targetField = fields.find((f) => f.name === action.params['field']);
        control = targetField ? (
          <DatasheetFieldInput field={targetField} value={val} onChange={(v) => set(v == null ? '' : String(v))} />
        ) : (
          <input disabled placeholder="Pick a field first" className={`${INPUT} opacity-60`} />
        );
        break;
      }
      default:
        control = p.options && p.options.length > 0 ? (
          <select value={val} onChange={(e) => set(e.target.value)} className={`${INPUT} appearance-none`}>
            <option value="">Select…</option>
            {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input type={p.type === 'number' ? 'number' : 'text'} value={val}
            onChange={(e) => set(e.target.value)} className={INPUT} />
        );
    }

    return (
      <div key={p.name}>
        <label className="mb-1 block text-[11px] text-text-secondary">{p.label}{p.required ? ' *' : ''}</label>
        {control}
        {p.hint && <p className="mt-1 text-[10px] text-text-secondary/70">{p.hint}</p>}
        {p.widget === 'wa_message_template' && templateByAction[idx] && (
          <div className="mt-2"><TemplateVariablePreview template={templateByAction[idx]!} /></div>
        )}
      </div>
    );
  };

  const startBlank = () => { setForm(emptyForm()); setCreating(true); };
  const startRecipe = (key: string) => { setForm(applyRecipe(key, fields)); setCreating(true); };

  const canSave = form.name.trim() &&
    form.actions.some((a) => a.type) &&
    (form.triggerType !== 'record.date_reminder' || form.dateField);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const trigger: AutomationRule['trigger'] = {
        event: form.triggerType,
        filters: { datasheet_id: modelId },
      };
      if (form.triggerType === 'record.date_reminder') {
        (trigger as Record<string, unknown>).config = {
          date_field: form.dateField,
          offset_days: Number(form.offsetDays) || 0,
          direction: form.direction,
        };
      }
      const conditions = form.conditions
        .filter((c) => c.field)
        .map((c) => ({
          field: c.field,
          op: c.op,
          value: c.op === 'is_empty' || c.op === 'is_not_empty' ? undefined : c.value,
        }));
      const actions = form.actions
        .filter((a) => a.type)
        .map((a) => ({
          type: a.type,
          params: Object.fromEntries(Object.entries(a.params).filter(([, v]) => v !== '' && v != null)),
        }));

      await createAutomationRule({
        name: form.name.trim(),
        category: 'data',
        trigger,
        conditions,
        actions,
        is_active: true,
      });
      setCreating(false);
      reload();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save automation');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAutomationRule(id);
      reload();
      onChanged?.();
    } catch { /* surfaced via reload no-op */ }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-xl flex-col border-l border-border-color bg-card-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <Zap className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Automations</h3>
              <p className="text-xs text-text-muted">{modelName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          {!creating && (
            <>
              {/* Existing rules (peek) */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Active on this sheet ({rules.length})
                </p>
                {rules.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border-color p-4 text-center text-sm text-text-secondary">
                    No automations yet. Pick a recipe below to create one.
                  </p>
                )}
                {rules.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-border-color bg-bg-primary/50 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{r.name}</p>
                      <p className="text-[11px] text-text-secondary">
                        {r.trigger.event}{r.run_count ? ` · ran ${r.run_count}×` : ''}
                        {r.is_active ? '' : ' · inactive'}
                      </p>
                    </div>
                    <button type="button" onClick={() => handleDelete(r.id)}
                      className="rounded-md p-1.5 text-text-secondary hover:bg-red-500/10 hover:text-red-400" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Recipe chips */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Start from a recipe</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {recipes.map((rec) => (
                    <button key={rec.key} type="button" onClick={() => startRecipe(rec.key)}
                      className="rounded-xl border border-border-color bg-bg-primary/50 p-3 text-left transition-colors hover:border-accent/50 hover:bg-accent/5">
                      <p className="text-sm font-medium text-text-primary">{rec.label}</p>
                      <p className="mt-0.5 text-[11px] text-text-secondary">{rec.description}</p>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={startBlank}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent/20 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10">
                  <Plus className="h-3 w-3" /> Build from scratch
                </button>
              </div>
            </>
          )}

          {creating && (
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Automation name</label>
                <input value={form.name} onChange={(e) => update({ name: e.target.value })}
                  placeholder="e.g. Remind before renewal" className={INPUT} />
              </div>

              {/* When */}
              <div className="space-y-3 rounded-xl border border-border-color bg-bg-primary/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">When</p>
                <select value={form.triggerType} onChange={(e) => update({ triggerType: e.target.value as TriggerType })}
                  className={`${INPUT} appearance-none`}>
                  {TRIGGER_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                {form.triggerType === 'record.date_reminder' && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] text-text-secondary">Date field</label>
                      <select value={form.dateField} onChange={(e) => update({ dateField: e.target.value })}
                        className={`${INPUT} appearance-none`}>
                        <option value="">Select…</option>
                        {dateFields.map((f) => <option key={f.id} value={f.name}>{f.display_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-text-secondary">Days</label>
                      <input type="number" min={0} value={form.offsetDays}
                        onChange={(e) => update({ offsetDays: Number(e.target.value) })} className={INPUT} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-text-secondary">When</label>
                      <select value={form.direction} onChange={(e) => update({ direction: e.target.value as 'before' | 'after' })}
                        className={`${INPUT} appearance-none`}>
                        <option value="before">before the date</option>
                        <option value="after">after the date</option>
                      </select>
                    </div>
                  </div>
                )}
                {form.triggerType === 'record.date_reminder' && dateFields.length === 0 && (
                  <p className="flex items-center gap-1 text-[11px] text-amber-500">
                    <Clock className="h-3 w-3" /> This sheet has no date field to remind on.
                  </p>
                )}
              </div>

              {/* If */}
              <div className="space-y-2 rounded-xl border border-border-color bg-bg-primary/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-yellow-500">If (optional)</p>
                <ConditionBuilder
                  fields={conditionFields}
                  value={form.conditions}
                  onChange={(next) => update({ conditions: next })}
                  addLabel="Add condition"
                  emptyHint="This sheet has no fields to filter on."
                />
              </div>

              {/* Then */}
              <div className="space-y-3 rounded-xl border border-border-color bg-bg-primary/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-green-500">Then</p>
                {form.actions.map((action, idx) => {
                  const meta = datasheetActions.find((a) => a.type === action.type);
                  return (
                    <div key={idx} className="space-y-2 rounded-lg border border-border-color bg-bg-primary/60 p-2.5">
                      <div className="flex items-center gap-2">
                        <select value={action.type}
                          onChange={(e) => update({ actions: form.actions.map((a, i) => i === idx ? { type: e.target.value, params: {} } : a) })}
                          className={`${INPUT} appearance-none`}>
                          <option value="">Select action…</option>
                          {datasheetActions.map((a) => <option key={a.type} value={a.type}>{a.label}</option>)}
                        </select>
                        {form.actions.length > 1 && (
                          <button type="button" onClick={() => update({ actions: form.actions.filter((_, i) => i !== idx) })}
                            className="rounded-md p-1.5 text-text-secondary hover:bg-red-500/10 hover:text-red-400">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {meta?.param_schema.map((p) => renderActionParam(p, action, idx))}
                    </div>
                  );
                })}
                <button type="button" onClick={() => update({ actions: [...form.actions, { type: '', params: {} }] })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent/20 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10">
                  <Plus className="h-3 w-3" /> Add action
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {creating && (
          <div className="flex items-center justify-between border-t border-border-color bg-bg-secondary/30 px-5 py-3.5">
            <button type="button" onClick={() => setCreating(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-secondary">
              Back
            </button>
            <button type="button" onClick={handleSave} disabled={!canSave || saving}
              className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Create automation'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
