'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { useAuthStore } from '@/lib/auth-store';
import {
  listWorkTypes,
  createWorkType,
  updateWorkType,
  type WorkType,
} from '@/services/work';

export default function WorkTemplatesPage() {
  const user = useAuthStore((s) => s.user as { businesses?: { role?: string }[] } | null);
  const role = user?.businesses?.[0]?.role ?? 'owner';
  const canEdit = role === 'owner' || role === 'manager';

  const [types, setTypes] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listWorkTypes();
      setTypes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load work types');
      setTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create work type');
    } finally {
      setSaving(false);
    }
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
