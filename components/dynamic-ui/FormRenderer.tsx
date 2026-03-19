'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { UIForm } from '@/types/ui-protocol';

interface FormRendererProps {
  block: UIForm;
}

function normalizePath(path: string): string {
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

export default function FormRenderer({ block }: FormRendererProps) {
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const method = block.method ?? 'POST';

  const handleChange = (name: string, value: string | number) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await apiFetch(normalizePath(block.submit_api), {
        method,
        body: JSON.stringify(values),
      });
      setSuccess(true);
      setValues({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4">
      {block.title && (
        <h3 className="mb-3 text-base font-semibold text-text-primary">{block.title}</h3>
      )}
      {success ? (
        <p className="text-sm font-medium text-green-600">Submitted successfully.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {block.fields.map((field) => (
            <div key={field.name}>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                {field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={String(values[field.name] ?? '')}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary"
                  rows={3}
                />
              ) : field.type === 'number' ? (
                <input
                  type="number"
                  value={values[field.name] ?? ''}
                  onChange={(e) =>
                    handleChange(field.name, e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary"
                />
              ) : field.type === 'date' ? (
                <input
                  type="date"
                  value={String(values[field.name] ?? '')}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary"
                />
              ) : field.type === 'file' ? (
                <input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleChange(field.name, f.name);
                  }}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary text-sm"
                />
              ) : field.type === 'select' ? (
                <select
                  value={String(values[field.name] ?? '')}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary"
                >
                  <option value="">Select…</option>
                  {/* Options can be extended via block schema if needed */}
                </select>
              ) : (
                <input
                  type="text"
                  value={String(values[field.name] ?? '')}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary"
                />
              )}
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      )}
    </div>
  );
}
