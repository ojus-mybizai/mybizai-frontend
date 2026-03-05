'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { useAuthStore } from '@/lib/auth-store';
import {
  createWorkTemplate,
  listWorkTypes,
  listWorkTemplates,
  createWorkType,
  deleteWorkTemplate,
  updateWorkType,
  updateWorkTemplate,
  type WorkTemplate,
  type WorkType,
  type DatasheetUiSchema,
} from '@/services/work';
import { listEmployees, type Employee } from '@/services/employees';
import { listModels, listFields, type DynamicModel, type DynamicField } from '@/services/dynamic-data';
import { AssignWorkModal } from '@/components/work/assign-work-modal';
import { useRouter } from 'next/navigation';

type TemplateTypeValue = 'simple' | 'checklist' | 'datasheet';

interface StepRow {
  order: number;
  label: string;
}

interface RecordActionRow {
  type: string;
  label: string;
  field: string;
}

export default function WorkTemplatesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user as { businesses?: { role?: string }[] } | null);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEdit = hasPermission('manage_work');

  const [templates, setTemplates] = useState<WorkTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [types, setTypes] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateTypeId, setTemplateTypeId] = useState<number | null>(null);
  const [templateAssignedToId, setTemplateAssignedToId] = useState<number | null>(null);
  const [templateDueDays, setTemplateDueDays] = useState<string>('');
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateNotes, setTemplateNotes] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Interactive template: type and conditional fields
  const [templateType, setTemplateType] = useState<TemplateTypeValue>('simple');
  const [stepsSchema, setStepsSchema] = useState<StepRow[]>([]);
  const [linkedDynamicModelId, setLinkedDynamicModelId] = useState<number | null>(null);
  const [datasheetUiSchema, setDatasheetUiSchema] = useState<DatasheetUiSchema>({});
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [datasheetFields, setDatasheetFields] = useState<DynamicField[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignModalTemplateId, setAssignModalTemplateId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [typeData, templateData, employeeData, modelsData] = await Promise.all([
        listWorkTypes(),
        listWorkTemplates(),
        listEmployees(),
        listModels().catch(() => []),
      ]);
      setTypes(typeData);
      setTemplates(templateData);
      setEmployees(employeeData);
      setModels(modelsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load work types');
      setTemplates([]);
      setTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // When user selects Datasheet template type, load datasheet list dynamically so they can select one
  useEffect(() => {
    if (templateType !== 'datasheet') return;
    setModelsLoading(true);
    setError(null);
    listModels()
      .then((list) => {
        setModels(list);
      })
      .catch((e) => {
        setModels([]);
        setError(e instanceof Error ? e.message : 'Failed to load datasheets. You may need to create a datasheet first.');
      })
      .finally(() => setModelsLoading(false));
  }, [templateType]);

  useEffect(() => {
    if (templateType === 'datasheet' && linkedDynamicModelId != null) {
      listFields(linkedDynamicModelId)
        .then(setDatasheetFields)
        .catch(() => setDatasheetFields([]));
    } else {
      setDatasheetFields([]);
    }
  }, [templateType, linkedDynamicModelId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (t: WorkType) => {
    if (!canEdit) return;
    setEditingId(t.id);
    setEditName(t.name);
    setEditDescription(t.description || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    setSaving(true);
    try {
      await updateWorkType(editingId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      cancelEdit();
      setNotice('Work type updated.');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const addType = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createWorkType({
        name: newName.trim(),
        description: newDescription.trim() || null,
      });
      setNewName('');
      setNewDescription('');
      setShowAdd(false);
      setNotice('Work type created.');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create work type');
    } finally {
      setSaving(false);
    }
  };

  const resetTemplateForm = () => {
    setTemplateName('');
    setTemplateTypeId(null);
    setTemplateAssignedToId(null);
    setTemplateDueDays('');
    setTemplateTitle('');
    setTemplateNotes('');
    setEditingTemplateId(null);
    setTemplateType('simple');
    setStepsSchema([]);
    setLinkedDynamicModelId(null);
    setDatasheetUiSchema({});
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || templateTypeId == null) {
      setError('Template name and work type are required.');
      return;
    }
    if (templateType === 'datasheet' && linkedDynamicModelId == null) {
      setError('Please select a datasheet for datasheet-type templates.');
      return;
    }
    setSaving(true);
    setError(null);
    const basePayload = {
      name: templateName.trim(),
      work_type_id: templateTypeId,
      default_assigned_to_id: templateAssignedToId,
      default_due_days: templateDueDays ? Number(templateDueDays) : null,
      default_title: templateTitle.trim() || null,
      default_notes: templateNotes.trim() || null,
    };
    const templatePayload = {
      ...basePayload,
      template_type: templateType,
      steps_schema: templateType === 'checklist' ? stepsSchema.map((s, i) => ({ order: i, label: s.label })) : null,
      linked_dynamic_model_id: templateType === 'datasheet' ? linkedDynamicModelId : null,
      datasheet_ui_schema: templateType === 'datasheet' ? datasheetUiSchema : null,
    };
    try {
      if (editingTemplateId != null) {
        await updateWorkTemplate(editingTemplateId, {
          ...templatePayload,
          is_active: undefined,
        });
        setNotice('Template updated.');
      } else {
        await createWorkTemplate({
          ...templatePayload,
          is_active: true,
        });
        setNotice('Template created.');
      }
      resetTemplateForm();
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTemplate = (template: WorkTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateTypeId(template.work_type_id);
    setTemplateAssignedToId(template.default_assigned_to_id);
    setTemplateDueDays(template.default_due_days == null ? '' : String(template.default_due_days));
    setTemplateTitle(template.default_title || '');
    setTemplateNotes(template.default_notes || '');
    const tt = (template.template_type ?? 'simple') as TemplateTypeValue;
    setTemplateType(tt);
    const steps = template.steps_schema ?? [];
    setStepsSchema(Array.isArray(steps) ? steps.map((s: { order?: number; label?: string }) => ({ order: s.order ?? 0, label: s.label ?? '' })) : []);
    setLinkedDynamicModelId(template.linked_dynamic_model_id ?? null);
    setDatasheetUiSchema(template.datasheet_ui_schema ?? {});
  };

  const handleDeleteTemplate = async (template: WorkTemplate) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteWorkTemplate(template.id);
      setNotice('Template deleted.');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete template');
    } finally {
      setSaving(false);
    }
  };

  const openAssignModalForTemplate = (template: WorkTemplate) => {
    setAssignModalTemplateId(template.id);
    setAssignModalOpen(true);
  };

  const addStep = () => {
    const nextOrder = stepsSchema.length === 0 ? 0 : Math.max(...stepsSchema.map((s) => s.order)) + 1;
    setStepsSchema((prev) => [...prev, { order: nextOrder, label: '' }]);
  };

  const updateStep = (index: number, label: string) => {
    setStepsSchema((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], label };
      return next;
    });
  };

  const removeStep = (index: number) => {
    setStepsSchema((prev) => prev.filter((_, i) => i !== index));
  };

  const setDisplayFields = (fields: string[]) => {
    setDatasheetUiSchema((prev) => ({ ...prev, display_fields: fields }));
  };

  const setEditableFields = (fields: string[]) => {
    setDatasheetUiSchema((prev) => ({ ...prev, editable_fields: fields }));
  };

  const setRecordActions = (actions: RecordActionRow[]) => {
    setDatasheetUiSchema((prev) => ({ ...prev, record_actions: actions }));
  };

  const setAutoCompleteWhenAllDone = (value: boolean) => {
    setDatasheetUiSchema((prev) => ({ ...prev, auto_complete_work_when_all_done: value }));
  };

  if (!canEdit) {
    return (
      <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="w-full rounded-xl border border-border-color bg-card-bg p-4">
            <p className="text-base text-text-secondary">Only owner or manager can manage work types.</p>
            <Link href="/work" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
              Back to Work
            </Link>
          </div>
        </ModuleGuard>
      </ProtectedShell>
    );
  }

  return (
    <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="w-full space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Work types</h2>
                <p className="text-base text-text-secondary">
                  Define work types (e.g. Delivery, Calling) to use when assigning work.
                </p>
              </div>
              <Link
                href="/work"
                className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
              >
                Back to Work
              </Link>
            </div>

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

            <div className="rounded-xl border border-border-color bg-card-bg p-4">
              <h3 className="text-sm font-semibold text-text-primary">Work templates</h3>
              <p className="mt-1 text-sm text-text-secondary">Reusable assignment blueprints for repeated tasks.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name"
                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary"
                />
                <select
                  value={templateTypeId ?? ''}
                  onChange={(e) => setTemplateTypeId(e.target.value ? Number(e.target.value) : null)}
                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary"
                >
                  <option value="">Default work type</option>
                  {types.filter((t) => t.is_active).map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">Template type</label>
                  <select
                    value={templateType}
                    onChange={(e) => {
                      const v = e.target.value as TemplateTypeValue;
                      setTemplateType(v);
                      if (v !== 'checklist') setStepsSchema([]);
                      if (v !== 'datasheet') {
                        setLinkedDynamicModelId(null);
                        setDatasheetUiSchema({});
                      }
                    }}
                    className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary"
                  >
                    <option value="simple">Simple</option>
                    <option value="checklist">Checklist (steps)</option>
                    <option value="datasheet">Datasheet (records)</option>
                  </select>
                </div>
                {templateType === 'checklist' && (
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-text-secondary">Steps (order + label)</label>
                      <button type="button" onClick={addStep} className="rounded-lg border border-border-color bg-bg-primary px-2 py-1 text-xs font-semibold text-text-primary">Add step</button>
                    </div>
                    <div className="space-y-2">
                      {stepsSchema.map((step, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <span className="text-sm text-text-secondary w-8">{step.order}</span>
                          <input
                            type="text"
                            value={step.label}
                            onChange={(e) => updateStep(idx, e.target.value)}
                            placeholder="Step label"
                            className="flex-1 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                          />
                          <button type="button" onClick={() => removeStep(idx)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600">Remove</button>
                        </div>
                      ))}
                      {stepsSchema.length === 0 && (
                        <p className="text-sm text-text-secondary">No steps. Add steps for checklist-style work (e.g. Pick items, Confirm address, Mark delivered).</p>
                      )}
                    </div>
                  </div>
                )}
                {templateType === 'datasheet' && (
                  <div className="md:col-span-2 space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Link datasheet</label>
                      <select
                        value={linkedDynamicModelId ?? ''}
                        onChange={(e) => setLinkedDynamicModelId(e.target.value ? Number(e.target.value) : null)}
                        disabled={modelsLoading}
                        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {modelsLoading ? 'Loading datasheets…' : models.length === 0 ? 'No datasheets found' : 'Select a datasheet'}
                        </option>
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>{m.display_name || m.name}</option>
                        ))}
                      </select>
                      {!modelsLoading && models.length === 0 && (
                        <p className="mt-1 text-xs text-text-secondary">Create a datasheet first (Data sheet / Models) to link here.</p>
                      )}
                    </div>
                    {linkedDynamicModelId != null && datasheetFields.length > 0 && (
                      <>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-text-secondary">Display fields</label>
                          <div className="flex flex-wrap gap-2">
                            {datasheetFields.map((f) => {
                              const selected = (datasheetUiSchema.display_fields ?? []).includes(f.name);
                              return (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={() => setDisplayFields(selected ? (datasheetUiSchema.display_fields ?? []).filter((x) => x !== f.name) : [...(datasheetUiSchema.display_fields ?? []), f.name])}
                                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${selected ? 'bg-accent text-white' : 'border border-border-color bg-bg-primary text-text-secondary'}`}
                                >
                                  {f.display_name || f.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-text-secondary">Editable fields</label>
                          <div className="flex flex-wrap gap-2">
                            {datasheetFields.map((f) => {
                              const selected = (datasheetUiSchema.editable_fields ?? []).includes(f.name);
                              return (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={() => setEditableFields(selected ? (datasheetUiSchema.editable_fields ?? []).filter((x) => x !== f.name) : [...(datasheetUiSchema.editable_fields ?? []), f.name])}
                                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${selected ? 'bg-accent text-white' : 'border border-border-color bg-bg-primary text-text-secondary'}`}
                                >
                                  {f.display_name || f.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-text-secondary">Auto-complete work when all records done</label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={datasheetUiSchema.auto_complete_work_when_all_done ?? false}
                              onChange={(e) => setAutoCompleteWhenAllDone(e.target.checked)}
                              className="rounded border-border-color"
                            />
                            <span className="text-sm text-text-secondary">When all assigned records are marked done, set work to completed</span>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <select
                  value={templateAssignedToId ?? ''}
                  onChange={(e) => setTemplateAssignedToId(e.target.value ? Number(e.target.value) : null)}
                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary"
                >
                  <option value="">Default assignee (optional)</option>
                  {employees.map((emp) => (
                    <option key={emp.user_id} value={emp.user_id}>{emp.name || emp.email}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={templateDueDays}
                  onChange={(e) => setTemplateDueDays(e.target.value)}
                  placeholder="Default due offset (days)"
                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary"
                />
                <input
                  type="text"
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  placeholder="Default title (optional)"
                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary md:col-span-2"
                />
                <textarea
                  value={templateNotes}
                  onChange={(e) => setTemplateNotes(e.target.value)}
                  placeholder="Default notes (optional)"
                  rows={3}
                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary md:col-span-2"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveTemplate()}
                  disabled={saving}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {editingTemplateId != null ? 'Update template' : 'Create template'}
                </button>
                {editingTemplateId != null && (
                  <button
                    type="button"
                    onClick={resetTemplateForm}
                    className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border-color bg-card-bg">
              <div className="border-b border-border-color px-4 py-3 text-sm font-semibold text-text-secondary">Saved templates</div>
              <div className="divide-y divide-border-color">
                {templates.map((template) => (
                  <div key={template.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-text-primary">{template.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          (template.template_type ?? 'simple') === 'checklist' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                          (template.template_type ?? 'simple') === 'datasheet' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {(template.template_type ?? 'simple').charAt(0).toUpperCase() + (template.template_type ?? 'simple').slice(1)}
                        </span>
                      </div>
                      <div className="text-sm text-text-secondary">
                        {template.work_type_name}
                        {template.default_assigned_to_name ? ` · ${template.default_assigned_to_name}` : ''}
                        {template.default_due_days != null ? ` · +${template.default_due_days} days` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleEditTemplate(template)} className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-semibold text-text-primary">Edit</button>
                      <button type="button" onClick={() => openAssignModalForTemplate(template)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">Use template</button>
                      <button type="button" onClick={() => void handleDeleteTemplate(template)} className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-300">Delete</button>
                    </div>
                  </div>
                ))}
                {templates.length === 0 && !loading && (
                  <div className="px-4 py-8 text-center text-sm text-text-secondary">No templates yet.</div>
                )}
              </div>
            </div>

            {showAdd && (
              <div className="rounded-xl border border-border-color bg-card-bg p-4">
                <h3 className="mb-3 text-sm font-semibold text-text-primary">Add work type</h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name (e.g. Delivery, Calling)"
                    className="w-full max-w-md rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full max-w-md rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={addType}
                    disabled={!newName.trim() || saving}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAdd(false); setNewName(''); setNewDescription(''); }}
                    className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!showAdd && (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
              >
                Add work type
              </button>
            )}

            <AssignWorkModal
              isOpen={assignModalOpen}
              onClose={() => { setAssignModalOpen(false); setAssignModalTemplateId(null); }}
              onCreated={(workId) => { setAssignModalOpen(false); setAssignModalTemplateId(null); setNotice('Work created from template.'); router.push(`/work/${workId}`); }}
              initialTemplateId={assignModalTemplateId}
            />

            {loading && <div className="text-base text-text-secondary">Loading…</div>}

            {!loading && (
              <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg">
                <table className="min-w-full divide-y divide-border-color">
                  <thead className="bg-bg-secondary">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Name</th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Description</th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Status</th>
                      <th className="px-4 py-2.5 text-right text-sm font-semibold text-text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    {types.map((t) => (
                      <tr key={t.id} className="hover:bg-bg-secondary/60">
                        {editingId === t.id ? (
                          <>
                            <td className="px-4 py-2.5" colSpan={2}>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                              />
                              <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                rows={2}
                                className="mt-2 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                              />
                            </td>
                            <td className="px-4 py-2.5" />
                            <td className="px-4 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={saveEdit}
                                disabled={!editName.trim() || saving}
                                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="ml-2 rounded-lg border border-border-color px-3 py-1.5 text-sm font-semibold text-text-primary"
                              >
                                Cancel
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2.5 text-base font-medium text-text-primary">{t.name}</td>
                            <td className="px-4 py-2.5 text-sm text-text-secondary">{t.description || '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${t.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-600'}`}>
                                {t.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => startEdit(t)}
                                className="text-sm font-semibold text-accent hover:underline"
                              >
                                Edit
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {types.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-text-secondary">
                    No work types yet. Add one above to use when assigning work.
                  </div>
                )}
              </div>
            )}
          </div>
        </ModuleGuard>
    </ProtectedShell>
  );
}
