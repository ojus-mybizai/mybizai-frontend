'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { useAuthStore } from '@/lib/auth-store';
import { listEmployees } from '@/services/employees';
import { listLeadsForSelect, type LeadOption } from '@/services/customers';
import { getWork, listWorkTypes, updateWork, type Work, type WorkType, type WorkUpdate } from '@/services/work';

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
  const user = useAuthStore((s) => s.user as { id?: number; businesses?: { role?: string }[] } | null);
  const role = user?.businesses?.[0]?.role ?? 'owner';
  const canEditAll = role === 'owner' || role === 'manager';
  const canEditOwn = true;

  const [work, setWork] = useState<Work | null>(null);
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

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
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

  const handleSave = async () => {
    if (!id || !work) return;
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
          <div className="w-full rounded-xl border border-border-color bg-card-bg p-4">
            <p className="text-base text-text-secondary">Invalid work id.</p>
            <Link href="/work" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
              Back to Work
            </Link>
          </div>
        </ModuleGuard>
      </ProtectedShell>
    );
  }

  if (loading || !work) {
    return (
      <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="w-full rounded-xl border border-border-color bg-card-bg p-4">
            {loading ? <p className="text-base text-text-secondary">Loading…</p> : <p className="text-base text-text-secondary">{error || 'Work not found.'}</p>}
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
          <div className="w-full max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <Link href="/work" className="text-sm font-semibold text-accent hover:underline">
                ← Back to Work
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
              <h2 className="text-xl font-semibold text-text-primary">{work.title || work.work_type_name}</h2>
              <p className="mt-1 text-sm text-text-secondary">Type: {work.work_type_name}</p>

              <dl className="mt-4 space-y-2 text-base">
                <div className="flex justify-between gap-2">
                  <dt className="text-text-secondary">Title</dt>
                  <dd className="text-text-primary">
                    {canEditAnyField ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-72 rounded-lg border border-border-color bg-bg-primary px-2 py-1 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    ) : (
                      work.title || '—'
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-secondary">Assigned to</dt>
                  <dd className="text-text-primary">
                    {canEditRestricted ? (
                      <select
                        value={editAssignedToId ?? ''}
                        onChange={(e) => setEditAssignedToId(e.target.value ? Number(e.target.value) : null)}
                        className="rounded-lg border border-border-color bg-bg-primary px-2 py-1 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {employees.map((emp) => (
                          <option key={emp.user_id} value={emp.user_id}>{emp.name}</option>
                        ))}
                      </select>
                    ) : (
                      work.assigned_to_name
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-secondary">Work type</dt>
                  <dd className="text-text-primary">
                    {canEditRestricted ? (
                      <select
                        value={editWorkTypeId ?? ''}
                        onChange={(e) => setEditWorkTypeId(e.target.value ? Number(e.target.value) : null)}
                        className="rounded-lg border border-border-color bg-bg-primary px-2 py-1 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {workTypes.filter((type) => type.is_active).map((type) => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    ) : (
                      work.work_type_name
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-secondary">Status</dt>
                  <dd className="text-text-primary">
                    {canEditAnyField ? (
                      <select
                        value={editStatus ?? work.status}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="rounded-lg border border-border-color bg-bg-primary px-2 py-1 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      work.status
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-secondary">Priority</dt>
                  <dd className="text-text-primary">
                    {canEditAnyField ? (
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value as 'low' | 'medium' | 'high')}
                        className="rounded-lg border border-border-color bg-bg-primary px-2 py-1 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    ) : (
                      work.priority
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-secondary">Due date</dt>
                  <dd className="text-text-primary">
                    {canEditAnyField ? (
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="rounded-lg border border-border-color bg-bg-primary px-2 py-1 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    ) : (
                      formatDate(work.due_date)
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-secondary">Lead</dt>
                  <dd className="text-text-primary">
                    {canEditRestricted ? (
                      <select
                        value={editLeadId ?? ''}
                        onChange={(e) => setEditLeadId(e.target.value ? Number(e.target.value) : null)}
                        className="rounded-lg border border-border-color bg-bg-primary px-2 py-1 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
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
                      '—'
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-secondary">Created</dt>
                  <dd className="text-text-primary">{formatDate(work.created_at)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-secondary">Updated</dt>
                  <dd className="text-text-primary">{formatDate(work.updated_at)}</dd>
                </div>
              </dl>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-text-secondary">Notes</label>
                {canEditAnyField ? (
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                ) : (
                  <p className="whitespace-pre-wrap rounded-lg border border-border-color bg-bg-secondary p-3 text-base text-text-primary">
                    {work.notes || '—'}
                  </p>
                )}
              </div>

              {canEditAnyField && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </ModuleGuard>
    </ProtectedShell>
  );
}
