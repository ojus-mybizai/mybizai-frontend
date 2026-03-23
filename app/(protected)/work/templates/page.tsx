'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ModuleGuard from '@/components/module-guard';
import { useAuthStore } from '@/lib/auth-store';
import {
  createWorkTemplate,
  listWorkTypes,
  listWorkTemplates,
  createWorkType,
  deleteWorkTemplate,
  updateWorkTemplate,
  type WorkTemplate,
  type WorkType,
  type DatasheetUiSchema,
  type FormField,
  type FormFieldType,
} from '@/services/work';
import { listEmployees, type Employee } from '@/services/employees';
import { listModels, listFields, type DynamicModel, type DynamicField } from '@/services/dynamic-data';
import { AssignWorkModal } from '@/components/work/assign-work-modal';

// ─── Constants ───────────────────────────────────────────────────────────────

type TemplateTypeValue = 'simple' | 'checklist' | 'datasheet' | 'calling';

interface StepRow {
  order: number;
  label: string;
  form_schema?: FormField[];
}

const FORM_FIELD_TYPES: Array<{ value: FormFieldType; label: string; icon: string }> = [
  { value: 'text', label: 'Text', icon: 'T' },
  { value: 'textarea', label: 'Long Text', icon: '¶' },
  { value: 'number', label: 'Number', icon: '#' },
  { value: 'select', label: 'Dropdown', icon: '▾' },
  { value: 'image', label: 'Image', icon: '📷' },
  { value: 'location', label: 'GPS Location', icon: '📍' },
  { value: 'datetime', label: 'Date & Time', icon: '🕐' },
  { value: 'phone', label: 'Phone', icon: '📞' },
  { value: 'lead', label: 'Customer', icon: '👤' },
];

function templateTypeIcon(t?: string | null) {
  if (t === 'checklist') return '☑';
  if (t === 'datasheet') return '📊';
  if (t === 'calling') return '📞';
  return '📋';
}

function templateTypeBadgeClass(t?: string | null) {
  if (t === 'checklist') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  if (t === 'datasheet') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
  if (t === 'calling') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  return 'bg-bg-secondary text-text-secondary';
}

// ─── Category Combobox ───────────────────────────────────────────────────────

