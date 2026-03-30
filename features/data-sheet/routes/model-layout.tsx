'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ModuleGuard from '@/components/module-guard';
import { getModel, listFields, type DynamicModel, type DynamicField } from '@/features/data-sheet/api';
import { DataSheetProvider, type DataSheetContextValue } from '@/features/data-sheet/context/data-sheet-context';

export function ModelLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ modelId: string }>();
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
      <ModuleGuard module="lms">
        <div className="rounded-xl border border-border-color bg-card-bg px-6 py-8 text-text-secondary">
          Invalid model
        </div>
      </ModuleGuard>
    );
  }

  if (loading) {
    return (
      <ModuleGuard module="lms">
        <div className="space-y-4">
          <div className="h-6 w-48 animate-pulse rounded bg-bg-secondary" />
          <div className="h-10 w-full animate-pulse rounded bg-bg-secondary" />
        </div>
      </ModuleGuard>
    );
  }

  if (error || !model) {
    return (
      <ModuleGuard module="lms">
        <div className="rounded-xl border border-border-color bg-card-bg px-6 py-8">
          <p className="font-medium text-text-primary">{error ?? 'Model not found'}</p>
          <Link href="/data-sheet" className="mt-2 inline-block text-sm text-accent hover:underline">
            Back to Data Sheet
          </Link>
        </div>
      </ModuleGuard>
    );
  }

  const contextValue: DataSheetContextValue = {
    modelId: String(model.id),
    model,
    fields,
    refetchFields: loadModel,
  };

  return (
    <ModuleGuard module="lms">
      <DataSheetProvider value={contextValue}>
        <div className="flex w-full max-w-full flex-1 flex-col gap-3 min-h-0">
          {/* Compact header: back arrow + title */}
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/data-sheet"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-color bg-card-bg text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
              title="All data sheets"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-text-primary truncate">
              {model.display_name}
            </h1>
            {model.description && (
              <span className="hidden text-xs text-text-secondary truncate sm:block">
                {model.description}
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 flex flex-col overflow-hidden">{children}</div>
        </div>
      </DataSheetProvider>
    </ModuleGuard>
  );
}
