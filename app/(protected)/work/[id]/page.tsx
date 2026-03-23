'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ModuleGuard from '@/components/module-guard';
import { useAuthStore } from '@/lib/auth-store';
import { listEmployees } from '@/services/employees';
import { listLeadsForSelect, type LeadOption } from '@/services/customers';
import {
  getWork, updateWork, startWork, getWorkTemplate, submitWorkForm,
  getAssignedLeads, updateLeadAssignmentStatus,
  type Work, type WorkUpdate, type DatasheetUiSchema, type FormField,
  type WorkLeadAssignment,
} from '@/services/work';
import { WorkDetailHeader } from '@/components/work/work-detail-header';
import WorkDetailChecklist from '@/components/work/work-detail-checklist';
import WorkDetailDatasheet from '@/components/work/work-detail-datasheet';
import { DynamicWorkForm } from '@/components/work/dynamic-work-form';

const STATUS_OPTS = [
  { value: 'pending', label: 'Pending', cls: 'bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-900/40 dark:text-amber-300' },
  { value: 'in_progress', label: 'In progress', cls: 'bg-blue-100 text-blue-800 border-blue-400 dark:bg-blue-900/40 dark:text-blue-300' },
  { value: 'completed', label: 'Completed', cls: 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { value: 'cancelled', label: 'Cancelled', cls: 'bg-gray-100 text-gray-600 border-gray-400 dark:bg-gray-700 dark:text-gray-300' },
] as const;

const PRIORITY_OPTS = [
  { value: 'low', label: 'Low', cls: 'bg-slate-100 text-slate-700 border-slate-400 dark:bg-slate-700 dark:text-slate-300' },
  { value: 'medium', label: 'Medium', cls: 'bg-blue-50 text-blue-700 border-blue-400 dark:bg-blue-900/20 dark:text-blue-300' },
  { value: 'high', label: 'High', cls: 'bg-red-100 text-red-800 border-red-400 dark:bg-red-900/40 dark:text-red-300' },
] as const;

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Read-only view of a submitted form — shown after work form is submitted */
function FormDataReadOnly({ formData, fields, onEdit }: {
  formData: Record<string, unknown>;
  fields: FormField[];
  onEdit?: () => void;
}) {
  const filled = fields.filter((f) => formData[f.id] !== '' && formData[f.id] != null);
  if (filled.length === 0) {
    return (
      <p className="text-sm text-text-secondary">No data submitted yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {filled.map((f) => {
        const val = formData[f.id];
        return (
          <div key={f.id} className="grid grid-cols-[160px_1fr] gap-3 text-sm">
            <span className="font-medium text-text-secondary truncate">{f.label}</span>
            <span className="text-text-primary break-words">
              {f.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={String(val)}
                  alt={f.label}
                  className="max-h-40 rounded-lg border border-border-color object-contain"
                />
              ) : f.type === 'location' ? (
                <a
                  href={`https://www.google.com/maps?q=${encodeURIComponent(String(val))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {String(val)} ↗
                </a>
              ) : (
                String(val)
              )}
            </span>
          </div>
        );
      })}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="mt-2 text-xs font-medium text-accent hover:underline"
        >
          Edit submission →
        </button>
      )}
    </div>
  );
}

/** Smart back button — goes to the previous page in browser history.
 *  Falls back to /work list if there's no history (e.g. direct URL open). */
function BackNav() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        // If we have a real history entry, go back; otherwise fall back to work list.
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push('/work');
        }
      }}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-accent hover:underline"
    >
      <span aria-hidden>←</span>
      Back
    </button>
  );
}

export default function WorkDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const user = useAuthStore((s) => s.user as { id?: number } | null);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEditAll = hasPermission('manage_work') || hasPermission('assign_work');

  const [work, setWork] = useState<Work | null>(null);
  const [datasheetUiSchema, setDatasheetUiSchema] = useState<DatasheetUiSchema | null>(null);
  const [formSchema, setFormSchema] = useState<FormField[] | null>(null);
  const [templateStepsSchema, setTemplateStepsSchema] = useState<Array<{ order: number; label: string; form_schema?: FormField[] }> | null>(null);
  const [executionRules, setExecutionRules] = useState<Record<string, unknown> | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [employees, setEmployees] = useState<Array<{ user_id: number; name: string }>>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Edit state — mirrors work fields
  const [editTitle, setEditTitle] = useState('');
  const [editStatus, setEditStatus] = useState<string>('pending');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editAssignedToId, setEditAssignedToId] = useState<number | null>(null);
  const [editLeadId, setEditLeadId] = useState<number | null>(null);

  // Whether the work form (DynamicWorkForm) is in edit mode vs read-only view
  const [formEditMode, setFormEditMode] = useState(false);

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };

  const canEditAnyField = canEditAll || (work?.assigned_to_id === user?.id);
  const canEditRestricted = canEditAll;
  const isCompleted = work?.status === 'completed';
  const formDisabled = isCompleted && !canEditRestricted;

  const isDirty = work
    ? editTitle !== (work.title || '') ||
      editStatus !== work.status ||
      editPriority !== work.priority ||
      editDueDate !== (work.due_date || '') ||
      editNotes !== (work.notes || '') ||
      editAssignedToId !== work.assigned_to_id ||
      editLeadId !== work.lead_id
    : false;

  const syncEditState = (data: Work) => {
    setEditTitle(data.title || '');
    setEditStatus(data.status);
    setEditPriority(data.priority);
    setEditDueDate(data.due_date || '');
    setEditNotes(data.notes || '');
    setEditAssignedToId(data.assigned_to_id);
    setEditLeadId(data.lead_id);
    // Start in read-only mode if form is already submitted
    const hasFormData = data.form_data && Object.keys(data.form_data as object).length > 0;
    setFormEditMode(!hasFormData);
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setDatasheetUiSchema(null);
    setFormSchema(null);
    setTemplateStepsSchema(null);
    setExecutionRules(null);
    try {
      const data = await getWork(Number(id));
      setWork(data);
      syncEditState(data);
      if (data.work_template_id) {
        setTemplateLoading(true);
        getWorkTemplate(data.work_template_id)
          .then((t) => {
            if (data.template_type === 'datasheet') setDatasheetUiSchema(t.datasheet_ui_schema ?? null);
            setFormSchema(Array.isArray(t.form_schema) ? (t.form_schema as FormField[]) : null);
            setExecutionRules((t.execution_rules as Record<string, unknown> | null) ?? null);
            if (Array.isArray(t.steps_schema)) {
              setTemplateStepsSchema(
                t.steps_schema.map((s) => ({
                  order: s.order,
                  label: s.label,
                  form_schema: Array.isArray(s.form_schema) ? (s.form_schema as FormField[]) : undefined,
                })),
              );
            }
          })
          .catch(() => { setDatasheetUiSchema(null); setFormSchema(null); setTemplateStepsSchema(null); })
          .finally(() => setTemplateLoading(false));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load work');
      setWork(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    listEmployees()
      .then((rows) =>
        setEmployees(
          rows
            .filter((r) => r.is_active)
            .map((r) => ({ user_id: r.user_id, name: r.name || r.email })),
        ),
      )
      .catch(() => setEmployees([]));
    listLeadsForSelect({ per_page: 100 }).then(setLeads).catch(() => setLeads([]));
  }, []);

  const handleStartWork = async () => {
    if (!id || !work || work.status !== 'pending') return;
    setSaving(true);
    setError(null);
    try {
      const updated = await startWork(Number(id));
      setWork(updated);
      syncEditState(updated);
      showNotice('Work started successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start work');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!id || !work || formDisabled || !isDirty) return;
    setSaving(true);
    setError(null);
    try {
      const payload: WorkUpdate = {};
      if (editStatus !== work.status) payload.status = editStatus as WorkUpdate['status'];
      if (editPriority !== work.priority) payload.priority = editPriority;
      if (editTitle !== (work.title || '')) payload.title = editTitle || null;
      if (editDueDate !== (work.due_date || '')) payload.due_date = editDueDate || null;
      if (editNotes !== (work.notes || '')) payload.notes = editNotes || null;
      if (canEditRestricted) {
        if (editAssignedToId !== work.assigned_to_id && editAssignedToId != null) payload.assigned_to_id = editAssignedToId;
        if (editLeadId !== work.lead_id) payload.lead_id = editLeadId;
      }
      const updated = await updateWork(Number(id), payload);
      setWork(updated);
      syncEditState(updated);
      showNotice('Changes saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (work) syncEditState(work);
  };

  // ── Invalid / loading states ─────────────────────────────────────────────

  if (!id) {
    return (
      <ModuleGuard module="lms">
        <div className="w-full max-w-2xl space-y-4">
          <BackNav />
          <div className="rounded-xl border border-border-color bg-card-bg p-6">
            <p className="text-text-secondary">Invalid work ID.</p>
          </div>
        </div>
      </ModuleGuard>
    );
  }

  if (loading || !work) {
    return (
      <ModuleGuard module="lms">
        <div className="w-full max-w-2xl space-y-4">
          <BackNav />
          <div className="rounded-xl border border-border-color bg-card-bg p-8 shadow-sm">
            {loading ? (
              <div className="space-y-4">
                <div className="h-7 w-48 animate-pulse rounded-lg bg-bg-secondary" />
                <div className="h-4 w-full animate-pulse rounded bg-bg-secondary" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-bg-secondary" />
              </div>
            ) : (
              <p className="text-text-secondary">{error || 'Work not found.'}</p>
            )}
          </div>
        </div>
      </ModuleGuard>
    );
  }

  const templateType = work.template_type ?? 'simple';

  // ── Checklist ────────────────────────────────────────────────────────────

  if (templateType === 'checklist') {
    return (
      <ModuleGuard module="lms">
        <div className="w-full max-w-2xl space-y-4">
          <BackNav />
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}
          {notice && !error && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              {notice}
            </div>
          )}
          <div className="rounded-xl border border-border-color bg-card-bg p-6 shadow-sm">
            <WorkDetailChecklist
              work={work}
              onWorkUpdated={setWork}
              stepsSchema={templateStepsSchema}
              globalFormSchema={formSchema}
            />
          </div>
          {templateLoading && (
            <p className="animate-pulse text-center text-xs text-text-secondary">Loading template…</p>
          )}
        </div>
      </ModuleGuard>
    );
  }

  // ── Datasheet ────────────────────────────────────────────────────────────

  if (templateType === 'datasheet') {
    const dsFormMode = (datasheetUiSchema as { form_mode?: 'per_record' | 'single' } | null)?.form_mode ?? 'per_record';
    const dsHasSubmittedForm = !!(work.form_data && Object.keys(work.form_data as object).length > 0);
    // 'single' → global work form + no per-record forms. 'per_record' → per-record form inside table + no global.
    const showGlobalForm = dsFormMode === 'single' && formSchema && formSchema.length > 0;
    const perRecordFormSchema = dsFormMode === 'per_record' ? formSchema : null;

    return (
      <ModuleGuard module="lms">
        <div className="w-full max-w-5xl space-y-4">
          <BackNav />
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}
          {notice && !error && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              {notice}
            </div>
          )}

          {/* Template loading skeleton */}
          {templateLoading && (
            <div className="rounded-xl border border-dashed border-border-color p-5 text-center">
              <p className="animate-pulse text-sm text-text-secondary">Loading template…</p>
            </div>
          )}

          {/* Records table */}
          <div className="rounded-xl border border-border-color bg-card-bg p-6 shadow-sm">
            <WorkDetailDatasheet
              work={work}
              onWorkUpdated={(updated) => {
                setWork(updated);
                syncEditState(updated);
              }}
              uiSchema={datasheetUiSchema ?? undefined}
              formSchema={perRecordFormSchema}
            />
          </div>

          {/* Single / global work form — shown below the records table when form_mode = 'single' */}
          {showGlobalForm && (
            <div className="rounded-xl border-2 border-accent/30 bg-card-bg p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                    <svg className="h-4 w-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Work Form</h2>
                    <p className="text-xs text-text-secondary">Fill once to complete this work</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {dsHasSubmittedForm ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      ✓ Submitted
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Required to complete
                    </span>
                  )}
                  {dsHasSubmittedForm && !formDisabled && (
                    <button
                      type="button"
                      onClick={() => setFormEditMode((v) => !v)}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      {formEditMode ? 'View' : 'Edit'}
                    </button>
                  )}
                </div>
              </div>

              {dsHasSubmittedForm && !formEditMode ? (
                <FormDataReadOnly
                  formData={work.form_data as Record<string, unknown>}
                  fields={formSchema!}
                  onEdit={!formDisabled ? () => setFormEditMode(true) : undefined}
                />
              ) : (
                <DynamicWorkForm
                  fields={formSchema!}
                  initialValues={(work.form_data as Record<string, unknown>) ?? {}}
                  onSubmit={async (values) => {
                    let updated = await submitWorkForm(Number(id), values);
                    if (
                      executionRules?.auto_complete_on_form_submit === true &&
                      updated.status !== 'completed' &&
                      updated.status !== 'cancelled'
                    ) {
                      updated = await updateWork(Number(id), { status: 'completed' });
                      showNotice('Form submitted — work marked as completed ✓');
                    } else {
                      showNotice('Work form submitted.');
                    }
                    setWork(updated);
                    setFormEditMode(false);
                  }}
                  submitLabel={
                    executionRules?.auto_complete_on_form_submit && !dsHasSubmittedForm
                      ? 'Submit & complete work ✓'
                      : dsHasSubmittedForm ? 'Update form' : 'Submit form'
                  }
                  disabled={formDisabled}
                />
              )}
            </div>
          )}
        </div>
      </ModuleGuard>
    );
  }

  // ── Calling work ─────────────────────────────────────────────────────────

  if (templateType === 'calling') {
    return (
      <ModuleGuard module="lms">
        <div className="w-full max-w-3xl space-y-4">
          <BackNav />
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}
          <WorkDetailHeader work={work} />
          <CallingWorkView workId={work.id} />
        </div>
      </ModuleGuard>
    );
  }

  // ── Simple work ──────────────────────────────────────────────────────────

  const hasSubmittedForm = !!(work.form_data && Object.keys(work.form_data as object).length > 0);
  const isOverdue =
    work.status !== 'completed' &&
    work.status !== 'cancelled' &&
    work.due_date &&
    new Date(work.due_date) < new Date() &&
    !Number.isNaN(new Date(work.due_date).getTime());

  return (
    <ModuleGuard module="lms">
      <div className="w-full max-w-2xl space-y-4">
        {/* Breadcrumb nav */}
        <BackNav />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
        {notice && !error && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
            {notice}
          </div>
        )}

        {/* ── Overview card ── */}
        <div className="rounded-xl border border-border-color bg-card-bg p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {canEditAnyField && !formDisabled ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={work.work_type_name || 'Work title'}
                  className="w-full bg-transparent text-xl font-semibold text-text-primary placeholder:text-text-secondary/60 focus:outline-none"
                />
              ) : (
                <h1 className="text-xl font-semibold text-text-primary">
                  {work.title || work.work_type_name || 'Untitled'}
                </h1>
              )}
              <p className="mt-0.5 text-sm text-text-secondary">{work.work_type_name}</p>
            </div>

            {/* Start work button — only when pending */}
            {work.status === 'pending' && canEditAnyField && (
              <button
                type="button"
                onClick={() => void handleStartWork()}
                disabled={saving}
                className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
              >
                {saving ? 'Starting…' : 'Start work'}
              </button>
            )}
          </div>

          {/* Quick meta row */}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-text-secondary">
            <span>
              <span className="font-medium text-text-primary">{work.assigned_to_name}</span>
            </span>
            {work.due_date && (
              <span>
                Due{' '}
                <span className={`font-medium ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-text-primary'}`}>
                  {new Date(work.due_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </span>
                {isOverdue && (
                  <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    Overdue
                  </span>
                )}
              </span>
            )}
            {work.lead_id && (
              <Link href={`/customers/${work.lead_id}`} className="font-medium text-accent hover:underline">
                {work.lead_name || `Lead #${work.lead_id}`}
              </Link>
            )}
          </div>

          {isCompleted && !canEditRestricted && (
            <div className="mt-4 rounded-lg border border-border-color bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
              This work is completed. Only managers can reopen or make further changes.
            </div>
          )}
        </div>

        {/* ── Details card ── */}
        <div className="rounded-xl border border-border-color bg-card-bg p-6 shadow-sm space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Details</h2>

          {/* Status — pill button group */}
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Status</p>
            {canEditAnyField && !formDisabled ? (
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditStatus(opt.value)}
                    className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all border-2 ${
                      editStatus === opt.value
                        ? opt.cls
                        : 'border-transparent bg-bg-secondary text-text-secondary hover:bg-bg-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className={`inline-flex rounded-full border-2 px-3 py-0.5 text-xs font-semibold ${STATUS_OPTS.find((o) => o.value === work.status)?.cls ?? ''}`}>
                {STATUS_OPTS.find((o) => o.value === work.status)?.label ?? work.status}
              </span>
            )}
          </div>

          {/* Priority — pill button group */}
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Priority</p>
            {canEditAnyField && !formDisabled ? (
              <div className="flex gap-2">
                {PRIORITY_OPTS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditPriority(opt.value)}
                    className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all border-2 ${
                      editPriority === opt.value
                        ? opt.cls
                        : 'border-transparent bg-bg-secondary text-text-secondary hover:bg-bg-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className={`inline-flex rounded-full border-2 px-3 py-0.5 text-xs font-semibold capitalize ${PRIORITY_OPTS.find((o) => o.value === work.priority)?.cls ?? ''}`}>
                {work.priority}
              </span>
            )}
          </div>

          {/* Grid: Assignee + Due date + Lead */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Assignee */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">Assigned to</label>
              {canEditRestricted ? (
                <select
                  value={editAssignedToId ?? ''}
                  onChange={(e) => setEditAssignedToId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {employees.map((emp) => (
                    <option key={emp.user_id} value={emp.user_id}>{emp.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-text-primary">{work.assigned_to_name}</p>
              )}
            </div>

            {/* Due date */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">Due date</label>
              {canEditAnyField && !formDisabled ? (
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              ) : (
                <p className="text-sm text-text-primary">{new Date(work.due_date || '').toLocaleDateString(undefined, { dateStyle: 'medium' }) || '—'}</p>
              )}
            </div>

            {/* Customer / Lead */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">Customer</label>
              {canEditRestricted ? (
                <select
                  value={editLeadId ?? ''}
                  onChange={(e) => setEditLeadId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">None</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>{lead.name || lead.phone || `Lead #${lead.id}`}</option>
                  ))}
                </select>
              ) : work.lead_id ? (
                <Link href={`/customers/${work.lead_id}`} className="text-sm font-medium text-accent hover:underline">
                  {work.lead_name || `Lead #${work.lead_id}`}
                </Link>
              ) : (
                <p className="text-sm text-text-secondary">—</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Notes</label>
            {canEditAnyField && !formDisabled ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Instructions or context…"
              />
            ) : (
              <div className="rounded-lg bg-bg-secondary p-3">
                <p className="whitespace-pre-wrap text-sm text-text-primary">{work.notes || '—'}</p>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <p className="text-xs text-text-secondary">
            Created {formatDate(work.created_at)}
            {work.started_at && ` · Started ${formatDate(work.started_at)}`}
            {work.completed_at && ` · Completed ${formatDate(work.completed_at)}`}
          </p>

          {/* Unsaved changes save bar — only appears when dirty */}
          {canEditAnyField && !formDisabled && isDirty && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
              <span className="flex-1 text-xs text-text-secondary">You have unsaved changes</span>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                disabled={saving}
                className="rounded-lg border border-border-color px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary disabled:opacity-60"
              >
                Discard
              </button>
            </div>
          )}
        </div>

        {/* ── Work form card — appears when template has form_schema ── */}
        {templateLoading ? (
          <div className="rounded-xl border border-dashed border-border-color p-6 text-center">
            <p className="animate-pulse text-sm text-text-secondary">Loading form…</p>
          </div>
        ) : formSchema && formSchema.length > 0 ? (
          <div className="rounded-xl border-2 border-accent/30 bg-card-bg p-6 shadow-sm">
            {/* Form header */}
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                  <svg className="h-4 w-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-text-primary">Work Form</h2>
              </div>
              {hasSubmittedForm && (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    ✓ Submitted
                  </span>
                  {!formDisabled && (
                    <button
                      type="button"
                      onClick={() => setFormEditMode((v) => !v)}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      {formEditMode ? 'View submitted' : 'Edit'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Read-only view when already submitted and not in edit mode */}
            {hasSubmittedForm && !formEditMode ? (
              <FormDataReadOnly
                formData={work.form_data as Record<string, unknown>}
                fields={formSchema}
                onEdit={!formDisabled ? () => setFormEditMode(true) : undefined}
              />
            ) : (
              <DynamicWorkForm
                fields={formSchema}
                initialValues={(work.form_data as Record<string, unknown>) ?? {}}
                onSubmit={async (values) => {
                  let updated = await submitWorkForm(Number(id), values);
                  if (
                    executionRules?.auto_complete_on_form_submit === true &&
                    updated.status !== 'completed' &&
                    updated.status !== 'cancelled'
                  ) {
                    updated = await updateWork(Number(id), { status: 'completed' });
                    showNotice('Form submitted — work marked as completed ✓');
                  } else {
                    showNotice('Form submitted successfully.');
                  }
                  setWork(updated);
                  syncEditState(updated);
                  setFormEditMode(false);
                }}
                submitLabel={
                  executionRules?.auto_complete_on_form_submit && !hasSubmittedForm
                    ? 'Submit & complete work ✓'
                    : hasSubmittedForm ? 'Update form' : 'Submit form'
                }
                disabled={formDisabled}
              />
            )}
          </div>
        ) : null}
      </div>
    </ModuleGuard>
  );
}


// ── Calling Work View ────────────────────────────────────────────────────

const CALL_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  called: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  skipped: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  callback: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

function CallingWorkView({ workId }: { workId: number }) {
  const [leads, setLeads] = useState<WorkLeadAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    try {
      const data = await getAssignedLeads(workId);
      setLeads(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleStatusChange = async (leadId: number, status: string) => {
    try {
      await updateLeadAssignmentStatus(workId, leadId, status);
      await fetchLeads();
    } catch {
      // silent
    }
  };

  if (loading) {
    return <p className="animate-pulse text-center text-sm text-text-secondary py-8">Loading leads...</p>;
  }

  const calledCount = leads.filter((l) => l.status === 'called').length;
  const progress = leads.length > 0 ? (calledCount / leads.length) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="rounded-xl border border-border-color bg-card-bg p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-text-primary">Calling Progress</h3>
          <span className="text-sm font-bold text-accent">{calledCount}/{leads.length}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Lead List */}
      <div className="rounded-xl border border-border-color bg-card-bg shadow-sm divide-y divide-border-color">
        <div className="px-5 py-3">
          <h3 className="text-sm font-semibold text-text-primary">Leads to Call ({leads.length})</h3>
        </div>
        {leads.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-secondary">No leads assigned</p>
        ) : (
          leads.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{a.lead_name || 'Unknown'}</p>
                <p className="text-xs text-text-secondary">{a.lead_phone || 'No phone'}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${CALL_STATUS_STYLES[a.status] || CALL_STATUS_STYLES.pending}`}>
                {a.status}
              </span>
              {a.last_disposition && (
                <span className="text-xs text-text-secondary capitalize">{a.last_disposition.replace(/_/g, ' ')}</span>
              )}
              {a.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange(a.lead_id, 'skipped')}
                  className="text-xs text-text-secondary hover:text-text-primary"
                >
                  Skip
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
