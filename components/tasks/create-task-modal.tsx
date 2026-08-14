'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, Target, Info } from 'lucide-react';
import { createTask, type TaskCreatePayload } from '@/services/tasks';
import { listMembers, type Member } from '@/services/members';
import { listModels, listFields, type DynamicModel, type DynamicField } from '@/services/dynamic-data';
import { listProcesses, getProcess, type BusinessProcessListItem, type ProcessStage } from '@/services/processes';

type TaskType = 'simple' | 'app_action';
type Signal = 'record_created' | 'field_equals' | 'stage_reached' | 'fields_filled';

interface CompletionCondition {
  signal: Signal;
  datasheet_id?: number;
  contact_id?: number;
  entity?: string;
  entity_id?: number;
  field?: string;
  value?: string;
  process_id?: number;
  entry_id?: number;
  stage_id?: number;
  fields?: string[];
}

// Field types whose value is a bounded set — surface a value dropdown instead
// of a free-text input when we already know the options.
const SELECT_FIELD_TYPES = new Set(['select', 'multiselect', 'dropdown', 'radio']);
const BOOLEAN_FIELD_TYPES = new Set(['boolean', 'checkbox', 'toggle']);
const NUMBER_FIELD_TYPES = new Set(['number', 'integer', 'decimal', 'currency']);
const DATE_FIELD_TYPES = new Set(['date', 'datetime']);

function fieldLabel(f: DynamicField): string {
  return f.display_name || f.name;
}

function fieldOptions(f: DynamicField): string[] {
  const raw = (f.config as { options?: unknown } | undefined)?.options;
  return Array.isArray(raw) ? raw.map(String) : [];
}

export function CreateTaskModal({
  onClose,
  onCreated,
  prefillContactId,
  prefillDatasheetId,
}: {
  onClose: () => void;
  onCreated: () => void;
  prefillContactId?: number;
  prefillDatasheetId?: number;
}) {
  const [step, setStep] = useState<'type' | 'form'>(prefillDatasheetId ? 'form' : 'type');
  const [taskType, setTaskType] = useState<TaskType>(prefillDatasheetId ? 'app_action' : 'simple');

  function selectType(t: TaskType) {
    setTaskType(t);
    setStep('form');
  }

  if (step === 'type') {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-bg-primary rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-secondary">
            <h2 className="text-lg font-semibold text-text-primary">New Task</h2>
            <button onClick={onClose} className="p-1 rounded-lg text-text-secondary hover:bg-bg-secondary">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5">
            <p className="text-sm text-text-secondary mb-4">What kind of task?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => selectType('simple')}
                className="p-4 rounded-xl border-2 border-border-secondary hover:border-accent text-left transition-colors"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <p className="text-sm font-semibold text-text-primary">Quick task</p>
                <p className="text-xs text-text-secondary mt-1">Ask someone to confirm they did it. Done with a tap.</p>
              </button>
              <button
                onClick={() => selectType('app_action')}
                className="p-4 rounded-xl border-2 border-border-secondary hover:border-accent text-left transition-colors"
              >
                <Target className="w-8 h-8 text-purple-500 mb-2" />
                <p className="text-sm font-semibold text-text-primary">Action task</p>
                <p className="text-xs text-text-secondary mt-1">Something that happens in the app. Auto-completes when done.</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TaskForm
      taskType={taskType}
      onClose={onClose}
      onCreated={onCreated}
      onBack={() => setStep('type')}
      prefillContactId={prefillContactId}
      prefillDatasheetId={prefillDatasheetId}
    />
  );
}

