'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { getModel, listFields, type DynamicModel, type DynamicField } from '@/features/data-sheet/api';
import { DataSheetProvider, type DataSheetContextValue } from '@/features/data-sheet/context/data-sheet-context';

const TABS = [
  { slug: '', label: 'Table', href: (id: string) => `/data-sheet/${id}` },
  { slug: 'settings', label: 'Settings', href: (id: string) => `/data-sheet/${id}/settings` },
  { slug: 'import', label: 'Import', href: (id: string) => `/data-sheet/${id}/import` },
];

export function ModelLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ modelId: string }>();
  const pathname = usePathname();
  const modelId = params?.modelId as string | undefined;

  const [model, setModel] = useState<DynamicModel | null>(null);
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadModel = useCallback(async () => {
    if (!modelId) return;
    setLoading(true);
    setError(null);
    try {
      const [modelData, fieldsData] = await Promise.all([
        getModel(modelId),
        listFields(modelId),
      ]);
      setModel(modelData);
      setFields(fieldsData.sort((a, b) => a.order_index - b.order_index));
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load model');
      setModel(null);
      setFields([]);
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  useEffect(() => {
    void loadModel();
  }, [loadModel]);

  if (!modelId) {
    return (
      <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="rounded-xl border border-border-color bg-card-bg px-6 py-8 text-text-secondary">
            Invalid model
          </div>
        </ModuleGuard>
      </ProtectedShell>
    );
  }

  if (loading) {
    return (
      <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="space-y-4">
            <div className="h-6 w-48 animate-pulse rounded bg-bg-secondary" />
            <div className="h-10 w-full animate-pulse rounded bg-bg-secondary" />
          </div>
        </ModuleGuard>
      </ProtectedShell>
    );
  }

  if (error || !model) {
    return (
      <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="rounded-xl border border-border-color bg-card-bg px-6 py-8">
            <p className="font-medium text-text-primary">{error ?? 'Model not found'}</p>
            <Link href="/data-sheet" className="mt-2 inline-block text-sm text-accent hover:underline">
              Back to Data Sheet
            </Link>
          </div>
        </ModuleGuard>
      </ProtectedShell>
    );
  }

  const base = `/data-sheet/${model.id}`;
  const activeTab = TABS.find((t) =>
    t.slug === '' ? pathname === base || pathname === `${base}/` : pathname?.startsWith(`${base}/${t.slug}`)
  );

  const contextValue: DataSheetContextValue = {
    modelId: String(model.id),
    model,
    fields,
    refetchFields: loadModel,
  };

  return (
    <ProtectedShell>
      <ModuleGuard module="lms">
        <DataSheetProvider value={contextValue}>
          <div className="w-full max-w-full space-y-4">
            <nav className="text-xs text-text-secondary">
              <Link href="/data-sheet" className="font-semibold text-accent hover:underline">
                Data Sheet
              </Link>
              <span className="mx-2 text-text-secondary/70">/</span>
              <span className="text-text-primary">{model.display_name}</span>
              {activeTab?.label != null && (
                <>
                  <span className="mx-2 text-text-secondary/70">/</span>
                  <span className="text-text-primary">{activeTab.label}</span>
                </>
              )}
            </nav>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">
                {model.display_name}
              </h1>
            </div>

            <div className="flex gap-1 overflow-x-auto rounded-xl border border-border-color bg-bg-primary px-1 py-1 text-sm">
              {TABS.map((tab) => {
                const href = tab.href(String(model.id));
                const active =
                  tab.slug === ''
                    ? pathname === base || pathname === `${base}/`
                    : pathname?.startsWith(`${base}/${tab.slug}`);
                return (
                  <Link
                    key={tab.slug || 'table'}
                    href={href}
                    className={`rounded-lg px-3 py-2 font-semibold transition ${
                      active
                        ? 'border border-border-color bg-card-bg text-text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>

            <div>{children}</div>
          </div>
        </DataSheetProvider>
      </ModuleGuard>
    </ProtectedShell>
  );
}
