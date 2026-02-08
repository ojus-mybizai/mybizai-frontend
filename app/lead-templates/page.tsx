'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import {
  listLeadTemplates,
  deleteLeadTemplate,
  type LeadTemplate,
} from '@/services/lead-templates';

export default function LeadTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<LeadTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listLeadTemplates(true)
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message ?? 'Failed to load templates');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteLeadTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError((err as Error).message ?? 'Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <ProtectedShell>
      <ModuleGuard module="agents">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Lead Templates</h2>
              <p className="text-sm text-text-secondary">
                Define templates to guide what the agent captures from conversations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/lead-templates/new')}
              className="inline-flex items-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              New Template
            </button>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          {loading && (
            <div className="rounded-2xl border border-border-color bg-card-bg p-8 text-center text-sm text-text-secondary">
              Loading templates…
            </div>
          )}

          {!loading && templates.length === 0 && (
            <div className="rounded-2xl border border-border-color bg-card-bg px-6 py-10 text-center">
              <p className="mb-2 font-medium text-text-primary">No templates yet</p>
              <p className="mb-4 text-sm text-text-secondary">
                Create a template to define intent categories and custom fields for lead extraction.
              </p>
              <button
                type="button"
                onClick={() => router.push('/lead-templates/new')}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                New Template
              </button>
            </div>
          )}

          {!loading && templates.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border-color bg-card-bg">
              <table className="min-w-full divide-y divide-border-color">
                <thead className="bg-bg-secondary text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Intent</th>
                    <th className="px-4 py-3 text-left">Fields</th>
                    <th className="px-4 py-3 text-left">Scope</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color text-sm">
                  {templates.map((t) => (
                    <tr key={t.id} className="hover:bg-bg-secondary/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-text-primary">{t.name}</div>
                        {t.description && (
                          <div className="text-xs text-text-secondary line-clamp-1 mt-0.5">{t.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {t.intent_category ?? '—'}
                        {t.intent_keywords && t.intent_keywords.length > 0 && (
                          <div className="text-[11px] text-text-secondary mt-0.5">
                            {t.intent_keywords.slice(0, 3).join(', ')}
                            {t.intent_keywords.length > 3 ? '…' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{t.fields?.length ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.is_global ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {t.is_global ? 'Global' : 'Business'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => router.push(`/lead-templates/${t.id}/edit`)}
                          className="rounded-md border border-border-color px-3 py-1 text-xs font-semibold text-text-primary hover:bg-bg-secondary"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id)}
                          disabled={deletingId === t.id}
                          className="ml-2 rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
                        >
                          {deletingId === t.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </ModuleGuard>
    </ProtectedShell>
  );
}
