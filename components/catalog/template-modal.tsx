'use client';

import { FormEvent, useState } from 'react';
import type { ApiError } from '@/lib/api-client';
import { createCatalogTemplate, type CatalogTemplate } from '@/lib/catalog-api';
import TagInput from './tag-input';

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (template: CatalogTemplate) => void;
}

export default function TemplateModal({ open, onClose, onCreated }: TemplateModalProps) {
  const [name, setName] = useState('');
  const [keys, setKeys] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Template name is required.');
      return;
    }
    if (trimmedName.length > 100) {
      setError('Template name must be at most 100 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await createCatalogTemplate({
        name: trimmedName,
        extra_metadata: keys,
      });
      onCreated(created);
      setName('');
      setKeys([]);
      onClose();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to create template.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl border border-border-color bg-card-bg p-5 shadow-lg"
      >
        <div>
          <h2 className="text-base font-semibold text-text-primary">Create catalog template</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Define a reusable set of metadata fields for similar catalog items.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-primary">Template name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-primary">Metadata keys</label>
          <TagInput
            value={keys}
            onChange={setKeys}
            placeholder="Add keys like brand, material, color"
          />
          <p className="text-[11px] text-text-secondary">
            These will appear as suggested fields in the metadata section when using this template.
          </p>
        </div>

        <div className="flex justify-end gap-2 text-sm pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-border-color bg-bg-primary px-4 py-1.5 text-text-secondary hover:text-text-primary disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create template'}
          </button>
        </div>
      </form>
    </div>
  );
}
