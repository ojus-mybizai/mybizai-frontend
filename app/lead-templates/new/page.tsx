'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { createLeadTemplate } from '@/services/lead-templates';
import type { TemplateField } from '@/services/lead-templates';

const FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'select'] as const;

function defaultField(): TemplateField {
  return {
    name: '',
    type: 'text',
    label: null,
    required: false,
    options: null,
    validation: null,
  };
}

export default function NewLeadTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [intentCategory, setIntentCategory] = useState('');
  const [intentKeywords, setIntentKeywords] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [priority, setPriority] = useState(0);
  const [fields, setFields] = useState<TemplateField[]>([defaultField()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addField = () => setFields((f) => [...f, defaultField()]);
  const removeField = (i: number) => setFields((f) => f.filter((_, j) => j !== i));
  const updateField = (i: number, patch: Partial<TemplateField>) => {
    setFields((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    const keywords = intentKeywords
      .split(/[,\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    const validFields = fields
      .map((f) => ({ ...f, name: f.name.trim(), type: f.type || 'text' }))
      .filter((f) => f.name.length > 0);
    if (validFields.length === 0) {
      setError('Add at least one field with a name.');
      return;
    }
    setLoading(true);
    try {
      const created = await createLeadTemplate({
        name: name.trim(),
        description: description.trim() || null,
        intent_category: intentCategory.trim() || null,
        intent_keywords: keywords.length ? keywords : null,
        is_global: isGlobal,
        is_active: isActive,
        priority,
        fields: validFields,
      });
      router.replace(`/lead-templates/${created.id}/edit`);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedShell>
        <ModuleGuard module="agents">
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">New Lead Template</h2>
            <p className="text-sm text-text-secondary">
              Define intent and custom fields for lead extraction from conversations.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border-color bg-card-bg p-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="e.g. Product inquiry"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Optional description"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-text-primary">Intent category</label>
                <input
                  type="text"
                  value={intentCategory}
                  onChange={(e) => setIntentCategory(e.target.value)}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="e.g. sales"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-text-primary">Intent keywords (comma-separated)</label>
                <input
                  type="text"
                  value={intentKeywords}
                  onChange={(e) => setIntentKeywords(e.target.value)}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="e.g. buy, price, order"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} />
                <span className="text-sm text-text-primary">Global template</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span className="text-sm text-text-primary">Active</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-primary">Priority</label>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value) || 0)}
                  className="w-20 rounded-md border border-border-color bg-bg-primary px-2 py-1 text-sm text-text-primary"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-primary">Fields</label>
                <button type="button" onClick={addField} className="text-xs font-semibold text-accent hover:underline">
                  + Add field
                </button>
              </div>
              <div className="space-y-3">
                {fields.map((f, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-border-color bg-bg-primary p-3">
                    <input
                      type="text"
                      value={f.name}
                      onChange={(e) => updateField(i, { name: e.target.value })}
                      placeholder="Field name (e.g. budget)"
                      className="flex-1 min-w-[120px] rounded-md border border-border-color px-2 py-1.5 text-sm text-text-primary"
                    />
                    <select
                      value={f.type}
                      onChange={(e) => updateField(i, { type: e.target.value })}
                      className="rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={f.label ?? ''}
                      onChange={(e) => updateField(i, { label: e.target.value || null })}
                      placeholder="Label (optional)"
                      className="w-28 rounded-md border border-border-color px-2 py-1.5 text-sm text-text-primary"
                    />
                    <label className="flex items-center gap-1 text-sm text-text-secondary">
                      <input
                        type="checkbox"
                        checked={!!f.required}
                        onChange={(e) => updateField(i, { required: e.target.checked })}
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      onClick={() => removeField(i)}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {loading ? 'Creating…' : 'Create template'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-md border border-border-color px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
        </ModuleGuard>
    </ProtectedShell>
  );
}
