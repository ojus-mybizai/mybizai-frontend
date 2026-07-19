'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { listModels, deleteModel, type DynamicModel } from '@/features/data-sheet/api';
import { normalizeApiError } from '@/features/data-sheet/api/normalize-error';
import dynamic from 'next/dynamic';
import { DeleteModelModal } from '@/features/data-sheet/components/delete-model-modal';
const CreateModelModal = dynamic(
  () => import('@/features/data-sheet/components/create-model-modal').then(m => m.CreateModelModal),
  { ssr: false }
);
import { useStarredDatasheets } from '@/lib/use-starred-datasheets';

export function ModelDirectoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | ReturnType<typeof normalizeApiError> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DynamicModel | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteBlock, setDeleteBlock] = useState<ReturnType<typeof normalizeApiError> | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { isStarred, toggleStar } = useStarredDatasheets();

  const loadModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listModels();
      setModels(data);
    } catch (e) {
      setError(normalizeApiError(e).message);
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadModels();
  }, []);

  useEffect(() => {
    if (searchParams?.get('create') === '1') setCreateModalOpen(true);
  }, [searchParams]);

  const handleDeleteConfirm = async (detach: boolean) => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteModel(deleteTarget.id, detach);
      setDeleteTarget(null);
      setDeleteBlock(null);
      await loadModels();
    } catch (e) {
      const norm = normalizeApiError(e);
      if (norm.referencing_fields && norm.referencing_fields.length > 0) {
        setDeleteBlock(norm);
      } else {
        setError(norm);
        setDeleteTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-full space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">
            Data Sheet
          </h2>
          <p className="mt-0.5 text-base text-text-secondary">
            Create and manage dynamic models with custom fields. Use spreadsheet-style tables to edit records.
          </p>
          {!loading && (
            <p className="mt-1 text-sm text-text-secondary">
              {models.length} {models.length === 1 ? 'model' : 'models'}
              {' · '}
              <span className="text-amber-400">★</span>
              <span className="text-text-secondary"> to pin in sidebar</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/data-sheet/designer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-base font-semibold text-accent hover:bg-accent/20"
          >
            <span aria-hidden>✨</span> Design with AI
          </Link>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-base font-semibold text-white hover:opacity-90"
          >
            Create model
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {typeof error === 'string' ? error : error.message}
          {typeof error === 'object' && error.linked_tool_names?.length ? (
            <p className="mt-2 text-sm">
              Linked tools: {error.linked_tool_names.join(', ')}
            </p>
          ) : null}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border-color bg-card-bg p-4 animate-pulse"
            >
              <div className="h-5 w-3/4 rounded bg-bg-secondary" />
              <div className="mt-2 h-4 w-1/2 rounded bg-bg-secondary" />
              <div className="mt-3 h-4 w-full rounded bg-bg-secondary" />
              <div className="mt-4 flex gap-2">
                <div className="h-8 w-24 rounded bg-bg-secondary" />
                <div className="h-8 w-20 rounded bg-bg-secondary" />
              </div>
            </div>
          ))}
        </div>
      ) : models.length === 0 ? (
        <div className="rounded-xl border border-border-color bg-card-bg px-6 py-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary text-2xl text-text-secondary">
            📋
          </div>
          <p className="mb-1.5 font-medium text-text-primary">No data sheets yet</p>
          <p className="mb-4 text-sm text-text-secondary">
            Create your first data sheet to start organizing your data.
          </p>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Create model
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <div
              key={model.id}
              className="rounded-xl border border-border-color bg-card-bg p-4 transition-colors hover:border-accent/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium text-text-primary">
                      {model.display_name}
                    </h3>
                    {isStarred(model.id) && (
                      <span className="text-amber-400 text-xs leading-none shrink-0" title="Pinned in sidebar">★</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-text-secondary">
                    {model.name}
                  </p>
                  {model.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                      {model.description}
                    </p>
                  )}
                  {model.created_at && (
                    <p className="mt-2 text-xs text-text-secondary">
                      Created {new Date(model.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* Star / unstar — pins in sidebar */}
                  <button
                    type="button"
                    onClick={() => toggleStar(model.id)}
                    title={isStarred(model.id) ? 'Remove from sidebar' : 'Pin to sidebar'}
                    className={`rounded p-1.5 transition-colors ${
                      isStarred(model.id)
                        ? 'text-amber-400 hover:text-amber-300'
                        : 'text-text-secondary hover:text-amber-400'
                    }`}
                  >
                    <span className="text-base leading-none">{isStarred(model.id) ? '★' : '☆'}</span>
                  </button>
                  <div className="relative">
                    <CardActionsMenu model={model} onDelete={() => { setDeleteBlock(null); setDeleteTarget(model); }} />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2 flex-wrap">
                <Link
                  href={`/data-sheet/${model.id}`}
                  className="rounded-md border border-border-color bg-bg-secondary px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-primary"
                >
                  Open table
                </Link>
                <Link
                  href={`/data-sheet/${model.id}/reports`}
                  className="rounded-md border border-border-color bg-bg-secondary px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-primary"
                >
                  Reports
                </Link>
                <Link
                  href={`/data-sheet/${model.id}/settings`}
                  className="rounded-md border border-border-color bg-bg-secondary px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-primary hover:text-text-primary"
                >
                  Settings
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteModelModal
          model={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onClose={() => { setDeleteTarget(null); setDeleteBlock(null); }}
          deleting={deleting}
          referencingFields={deleteBlock?.referencing_fields}
          canDetach={deleteBlock?.can_detach}
        />
      )}

      {createModalOpen && (
        <CreateModelModal
          onClose={() => setCreateModalOpen(false)}
          onSuccess={(modelId) => {
            setCreateModalOpen(false);
            void loadModels();
            router.push(`/data-sheet/${modelId}`);
          }}
        />
      )}

    </div>
  );
}

function CardActionsMenu({ model, onDelete }: { model: DynamicModel; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
        aria-label="Actions"
      >
        <span className="text-base leading-none">⋯</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-border-color bg-card-bg py-1 shadow-lg">
            <Link
              href={`/data-sheet/${model.id}`}
              className="block w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
              onClick={() => setOpen(false)}
            >
              Open table
            </Link>
            <Link
              href={`/data-sheet/${model.id}/reports`}
              className="block w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
              onClick={() => setOpen(false)}
            >
              Reports
            </Link>
            <Link
              href={`/data-sheet/${model.id}/settings`}
              className="block w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
              onClick={() => setOpen(false)}
            >
              Settings
            </Link>
            <button
              type="button"
              onClick={() => { setOpen(false); onDelete(); }}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-bg-secondary"
            >
              Delete model
            </button>
          </div>
        </>
      )}
    </>
  );
}
