'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import {
  createWork,
  createWorkFromTemplate,
  listWorkTemplates,
  listWorkTypes,
  type WorkTemplate,
  type WorkType,
} from '@/services/work';
import { listEmployees, type Employee } from '@/services/employees';
import { listLeadsForSelect, type LeadOption } from '@/services/customers';
import { listFields, type DynamicField } from '@/services/dynamic-data';
import type { RecordFilterRow } from '@/services/work';

export interface AssignWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (workId: number) => void;
  initialLeadId?: number | null;
  initialTemplateId?: number | null;
}

type ModalStep = 'pick' | 'details';

function templateTypeIcon(type?: string | null): string {
  if (type === 'checklist') return '☑';
  if (type === 'datasheet') return '📊';
  if (type === 'calling') return '📞';
  return '📋';
}

function templateTypeBadge(type?: string | null): string {
  if (type === 'checklist') return 'Checklist';
  if (type === 'datasheet') return 'Datasheet';
  if (type === 'calling') return 'Calling';
  return 'Simple';
}

function templateTypeBadgeClass(type?: string | null): string {
  if (type === 'checklist') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  if (type === 'datasheet') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
  if (type === 'calling') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  return 'bg-bg-secondary text-text-secondary';
}

export function AssignWorkModal({
  isOpen,
  onClose,
  onCreated,
  initialLeadId = null,
  initialTemplateId = null,
}: AssignWorkModalProps) {
  const router = useRouter();
  const currentUserId = useAuthStore((s) => (s.user as { id?: number } | null)?.id ?? null);

  // Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [templates, setTemplates] = useState<WorkTemplate[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [datasheetFields, setDatasheetFields] = useState<DynamicField[]>([]);

  // Navigation
  const [step, setStep] = useState<ModalStep>('pick');
  const [noTemplateMode, setNoTemplateMode] = useState(false);
  const [search, setSearch] = useState('');

  // Selected template
  const [selectedTemplate, setSelectedTemplate] = useState<WorkTemplate | null>(null);

  // Form fields
  const [assignedToId, setAssignedToId] = useState<number | null>(null);
  const [workTypeId, setWorkTypeId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [leadId, setLeadId] = useState<number | null>(null);
  const [leadQuery, setLeadQuery] = useState('');
  const [recordLimit, setRecordLimit] = useState('');
  const [filterRows, setFilterRows] = useState<RecordFilterRow[]>([]);

  // UI state
  const [showCustomer, setShowCustomer] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevLinkedModelId = useRef<number | null>(null);
  const didPickFromInitial = useRef(false);

  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [callingLeadQuery, setCallingLeadQuery] = useState('');
  const [datasheetMode, setDatasheetMode] = useState<'existing' | 'create'>('existing');
  const [createRecordCount, setCreateRecordCount] = useState('');

  const isDatasheet = selectedTemplate?.template_type === 'datasheet';
  const isCalling = selectedTemplate?.template_type === 'calling';
  const linkedModelId = selectedTemplate?.linked_dynamic_model_id ?? null;

  // ── Load data on open ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    didPickFromInitial.current = false;

    Promise.all([
      listEmployees().catch(() => [] as Employee[]),
      listWorkTemplates().catch(() => [] as WorkTemplate[]),
      listWorkTypes().catch(() => [] as WorkType[]),
      listLeadsForSelect({ per_page: 200 }).catch(() => [] as LeadOption[]),
    ]).then(([emps, tpls, wts, lds]) => {
      setEmployees(emps.filter((e) => e.id === 0 || e.is_active));
      setTemplates(tpls);
      setWorkTypes(wts);
      setLeads(lds);

      // Auto-pick initialTemplateId after templates load
      if (initialTemplateId != null && !didPickFromInitial.current) {
        const t = tpls.find((x) => x.id === initialTemplateId);
        if (t) {
          didPickFromInitial.current = true;
          applyTemplate(t);
        }
      }
    });

    // Reset all
    setStep(initialTemplateId != null ? 'details' : 'pick');
    setNoTemplateMode(false);
    setSearch('');
    setSelectedTemplate(null);
    setAssignedToId(null);
    setWorkTypeId(null);
    setTitle('');
    setNotes('');
    setPriority('medium');
    setDueDate('');
    setLeadId(initialLeadId);
    setLeadQuery('');
    setRecordLimit('');
    setFilterRows([]);
    setShowCustomer(!!initialLeadId);
    setShowNotes(false);
    setSelectedLeadIds([]);
    setCallingLeadQuery('');
    setDatasheetMode('existing');
    setCreateRecordCount('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load datasheet fields when datasheet template selected
  useEffect(() => {
    if (!isDatasheet || linkedModelId == null) {
      setDatasheetFields([]);
      prevLinkedModelId.current = null;
      return;
    }
    if (prevLinkedModelId.current !== linkedModelId) {
      setFilterRows([]);
      prevLinkedModelId.current = linkedModelId;
    }
    setFieldsLoading(true);
    listFields(linkedModelId)
      .then(setDatasheetFields)
      .catch(() => setDatasheetFields([]))
      .finally(() => setFieldsLoading(false));
  }, [isDatasheet, linkedModelId]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const applyTemplate = (t: WorkTemplate) => {
    setSelectedTemplate(t);
    setWorkTypeId(t.work_type_id);
    setAssignedToId(t.default_assigned_to_id ?? null);
    setTitle(t.default_title ?? '');
    setNotes(t.default_notes ?? '');
    if (t.default_due_days != null) {
      const d = new Date();
      d.setDate(d.getDate() + t.default_due_days);
      setDueDate(d.toISOString().slice(0, 10));
    }
  };

  const pickTemplate = (t: WorkTemplate) => {
    applyTemplate(t);
    setStep('details');
  };

  const applyDue = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().slice(0, 10));
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.is_active &&
      (search === '' ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.work_type_name.toLowerCase().includes(search.toLowerCase())),
  );

  const filteredLeads = leads.filter((l) => {
    const q = leadQuery.trim().toLowerCase();
    if (!q) return true;
    return `${l.name ?? ''} ${l.phone ?? ''} ${l.id}`.toLowerCase().includes(q);
  });

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!noTemplateMode) {
      if (!selectedTemplate) { setError('Please select a template.'); return; }
      if (!assignedToId) { setError('Please select who to assign this work to.'); return; }
      if (isCalling && selectedLeadIds.length === 0) { setError('Please select at least one lead to call.'); return; }
    } else {
      if (!workTypeId) { setError('Please select a work type.'); return; }
      if (!assignedToId) { setError('Please select an employee.'); return; }
    }

    setLoading(true);
    try {
      let created;
      if (!noTemplateMode && selectedTemplate) {
        const payload: Parameters<typeof createWorkFromTemplate>[1] = {
          assigned_to_id: assignedToId!,
          work_type_id: workTypeId ?? undefined,
          lead_id: leadId || undefined,
          title: title.trim() || undefined,
          notes: notes.trim() || undefined,
          priority,
          due_date: dueDate || undefined,
        };
        if (isCalling) {
          payload.lead_ids = selectedLeadIds;
        }
        if (isDatasheet) {
          if (datasheetMode === 'create') {
            const n = parseInt(createRecordCount, 10);
            if (!Number.isNaN(n) && n >= 1) {
              payload.create_record_count = n;
            } else {
              setError('Please enter a valid number of records to create.');
              setLoading(false);
              return;
            }
          } else {
            if (recordLimit.trim()) {
              const n = parseInt(recordLimit, 10);
              if (!Number.isNaN(n) && n >= 1 && n <= 500) payload.record_limit = n;
            }
            const filters = filterRows.filter(
              (r) =>
                r.field &&
                (r.value !== undefined && r.value !== '' || ['is_null', 'is_not_null'].includes(r.op ?? 'eq')),
            );
            if (filters.length > 0) {
              payload.record_filters = filters.map((r) => {
                const op = r.op ?? 'eq';
                let value = r.value;
                if (op === 'in' && typeof value === 'string') {
                  value = value.split(',').map((s) => s.trim()).filter(Boolean);
                }
                return { field: r.field, op, value };
              });
            }
          }
        }
        created = await createWorkFromTemplate(selectedTemplate.id, payload);
      } else {
        created = await createWork({
          work_type_id: workTypeId!,
          assigned_to_id: assignedToId!,
          lead_id: leadId || undefined,
          title: title.trim() || undefined,
          notes: notes.trim() || undefined,
          priority,
          due_date: dueDate || undefined,
        });
      }
      onClose();
      onCreated?.(created.id);
      router.push(`/workstation?work=${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign work');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-[560px] flex-col rounded-2xl border border-border-color bg-card-bg shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            {step === 'details' && !noTemplateMode && (
              <button
                type="button"
                onClick={() => { setStep('pick'); setSelectedTemplate(null); }}
                className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-secondary"
                aria-label="Back"
              >
                ←
              </button>
            )}
            <div>
              <h2 className="font-semibold text-text-primary">
                {step === 'pick' && !noTemplateMode ? 'Choose a template' : 'Assign work'}
              </h2>
              <p className="text-xs text-text-secondary">
                {step === 'pick' && !noTemplateMode
                  ? `${filteredTemplates.length} template${filteredTemplates.length !== 1 ? 's' : ''} available`
                  : selectedTemplate
                  ? `Template: ${selectedTemplate.name}`
                  : 'Manual assignment'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-secondary"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* ── Step 1: Template picker ── */}
        {step === 'pick' && !noTemplateMode && (
          <div className="flex flex-col overflow-hidden min-h-0 flex-1">
            <div className="shrink-0 border-b border-border-color px-4 pt-3 pb-3">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-sm">
                  🔍
                </span>
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates…"
                  className="w-full rounded-lg border border-border-color bg-bg-primary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredTemplates.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-sm font-medium text-text-primary">No templates found</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {templates.length === 0
                      ? 'Go to Work › Templates to create your first template.'
                      : 'Try a different search.'}
                  </p>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {filteredTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pickTemplate(t)}
                      className="group flex items-start gap-3 rounded-xl border border-border-color bg-bg-primary p-3 text-left transition hover:border-accent hover:shadow-sm"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-xl">
                        {templateTypeIcon(t.template_type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-text-primary group-hover:text-accent text-sm">
                          {t.name}
                        </p>
                        <p className="truncate text-xs text-text-secondary">{t.work_type_name}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <span className={`rounded-full px-1.5 py-0.5 text-xs ${templateTypeBadgeClass(t.template_type)}`}>
                            {templateTypeBadge(t.template_type)}
                          </span>
                          {t.default_assigned_to_name && (
                            <span className="max-w-[80px] truncate rounded-full bg-bg-secondary px-1.5 py-0.5 text-xs text-text-secondary">
                              {t.default_assigned_to_name}
                            </span>
                          )}
                          {t.default_due_days != null && (
                            <span className="rounded-full bg-bg-secondary px-1.5 py-0.5 text-xs text-text-secondary">
                              +{t.default_due_days}d
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 self-center text-text-secondary group-hover:text-accent">›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* No-template escape hatch */}
            <div className="shrink-0 border-t border-border-color px-4 py-3 text-center">
              <button
                type="button"
                onClick={() => setNoTemplateMode(true)}
                className="text-xs text-text-secondary hover:text-text-primary hover:underline"
              >
                Assign without a template (advanced)
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Details form ── */}
        {(step === 'details' || noTemplateMode) && (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {error}
                </div>
              )}

              {/* No-template mode: work type selector */}
              {noTemplateMode && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:bg-amber-900/20 dark:border-amber-700">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      Manual assignment — no template
                    </span>
                    <button
                      type="button"
                      onClick={() => setNoTemplateMode(false)}
                      className="ml-auto text-xs text-accent hover:underline"
                    >
                      ← Use template instead
                    </button>
                  </div>
                  <select
                    value={workTypeId ?? ''}
                    onChange={(e) => setWorkTypeId(e.target.value === '' ? null : Number(e.target.value))}
                    required
                    className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                  >
                    <option value="">Select work type *</option>
                    {workTypes.filter((t) => t.is_active).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Assign to */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Assign to <span className="text-red-500">*</span>
                </label>
                <select
                  value={assignedToId ?? ''}
                  onChange={(e) =>
                    setAssignedToId(e.target.value === '' ? null : Number(e.target.value))
                  }
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.user_id} value={emp.user_id}>
                      {emp.name || emp.email}
                      {emp.id === 0 ? ' (Owner)' : ''}
                    </option>
                  ))}
                </select>
                {currentUserId != null && (
                  <button
                    type="button"
                    onClick={() => setAssignedToId(currentUserId)}
                    className="mt-1.5 text-xs font-medium text-accent hover:underline"
                  >
                    Assign to me
                  </button>
                )}
              </div>

              {/* Title */}
              {noTemplateMode ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      selectedTemplate?.default_title ?? 'Give this work a title (optional)'
                    }
                    className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
                  />
                </div>
              ) : (
                <p className="text-xs text-text-secondary italic">
                  Title auto-generated from template name
                </p>
              )}

              {/* Due date */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Due date
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex overflow-hidden rounded-lg border border-border-color">
                    {[
                      { label: 'Today', days: 0 },
                      { label: 'Tomorrow', days: 1 },
                      { label: '+3d', days: 3 },
                      { label: '+1w', days: 7 },
                    ].map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => applyDue(chip.days)}
                        className="border-r border-border-color px-2.5 py-1.5 text-xs text-text-secondary last:border-r-0 hover:bg-bg-secondary hover:text-text-primary transition"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                  />
                  {dueDate && (
                    <button
                      type="button"
                      onClick={() => setDueDate('')}
                      className="text-xs text-text-secondary hover:text-text-primary"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Priority
                </label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                        priority === p
                          ? p === 'high'
                            ? 'border-red-500 bg-red-500 text-white'
                            : p === 'low'
                            ? 'border-blue-400 bg-blue-400 text-white'
                            : 'border-accent bg-accent text-white'
                          : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent hover:text-text-primary'
                      }`}
                    >
                      {p === 'high' ? '↑ High' : p === 'low' ? '↓ Low' : '● Medium'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Datasheet mode & filters — visible when datasheet template */}
              {isDatasheet && (
                <div className="space-y-3 rounded-xl border border-border-color bg-bg-primary p-4">
                  {/* Assignment mode toggle */}
                  <div>
                    <p className="text-sm font-medium text-text-primary mb-2">Assignment mode</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDatasheetMode('existing')}
                        className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                          datasheetMode === 'existing'
                            ? 'border-accent bg-accent text-white'
                            : 'border-border-color bg-bg-secondary text-text-secondary hover:border-accent hover:text-text-primary'
                        }`}
                      >
                        Assign existing records
                      </button>
                      <button
                        type="button"
                        onClick={() => setDatasheetMode('create')}
                        className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                          datasheetMode === 'create'
                            ? 'border-accent bg-accent text-white'
                            : 'border-border-color bg-bg-secondary text-text-secondary hover:border-accent hover:text-text-primary'
                        }`}
                      >
                        Create new records
                      </button>
                    </div>
                  </div>

                  {datasheetMode === 'create' ? (
                    /* Create new records mode */
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Number of records to create <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={createRecordCount}
                        onChange={(e) => setCreateRecordCount(e.target.value)}
                        placeholder="e.g. 10"
                        className="w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                      />
                      <p className="mt-1.5 text-xs text-text-secondary">
                        The employee will create records in the datasheet as part of this work.
                      </p>
                    </div>
                  ) : (
                    /* Assign existing records mode */
                    <>
                      <div>
                        <p className="text-sm font-medium text-text-primary">Record filters</p>
                        <p className="text-xs text-text-secondary">
                          Only assign rows matching these conditions
                        </p>
                      </div>
                      {fieldsLoading ? (
                        <p className="text-xs text-text-secondary">Loading fields…</p>
                      ) : (
                        <div className="space-y-2">
                          {filterRows.map((row, idx) => (
                            <div key={idx} className="flex flex-wrap items-center gap-2">
                              <select
                                value={row.field}
                                onChange={(e) => {
                                  const n = [...filterRows];
                                  n[idx] = { ...n[idx], field: e.target.value };
                                  setFilterRows(n);
                                }}
                                className="min-w-[100px] flex-1 rounded-lg border border-border-color bg-bg-secondary px-2 py-1.5 text-xs text-text-primary"
                              >
                                <option value="">Field</option>
                                {datasheetFields.map((f) => (
                                  <option key={f.id} value={f.name}>
                                    {f.display_name || f.name}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={row.op ?? 'eq'}
                                onChange={(e) => {
                                  const n = [...filterRows];
                                  n[idx] = { ...n[idx], op: e.target.value };
                                  setFilterRows(n);
                                }}
                                className="rounded-lg border border-border-color bg-bg-secondary px-2 py-1.5 text-xs text-text-primary"
                              >
                                <option value="eq">equals</option>
                                <option value="ne">not equals</option>
                                <option value="contains">contains</option>
                                <option value="in">in (comma-sep)</option>
                                <option value="is_null">is empty</option>
                                <option value="is_not_null">has value</option>
                              </select>
                              {row.op !== 'is_null' && row.op !== 'is_not_null' && (
                                <input
                                  type="text"
                                  value={row.value != null ? String(row.value) : ''}
                                  onChange={(e) => {
                                    const n = [...filterRows];
                                    n[idx] = { ...n[idx], value: e.target.value };
                                    setFilterRows(n);
                                  }}
                                  placeholder="Value"
                                  className="min-w-[80px] flex-1 rounded-lg border border-border-color bg-bg-secondary px-2 py-1.5 text-xs text-text-primary"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setFilterRows((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="text-text-secondary hover:text-red-500"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setFilterRows((prev) => [...prev, { field: '', op: 'eq', value: '' }])
                            }
                            className="text-xs text-accent hover:underline"
                          >
                            + Add filter
                          </button>
                        </div>
                      )}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-text-secondary">
                          Record limit (optional)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={recordLimit}
                          onChange={(e) => setRecordLimit(e.target.value)}
                          placeholder="e.g. 20 — blank = all matching"
                          className="w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Calling: Lead multi-selector */}
              {isCalling && (
                <div className="space-y-3 rounded-xl border border-border-color bg-bg-primary p-4">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      Leads to call <span className="text-red-500">*</span>
                    </p>
                    <p className="text-xs text-text-secondary">
                      Select leads to assign for calling ({selectedLeadIds.length} selected)
                    </p>
                  </div>
                  <input
                    type="text"
                    value={callingLeadQuery}
                    onChange={(e) => setCallingLeadQuery(e.target.value)}
                    placeholder="Search by name or phone..."
                    className="w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
                  />
                  {selectedLeadIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLeadIds.map((lid) => {
                        const lead = leads.find((l) => l.id === lid);
                        return (
                          <span
                            key={lid}
                            className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent"
                          >
                            {lead?.name || lead?.phone || `#${lid}`}
                            <button
                              type="button"
                              onClick={() => setSelectedLeadIds((prev) => prev.filter((id) => id !== lid))}
                              className="ml-0.5 hover:text-red-500"
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="max-h-[200px] overflow-y-auto space-y-1 rounded-lg border border-border-color bg-bg-secondary p-2">
                    {leads
                      .filter((l) => {
                        const q = callingLeadQuery.trim().toLowerCase();
                        if (!q) return true;
                        return `${l.name ?? ''} ${l.phone ?? ''} ${l.id}`.toLowerCase().includes(q);
                      })
                      .map((l) => {
                        const isSelected = selectedLeadIds.includes(l.id);
                        return (
                          <label
                            key={l.id}
                            className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                              isSelected
                                ? 'bg-accent/10 text-accent'
                                : 'text-text-primary hover:bg-bg-primary'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedLeadIds((prev) =>
                                  isSelected
                                    ? prev.filter((id) => id !== l.id)
                                    : [...prev, l.id]
                                );
                              }}
                              className="rounded border-border-color text-accent focus:ring-accent"
                            />
                            <span className="flex-1 truncate font-medium">
                              {l.name || l.phone || `Lead #${l.id}`}
                            </span>
                            {l.phone && (
                              <span className="text-xs text-text-secondary">{l.phone}</span>
                            )}
                          </label>
                        );
                      })}
                    {leads.filter((l) => {
                      const q = callingLeadQuery.trim().toLowerCase();
                      if (!q) return true;
                      return `${l.name ?? ''} ${l.phone ?? ''} ${l.id}`.toLowerCase().includes(q);
                    }).length === 0 && (
                      <p className="py-4 text-center text-xs text-text-secondary">No leads found</p>
                    )}
                  </div>
                  {leads.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedLeadIds(leads.filter((l) => l.phone).map((l) => l.id))}
                        className="text-xs text-accent hover:underline"
                      >
                        Select all with phone
                      </button>
                      {selectedLeadIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedLeadIds([])}
                          className="text-xs text-text-secondary hover:underline"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Collapsible: Link customer ── */}
              <div className="overflow-hidden rounded-xl border border-border-color">
                <button
                  type="button"
                  onClick={() => setShowCustomer((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-bg-secondary transition"
                >
                  <span className="font-medium text-text-primary">
                    {leadId ? '👤 Customer linked' : '👤 Link to customer'}
                  </span>
                  <span
                    className={`text-text-secondary transition-transform ${showCustomer ? 'rotate-180' : ''}`}
                  >
                    ▾
                  </span>
                </button>
                {showCustomer && (
                  <div className="space-y-2 border-t border-border-color px-4 py-3">
                    <input
                      type="text"
                      value={leadQuery}
                      onChange={(e) => setLeadQuery(e.target.value)}
                      placeholder="Search by name or phone…"
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                    />
                    <select
                      value={leadId ?? ''}
                      onChange={(e) =>
                        setLeadId(e.target.value === '' ? null : Number(e.target.value))
                      }
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                    >
                      <option value="">No customer</option>
                      {filteredLeads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name || l.phone || `Lead #${l.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* ── Collapsible: Notes ── */}
              <div className="overflow-hidden rounded-xl border border-border-color">
                <button
                  type="button"
                  onClick={() => setShowNotes((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-bg-secondary transition"
                >
                  <span className="font-medium text-text-primary">
                    {notes ? '📝 Notes added' : '📝 Add notes / instructions'}
                  </span>
                  <span
                    className={`text-text-secondary transition-transform ${showNotes ? 'rotate-180' : ''}`}
                  >
                    ▾
                  </span>
                </button>
                {showNotes && (
                  <div className="border-t border-border-color px-4 py-3">
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Instructions or context for the assignee…"
                      className="w-full resize-none rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex shrink-0 gap-3 border-t border-border-color px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-border-color py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
              >
                {loading ? 'Creating…' : 'Assign Work →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