function CategoryCombobox({
  value,
  onChange,
  types,
  onTypeIdChange,
}: {
  value: string;
  onChange: (v: string) => void;
  types: WorkType[];
  onTypeIdChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const suggestions = types.filter(
    (t) => t.is_active && value.trim() && t.name.toLowerCase().includes(value.toLowerCase()),
  );
  const exactMatch = types.find((t) => t.name.toLowerCase() === value.trim().toLowerCase());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = (name: string, id: number | null) => {
    onChange(name);
    onTypeIdChange(id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onTypeIdChange(null); // reset matched id when user types
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="e.g. Field Work, Sales, Support…"
        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
      />
      {open && value.trim() && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border-color bg-card-bg shadow-lg">
          {suggestions.map((t) => (
            <button
              key={t.id}
              type="button"
              onMouseDown={() => pick(t.name, t.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
            >
              <span className="text-text-secondary">↩</span>
              {t.name}
              <span className="ml-auto text-xs text-text-secondary">existing</span>
            </button>
          ))}
          {!exactMatch && value.trim().length > 1 && (
            <button
              type="button"
              onMouseDown={() => pick(value.trim(), null)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-accent hover:bg-accent/5"
            >
              <span>+</span>
              Create category &ldquo;{value.trim()}&rdquo;
            </button>
          )}
          {suggestions.length === 0 && value.trim().length <= 1 && (
            <div className="px-3 py-2 text-xs text-text-secondary">Type to search or create a category</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Form Field Builder ──────────────────────────────────────────────────────

function FormFieldBuilder({
  fields,
  onChange,
  title,
}: {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  title?: string;
}) {
  // ── Local raw string state for dropdown option inputs ──────────────────────
  // Stores the in-progress comma-separated text per field id.
  // We only parse & commit to parent state on blur, so the user can type
  // "New, Contacted, Won" freely without commas being swallowed mid-type.
  const [rawOptions, setRawOptions] = useState<Record<string, string>>({});

  const add = (type: FormFieldType) => {
    const id = `field_${Date.now()}`;
    onChange([
      ...fields,
      { id, type, label: FORM_FIELD_TYPES.find((f) => f.value === type)?.label ?? type, required: false },
    ]);
  };

  const update = (idx: number, patch: Partial<FormField>) => {
    const next = [...fields];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const remove = (idx: number) => {
    // Clean up rawOptions for the removed field
    const removed = fields[idx];
    if (removed) {
      setRawOptions((prev) => {
        const next = { ...prev };
        delete next[removed.id];
        return next;
      });
    }
    onChange(fields.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...fields];
    const t = idx + dir;
    if (t < 0 || t >= next.length) return;
    [next[idx], next[t]] = [next[t], next[idx]];
    onChange(next);
  };

  // Commit the raw option string for a field on blur
  const commitOptions = (fieldId: string, idx: number, raw: string) => {
    const parsed = raw.split(',').map((o) => o.trim()).filter(Boolean);
    update(idx, { options: parsed });
    // Normalise the display back to trimmed join so it looks clean
    setRawOptions((prev) => ({ ...prev, [fieldId]: parsed.join(', ') }));
  };

  return (
    <div className="space-y-2">
      {title && <p className="text-xs font-semibold text-text-secondary">{title}</p>}

      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-color px-3 py-3 text-center text-xs text-text-secondary">
          No fields yet — add below
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, idx) => (
            <div key={field.id} className="rounded-lg border border-border-color bg-bg-primary p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-xs text-text-secondary">
                  {FORM_FIELD_TYPES.find((f) => f.value === field.type)?.icon ?? '?'}
                </span>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => update(idx, { label: e.target.value })}
                  placeholder="Field label"
                  className="min-w-0 flex-1 rounded border border-border-color bg-bg-secondary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <select
                  value={field.type}
                  onChange={(e) => {
                    const newType = e.target.value as FormFieldType;
                    // If switching away from select, clear stale rawOptions entry
                    if (field.type === 'select' && newType !== 'select') {
                      setRawOptions((prev) => {
                        const next = { ...prev };
                        delete next[field.id];
                        return next;
                      });
                    }
                    update(idx, { type: newType });
                  }}
                  className="shrink-0 rounded border border-border-color bg-bg-secondary px-1.5 py-1 text-xs text-text-primary"
                >
                  {FORM_FIELD_TYPES.map((ft) => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </select>
                <label className="flex shrink-0 items-center gap-1 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => update(idx, { required: e.target.checked })}
                    className="rounded"
                  />
                  Req
                </label>
                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="text-text-secondary disabled:opacity-30 hover:text-text-primary">↑</button>
                <button type="button" onClick={() => move(idx, 1)} disabled={idx === fields.length - 1} className="text-text-secondary disabled:opacity-30 hover:text-text-primary">↓</button>
                <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600">✕</button>
              </div>

              {field.type === 'select' && (
                <div className="space-y-1">
                  <input
                    type="text"
                    // Show the raw in-progress string while typing;
                    // fall back to the committed options when the field first appears.
                    value={rawOptions[field.id] ?? (field.options ?? []).join(', ')}
                    onChange={(e) =>
                      // Only update local raw state — do NOT split yet
                      setRawOptions((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    onBlur={(e) =>
                      // Parse & commit to parent only when user leaves the input
                      commitOptions(field.id, idx, e.target.value)
                    }
                    placeholder="Type options separated by commas, e.g.  New, Contacted, Won, Lost"
                    className="w-full rounded border border-border-color bg-bg-secondary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  {/* Live preview of parsed options */}
                  {(rawOptions[field.id] ?? (field.options ?? []).join(', ')) && (
                    <div className="flex flex-wrap gap-1">
                      {(rawOptions[field.id] ?? (field.options ?? []).join(', '))
                        .split(',')
                        .map((o) => o.trim())
                        .filter(Boolean)
                        .map((opt, i) => (
                          <span
                            key={i}
                            className="inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
                          >
                            {opt}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 pt-1">
        {FORM_FIELD_TYPES.map((ft) => (
          <button
            key={ft.value}
            type="button"
            onClick={() => add(ft.value)}
            className="inline-flex items-center gap-1 rounded-full border border-border-color bg-bg-primary px-2 py-0.5 text-xs text-text-secondary hover:border-accent hover:text-accent transition"
          >
            {ft.icon} {ft.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Template Editor Modal ───────────────────────────────────────────────────

// ─── Collapsible Section ─────────────────────────────────────────────────────
// Defined at module level — NOT inside any component — to keep a stable
// component identity across renders and prevent input focus loss.

function Section({
  id,
  label,
  badge,
  activeSection,
  setActiveSection,
  children,
}: {
  id: string;
  label: string;
  badge?: string | number;
  activeSection: string | null;
  setActiveSection: (v: string | null) => void;
  children: React.ReactNode;
}) {
  const isActive = activeSection === id;
  return (
    <div className="overflow-hidden rounded-xl border border-border-color">
      <button
        type="button"
        onClick={() => setActiveSection(isActive ? null : id)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-bg-secondary transition"
      >
        <span className="font-medium text-text-primary">{label}</span>
        <div className="flex items-center gap-2">
          {badge !== undefined && badge !== '' && (
            <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent">
              {badge}
            </span>
          )}
          <span className={`text-text-secondary transition-transform ${isActive ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </div>
      </button>
      {isActive && (
        <div className="border-t border-border-color px-4 py-4 space-y-3">{children}</div>
      )}
    </div>
  );
}

interface TemplateEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingTemplate: WorkTemplate | null;
  types: WorkType[];
  employees: Employee[];
  models: DynamicModel[];
}

function TemplateEditor({
  isOpen,
  onClose,
  onSaved,
  editingTemplate,
  types,
  employees,
  models,
}: TemplateEditorProps) {
  // Basic fields
  const [name, setName] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [categoryTypeId, setCategoryTypeId] = useState<number | null>(null);
  const [templateType, setTemplateType] = useState<TemplateTypeValue>('simple');
  const [defaultAssignedToId, setDefaultAssignedToId] = useState<number | null>(null);
  const [defaultDueDays, setDefaultDueDays] = useState('');
  const [defaultTitle, setDefaultTitle] = useState('');
  const [defaultNotes, setDefaultNotes] = useState('');

  // Checklist
  const [stepsSchema, setStepsSchema] = useState<StepRow[]>([]);
  const [perStepForms, setPerStepForms] = useState(false);
  const [expandedStepIdx, setExpandedStepIdx] = useState<number | null>(null);

  // Datasheet
  const [linkedModelId, setLinkedModelId] = useState<number | null>(null);
  const [datasheetUiSchema, setDatasheetUiSchema] = useState<DatasheetUiSchema>({});
  const [datasheetFields, setDatasheetFields] = useState<DynamicField[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Global form
  const [formSchema, setFormSchema] = useState<FormField[]>([]);

  // Execution rules
  const [autoCompleteOnFormSubmit, setAutoCompleteOnFormSubmit] = useState(false);

  // UI
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // ── Populate when editing ────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setActiveSection(null);

    if (editingTemplate) {
      setName(editingTemplate.name);
      const wt = types.find((t) => t.id === editingTemplate.work_type_id);
      setCategoryInput(wt?.name ?? '');
      setCategoryTypeId(editingTemplate.work_type_id);
      const tt = (editingTemplate.template_type ?? 'simple') as TemplateTypeValue;
      setTemplateType(tt);
      setDefaultAssignedToId(editingTemplate.default_assigned_to_id ?? null);
      setDefaultDueDays(editingTemplate.default_due_days != null ? String(editingTemplate.default_due_days) : '');
      setDefaultTitle(editingTemplate.default_title ?? '');
      setDefaultNotes(editingTemplate.default_notes ?? '');
      const steps = Array.isArray(editingTemplate.steps_schema)
        ? (editingTemplate.steps_schema as StepRow[]).map((s) => ({
            order: s.order ?? 0,
            label: s.label ?? '',
            form_schema: Array.isArray(s.form_schema) ? (s.form_schema as FormField[]) : [],
          }))
        : [];
      setStepsSchema(steps);
      setPerStepForms(steps.some((s) => s.form_schema && s.form_schema.length > 0));
      setExpandedStepIdx(null);
      setLinkedModelId(editingTemplate.linked_dynamic_model_id ?? null);
      setDatasheetUiSchema(editingTemplate.datasheet_ui_schema ?? {});
      setFormSchema(Array.isArray(editingTemplate.form_schema) ? (editingTemplate.form_schema as FormField[]) : []);
      setAutoCompleteOnFormSubmit(
        (editingTemplate.execution_rules as Record<string, unknown> | null)?.auto_complete_on_form_submit === true
      );
    } else {
      setName('');
      setCategoryInput('');
      setCategoryTypeId(null);
      setTemplateType('simple');
      setDefaultAssignedToId(null);
      setDefaultDueDays('');
      setDefaultTitle('');
      setDefaultNotes('');
      setStepsSchema([]);
      setPerStepForms(false);
      setExpandedStepIdx(null);
      setLinkedModelId(null);
      setDatasheetUiSchema({});
      setFormSchema([]);
      setAutoCompleteOnFormSubmit(false);
    }
  }, [isOpen, editingTemplate, types]);

  // Load datasheet fields
  useEffect(() => {
    if (templateType === 'datasheet' && linkedModelId != null) {
      listFields(linkedModelId).then(setDatasheetFields).catch(() => setDatasheetFields([]));
    } else {
      setDatasheetFields([]);
    }
  }, [templateType, linkedModelId]);

  // Load models when datasheet tab selected
  useEffect(() => {
    if (templateType !== 'datasheet') return;
    setModelsLoading(true);
    listModels().finally(() => setModelsLoading(false));
  }, [templateType]);

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!name.trim()) { setError('Template name is required.'); return; }
    if (!categoryInput.trim()) { setError('Category is required.'); return; }
    if (templateType === 'datasheet' && !linkedModelId) {
      setError('Please select a datasheet to link.'); return;
    }

    setSaving(true);
    setError(null);

    try {
      // Find or create the work type (category)
      let wtId = categoryTypeId;
      if (!wtId) {
        const existing = types.find(
          (t) => t.name.toLowerCase() === categoryInput.trim().toLowerCase(),
        );
        if (existing) {
          wtId = existing.id;
        } else {
          const created = await createWorkType({ name: categoryInput.trim() });
          wtId = created.id;
        }
      }

      const payload = {
        name: name.trim(),
        work_type_id: wtId,
        default_assigned_to_id: defaultAssignedToId,
        default_due_days: defaultDueDays ? Number(defaultDueDays) : null,
        default_title: defaultTitle.trim() || null,
        default_notes: defaultNotes.trim() || null,
        template_type: templateType,
        steps_schema:
          templateType === 'checklist'
            ? stepsSchema.map((s, i) => ({
                order: i,
                label: s.label,
                ...(perStepForms && s.form_schema && s.form_schema.length > 0
                  ? { form_schema: s.form_schema }
                  : {}),
              }))
            : null,
        linked_dynamic_model_id: templateType === 'datasheet' ? linkedModelId : null,
        datasheet_ui_schema: templateType === 'datasheet' ? datasheetUiSchema : null,
        form_schema:
          !perStepForms && formSchema.length > 0
            ? formSchema
            : null,
        execution_rules: autoCompleteOnFormSubmit
          ? { auto_complete_on_form_submit: true }
          : null,
      };

      if (editingTemplate) {
        await updateWorkTemplate(editingTemplate.id, payload);
      } else {
        await createWorkTemplate({ ...payload, is_active: true });
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // ── Step helpers ─────────────────────────────────────────────────────────

  const addStep = () => {
    const order = stepsSchema.length;
    setStepsSchema((prev) => [...prev, { order, label: '', form_schema: [] }]);
  };

  const updateStepLabel = (idx: number, label: string) => {
    setStepsSchema((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], label };
      return next;
    });
  };

  const removeStep = (idx: number) => {
    setStepsSchema((prev) => prev.filter((_, i) => i !== idx));
    if (expandedStepIdx === idx) setExpandedStepIdx(null);
  };

  const updateStepForm = (idx: number, fields: FormField[]) => {
    setStepsSchema((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], form_schema: fields };
      return next;
    });
  };

  // ── Datasheet helpers ────────────────────────────────────────────────────

  const toggleDisplayField = (name: string) => {
    const cur = datasheetUiSchema.display_fields ?? [];
    setDatasheetUiSchema((prev) => ({
      ...prev,
      display_fields: cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name],
    }));
  };

  const toggleEditableField = (name: string) => {
    const cur = datasheetUiSchema.editable_fields ?? [];
    setDatasheetUiSchema((prev) => ({
      ...prev,
      editable_fields: cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name],
    }));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col rounded-2xl border border-border-color bg-card-bg shadow-2xl"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-color px-5 py-4">
          <div>
            <h2 className="font-semibold text-text-primary">
              {editingTemplate ? `Edit: ${editingTemplate.name}` : 'New Template'}
            </h2>
            <p className="text-xs text-text-secondary">
              Templates define how work gets done. Assign them to employees in one click.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-secondary">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          {/* ── Core fields ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                Template name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Site Visit, Follow-up Call, Product Demo"
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                Category <span className="text-red-500">*</span>
              </label>
              <CategoryCombobox
                value={categoryInput}
                onChange={setCategoryInput}
                types={types}
                onTypeIdChange={setCategoryTypeId}
              />
              <p className="mt-1 text-xs text-text-secondary">
                Groups related templates (e.g. &ldquo;Field Work&rdquo;). Type to create new.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">Work type</label>
              <div className="flex rounded-lg border border-border-color overflow-hidden">
                {(['simple', 'checklist', 'datasheet', 'calling'] as TemplateTypeValue[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTemplateType(t);
                      if (t !== 'checklist') { setStepsSchema([]); setPerStepForms(false); }
                      if (t !== 'datasheet') { setLinkedModelId(null); setDatasheetUiSchema({}); }
                    }}
                    className={`flex-1 py-2 text-xs font-medium capitalize transition ${
                      templateType === t
                        ? 'bg-accent text-white'
                        : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'
                    }`}
                  >
                    {templateTypeIcon(t)} {t}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                {templateType === 'simple' && 'Form fields only — employee fills and submits.'}
                {templateType === 'checklist' && 'Step-by-step tasks the employee marks done.'}
                {templateType === 'datasheet' && 'Assigns rows from a data sheet to act on.'}
                {templateType === 'calling' && 'Assign leads to call — employee calls from mobile app.'}
              </p>
            </div>
          </div>

          {/* ── Checklist steps ── */}
          {templateType === 'checklist' && (
            <div className="rounded-xl border border-border-color p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Checklist Steps</p>
                  <p className="text-xs text-text-secondary">{stepsSchema.length} step{stepsSchema.length !== 1 ? 's' : ''} defined</p>
                </div>
                <button
                  type="button"
                  onClick={addStep}
                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-primary hover:border-accent"
                >
                  + Add step
                </button>
              </div>

              {/* Form mode toggle (when steps exist) */}
              {stepsSchema.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-bg-secondary px-3 py-2">
                  <span className="text-xs text-text-secondary">Step forms:</span>
                  <button
                    type="button"
                    onClick={() => { setPerStepForms(false); setExpandedStepIdx(null); }}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${!perStepForms ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    Global (shared)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerStepForms(true)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${perStepForms ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    Per-step (unique)
                  </button>
                </div>
              )}

              {/* Steps list */}
              <div className="space-y-2">
                {stepsSchema.map((step, idx) => (
                  <div key={idx} className="overflow-hidden rounded-lg border border-border-color bg-card-bg">
                    <div className="flex items-center gap-2 p-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-xs font-bold text-text-secondary">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={step.label}
                        onChange={(e) => updateStepLabel(idx, e.target.value)}
                        placeholder="Step description (e.g. Take site photo)"
                        className="min-w-0 flex-1 rounded-lg border border-border-color bg-bg-primary px-2.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                      />
                      {perStepForms && (
                        <button
                          type="button"
                          onClick={() => setExpandedStepIdx(expandedStepIdx === idx ? null : idx)}
                          className={`shrink-0 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                            expandedStepIdx === idx
                              ? 'border-accent bg-accent/10 text-accent'
                              : step.form_schema && step.form_schema.length > 0
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                              : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent'
                          }`}
                        >
                          {step.form_schema && step.form_schema.length > 0
                            ? `Form (${step.form_schema.length})`
                            : '+ Form'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        className="shrink-0 rounded border border-red-200 px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        ✕
                      </button>
                    </div>
                    {/* Per-step form builder */}
                    {perStepForms && expandedStepIdx === idx && (
                      <div className="border-t border-border-color bg-bg-secondary p-3">
                        <FormFieldBuilder
                          fields={step.form_schema ?? []}
                          onChange={(fields) => updateStepForm(idx, fields)}
                          title="Form fields for this step:"
                        />
                      </div>
                    )}
                  </div>
                ))}
                {stepsSchema.length === 0 && (
                  <button
                    type="button"
                    onClick={addStep}
                    className="w-full rounded-lg border border-dashed border-border-color px-4 py-6 text-center text-sm text-text-secondary hover:border-accent hover:text-accent transition"
                  >
                    + Add your first step
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Datasheet config ── */}
          {templateType === 'datasheet' && (
            <div className="rounded-xl border border-border-color p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">Linked Datasheet</p>
                <p className="text-xs text-text-secondary">Rows from this datasheet will be assigned to the employee</p>
              </div>
              <select
                value={linkedModelId ?? ''}
                onChange={(e) => setLinkedModelId(e.target.value ? Number(e.target.value) : null)}
                disabled={modelsLoading}
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary disabled:opacity-70 focus:border-accent focus:outline-none"
              >
                <option value="">
                  {modelsLoading ? 'Loading…' : models.length === 0 ? 'No datasheets found' : 'Select a datasheet'}
                </option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.display_name || m.name}</option>
                ))}
              </select>
              {models.length === 0 && !modelsLoading && (
                <p className="text-xs text-text-secondary">
                  Create a datasheet first under Data Sheets, then come back here.
                </p>
              )}
              {linkedModelId != null && datasheetFields.length > 0 && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">Display fields</label>
                    <div className="flex flex-wrap gap-1.5">
                      {datasheetFields.map((f) => {
                        const on = (datasheetUiSchema.display_fields ?? []).includes(f.name);
                        return (
                          <button key={f.id} type="button" onClick={() => toggleDisplayField(f.name)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? 'bg-accent text-white' : 'border border-border-color bg-bg-primary text-text-secondary hover:border-accent'}`}>
                            {f.display_name || f.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">Editable fields</label>
                    <div className="flex flex-wrap gap-1.5">
                      {datasheetFields.map((f) => {
                        const on = (datasheetUiSchema.editable_fields ?? []).includes(f.name);
                        return (
                          <button key={f.id} type="button" onClick={() => toggleEditableField(f.name)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? 'bg-accent text-white' : 'border border-border-color bg-bg-primary text-text-secondary hover:border-accent'}`}>
                            {f.display_name || f.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={datasheetUiSchema.auto_complete_work_when_all_done ?? false}
                      onChange={(e) =>
                        setDatasheetUiSchema((prev) => ({
                          ...prev,
                          auto_complete_work_when_all_done: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span className="text-text-primary text-sm">Auto-complete work when all rows are done</span>
                  </label>
                </>
              )}
            </div>
          )}

          {/* ── Collapsible sections ── */}

          {/* Form fields — available for all template types */}
          {!perStepForms && (
            <Section
              id="form"
              label={templateType === 'datasheet' ? '📝 Form fields' : '📝 Capture form fields'}
              badge={formSchema.length > 0 ? formSchema.length : undefined}
              activeSection={activeSection}
              setActiveSection={setActiveSection}
            >
              <p className="text-xs text-text-secondary">
                {templateType === 'datasheet'
                  ? 'Fields the employee fills when working on this datasheet.'
                  : 'Fields the employee fills when doing this work (photo, GPS, text, notes, etc.)'}
              </p>

              {/* Datasheet form mode toggle — only shown when there are fields */}
              {templateType === 'datasheet' && (
                <div className="rounded-lg border border-border-color bg-bg-secondary p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-text-secondary">How should this form be used?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDatasheetUiSchema((prev) => ({ ...prev, form_mode: 'per_record' }))
                      }
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        (datasheetUiSchema.form_mode ?? 'per_record') === 'per_record'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent/50'
                      }`}
                    >
                      <span className="block text-sm mb-0.5">📋 Per-record</span>
                      Employee fills the form for each row in the table. "Done" only allowed after form filled.
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDatasheetUiSchema((prev) => ({ ...prev, form_mode: 'single' }))
                      }
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        datasheetUiSchema.form_mode === 'single'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent/50'
                      }`}
                    >
                      <span className="block text-sm mb-0.5">📄 Single form</span>
                      One form for the whole work. Work can only be marked done after submitting.
                    </button>
                  </div>
                </div>
              )}

              <FormFieldBuilder fields={formSchema} onChange={setFormSchema} />

              {/* Auto-complete option — shown for simple and datasheet single-form (not per-record) */}
              {(templateType !== 'datasheet' || datasheetUiSchema.form_mode === 'single') && (
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border-color bg-bg-secondary px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={autoCompleteOnFormSubmit}
                    onChange={(e) => setAutoCompleteOnFormSubmit(e.target.checked)}
                    className="h-4 w-4 rounded accent-[var(--color-accent)]"
                  />
                  <div>
                    <span className="block text-sm font-medium text-text-primary">Auto-complete work when form is submitted</span>
                    <span className="text-xs text-text-secondary">Work status changes to Completed automatically after the employee submits the form</span>
                  </div>
                </label>
              )}
            </Section>
          )}

          {/* Defaults */}
          <Section
            id="defaults"
            label="⚙ Defaults & pre-fill"
            activeSection={activeSection}
            setActiveSection={setActiveSection}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Default assignee</label>
                <select
                  value={defaultAssignedToId ?? ''}
                  onChange={(e) => setDefaultAssignedToId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                >
                  <option value="">No default</option>
                  {employees.map((emp) => (
                    <option key={emp.user_id} value={emp.user_id}>
                      {emp.name || emp.email}{emp.id === 0 ? ' (Owner)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Default due (days from today)</label>
                <input
                  type="number"
                  min={0}
                  max={3650}
                  value={defaultDueDays}
                  onChange={(e) => setDefaultDueDays(e.target.value)}
                  placeholder="e.g. 2"
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Default title</label>
                <input
                  type="text"
                  value={defaultTitle}
                  onChange={(e) => setDefaultTitle(e.target.value)}
                  placeholder="Pre-filled title for work items"
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Default notes</label>
                <input
                  type="text"
                  value={defaultNotes}
                  onChange={(e) => setDefaultNotes(e.target.value)}
                  placeholder="Instructions pre-filled for the assignee"
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 gap-3 border-t border-border-color px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border-color py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : editingTemplate ? 'Save changes' : 'Create template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  canEdit,
  onEdit,
  onAssign,
  onDelete,
}: {
  template: WorkTemplate;
  canEdit: boolean;
  onEdit: () => void;
  onAssign: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const stepsCount = Array.isArray(template.steps_schema) ? template.steps_schema.length : 0;
  const formCount = Array.isArray(template.form_schema) ? template.form_schema.length : 0;
  const hasPerStepForms =
    Array.isArray(template.steps_schema) &&
    (template.steps_schema as StepRow[]).some((s) => s.form_schema && s.form_schema.length > 0);

  return (
    <div className="group relative flex flex-col rounded-xl border border-border-color bg-card-bg p-4 transition hover:border-accent hover:shadow-sm">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-lg">
            {templateTypeIcon(template.template_type)}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-text-primary text-sm">{template.name}</h3>
            <p className="truncate text-xs text-text-secondary">{template.work_type_name}</p>
          </div>
        </div>

        {/* ⋮ menu */}
        {canEdit && (
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-secondary opacity-0 group-hover:opacity-100 transition"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg border border-border-color bg-card-bg shadow-lg">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onEdit(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
                >
                  ✏ Edit
                </button>
                <div className="h-px bg-border-color" />
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  🗑 Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${templateTypeBadgeClass(template.template_type)}`}>
          {template.template_type ?? 'simple'}
        </span>
        {stepsCount > 0 && (
          <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary">
            {stepsCount} step{stepsCount !== 1 ? 's' : ''}
          </span>
        )}
        {hasPerStepForms && (
          <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary">
            per-step form
          </span>
        )}
        {!hasPerStepForms && formCount > 0 && (
          <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary">
            {formCount} field{formCount !== 1 ? 's' : ''}
          </span>
        )}
        {!template.is_active && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-300">
            Inactive
          </span>
        )}
      </div>

      {/* Meta info */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-secondary">
        {template.default_assigned_to_name && (
          <span>👤 {template.default_assigned_to_name}</span>
        )}
        {template.default_due_days != null && (
          <span>📅 +{template.default_due_days}d</span>
        )}
      </div>

      {/* Assign CTA */}
      <div className="mt-4 pt-3 border-t border-border-color">
        <button
          type="button"
          onClick={onAssign}
          className="w-full rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent/90 transition"
        >
          Assign Work →
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkTemplatesPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEdit = hasPermission('manage_work');

  const [templates, setTemplates] = useState<WorkTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [types, setTypes] = useState<WorkType[]>([]);
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Editor modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkTemplate | null>(null);

  // Assign modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignModalTemplateId, setAssignModalTemplateId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tData, eData, wtData, mData] = await Promise.all([
        listWorkTemplates(),
        listEmployees(),
        listWorkTypes(),
        listModels().catch(() => [] as DynamicModel[]),
      ]);
      setTemplates(tData);
      setEmployees(eData);
      setTypes(wtData);
      setModels(mData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (template: WorkTemplate) => {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    try {
      await deleteWorkTemplate(template.id);
      setNotice('Template deleted.');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete template');
    }
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const openEdit = (t: WorkTemplate) => {
    setEditingTemplate(t);
    setEditorOpen(true);
  };

  const openAssign = (t: WorkTemplate) => {
    setAssignModalTemplateId(t.id);
    setAssignModalOpen(true);
  };

  const filtered = templates.filter(
    (t) =>
      search === '' ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.work_type_name.toLowerCase().includes(search.toLowerCase()),
  );

  // Group by category (work_type_name)
  const categories = Array.from(new Set(filtered.map((t) => t.work_type_name))).sort();

  if (!canEdit) {
    return (
      <ModuleGuard module="lms">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="font-semibold text-text-primary">Permission required</p>
          <p className="mt-1 text-sm text-text-secondary">You need manage_work permission to view templates.</p>
          <Link href="/work" className="mt-4 text-sm font-medium text-accent hover:underline">← Back to Work</Link>
        </div>
      </ModuleGuard>
    );
  }

  return (
    <ModuleGuard module="lms">
      <TemplateEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setNotice(editingTemplate ? 'Template updated.' : 'Template created.');
          void load();
        }}
        editingTemplate={editingTemplate}
        types={types}
        employees={employees}
        models={models}
      />

      <AssignWorkModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        initialTemplateId={assignModalTemplateId}
      />

      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Work Templates</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Reusable blueprints — create once, assign in one click.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/work"
              className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
            >
              ← Work
            </Link>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
            >
              + New Template
            </button>
          </div>
        </div>

        {/* ── Alerts ── */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}
        {notice && !error && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            {notice}
          </div>
        )}

        {/* ── Search ── */}
        {templates.length > 0 && (
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="w-full max-w-sm rounded-lg border border-border-color bg-bg-primary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
            />
          </div>
        )}

        {/* ── Loading ── */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl border border-border-color bg-card-bg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-color bg-card-bg py-20 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-semibold text-text-primary">
              {templates.length === 0 ? 'No templates yet' : 'No templates match your search'}
            </p>
            <p className="mt-1 text-sm text-text-secondary max-w-xs">
              {templates.length === 0
                ? 'Create your first template to start assigning structured work to your team.'
                : 'Try a different search term.'}
            </p>
            {templates.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
              >
                + Create first template
              </button>
            )}
          </div>
        ) : (
          /* ── Template cards grouped by category ── */
          <div className="space-y-8">
            {categories.map((cat) => {
              const catTemplates = filtered.filter((t) => t.work_type_name === cat);
              return (
                <div key={cat}>
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                      {cat}
                    </h2>
                    <div className="flex-1 h-px bg-border-color" />
                    <span className="text-xs text-text-secondary">{catTemplates.length}</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {catTemplates.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        canEdit={canEdit}
                        onEdit={() => openEdit(t)}
                        onAssign={() => openAssign(t)}
                        onDelete={() => void handleDelete(t)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Work types admin note ── */}
        {templates.length > 0 && (
          <p className="text-center text-xs text-text-secondary">
            Categories are automatically managed.{' '}
            <span className="opacity-60">
              {types.length} categor{types.length !== 1 ? 'ies' : 'y'} · {templates.length} template{templates.length !== 1 ? 's' : ''}
            </span>
          </p>
        )}
      </div>
    </ModuleGuard>
  );
}
