'use client';

import { Suspense } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import CatalogForm from '@/components/catalog/catalog-form';
import { AvailabilityBadge } from '@/components/catalog/availability-badge';
import { PriceDisplay } from '@/components/catalog/price-display';
import ConfirmDialog from '@/components/catalog/confirm-dialog';
import { useCatalogStore } from '@/lib/catalog-store';

type Availability = 'available' | 'out_of_stock' | 'discontinued';

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function renderStructuredValue(value: unknown): React.ReactNode {
  if (value == null) return <span className="text-text-secondary">—</span>;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span className="text-text-primary">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-text-secondary">None</span>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((entry, idx) => (
          <span
            key={`arr-${idx}`}
            className="rounded-full border border-border-color bg-bg-secondary px-2 py-0.5 text-xs text-text-primary"
          >
            {typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'
              ? String(entry)
              : JSON.stringify(entry)}
          </span>
        ))}
      </div>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-text-secondary">None</span>;
    return (
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="rounded-md border border-border-color bg-bg-secondary/60 px-2 py-1">
            <span className="font-medium text-text-primary">{k}:</span>{' '}
            <span className="text-text-secondary">
              {typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
                ? String(v)
                : JSON.stringify(v)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-text-secondary">{String(value)}</span>;
}

function CatalogItemContent() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const {
    current,
    loading,
    error,
    select,
    update,
    create,
    remove,
    templates,
    loadTemplates,
    categories,
    loadCategories,
    itemInsights,
    itemInsightsLoading,
    itemInsightsError,
    loadItemInsights,
  } = useCatalogStore((s) => ({
    current: s.current,
    loading: s.loading,
    error: s.error,
    select: s.select,
    update: s.update,
    create: s.create,
    remove: s.remove,
    templates: s.templates,
    loadTemplates: s.loadTemplates,
    categories: s.categories,
    loadCategories: s.loadCategories,
    itemInsights: s.itemInsights,
    itemInsightsLoading: s.itemInsightsLoading,
    itemInsightsError: s.itemInsightsError,
    loadItemInsights: s.loadItemInsights,
  }));

  const id = params?.id as string | undefined;
  const editMode = search?.get('edit') === '1';
  const [showDelete, setShowDelete] = useState(false);
  const [stockDraft, setStockDraft] = useState('');
  const [stockSaving, setStockSaving] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [duplicateSaving, setDuplicateSaving] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const hasCurrentForRoute = !!current && String(current.id) === id;
  const currentTemplate = useMemo(() => {
    if (!current?.template_id) return null;
    return templates.find((t) => t.id === current.template_id) ?? null;
  }, [current?.template_id, templates]);

  useEffect(() => {
    if (id) {
      void select(id);
      void loadItemInsights(id, 5);
    }
    if (!templates.length) void loadTemplates();
    if (!categories.length) void loadCategories();
  }, [categories.length, id, loadCategories, loadItemInsights, loadTemplates, select, templates.length]);

  useEffect(() => {
    if (current?.type === 'product') {
      setStockDraft(current.stock == null ? '' : String(current.stock));
    } else {
      setStockDraft('');
    }
  }, [current?.id, current?.stock, current?.type]);

  if (!id) {
    return (
      <ProtectedShell>
        <div className="mx-auto max-w-4xl rounded-2xl border border-border-color bg-card-bg p-6">
          <div className="text-sm text-text-secondary">Invalid catalog item id.</div>
        </div>
      </ProtectedShell>
    );
  }

  if (loading && !hasCurrentForRoute) {
    return (
      <ProtectedShell>
        <div className="mx-auto max-w-4xl rounded-2xl border border-border-color bg-card-bg p-6">
          <div className="text-sm text-text-secondary">Loading catalog item...</div>
        </div>
      </ProtectedShell>
    );
  }

  if (error && !hasCurrentForRoute) {
    return (
      <ProtectedShell>
        <div className="mx-auto max-w-4xl space-y-3 rounded-2xl border border-border-color bg-card-bg p-6">
          <div className="text-sm font-semibold text-red-600">Could not load this catalog item.</div>
          <div className="text-sm text-text-secondary">{error}</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                void select(id);
                void loadItemInsights(id, 5);
              }}
              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => router.push('/catalog')}
              className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent"
            >
              Back to catalog
            </button>
          </div>
        </div>
      </ProtectedShell>
    );
  }

  if (!hasCurrentForRoute) {
    return (
      <ProtectedShell>
        <div className="mx-auto max-w-4xl space-y-3 rounded-2xl border border-border-color bg-card-bg p-6">
          <div className="text-sm font-semibold text-text-primary">Catalog item not found.</div>
          <div className="text-sm text-text-secondary">
            The item may have been removed or you may not have access.
          </div>
          <button
            type="button"
            onClick={() => router.push('/catalog')}
            className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent"
          >
            Back to catalog
          </button>
        </div>
      </ProtectedShell>
    );
  }

  const handleDelete = async () => {
    try {
      await remove(String(current.id));
      router.replace('/catalog');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete item.');
    }
  };

  const handleSaveStock = async () => {
    if (current.type !== 'product') return;
    const trimmed = stockDraft.trim();
    if (trimmed && !/^\d+$/.test(trimmed)) {
      setActionError('Stock must be a whole number 0 or more.');
      return;
    }
    const nextStock = trimmed ? Number(trimmed) : null;
    if (nextStock === current.stock) return;
    setStockSaving(true);
    setActionError(null);
    try {
      await update(String(current.id), { stock: nextStock });
      setActionNotice('Stock updated.');
      void loadItemInsights(id, 5);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update stock.');
    } finally {
      setStockSaving(false);
    }
  };

  const handleAvailabilityChange = async (value: Availability) => {
    if (value === current.availability) return;
    setAvailabilitySaving(true);
    setActionError(null);
    try {
      await update(String(current.id), { availability: value });
      setActionNotice(`Availability set to ${value.replace(/_/g, ' ')}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update availability.');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const handleDuplicate = async () => {
    setDuplicateSaving(true);
    setActionError(null);
    try {
      const duplicateName = `${current.name} (Copy)`.slice(0, 255);
      const created = await create({
        name: duplicateName,
        description: current.description,
        category: current.category,
        price: current.price,
        currency: current.currency,
        availability: current.availability,
        type: current.type,
        stock: current.type === 'product' ? current.stock : null,
        low_stock_threshold: current.type === 'product' ? current.low_stock_threshold : null,
        tags: current.tags ?? undefined,
        variants: current.variants ?? undefined,
        images: current.images ?? [],
        metadata: current.metadata ?? {},
        template_id: current.template_id,
      });
      router.push(`/catalog/${created.id}?edit=1`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not duplicate item.');
    } finally {
      setDuplicateSaving(false);
    }
  };

  const handleCopySku = async () => {
    if (!current.sku) return;
    try {
      await navigator.clipboard.writeText(current.sku);
      setActionNotice('SKU copied.');
    } catch {
      setActionNotice(`SKU: ${current.sku}`);
    }
  };

  const variantsEntries =
    current.variants && typeof current.variants === 'object'
      ? Object.entries(current.variants as Record<string, unknown>)
      : [];

  const metadataEntries =
    current.metadata && typeof current.metadata === 'object' ? Object.entries(current.metadata) : [];

  const heroImage = current.images?.[0] ?? null;
  const extraImages = current.images?.slice(1) ?? [];

  const onAdjustStock = (delta: number) => {
    const numeric = /^\d+$/.test(stockDraft.trim()) ? Number(stockDraft.trim()) : current.stock ?? 0;
    setStockDraft(String(Math.max(0, numeric + delta)));
  };

  if (editMode) {
    return (
      <ProtectedShell>
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">Edit catalog item</h1>
            <p className="text-sm text-text-secondary">Update details for this product or service.</p>
          </div>
          <CatalogForm mode="edit" item={current} templates={templates} />
        </div>
      </ProtectedShell>
    );
  }

  return (
    <ProtectedShell>
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <button type="button" onClick={() => router.push('/catalog')} className="hover:text-text-primary">
            Catalog
          </button>
          <span>/</span>
          <span className="text-text-primary">{current.name}</span>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border-color bg-card-bg p-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => router.push('/catalog')}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              ← Back to catalog
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{current.name}</h1>
                <AvailabilityBadge value={current.availability} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                <span>{current.type === 'product' ? 'Product' : 'Service'}</span>
                <span>Category: {current.category || 'Uncategorized'}</span>
                <span>SKU: {current.sku || '—'}</span>
                <span>Template: {currentTemplate?.name || 'None'}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopySku}
              disabled={!current.sku}
              className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent disabled:opacity-50"
            >
              Copy SKU
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={duplicateSaving}
              className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent disabled:opacity-60"
            >
              {duplicateSaving ? 'Duplicating...' : 'Duplicate'}
            </button>
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

        {(actionError || actionNotice || error) && (
          <div className="space-y-2">
            {actionError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {actionError}
              </div>
            )}
            {actionNotice && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {actionNotice}
              </div>
            )}
            {error && (
              <button
                type="button"
                onClick={() => {
                  void select(id);
                  void loadItemInsights(id, 5);
                }}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-800"
              >
                Sync warning: {error}. Click to retry.
              </button>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-3 rounded-2xl border border-border-color bg-card-bg p-4 md:col-span-2">
            {heroImage ? (
              <button
                type="button"
                onClick={() => setExpandedImage(heroImage)}
                className="block w-full overflow-hidden rounded-lg border border-border-color"
              >
                <img src={heroImage} alt={`${current.name} cover`} className="h-64 w-full object-cover" />
              </button>
            ) : (
              <div className="rounded-lg border border-dashed border-border-color p-6 text-sm text-text-secondary">
                No images uploaded.
              </div>
            )}
            {extraImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {extraImages.map((url, idx) => (
                  <button
                    type="button"
                    key={`${url}-${idx}`}
                    onClick={() => setExpandedImage(url)}
                    className="overflow-hidden rounded-md border border-border-color"
                  >
                    <img src={url} alt={`${current.name} image ${idx + 2}`} className="h-20 w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <div className="text-xl font-semibold text-text-primary">
                <PriceDisplay amount={current.price} currency={current.currency} />
              </div>
              <div className="text-sm text-text-secondary">
                {current.description || 'No description provided.'}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary">
              {(current.tags || []).length ? (
                (current.tags || []).map((tag) => (
                  <span key={tag} className="rounded-full bg-bg-secondary px-2 py-0.5">
                    {tag}
                  </span>
                ))
              ) : (
                <span>No tags.</span>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border-color bg-card-bg p-4">
            <div className="text-sm font-semibold text-text-primary">Quick actions</div>
            {current.type === 'product' ? (
              <div className="space-y-2">
                <div className="text-xs text-text-secondary">Stock</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAdjustStock(-1)}
                    className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                  >
                    -1
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={stockDraft}
                    onChange={(e) => setStockDraft(e.target.value)}
                    className="w-20 rounded border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => onAdjustStock(1)}
                    className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveStock()}
                    disabled={stockSaving}
                    className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-50"
                  >
                    {stockSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <div className="text-xs text-text-secondary">
                  Low stock threshold: {current.low_stock_threshold ?? '—'}
                </div>
              </div>
            ) : (
              <div className="text-xs text-text-secondary">Stock not applicable for services.</div>
            )}

            <div className="space-y-2">
              <div className="text-xs text-text-secondary">Availability</div>
              <div className="flex flex-wrap gap-2">
                {(['available', 'out_of_stock', 'discontinued'] as Availability[]).map((state) => (
                  <button
                    key={state}
                    type="button"
                    disabled={availabilitySaving || state === current.availability}
                    onClick={() => void handleAvailabilityChange(state)}
                    className={`rounded-md border px-2 py-1 text-xs capitalize ${
                      state === current.availability
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border-color bg-bg-primary text-text-secondary hover:text-text-primary'
                    } disabled:opacity-60`}
                  >
                    {state.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1 rounded-md border border-border-color bg-bg-secondary/40 p-3 text-xs text-text-secondary">
              <div>Created: {formatDateTime(current.created_at)}</div>
              <div>Updated: {formatDateTime(current.updated_at)}</div>
              <div>Template: {currentTemplate?.name || 'None'}</div>
              <div>Item ID: {current.id}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-2xl border border-border-color bg-card-bg p-4">
            <div className="text-sm font-semibold text-text-primary">Metadata</div>
            {metadataEntries.length === 0 ? (
              <div className="text-sm text-text-secondary">No metadata available.</div>
            ) : (
              <div className="divide-y divide-border-color rounded-md border border-border-color">
                {metadataEntries.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3 px-3 py-2">
                    <div className="font-semibold text-text-primary">{k}</div>
                    <div className="max-w-[65%] truncate text-sm text-text-secondary" title={String(v)}>
                      {typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
                        ? String(v)
                        : JSON.stringify(v)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2 rounded-2xl border border-border-color bg-card-bg p-4">
            <div className="text-sm font-semibold text-text-primary">Variants</div>
            {variantsEntries.length ? (
              <div className="space-y-2">
                {variantsEntries.map(([key, value]) => (
                  <div key={key} className="space-y-1 rounded-md border border-border-color p-2">
                    <div className="text-sm font-medium text-text-primary">{key}</div>
                    <div className="text-xs text-text-secondary">{renderStructuredValue(value)}</div>
                  </div>
                ))}
              </div>
            ) : current.variants ? (
              <pre className="whitespace-pre-wrap rounded-md bg-bg-secondary p-3 text-xs text-text-secondary">
                {JSON.stringify(current.variants, null, 2)}
              </pre>
            ) : (
              <div className="text-sm text-text-secondary">No variants provided.</div>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border-color bg-card-bg p-4">
          <div className="text-sm font-semibold text-text-primary">Performance</div>
          {itemInsightsLoading ? (
            <div className="text-sm text-text-secondary">Loading item insights...</div>
          ) : itemInsightsError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {itemInsightsError}
            </div>
          ) : itemInsights ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border-color bg-bg-primary px-3 py-2">
                  <div className="text-[11px] text-text-secondary">Orders</div>
                  <div className="text-lg font-semibold text-text-primary">{itemInsights.order_count}</div>
                </div>
                <div className="rounded-xl border border-border-color bg-bg-primary px-3 py-2">
                  <div className="text-[11px] text-text-secondary">Sold units</div>
                  <div className="text-lg font-semibold text-text-primary">{itemInsights.total_quantity_sold}</div>
                </div>
                <div className="rounded-xl border border-border-color bg-bg-primary px-3 py-2">
                  <div className="text-[11px] text-text-secondary">Revenue</div>
                  <div className="text-lg font-semibold text-text-primary">
                    <PriceDisplay amount={itemInsights.total_revenue} currency={current.currency} />
                  </div>
                </div>
                <div className="rounded-xl border border-border-color bg-bg-primary px-3 py-2">
                  <div className="text-[11px] text-text-secondary">Last sold</div>
                  <div className="text-sm font-semibold text-text-primary">
                    {formatDateTime(itemInsights.last_sold_at)}
                  </div>
                </div>
              </div>

              {itemInsights.recent_orders.length > 0 ? (
                <div className="overflow-hidden rounded-md border border-border-color">
                  <table className="min-w-full divide-y divide-border-color text-sm">
                    <thead className="bg-bg-secondary text-xs uppercase text-text-secondary">
                      <tr>
                        <th className="px-3 py-2 text-left">Order</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Qty</th>
                        <th className="px-3 py-2 text-left">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color">
                      {itemInsights.recent_orders.map((row) => (
                        <tr key={row.order_id}>
                          <td className="px-3 py-2 text-text-primary">#{row.order_id}</td>
                          <td className="px-3 py-2 text-text-secondary">{formatDateTime(row.created_at)}</td>
                          <td className="px-3 py-2 text-text-secondary">
                            {row.status} · {row.payment_status}
                          </td>
                          <td className="px-3 py-2 text-text-secondary">{row.quantity}</td>
                          <td className="px-3 py-2 text-text-primary">
                            <PriceDisplay amount={row.revenue} currency={row.currency || current.currency} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-text-secondary">No sales yet for this item.</div>
              )}
            </div>
          ) : (
            <div className="text-sm text-text-secondary">No performance data available yet.</div>
          )}
        </div>

        {expandedImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => setExpandedImage(null)}
          >
            <img
              src={expandedImage}
              alt={`${current.name} expanded`}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            />
          </div>
        )}

        {showDelete && (
          <ConfirmDialog
            open
            title={`Delete ${current.name}?`}
            description={
              <span>
                This will permanently remove <span className="font-semibold">{current.name}</span>
                {current.sku ? ` (SKU: ${current.sku})` : ''} from your catalog.
              </span>
            }
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
    <Suspense
      fallback={
        <ProtectedShell>
          <div className="mx-auto max-w-4xl rounded-2xl border border-border-color bg-card-bg p-6">
            <span className="text-sm text-text-secondary">Loading...</span>
          </div>
        </ProtectedShell>
      }
    >
      <CatalogItemContent />
    </Suspense>
  );
}
