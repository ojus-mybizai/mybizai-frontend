'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { useAuthStore } from '@/lib/auth-store';
import { listEmployees } from '@/services/employees';
import { listLeadsForSelect, type LeadOption } from '@/services/customers';
import { getWork, listWorkTypes, updateWork, startWork, getWorkTemplate, type Work, type WorkType, type WorkUpdate } from '@/services/work';
import { WorkDetailHeader } from '@/components/work/work-detail-header';
import WorkDetailChecklist from '@/components/work/work-detail-checklist';
import WorkDetailDatasheet from '@/components/work/work-detail-datasheet';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function WorkDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const user = useAuthStore((s) => s.user as { id?: number } | null);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEditAll = hasPermission('manage_work') || hasPermission('assign_work');
  const canEditOwn = true;

  const [work, setWork] = useState<Work | null>(null);
  const [datasheetUiSchema, setDatasheetUiSchema] = useState<Record<string, unknown> | null>(null);
  const [employees, setEmployees] = useState<Array<{ user_id: number; name: string }>>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editAssignedToId, setEditAssignedToId] = useState<number | null>(null);
  const [editWorkTypeId, setEditWorkTypeId] = useState<number | null>(null);
  const [editLeadId, setEditLeadId] = useState<number | null>(null);

  const canEditAnyField = canEditAll || (work?.assigned_to_id === user?.id && canEditOwn);
  const canEditRestricted = canEditAll;
  const isCompleted = work?.status === 'completed';
  const canReopen = isCompleted && canEditRestricted;
  const formDisabled = isCompleted && !canEditRestricted;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setDatasheetUiSchema(null);
    try {
      const data = await getWork(Number(id));
      setWork(data);
      setEditTitle(data.title || '');
      setEditStatus(data.status);
      setEditPriority(data.priority);
      setEditDueDate(data.due_date || '');
      setEditNotes(data.notes || '');
      setEditAssignedToId(data.assigned_to_id);
      setEditWorkTypeId(data.work_type_id);
      setEditLeadId(data.lead_id);
      if (data.template_type === 'datasheet' && data.work_template_id) {
        getWorkTemplate(data.work_template_id)
          .then((t) => setDatasheetUiSchema(t.datasheet_ui_schema ?? null))
          .catch(() => setDatasheetUiSchema(null));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load work');
      setWork(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    listEmployees()
      .then((rows) =>
        setEmployees(
          rows
            .filter((row) => row.id === 0 || row.is_active)
            .map((row) => ({ user_id: row.user_id, name: row.name || row.email })),
        ),
      )
      .catch(() => setEmployees([]));
    listWorkTypes().then(setWorkTypes).catch(() => setWorkTypes([]));
    listLeadsForSelect({ per_page: 100 }).then(setLeads).catch(() => setLeads([]));
  }, []);

  const handleStartWork = async () => {
    if (!id || !work || work.status !== 'pending') return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await startWork(Number(id));
      setWork(updated);
      setEditStatus(updated.status);
      setNotice('Work started.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!id || !work || formDisabled) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload: WorkUpdate = {};
      if (editStatus !== work.status) payload.status = editStatus as WorkUpdate['status'];
      if (editPriority !== work.priority) payload.priority = editPriority;
      if (editTitle !== (work.title || '')) payload.title = editTitle || null;
      if (editDueDate !== (work.due_date || '')) payload.due_date = editDueDate || null;
      if (editNotes !== (work.notes || '')) payload.notes = editNotes || null;
      if (canEditRestricted) {
        if (editAssignedToId !== work.assigned_to_id && editAssignedToId != null) payload.assigned_to_id = editAssignedToId;
        if (editWorkTypeId !== work.work_type_id && editWorkTypeId != null) payload.work_type_id = editWorkTypeId;
        if (editLeadId !== work.lead_id) payload.lead_id = editLeadId;
      }
      if (Object.keys(payload).length === 0) {
        setSaving(false);
        return;
      }
      const updated = await updateWork(Number(id), payload);
      setWork(updated);
      setNotice('Work updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return (
      <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="w-full max-w-2xl space-y-4">
            <Link
              href="/work"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-accent hover:underline"
            >
              <span aria-hidden>←</span>
              Back to Work
            </Link>
            <div className="rounded-xl border border-border-color bg-card-bg p-6">
              <p className="text-text-secondary">Invalid work id.</p>
            </div>
          </div>
        </ModuleGuard>
      </ProtectedShell>
    );
  }

  if (loading || !work) {
    return (
      <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="w-full max-w-2xl space-y-4">
            <Link
              href="/work"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-accent hover:underline"
            >
              <span aria-hidden>←</span>
              Back to Work
            </Link>
            <div className="rounded-xl border border-border-color bg-card-bg p-8 shadow-sm">
              {loading ? (
                <div className="space-y-4">
                  <div className="h-8 w-48 animate-pulse rounded-lg bg-bg-secondary" />
                  <div className="h-4 w-full animate-pulse rounded bg-bg-secondary" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-bg-secondary" />
                </div>
              ) : (
                <p className="text-text-secondary">{error || 'Work not found.'}</p>
              )}
            </div>
          </div>
        </ModuleGuard>
      </ProtectedShell>
    );
  }

  const templateType = work.template_type ?? 'simple';

  if (templateType === 'checklist') {
    return (
      <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="w-full max-w-2xl space-y-6">
            <div className="rounded-xl border border-border-color bg-card-bg p-6">
              <WorkDetailChecklist work={work} onWorkUpdated={setWork} />
            </div>
          </div>
        </ModuleGuard>
      </ProtectedShell>
    );
  }

  if (templateType === 'datasheet') {
    return (
      <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="w-full max-w-5xl space-y-6">
            <div className="rounded-xl border border-border-color bg-card-bg p-6">
              <WorkDetailDatasheet work={work} onWorkUpdated={setWork} uiSchema={datasheetUiSchema ?? undefined} />
            </div>
          </div>
        </ModuleGuard>
      </ProtectedShell>
    );
  }

  const startButton =
    work.status === 'pending' && canEditAnyField ? (
      <button
        type="button"
        onClick={handleStartWork}
        disabled={saving}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
      >
        {saving ? 'Starting…' : 'Start work'}
      </button>
    ) : null;

  return (
    <ProtectedShell>
      <ModuleGuard module="lms">
        <div className="w-full max-w-2xl space-y-6">
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
            <WorkDetailHeader work={work} action={startButton} />

            {isCompleted && !canEditRestricted && (
              <p className="mt-4 rounded-lg bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
                This work is completed. Only users with manage work can reopen or edit.
              </p>
            )}
            {canReopen && (
              <p className="mt-4 rounded-lg bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
                Completed. You can change status to In progress below to reopen.
              </p>
            )}

            <div className="mt-8 space-y-8">
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">Title</label>
                    {canEditAnyField && !formDisabled ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="Work title"
                      />
                    ) : (
                      <p className="text-text-primary">{work.title || '—'}</p>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Assigned to</label>
                      {canEditRestricted ? (
                        <select
                          value={editAssignedToId ?? ''}
                          onChange={(e) => setEditAssignedToId(e.target.value ? Number(e.target.value) : null)}
                          className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                          {employees.map((emp) => (
                            <option key={emp.user_id} value={emp.user_id}>{emp.name}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-text-primary">{work.assigned_to_name}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Work type</label>
                      {canEditRestricted ? (
                        <select
                          value={editWorkTypeId ?? ''}
                          onChange={(e) => setEditWorkTypeId(e.target.value ? Number(e.target.value) : null)}
                          className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                          {workTypes.filter((type) => type.is_active).map((type) => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-text-primary">{work.work_type_name}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">Linked lead</label>
                    {canEditRestricted ? (
                      <select
                        value={editLeadId ?? ''}
                        onChange={(e) => setEditLeadId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="">None</option>
                        {leads.map((lead) => (
                          <option key={lead.id} value={lead.id}>{lead.name || lead.phone || `Lead #${lead.id}`}</option>
                        ))}
                      </select>
                    ) : work.lead_id ? (
                      <Link href={`/customers/${work.lead_id}`} className="font-medium text-accent hover:underline">
                        {work.lead_name || `Lead #${work.lead_id}`}
                      </Link>
                    ) : (
                      <p className="text-text-secondary">—</p>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Schedule & status</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">Status</label>
                    {canEditAnyField && !formDisabled ? (
                      <select
                        value={editStatus ?? work.status}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="capitalize text-text-primary">{work.status.replace('_', ' ')}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">Priority</label>
                    {canEditAnyField && !formDisabled ? (
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value as 'low' | 'medium' | 'high')}
                        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    ) : (
                      <p className="capitalize text-text-primary">{work.priority}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">Due date</label>
                    {canEditAnyField && !formDisabled ? (
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    ) : (
                      <p className="text-text-primary">{formatDate(work.due_date)}</p>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  Created {formatDate(work.created_at)} · Updated {formatDate(work.updated_at)}
                </p>
              </section>

              <section>
                <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-text-secondary">Notes</label>
                {canEditAnyField && !formDisabled ? (
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Instructions or context…"
                  />
                ) : (
                  <div className="rounded-lg border border-border-color bg-bg-secondary p-4">
                    <p className="whitespace-pre-wrap text-text-primary">{work.notes || '—'}</p>
                  </div>
                )}
              </section>

              {canEditAnyField && !formDisabled && (
                <div className="flex flex-wrap gap-3 border-t border-border-color pt-6">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <Link
                    href="/work"
                    className="inline-flex items-center rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-secondary"
                  >
                    Cancel
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </ModuleGuard>
    </ProtectedShell>
  );
}
