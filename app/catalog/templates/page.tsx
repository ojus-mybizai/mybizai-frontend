'use client';

import { FormEvent, useEffect, useState } from 'react';
import ProtectedShell from '@/components/protected-shell';
import ConfirmDialog from '@/components/catalog/confirm-dialog';
import { useCatalogStore } from '@/lib/catalog-store';
import type { CatalogTemplate } from '@/lib/catalog-api';

export default function CatalogTemplatesPage() {
  const { templates, loadTemplates, createTemplate, editTemplate, removeTemplate } = useCatalogStore((s) => ({
    templates: s.templates,
    loadTemplates: s.loadTemplates,
    createTemplate: s.createTemplate,
    editTemplate: s.editTemplate,
    removeTemplate: s.removeTemplate,
  }));

  const [editing, setEditing] = useState<CatalogTemplate | null>(null);
  const [name, setName] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [fieldInput, setFieldInput] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templates.length) void loadTemplates();
  }, [loadTemplates, templates.length]);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setFields([]);
    setFieldInput('');
  };

  const startEdit = (tmpl: CatalogTemplate) => {
    setEditing(tmpl);
    setName(tmpl.name);
    setFields(tmpl.extra_metadata);
  };

  const handleAddField = () => {
    const trimmed = fieldInput.trim();
    if (!trimmed) return;
    if (!fields.includes(trimmed)) {
      setFields((f) => [...f, trimmed]);
    }
    setFieldInput('');
  };

  const handleRemoveField = (field: string) => {
    setFields((f) => f.filter((x) => x !== field));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    try {
      if (editing) {
        await editTemplate(String(editing.id), { name: name.trim(), extra_metadata: fields });
      } else {
        await createTemplate({ name: name.trim(), extra_metadata: fields });
      }
      resetForm();
    } catch (err) {
      setError((err as Error).message || 'Failed to save template');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await removeTemplate(deleteId);
    setDeleteId(null);
  };

  return (
    <ProtectedShell>
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Templates</h2>
              <p className="text-sm text-text-secondary">Metadata helpers. Fields are suggestions only.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-border-color bg-card-bg p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-text-primary">
                  {editing ? 'Edit template' : 'Create template'}
                </div>
                {editing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs font-semibold text-text-secondary hover:text-text-primary"
                  >
                    Cancel edit
                  </button>
                )}
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form className="space-y-3" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-primary">Template name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={fieldInput}
                      onChange={(e) => setFieldInput(e.target.value)}
                      placeholder="Add metadata field"
                      className="flex-1 rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddField();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddField}
                      className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Add
                    </button>
                  </div>
                  {fields.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
                      {fields.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center gap-1 rounded-full bg-bg-secondary px-2 py-1"
                        >
                          {f}
                          <button
                            type="button"
                            onClick={() => handleRemoveField(f)}
                            className="text-[10px] text-text-secondary hover:text-text-primary"
                            aria-label={`Remove field ${f}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    {editing ? 'Save changes' : 'Create template'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-md border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-3 rounded-2xl border border-border-color bg-card-bg p-4">
              <div className="text-sm font-semibold text-text-primary">Template list</div>
              {templates.length === 0 ? (
                <div className="text-sm text-text-secondary">No templates yet.</div>
              ) : (
                <div className="space-y-2">
                  {templates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="flex items-center justify-between rounded-xl border border-border-color bg-bg-primary px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-semibold text-text-primary">{tmpl.name}</div>
                        <div className="text-xs text-text-secondary">{tmpl.extra_metadata.length} fields</div>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => startEdit(tmpl)}
                          className="rounded-md border border-border-color px-2 py-1 font-semibold text-text-primary hover:border-accent"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(String(tmpl.id))}
                          className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white hover:opacity-90"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {deleteId && (
            <ConfirmDialog
              open
              title="Delete template?"
              description="This will remove the template and unlink it from items."
              confirmLabel="Delete"
              cancelLabel="Cancel"
              loading={false}
              onConfirm={confirmDelete}
              onCancel={() => setDeleteId(null)}
            />
          )}
        </div>
    </ProtectedShell>
  );
}
