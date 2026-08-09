'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Zap, ArrowLeft, ChevronRight, Check, Plus, X, GripVertical,
  AlertCircle, Clock, Filter, ArrowDown,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  RULE_CATEGORIES,
  type AutomationRule,
  type AutomationMetadata,
  type EventOption,
  type ActionOption,
  type RuleCategory,
} from '@/services/automation';
import {
  type RuleFormState,
  type ActionDraft,
  EMPTY_FORM,
  OP_LABELS,
  groupEventsByCategory,
  humanizeTrigger,
  humanizeConditions,
  humanizeActions,
} from './types';
import { ToggleSwitch, Select, Input, Textarea, FieldLabel } from './shared';
import { ConditionBuilder, type Condition } from '@/components/automation/condition-builder';
import { fieldDefsFromEcaMetadata } from '@/components/automation/condition-builder-adapters';

/* ═══════════════════════════════════════════════════════════════════════════ */
/* STEP DEFINITIONS                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

const STEPS = [
  { key: 'trigger', label: 'When', description: 'Choose what triggers this rule', color: 'text-accent', bg: 'bg-accent' },
  { key: 'conditions', label: 'If', description: 'Add optional conditions', color: 'text-yellow-400', bg: 'bg-yellow-400' },
  { key: 'actions', label: 'Then', description: 'Define what happens', color: 'text-green-400', bg: 'bg-green-400' },
  { key: 'review', label: 'Review', description: 'Preview and save', color: 'text-purple-400', bg: 'bg-purple-400' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

/* ═══════════════════════════════════════════════════════════════════════════ */
/* SORTABLE ACTION ITEM                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

function SortableActionItem({
  id,
  action,
  index,
  actionOptions,
  onUpdate,
  onUpdateParam,
  onRemove,
}: {
  id: string;
  action: ActionDraft;
  index: number;
  actionOptions: ActionOption[];
  onUpdate: (idx: number, patch: Partial<ActionDraft>) => void;
  onUpdateParam: (idx: number, key: string, val: string) => void;
  onRemove: (idx: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const selectedAction = actionOptions.find((ao) => ao.type === action.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-border-color bg-bg-primary/50 p-4 space-y-3 transition-shadow ${
        isDragging ? 'shadow-lg shadow-accent/10 border-accent/40 z-10' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="shrink-0 cursor-grab active:cursor-grabbing text-text-secondary/40 hover:text-text-secondary transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-green-400/10 text-green-400 text-[10px] font-bold">
          {index + 1}
        </span>
        <div className="flex-1">
          <Select
            value={action.type}
            onChange={(v) => onUpdate(index, { type: v, params: {} })}
          >
            <option value="">Select action...</option>
            {actionOptions.map((ao) => (
              <option key={ao.type} value={ao.type} disabled={ao.available === false}>
                {ao.label}{ao.available === false ? ' (coming soon)' : ''}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="shrink-0 rounded-md p-1.5 text-text-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors"
          title="Remove action"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Action description */}
      {selectedAction && (
        <p className="text-[11px] text-text-secondary/70 pl-11">
          {selectedAction.description}
        </p>
      )}

      {/* Dynamic param fields */}
      {selectedAction && selectedAction.param_schema.length > 0 && (
        <div className="space-y-3 pl-11">
          {selectedAction.param_schema.map((param) => (
            <div key={param.name}>
              <FieldLabel
                required={param.required}
                hint={getParamHint(selectedAction.type, param.name)}
              >
                {param.label}
              </FieldLabel>
              {param.options && param.options.length > 0 ? (
                <Select
                  value={action.params[param.name] || ''}
                  onChange={(v) => onUpdateParam(index, param.name, v)}
                >
                  <option value="">Select...</option>
                  {param.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </Select>
              ) : param.type === 'number' ? (
                <Input
                  type="number"
                  value={action.params[param.name] || ''}
                  onChange={(v) => onUpdateParam(index, param.name, v)}
                  placeholder={param.label}
                />
              ) : param.type === 'textarea' || param.type === 'json' ? (
                <Textarea
                  value={action.params[param.name] || ''}
                  onChange={(v) => onUpdateParam(index, param.name, v)}
                  placeholder={param.type === 'json' ? '{"key": "value"}' : param.label}
                  rows={param.type === 'json' ? 3 : 2}
                />
              ) : (
                <Input
                  value={action.params[param.name] || ''}
                  onChange={(v) => onUpdateParam(index, param.name, v)}
                  placeholder={getParamPlaceholder(selectedAction.type, param.name) || param.label}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* PARAM HINTS & PLACEHOLDERS                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

function getParamHint(actionType: string, paramName: string): string | undefined {
  const hints: Record<string, Record<string, string>> = {
    send_whatsapp: {
      message: 'Use {contact.name}, {contact.phone} etc. for dynamic values. Free-text works inside the 24h window.',
      channel_id: 'Optional — defaults to the first connected WhatsApp channel',
    },
    schedule_followup: {
      rule_id: 'Preferred — use an existing follow-up rule (template, delay, guards)',
      delay_minutes: 'Required only when no follow-up rule is selected',
      template_id: 'WhatsApp template to use outside the 24h window',
      free_form_text: 'Text used inside the 24h window. Supports {contact.name}.',
    },
    notify: {
      body: 'Use {contact.name} or {entry.title} for dynamic values',
      title: 'Brief title shown in the notification banner',
    },
    update_field: {
      field: 'Allowed contact fields: name, phone, email, company, source, priority, routing_mode, notes',
      value: 'Use {entry.stage} or {new_value} to reference event data',
    },
    assign_contact_to_employee: {
      method: 'round_robin / least_loaded pick the employee with fewest contacts',
      employee_id: 'WaEmployee ID — only needed when method is "specific"',
    },
    dispatch_wa_work: {
      wa_template_id: 'Optional WhatsApp work template (simple_task / checklist / form)',
      employee_ids: 'Comma-separated WaEmployee IDs (and/or use a group)',
      group_id: 'Employee group ID to dispatch to all members',
    },
    move_stage: {
      to_stage: 'Exact stage name within the entry\'s pipeline',
    },
    create_record: {
      field_values: 'JSON object mapping field names to values',
    },
  };
  return hints[actionType]?.[paramName];
}

function getParamPlaceholder(actionType: string, paramName: string): string | undefined {
  const placeholders: Record<string, Record<string, string>> = {
    send_whatsapp: {
      message: 'Hi {contact.name}, thanks for reaching out!',
    },
    notify: {
      title: 'New contact assigned to you',
      body: '{contact.name} from {contact.source} needs follow-up',
    },
    add_note: {
      content: 'Auto-note: stage changed to {entry.stage}',
    },
    add_tag: {
      tag: 'hot-lead',
    },
    log_activity: {
      message: 'Rule triggered: contact stage changed',
    },
  };
  return placeholders[actionType]?.[paramName];
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MAIN EDITOR COMPONENT                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function RuleEditor({
  editingRule,
  metadata,
  saving,
  onSave,
  onCancel,
}: {
  editingRule: AutomationRule | null;
  metadata: AutomationMetadata;
  saving: boolean;
  onSave: (form: RuleFormState) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<StepKey>('trigger');
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* ── Initialize form from editing rule or empty ────────────────────── */
  const [form, setForm] = useState<RuleFormState>(() => {
    if (!editingRule) return { ...EMPTY_FORM };
    return {
      name: editingRule.name,
      description: editingRule.description || '',
      category: (editingRule.category as RuleCategory) || 'general',
      trigger_event: editingRule.trigger.event,
      trigger_filters: (editingRule.trigger.filters as Record<string, string>) || {},
      trigger_schedule_type: editingRule.trigger.schedule?.type || '',
      trigger_schedule_time: editingRule.trigger.schedule?.time || '',
      trigger_schedule_day: editingRule.trigger.schedule?.day || '',
      conditions: (editingRule.conditions || []).map((c) => ({
        field: c.field || '',
        op: c.op || 'eq',
        value: Array.isArray(c.value) ? c.value.map(String) : String(c.value ?? ''),
      })),
      actions: (editingRule.actions || []).map((a) => ({
        type: a.type,
        params: Object.fromEntries(
          Object.entries(a.params || {}).map(([k, v]) => [k, String(v ?? '')])
        ),
      })),
      is_active: editingRule.is_active,
    };
  });

  const updateForm = useCallback(
    (patch: Partial<RuleFormState>) => {
      setForm((f) => ({ ...f, ...patch }));
      // Clear related errors
      const keys = Object.keys(patch);
      setErrors((prev) => {
        const next = { ...prev };
        for (const k of keys) delete next[k];
        return next;
      });
    },
    []
  );

  /* ── Derived ───────────────────────────────────────────────────────── */
  const events = metadata.events;
  const actionOptions = metadata.actions;
  const eventGroups = useMemo(() => groupEventsByCategory(events), [events]);
  const selectedEvent = events.find((e) => e.event === form.trigger_event);
  const isScheduleEvent = selectedEvent?.event.startsWith('schedule.');
  // Schema-aware condition fields for the current trigger (the fix for the old
  // raw "entity.field" text box). For record.* the datasheet drawer supplies a
  // richer schema; here we drive off the ECA metadata roots.
  const conditionFields = useMemo(
    () => fieldDefsFromEcaMetadata(form.trigger_event, metadata),
    [form.trigger_event, metadata],
  );

  /* ── Step index ────────────────────────────────────────────────────── */
  const stepIdx = STEPS.findIndex((s) => s.key === step);

  /* ── Action helpers ────────────────────────────────────────────────── */
  const addAction = () =>
    updateForm({ actions: [...form.actions, { type: '', params: {} }] });
  const updateAction = (idx: number, patch: Partial<ActionDraft>) =>
    updateForm({ actions: form.actions.map((a, i) => (i === idx ? { ...a, ...patch } : a)) });
  const updateActionParam = (idx: number, key: string, val: string) =>
    updateForm({
      actions: form.actions.map((a, i) =>
        i === idx ? { ...a, params: { ...a.params, [key]: val } } : a
      ),
    });
  const removeAction = (idx: number) =>
    updateForm({ actions: form.actions.filter((_, i) => i !== idx) });

  /* ── DnD for actions ───────────────────────────────────────────────── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const actionIds = form.actions.map((_, i) => `action-${i}`);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = actionIds.indexOf(active.id as string);
    const newIdx = actionIds.indexOf(over.id as string);
    updateForm({ actions: arrayMove(form.actions, oldIdx, newIdx) });
  };

  /* ── Step validation ───────────────────────────────────────────────── */
  const validateStep = (s: StepKey): boolean => {
    const errs: Record<string, string> = {};
    if (s === 'trigger') {
      if (!form.name.trim()) errs.name = 'Rule name is required';
      if (!form.trigger_event) errs.trigger_event = 'Select a trigger event';
    }
    if (s === 'actions') {
      if (form.actions.length === 0) errs.actions = 'Add at least one action';
      form.actions.forEach((a, i) => {
        if (!a.type) errs[`action_${i}_type`] = 'Select an action type';
      });
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    const nextIdx = Math.min(stepIdx + 1, STEPS.length - 1);
    setStep(STEPS[nextIdx].key);
  };

  const goPrev = () => {
    const prevIdx = Math.max(stepIdx - 1, 0);
    setStep(STEPS[prevIdx].key);
  };

  const handleSubmit = () => {
    if (!validateStep('trigger') || !validateStep('actions')) {
      // Jump to first step with errors
      if (!form.name.trim() || !form.trigger_event) setStep('trigger');
      else if (form.actions.length === 0) setStep('actions');
      return;
    }
    onSave(form);
  };

  /* ═════════════════════════════════════════════════════════════════════ */
  /* RENDER                                                               */
  /* ═════════════════════════════════════════════════════════════════════ */

  return (
    <div className="mx-auto max-w-3xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-2 text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-text-primary">
            {editingRule ? 'Edit Rule' : 'New Automation Rule'}
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {STEPS.find((s) => s.key === step)?.description}
          </p>
        </div>
        <ToggleSwitch
          checked={form.is_active}
          onChange={() => updateForm({ is_active: !form.is_active })}
          label="Rule active"
        />
        <span className="text-xs text-text-secondary">{form.is_active ? 'Active' : 'Inactive'}</span>
      </div>

      {/* ── Visual Stepper ─────────────────────────────────────────────── */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => {
          const isComplete = i < stepIdx;
          const isCurrent = i === stepIdx;
          return (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => {
                  // Allow going back freely, going forward requires validation
                  if (i <= stepIdx) setStep(s.key);
                  else if (i === stepIdx + 1 && validateStep(step)) setStep(s.key);
                }}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  isCurrent
                    ? `${s.bg}/15 ${s.color} ring-1 ring-current/20`
                    : isComplete
                    ? 'text-text-primary hover:bg-bg-secondary'
                    : 'text-text-secondary/50'
                }`}
              >
                <span
                  className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold shrink-0 transition-colors ${
                    isCurrent
                      ? `${s.bg} text-white`
                      : isComplete
                      ? 'bg-green-500 text-white'
                      : 'bg-bg-secondary text-text-secondary/50'
                  }`}
                >
                  {isComplete ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 transition-colors ${
                  i < stepIdx ? 'bg-green-500/50' : 'bg-border-color'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step Content ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border-color bg-card-bg p-6">

        {/* ════════ STEP 1: TRIGGER ════════ */}
        {step === 'trigger' && (
          <div className="space-y-5">
            {/* Name & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Rule Name</FieldLabel>
                <Input
                  value={form.name}
                  onChange={(v) => updateForm({ name: v })}
                  placeholder="e.g. Welcome message for new leads"
                  error={errors.name}
                />
              </div>
              <div>
                <FieldLabel>Description</FieldLabel>
                <Input
                  value={form.description}
                  onChange={(v) => updateForm({ description: v })}
                  placeholder="Optional description"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <FieldLabel>Category</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {RULE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => updateForm({ category: cat.key })}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border ${
                      form.category === cat.key
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent/50'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger Event — grouped dropdown */}
            <div>
              <FieldLabel required hint="What event should trigger this automation?">
                Trigger Event
              </FieldLabel>
              <div className="relative">
                <select
                  value={form.trigger_event}
                  onChange={(e) =>
                    updateForm({
                      trigger_event: e.target.value,
                      trigger_filters: {},
                      trigger_schedule_type: '',
                      trigger_schedule_time: '',
                      trigger_schedule_day: '',
                    })
                  }
                  className={`w-full appearance-none rounded-lg border bg-bg-primary px-3 py-2.5 pr-8 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/30 ${
                    errors.trigger_event ? 'border-red-500/60 focus:border-red-500' : 'border-border-color focus:border-accent'
                  }`}
                >
                  <option value="">Select an event...</option>
                  {eventGroups.map((group) => (
                    <optgroup key={group.category} label={group.category}>
                      {group.events.map((ev) => (
                        <option key={ev.event} value={ev.event} disabled={ev.available === false}>
                          {ev.label} — {ev.description}
                          {ev.available === false ? ' (coming soon)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary rotate-90" />
              </div>
              {errors.trigger_event && <p className="mt-1 text-xs text-red-400">{errors.trigger_event}</p>}
            </div>

            {/* Selected event info */}
            {selectedEvent && (
              <div className="rounded-xl bg-accent/5 border border-accent/10 p-3">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{selectedEvent.label}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{selectedEvent.description}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic filter fields */}
            {selectedEvent?.has_filters && selectedEvent.filter_fields.length > 0 && (
              <div className="space-y-3 rounded-xl border border-border-color bg-bg-primary/50 p-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-text-secondary" />
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Trigger Filters
                  </p>
                </div>
                <p className="text-[11px] text-text-secondary/60">
                  Narrow down when this trigger fires by specifying filter values
                </p>
                {selectedEvent.filter_fields.map((ff) => (
                  <div key={ff.name}>
                    <FieldLabel>{ff.label}</FieldLabel>
                    {ff.options && ff.options.length > 0 ? (
                      <Select
                        value={form.trigger_filters[ff.name] || ''}
                        onChange={(v) =>
                          updateForm({ trigger_filters: { ...form.trigger_filters, [ff.name]: v } })
                        }
                      >
                        <option value="">Any {ff.label.toLowerCase()}...</option>
                        {ff.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        value={form.trigger_filters[ff.name] || ''}
                        onChange={(v) =>
                          updateForm({ trigger_filters: { ...form.trigger_filters, [ff.name]: v } })
                        }
                        placeholder={`Filter by ${ff.label.toLowerCase()}...`}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Schedule fields */}
            {isScheduleEvent && (
              <div className="space-y-3 rounded-xl border border-border-color bg-bg-primary/50 p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-text-secondary" />
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Schedule Configuration
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <FieldLabel>Frequency</FieldLabel>
                    <Select
                      value={form.trigger_schedule_type || 'daily'}
                      onChange={(v) => updateForm({ trigger_schedule_type: v })}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel>Time</FieldLabel>
                    <input
                      type="time"
                      value={form.trigger_schedule_time}
                      onChange={(e) => updateForm({ trigger_schedule_time: e.target.value })}
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                  {form.trigger_schedule_type === 'weekly' && (
                    <div>
                      <FieldLabel>Day of Week</FieldLabel>
                      <Select
                        value={form.trigger_schedule_day}
                        onChange={(v) => updateForm({ trigger_schedule_day: v })}
                      >
                        <option value="">Select day...</option>
                        {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map((d) => (
                          <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                  {form.trigger_schedule_type === 'monthly' && (
                    <div>
                      <FieldLabel>Day of Month</FieldLabel>
                      <Select
                        value={form.trigger_schedule_day}
                        onChange={(v) => updateForm({ trigger_schedule_day: v })}
                      >
                        <option value="">Select day...</option>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={String(d)}>{d}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════ STEP 2: CONDITIONS ════════ */}
        {step === 'conditions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-yellow-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Conditions
                  <span className="text-[10px] font-normal text-text-secondary ml-1">optional</span>
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Add conditions to only run this rule when specific criteria are met. All conditions must be true (AND logic).
                </p>
              </div>
            </div>

            <ConditionBuilder
              fields={conditionFields}
              value={form.conditions as Condition[]}
              onChange={(next) =>
                updateForm({
                  conditions: next.map((c) => ({
                    field: c.field,
                    op: c.op,
                    value: Array.isArray(c.value) ? c.value.map(String) : String(c.value ?? ''),
                  })),
                })
              }
              operators={metadata.operators}
              addLabel="Add Condition"
              emptyHint={
                isScheduleEvent
                  ? 'Scheduled triggers have no entity context — pair with a scan action instead.'
                  : 'This trigger has no filterable fields. The rule runs every time it fires.'
              }
            />
          </div>
        )}

        {/* ════════ STEP 3: ACTIONS ════════ */}
        {step === 'actions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-green-400 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Actions
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Define what happens when this rule triggers. Actions run in order — drag to reorder.
                </p>
              </div>
              <button
                type="button"
                onClick={addAction}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-accent border border-accent/20 hover:bg-accent/10 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Action
              </button>
            </div>

            {errors.actions && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.actions}
              </p>
            )}

            {form.actions.length === 0 && (
              <div className="rounded-xl border border-dashed border-border-color p-8 text-center">
                <Zap className="mx-auto h-8 w-8 text-text-secondary/30 mb-2" />
                <p className="text-sm text-text-secondary">No actions added yet</p>
                <p className="text-xs text-text-secondary/60 mt-1">
                  Add at least one action to define what this rule does.
                </p>
                <button
                  type="button"
                  onClick={addAction}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add First Action
                </button>
              </div>
            )}

            {form.actions.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={actionIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {form.actions.map((action, idx) => (
                      <div key={actionIds[idx]}>
                        <SortableActionItem
                          id={actionIds[idx]}
                          action={action}
                          index={idx}
                          actionOptions={actionOptions}
                          onUpdate={updateAction}
                          onUpdateParam={updateActionParam}
                          onRemove={removeAction}
                        />
                        {idx < form.actions.length - 1 && (
                          <div className="flex justify-center py-1">
                            <ArrowDown className="h-4 w-4 text-green-400/40" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}

        {/* ════════ STEP 4: REVIEW ════════ */}
        {step === 'review' && (
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-purple-400 flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Review Your Rule
            </h3>

            {/* Rule summary card */}
            <div className="rounded-xl border border-border-color bg-bg-primary/30 p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-semibold text-text-primary">{form.name || 'Untitled Rule'}</h4>
                  {form.description && (
                    <p className="text-xs text-text-secondary mt-0.5">{form.description}</p>
                  )}
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                  form.is_active ? 'bg-green-500/10 text-green-400' : 'bg-text-secondary/10 text-text-secondary'
                }`}>
                  {form.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Visual pipeline */}
              <div className="space-y-0">
                {/* WHEN */}
                <div className="flex items-start gap-3 p-3 rounded-t-xl bg-accent/5 border border-accent/10">
                  <span className="shrink-0 mt-0.5 flex items-center justify-center h-6 w-6 rounded-full bg-accent text-white text-[10px] font-bold">W</span>
                  <div>
                    <p className="text-xs font-semibold text-accent uppercase tracking-wider">When</p>
                    <p className="text-sm text-text-primary mt-0.5">
                      {humanizeTrigger(
                        {
                          event: form.trigger_event,
                          filters: form.trigger_filters,
                          schedule: isScheduleEvent ? {
                            type: form.trigger_schedule_type || 'daily',
                            ...(form.trigger_schedule_time ? { time: form.trigger_schedule_time } : {}),
                            ...(form.trigger_schedule_day ? { day: form.trigger_schedule_day } : {}),
                          } : undefined,
                        },
                        events
                      )}
                    </p>
                  </div>
                </div>

                {/* Connector */}
                <div className="flex justify-center">
                  <div className="w-px h-4 bg-border-color" />
                </div>

                {/* IF */}
                <div className="flex items-start gap-3 p-3 bg-yellow-400/5 border-x border-yellow-400/10">
                  <span className="shrink-0 mt-0.5 flex items-center justify-center h-6 w-6 rounded-full bg-yellow-400 text-white text-[10px] font-bold">I</span>
                  <div>
                    <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">If</p>
                    <p className="text-sm text-text-primary mt-0.5">
                      {humanizeConditions(form.conditions.filter((c) => c.field && c.op))}
                    </p>
                  </div>
                </div>

                {/* Connector */}
                <div className="flex justify-center">
                  <div className="w-px h-4 bg-border-color" />
                </div>

                {/* THEN */}
                <div className="p-3 rounded-b-xl bg-green-400/5 border border-green-400/10 space-y-2">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 mt-0.5 flex items-center justify-center h-6 w-6 rounded-full bg-green-400 text-white text-[10px] font-bold">T</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Then</p>
                      {humanizeActions(
                        form.actions.filter((a) => a.type).map((a) => ({ type: a.type, params: a.params })),
                        actionOptions
                      ).map((a, i) => (
                        <div key={i} className="mt-2 rounded-lg bg-bg-primary/50 p-2.5 border border-border-color">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-green-400 bg-green-400/10 rounded-full px-1.5 py-0.5">
                              {i + 1}
                            </span>
                            <p className="text-sm font-medium text-text-primary">{a.label}</p>
                          </div>
                          {a.params.length > 0 && (
                            <div className="mt-1.5 pl-7 space-y-0.5">
                              {a.params.map((p) => (
                                <p key={p.key} className="text-xs text-text-secondary">
                                  <span className="text-text-secondary/60">{p.key}:</span>{' '}
                                  <span className="text-text-primary">{p.value}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {form.actions.filter((a) => a.type).length === 0 && (
                        <p className="text-sm text-text-secondary mt-0.5">No actions configured</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Human readable summary */}
              <div className="rounded-lg bg-purple-400/5 border border-purple-400/10 p-3">
                <p className="text-xs font-medium text-purple-400 mb-1">Summary</p>
                <p className="text-sm text-text-primary leading-relaxed">
                  {buildHumanSummary(form, events, actionOptions)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation Footer ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={stepIdx === 0 ? onCancel : goPrev}
          className="rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors"
        >
          {stepIdx === 0 ? 'Cancel' : 'Back'}
        </button>
        <div className="flex items-center gap-3">
          {step === 'review' ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {editingRule && editingRule.id > 0 ? 'Update Rule' : 'Create Rule'}
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* HUMAN-READABLE SUMMARY BUILDER                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

function buildHumanSummary(
  form: RuleFormState,
  events: EventOption[],
  actionOptions: ActionOption[],
): string {
  const ev = events.find((e) => e.event === form.trigger_event);
  const triggerLabel = ev?.label?.toLowerCase() || form.trigger_event || '...';

  const conditionParts = form.conditions
    .filter((c) => c.field && c.op)
    .map((c) => {
      const opLabel = (c.op && OP_LABELS[c.op]) || c.op;
      return `${c.field} ${opLabel} ${c.value || ''}`.trim();
    });

  const actionParts = form.actions
    .filter((a) => a.type)
    .map((a) => {
      const opt = actionOptions.find((o) => o.type === a.type);
      return opt?.label?.toLowerCase() || a.type;
    });

  let summary = `When ${triggerLabel}`;

  if (conditionParts.length > 0) {
    summary += `, if ${conditionParts.join(' and ')}`;
  }

  if (actionParts.length > 0) {
    summary += `, then ${actionParts.join(', then ')}`;
  } else {
    summary += ', then (no actions)';
  }

  summary += '.';
  return summary;
}