function TaskForm({
  taskType, onClose, onCreated, onBack,
  prefillContactId, prefillDatasheetId,
}: {
  taskType: TaskType;
  onClose: () => void;
  onCreated: () => void;
  onBack: () => void;
  prefillContactId?: number;
  prefillDatasheetId?: number;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [dueAt, setDueAt] = useState('');
  const [instructions, setInstructions] = useState('');
  const [contactId, setContactId] = useState<number | ''>(prefillContactId ?? '');
  const [deliveryChannel, setDeliveryChannel] = useState('auto');

  // Completion condition state (app_action only)
  const [signal, setSignal] = useState<Signal>('record_created');
  const [datasheetId, setDatasheetId] = useState<number | ''>(prefillDatasheetId ?? '');
  // The `field_equals` / `fields_filled` signals watch either the task's
  // linked contact or a datasheet record. `dynamic_record` scope reads
  // `datasheetId` to load fields; `contact` scope offers a small built-in list.
  const [watchScope, setWatchScope] = useState<'contact' | 'dynamic_record'>('dynamic_record');
  const [fieldName, setFieldName] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [processId, setProcessId] = useState<number | ''>('');
  const [stageId, setStageId] = useState<number | ''>('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  // Lookups
  const [datasheets, setDatasheets] = useState<DynamicModel[]>([]);
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [processes, setProcesses] = useState<BusinessProcessListItem[]>([]);
  const [stages, setStages] = useState<ProcessStage[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMembers({ assignable_only: true }).then(setMembers).catch(() => {});
    if (taskType === 'app_action') {
      listModels().then(setDatasheets).catch(() => {});
      listProcesses().then(setProcesses).catch(() => {});
    }
  }, [taskType]);

  // Load fields whenever the watched datasheet changes and the signal actually
  // uses them. Reset the picked field/value so a stale name from another sheet
  // doesn't stick around invisibly.
  useEffect(() => {
    const usesFields = signal === 'record_created'
      || signal === 'fields_filled'
      || signal === 'field_equals';
    if (usesFields && datasheetId) {
      listFields(Number(datasheetId))
        .then(fs => setFields([...fs].sort((a, b) => a.order_index - b.order_index)))
        .catch(() => setFields([]));
    } else {
      setFields([]);
    }
    setFieldName('');
    setFieldValue('');
    setSelectedFields([]);
  }, [datasheetId, signal, watchScope]);

  // Stage list follows the picked pipeline.
  useEffect(() => {
    if (signal === 'stage_reached' && processId) {
      getProcess(Number(processId))
        .then(p => setStages([...p.stages].sort((a, b) => a.sort_order - b.sort_order)))
        .catch(() => setStages([]));
      setStageId('');
    } else {
      setStages([]);
    }
  }, [processId, signal]);

  const activeField = useMemo(
    () => fields.find(f => f.name === fieldName) ?? null,
    [fields, fieldName],
  );

  function buildCompletionCondition(): CompletionCondition | undefined {
    if (taskType !== 'app_action') return undefined;

    if (signal === 'record_created' && datasheetId) {
      return {
        signal: 'record_created',
        datasheet_id: Number(datasheetId),
        ...(contactId ? { contact_id: Number(contactId) } : {}),
      };
    }
    if (signal === 'field_equals' && fieldName && fieldValue !== '') {
      // entity_id is derived server-side from the task's linked contact/record
      // (see task_completion_evaluator._resolve_entity_id) so the user never
      // has to name an id — they only pick the *what* and the *equals*.
      return {
        signal: 'field_equals',
        entity: watchScope,
        field: fieldName,
        value: fieldValue,
      };
    }
    if (signal === 'stage_reached' && processId) {
      return {
        signal: 'stage_reached',
        process_id: Number(processId),
        ...(stageId ? { stage_id: Number(stageId) } : {}),
      };
    }
    if (signal === 'fields_filled' && selectedFields.length > 0) {
      return {
        signal: 'fields_filled',
        entity: watchScope,
        fields: selectedFields,
      };
    }
    return undefined;
  }

  function buildDeepLink(): string | undefined {
    if (taskType !== 'app_action') return undefined;
    if (signal === 'record_created' && datasheetId) {
      const base = `/data-sheet/${datasheetId}/new`;
      return contactId ? `${base}?contact=${contactId}` : base;
    }
    if (signal === 'stage_reached' && processId) {
      return `/processes/${processId}`;
    }
    return undefined;
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!assigneeId) { setError('Assignee is required.'); return; }

    setSaving(true);
    setError(null);
    try {
      const payload: TaskCreatePayload = {
        title: title.trim(),
        type: taskType,
        assignee_member_id: Number(assigneeId),
        priority,
        due_at: dueAt || undefined,
        instructions: instructions.trim() || undefined,
        delivery_channel: deliveryChannel === 'auto' ? undefined : deliveryChannel,
        contact_id: contactId ? Number(contactId) : undefined,
        datasheet_id: datasheetId ? Number(datasheetId) : undefined,
        completion_condition: buildCompletionCondition() as Record<string, unknown> | undefined,
        deep_link_path: buildDeepLink(),
      };
      await createTask(payload);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }

  const signalLabel = {
    record_created: 'A new record is created',
    field_equals: 'A field reaches a specific value',
    fields_filled: 'A set of fields are all filled in',
    stage_reached: 'A pipeline deal reaches a stage',
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-primary rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-secondary sticky top-0 bg-bg-primary z-10">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="text-xs text-accent hover:underline">Back</button>
            <h2 className="text-lg font-semibold text-text-primary">
              {taskType === 'simple' ? 'Quick Task' : 'Action Task'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-text-secondary hover:bg-bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Title</label>
            <input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder={taskType === 'simple' ? 'What needs doing?' : 'What action should they take?'}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border-secondary bg-bg-primary text-text-primary focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Assignee</label>
            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border-secondary bg-bg-primary text-text-primary">
              <option value="">Select member...</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Instructions (optional)</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border-secondary bg-bg-primary text-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as 'low' | 'normal' | 'high')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border-secondary bg-bg-primary text-text-primary">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Due date</label>
              <input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border-secondary bg-bg-primary text-text-primary" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Delivery channel</label>
            <div className="flex gap-1">
              {[['auto', 'Auto'], ['whatsapp', 'WhatsApp'], ['in_app', 'In-App']].map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => setDeliveryChannel(val)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    deliveryChannel === val
                      ? 'border-accent bg-accent/10 text-accent font-medium'
                      : 'border-border-secondary text-text-secondary hover:border-accent'
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Completion condition builder (app_action only) */}
          {taskType === 'app_action' && (
            <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-semibold text-purple-800 dark:text-purple-300">Auto-complete when…</span>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">Trigger</label>
                <select value={signal} onChange={e => setSignal(e.target.value as Signal)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border-secondary bg-bg-primary text-text-primary">
                  <option value="record_created">{signalLabel.record_created}</option>
                  <option value="field_equals">{signalLabel.field_equals}</option>
                  <option value="fields_filled">{signalLabel.fields_filled}</option>
                  <option value="stage_reached">{signalLabel.stage_reached}</option>
                </select>
              </div>

              {/* ── record_created ───────────────────────────────────────── */}
              {signal === 'record_created' && (
                <div>
                  <label className="block text-xs text-text-secondary mb-1">In which datasheet?</label>
                  <select value={datasheetId} onChange={e => setDatasheetId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border-secondary bg-bg-primary text-text-primary">
                    <option value="">Select datasheet…</option>
                    {datasheets.map(d => <option key={d.id} value={d.id}>{d.display_name || d.name}</option>)}
                  </select>
                </div>
              )}

              {/* ── field_equals ─────────────────────────────────────────── */}
              {signal === 'field_equals' && (
                <div className="space-y-2">
                  <WatchScopePicker value={watchScope} onChange={setWatchScope} />

                  {watchScope === 'dynamic_record' && (
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Datasheet</label>
                      <select value={datasheetId} onChange={e => setDatasheetId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-border-secondary bg-bg-primary text-text-primary">
                        <option value="">Select datasheet…</option>
                        {datasheets.map(d => <option key={d.id} value={d.id}>{d.display_name || d.name}</option>)}
                      </select>
                    </div>
                  )}

                  {(watchScope === 'contact' || datasheetId) && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-text-secondary mb-1">Field</label>
                        <FieldSelect
                          fields={watchScope === 'contact' ? CONTACT_BUILT_IN_FIELDS : fields}
                          value={fieldName}
                          onChange={n => { setFieldName(n); setFieldValue(''); }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1">Equals</label>
                        <FieldValueInput
                          field={watchScope === 'contact'
                            ? CONTACT_BUILT_IN_FIELDS.find(f => f.name === fieldName) ?? null
                            : activeField}
                          value={fieldValue}
                          onChange={setFieldValue}
                        />
                      </div>
                    </div>
                  )}

                  <ScopeHint scope={watchScope} hasContact={!!contactId} />
                </div>
              )}

              {/* ── fields_filled ────────────────────────────────────────── */}
              {signal === 'fields_filled' && (
                <div className="space-y-2">
                  <WatchScopePicker value={watchScope} onChange={setWatchScope} />

                  {watchScope === 'dynamic_record' && (
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">Datasheet</label>
                      <select value={datasheetId} onChange={e => setDatasheetId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-border-secondary bg-bg-primary text-text-primary">
                        <option value="">Select datasheet…</option>
                        {datasheets.map(d => <option key={d.id} value={d.id}>{d.display_name || d.name}</option>)}
                      </select>
                    </div>
                  )}

                  <label className="block text-xs text-text-secondary">
                    Which fields must be filled? (tap to add)
                  </label>
                  <FieldChipPicker
                    fields={watchScope === 'contact' ? CONTACT_BUILT_IN_FIELDS : fields}
                    selected={selectedFields}
                    onToggle={n =>
                      setSelectedFields(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])
                    }
                  />

                  <ScopeHint scope={watchScope} hasContact={!!contactId} />
                </div>
              )}

              {/* ── stage_reached ────────────────────────────────────────── */}
              {signal === 'stage_reached' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Pipeline</label>
                    <select value={processId} onChange={e => setProcessId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border-secondary bg-bg-primary text-text-primary">
                      <option value="">Select pipeline…</option>
                      {processes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Stage</label>
                    <select value={stageId}
                      onChange={e => setStageId(e.target.value ? Number(e.target.value) : '')}
                      disabled={!processId}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border-secondary bg-bg-primary text-text-primary disabled:opacity-50">
                      <option value="">Any stage change</option>
                      {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border-secondary sticky bottom-0 bg-bg-primary">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-secondary/80">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving || !title.trim() || !assigneeId}
            className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── completion-condition helpers ────────────────────────────────────────────

// Contact fields the evaluator can already read via getattr on the Contact
// model. Shaped like DynamicField so the same pickers render both.
const CONTACT_BUILT_IN_FIELDS: DynamicField[] = [
  fakeField('status', 'Status', 'select', ['new', 'engaged', 'qualified', 'won', 'lost']),
  fakeField('assigned_to_id', 'Assigned to', 'text'),
  fakeField('name', 'Name', 'text'),
  fakeField('email', 'Email', 'text'),
  fakeField('phone', 'Phone', 'text'),
  fakeField('city', 'City', 'text'),
];

function fakeField(name: string, label: string, type: string, options?: string[]): DynamicField {
  return {
    id: -1, business_id: -1, dynamic_model_id: -1,
    name, display_name: label, field_type: type,
    is_required: false, is_unique: false, is_editable: true, is_searchable: true,
    order_index: 0, default_value: null,
    config: options ? { options } : {},
    relation_model_id: null, relation_builtin_model: null, relation_kind: null,
    created_at: null, updated_at: null,
  };
}

function WatchScopePicker({
  value, onChange,
}: {
  value: 'contact' | 'dynamic_record';
  onChange: (v: 'contact' | 'dynamic_record') => void;
}) {
  const opts: Array<{ v: 'contact' | 'dynamic_record'; label: string }> = [
    { v: 'dynamic_record', label: "On the task's record" },
    { v: 'contact',        label: "On the task's contact" },
  ];
  return (
    <div>
      <label className="block text-xs text-text-secondary mb-1">Watch what?</label>
      <div className="flex gap-1">
        {opts.map(o => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            className={`flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              value === o.v
                ? 'border-accent bg-accent/10 text-accent font-medium'
                : 'border-border-secondary text-text-secondary hover:border-accent'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FieldSelect({
  fields, value, onChange,
}: {
  fields: DynamicField[];
  value: string;
  onChange: (name: string) => void;
}) {
  if (fields.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-text-secondary rounded-lg border border-dashed border-border-secondary">
        Pick a datasheet above
      </div>
    );
  }
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm rounded-lg border border-border-secondary bg-bg-primary text-text-primary">
      <option value="">Select field…</option>
      {fields.map(f => (
        <option key={f.name} value={f.name}>{fieldLabel(f)}</option>
      ))}
    </select>
  );
}

function FieldValueInput({
  field, value, onChange,
}: {
  field: DynamicField | null;
  value: string;
  onChange: (v: string) => void;
}) {
  const cls = "w-full px-3 py-2 text-sm rounded-lg border border-border-secondary bg-bg-primary text-text-primary";

  if (!field) {
    return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="—" disabled className={`${cls} opacity-50`} />;
  }

  if (SELECT_FIELD_TYPES.has(field.field_type)) {
    const options = fieldOptions(field);
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
        <option value="">Select value…</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (BOOLEAN_FIELD_TYPES.has(field.field_type)) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
        <option value="">Select…</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (NUMBER_FIELD_TYPES.has(field.field_type)) {
    return <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder="e.g. 100" className={cls} />;
  }
  if (DATE_FIELD_TYPES.has(field.field_type)) {
    const t = field.field_type === 'datetime' ? 'datetime-local' : 'date';
    return <input type={t} value={value} onChange={e => onChange(e.target.value)} className={cls} />;
  }
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="Type a value…" className={cls} />;
}

function FieldChipPicker({
  fields, selected, onToggle,
}: {
  fields: DynamicField[];
  selected: string[];
  onToggle: (name: string) => void;
}) {
  if (fields.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-text-secondary rounded-lg border border-dashed border-border-secondary">
        Pick a datasheet above to see its fields
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map(f => {
        const on = selected.includes(f.name);
        return (
          <button key={f.name} type="button" onClick={() => onToggle(f.name)}
            className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
              on
                ? 'border-accent bg-accent/10 text-accent font-medium'
                : 'border-border-secondary text-text-secondary hover:border-accent'
            }`}>
            {fieldLabel(f)}
          </button>
        );
      })}
    </div>
  );
}

function ScopeHint({ scope, hasContact }: { scope: 'contact' | 'dynamic_record'; hasContact: boolean }) {
  const msg = scope === 'contact'
    ? (hasContact
        ? "Uses this task's linked contact automatically."
        : "Link a contact when saving so the evaluator knows which contact to watch.")
    : "Uses the record you attach when the assignee opens this task.";
  return (
    <div className="flex items-start gap-1.5 text-[11px] text-text-secondary">
      <Info className="w-3 h-3 mt-0.5 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}
