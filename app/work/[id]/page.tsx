'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { useAuthStore } from '@/lib/auth-store';
import { getWork, updateWork, type Work, type WorkUpdate } from '@/services/work';

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
  const router = useRouter();
  const id = params?.id;
  const user = useAuthStore((s) => s.user as { id?: number; businesses?: { role?: string }[] } | null);
  const role = user?.businesses?.[0]?.role ?? 'owner';
  const canEditAll = role === 'owner' || role === 'manager';

  const [work, setWork] = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getWork(Number(id));
      setWork(data);
      setEditStatus(data.status);
      setEditNotes(data.notes || '');
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

  const handleSave = async () => {
    if (!id || !work) return;
    setSaving(true);
    setError(null);
    try {
      const payload: WorkUpdate = {};
      if (editStatus !== work.status) payload.status = editStatus as WorkUpdate['status'];
      if (editNotes !== (work.notes || '')) payload.notes = editNotes || null;
      if (Object.keys(payload).length === 0) {
        setSaving(false);
        return;
      }
      const updated = await updateWork(Number(id), payload);
      setWork(updated);
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

            <div className="rounded-xl border border-border-color bg-card-bg p-4">
              <h2 className="text-xl font-semibold text-text-primary">{work.title || work.work_type_name}</h2>
              <p className="mt-1 text-sm text-text-secondary">Type: {work.work_type_name}</p>

              <dl className="mt-4 space-y-2 text-base">
                <div className="flex justify-between gap-2">
                  <dt className="text-text-secondary">Assigned to</dt>
                  <dd className="text-text-primary">{work.assigned_to_name}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-text-secondary">Status</dt>
                  <dd className="text-text-primary">
                    {canEditAll || work.assigned_to_id === user?.id ? (
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
                  <dt className="text-text-secondary">Due date</dt>
                  <dd className="text-text-primary">{formatDate(work.due_date)}</dd>
                </div>
                {work.lead_id && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-text-secondary">Lead</dt>
                    <dd className="text-text-primary">
                      <Link href={`/customers/${work.lead_id}`} className="font-medium text-accent hover:underline">
                        {work.lead_name || `Lead #${work.lead_id}`}
                      </Link>
                    </dd>
                  </div>
                )}
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
                {(canEditAll || work.assigned_to_id === user?.id) ? (
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

              {(canEditAll || work.assigned_to_id === user?.id) && (
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
