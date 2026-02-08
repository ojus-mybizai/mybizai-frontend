'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import CatalogForm from '@/components/catalog/catalog-form';
import { AvailabilityBadge } from '@/components/catalog/availability-badge';
import { PriceDisplay } from '@/components/catalog/price-display';
import ConfirmDialog from '@/components/catalog/confirm-dialog';
import { useCatalogStore } from '@/lib/catalog-store';

function CatalogItemContent() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { current, select, update, remove, templates, loadTemplates, categories, loadCategories } = useCatalogStore(
    (s) => ({
      current: s.current,
      select: s.select,
      update: s.update,
      remove: s.remove,
      templates: s.templates,
      loadTemplates: s.loadTemplates,
      categories: s.categories,
      loadCategories: s.loadCategories,
    }),
  );

  const id = params?.id as string | undefined;
  const editMode = search?.get('edit') === '1';
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (id) void select(id);
    if (!templates.length) void loadTemplates();
    if (!categories.length) void loadCategories();
  }, [categories.length, id, loadCategories, loadTemplates, select, templates.length]);

  if (!id) {
    return (
      <ProtectedShell>
        <div className="mx-auto max-w-4xl rounded-2xl border border-border-color bg-card-bg p-6">
          <div className="text-sm text-text-secondary">Invalid catalog item id.</div>
        </div>
      </ProtectedShell>
    );
  }

  if (!current) {
    return (
      <ProtectedShell>
        <div className="mx-auto max-w-4xl rounded-2xl border border-border-color bg-card-bg p-6">
          <div className="text-sm text-text-secondary">Loading or item not found.</div>
        </div>
      </ProtectedShell>
    );
  }

  const handleDelete = async () => {
    await remove(String(current.id));
    router.replace('/catalog');
  };

  if (editMode) {
    return (
      <ProtectedShell>
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">Edit catalog item</h1>
            <p className="text-sm text-text-secondary">Update details for this product or service.</p>
          </div>
          <CatalogForm mode="edit" item={current as any} templates={templates} />
        </div>
      </ProtectedShell>
    );
  }

  return (
    <ProtectedShell>
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-border-color bg-card-bg p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{current.name}</h1>
                <AvailabilityBadge value={current.availability} />
              </div>
              <div className="text-sm text-text-secondary">
                {current.type === 'product' ? 'Product' : 'Service'} · {current.category || 'Uncategorized'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push(`/catalog/${current.id}?edit=1`)}
                className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-3 rounded-2xl border border-border-color bg-card-bg p-4">
              {current.images?.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {current.images.map((url, idx) => (
                    <img key={`${url}-${idx}`} src={url} alt={`${current.name} image ${idx + 1}`} className="h-32 w-full rounded-lg object-cover" />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-text-secondary">No images.</div>
              )}

              <div className="space-y-1">
                <div className="text-lg font-semibold text-text-primary">
                  <PriceDisplay amount={current.price} currency={current.currency} />
                </div>
                <div className="text-sm text-text-secondary">{current.description}</div>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary">
                {(current.tags || []).map((tag) => (
                  <span key={tag} className="rounded-full bg-bg-secondary px-2 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border-color bg-card-bg p-4">
              <div className="text-sm font-semibold text-text-primary">Details</div>
              {current.type === 'product' && (
                <div className="text-sm text-text-secondary">
                  Stock: {current.stock ?? '—'}
                  {current.low_stock_threshold ? ` · Low stock at ${current.low_stock_threshold}` : ''}
                </div>
              )}
              <div className="text-sm text-text-secondary">Availability: {current.availability.replace(/_/g, ' ')}</div>
              <div className="text-sm text-text-secondary">Category: {current.category || '—'}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-2xl border border-border-color bg-card-bg p-4">
              <div className="text-sm font-semibold text-text-primary">Metadata</div>
              {Object.keys(current.metadata || {}).length === 0 ? (
                <div className="text-sm text-text-secondary">No metadata.</div>
              ) : (
                <div className="divide-y divide-border-color rounded-md border border-border-color">
                  {Object.entries(current.metadata).map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-3 px-3 py-2">
                      <div className="font-semibold text-text-primary">{k}</div>
                      <div className="text-sm text-text-secondary break-all">{String(v)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 rounded-2xl border border-border-color bg-card-bg p-4">
              <div className="text-sm font-semibold text-text-primary">Variants (JSON)</div>
              {current.variants ? (
                <pre className="whitespace-pre-wrap rounded-md bg-bg-secondary p-3 text-xs text-text-secondary">
                  {JSON.stringify(current.variants, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-text-secondary">No variants provided.</div>
              )}
            </div>
          </div>

          {showDelete && (
            <ConfirmDialog
              open
              title="Delete item?"
              description="This will permanently remove the item from the catalog."
              confirmLabel="Delete"
              cancelLabel="Cancel"
              loading={false}
              onConfirm={handleDelete}
              onCancel={() => setShowDelete(false)}
            />
          )}
        </div>
    </ProtectedShell>
  );
}

export default function CatalogItemPage() {
  return (
    <Suspense fallback={
      <ProtectedShell>
        <div className="mx-auto max-w-4xl rounded-2xl border border-border-color bg-card-bg p-6">
          <span className="text-sm text-text-secondary">Loading...</span>
        </div>
      </ProtectedShell>
    }>
      <CatalogItemContent />
    </Suspense>
  );
}
