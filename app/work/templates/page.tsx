'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { useAuthStore } from '@/lib/auth-store';
import {
  createWorkFromTemplate,
  createWorkTemplate,
  listWorkTypes,
  listWorkTemplates,
  createWorkType,
  deleteWorkTemplate,
  updateWorkType,
  updateWorkTemplate,
  type WorkTemplate,
  type WorkType,
} from '@/services/work';
import { listEmployees, type Employee } from '@/services/employees';
import { useRouter } from 'next/navigation';

export default function WorkTemplatesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user as { businesses?: { role?: string }[] } | null);
  const role = user?.businesses?.[0]?.role ?? 'owner';
  const canEdit = role === 'owner' || role === 'manager';

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [typeData, templateData, employeeData] = await Promise.all([
        listWorkTypes(),
        listWorkTemplates(),
        listEmployees(),
      ]);
      setTypes(typeData);
      setTemplates(templateData);
      setEmployees(employeeData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load work types');
      setTemplates([]);
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
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || templateTypeId == null) {
      setError('Template name and work type are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingTemplateId != null) {
        await updateWorkTemplate(editingTemplateId, {
          name: templateName.trim(),
          work_type_id: templateTypeId,
          default_assigned_to_id: templateAssignedToId,
          default_due_days: templateDueDays ? Number(templateDueDays) : null,
          default_title: templateTitle.trim() || null,
          default_notes: templateNotes.trim() || null,
        });
        setNotice('Template updated.');
      } else {
        await createWorkTemplate({
          name: templateName.trim(),
          work_type_id: templateTypeId,
          default_assigned_to_id: templateAssignedToId,
          default_due_days: templateDueDays ? Number(templateDueDays) : null,
          default_title: templateTitle.trim() || null,
          default_notes: templateNotes.trim() || null,
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

  const handleCreateFromTemplate = async (template: WorkTemplate) => {
    setSaving(true);
    setError(null);
    try {
      const created = await createWorkFromTemplate(template.id, {
        priority: 'medium',
      });
      setNotice(`Work created from template "${template.name}".`);
      router.push(`/work/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create work from template');
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
                      <div className="text-base font-semibold text-text-primary">{template.name}</div>
                      <div className="text-sm text-text-secondary">
                        {template.work_type_name}
                        {template.default_assigned_to_name ? ` · ${template.default_assigned_to_name}` : ''}
                        {template.default_due_days != null ? ` · +${template.default_due_days} days` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleEditTemplate(template)} className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-semibold text-text-primary">Edit</button>
                      <button type="button" onClick={() => void handleCreateFromTemplate(template)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">Use template</button>
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
