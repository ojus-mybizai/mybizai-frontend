'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CatalogFilters } from '@/components/catalog/catalog-filters';
import { AvailabilityBadge } from '@/components/catalog/availability-badge';
import { PriceDisplay } from '@/components/catalog/price-display';
import ConfirmDialog from '@/components/catalog/confirm-dialog';
import { updateCatalogItem } from '@/lib/catalog-api';
import { useCatalogStore } from '@/lib/catalog-store';
import type { ListCatalogParams as FilterType } from '@/lib/catalog-api';

const PAGE_SIZE = 10;

export default function CatalogPage() {
  const router = useRouter();
  const {
    items,
    loading,
    error,
    list,
    remove,
    categories,
    loadCategories,
    total,
    page,
    totalPages,
    stats,
    statsError,
    loadStats,
    loadBestSold,
    bestSold,
  } = useCatalogStore((s) => ({
    items: s.items,
    loading: s.loading,
    error: s.error,
    list: s.list,
    remove: s.remove,
    categories: s.categories,
    loadCategories: s.loadCategories,
    total: s.total,
    page: s.page,
    totalPages: s.totalPages,
    stats: s.stats,
    statsError: s.statsError,
    loadStats: s.loadStats,
    loadBestSold: s.loadBestSold,
    bestSold: s.bestSold,
  }));

  const [filters, setFilters] = useState<FilterType>({ page: 1, per_page: PAGE_SIZE });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({});
  const [stockSaving, setStockSaving] = useState<Record<number, boolean>>({});
  const [stockErrors, setStockErrors] = useState<Record<number, string | null>>({});
  const [stockUpdated, setStockUpdated] = useState<Record<number, boolean>>({});

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    let mounted = true;
    setStatsLoading(true);
    Promise.all([loadStats(), loadBestSold(5)])
      .finally(() => {
        if (mounted) setStatsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [loadStats, loadBestSold]);

  useEffect(() => {
    void list(filters as any);
  }, [filters, list]);

  const tagsPool = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.tags || []))),
    [items],
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    setDeleteId(null);
    void list(filters);
  };

  const baseStockText = (item: { stock: number | null }) =>
    item.stock == null ? '' : String(item.stock);

  const currentDraft = (itemId: number, fallback: string) =>
    stockDrafts[itemId] !== undefined ? stockDrafts[itemId] : fallback;

  const parseStockValue = (raw: string): { ok: true; value: number | null } | { ok: false; message: string } => {
    const value = raw.trim();
    if (!value) return { ok: true, value: null };
    if (!/^\d+$/.test(value)) {
      return { ok: false, message: 'Use whole numbers only (0 or more).' };
    }
    return { ok: true, value: Number(value) };
  };

  const adjustDraft = (itemId: number, base: string, delta: number) => {
    const current = currentDraft(itemId, base);
    const parsed = parseStockValue(current);
    const numeric = parsed.ok ? Math.max(0, parsed.value ?? 0) : 0;
    const next = Math.max(0, numeric + delta);
    setStockDrafts((prev) => ({ ...prev, [itemId]: String(next) }));
    setStockErrors((prev) => ({ ...prev, [itemId]: null }));
    setStockUpdated((prev) => ({ ...prev, [itemId]: false }));
  };

  const cancelDraft = (itemId: number, base: string) => {
    setStockDrafts((prev) => ({ ...prev, [itemId]: base }));
    setStockErrors((prev) => ({ ...prev, [itemId]: null }));
    setStockUpdated((prev) => ({ ...prev, [itemId]: false }));
  };

  const saveStock = async (item: { id: number; stock: number | null }) => {
    const base = baseStockText(item);
    const draft = currentDraft(item.id, base);
    const parsed = parseStockValue(draft);
    if (!parsed.ok) {
      setStockErrors((prev) => ({ ...prev, [item.id]: parsed.message }));
      return;
    }

    if (parsed.value === item.stock) {
      setStockErrors((prev) => ({ ...prev, [item.id]: null }));
      return;
    }

    setStockSaving((prev) => ({ ...prev, [item.id]: true }));
    setStockErrors((prev) => ({ ...prev, [item.id]: null }));
    setStockUpdated((prev) => ({ ...prev, [item.id]: false }));

    try {
      await updateCatalogItem(item.id, { stock: parsed.value });
      setStockDrafts((prev) => ({ ...prev, [item.id]: parsed.value == null ? '' : String(parsed.value) }));
      setStockUpdated((prev) => ({ ...prev, [item.id]: true }));
      setTimeout(() => {
        setStockUpdated((prev) => ({ ...prev, [item.id]: false }));
      }, 1500);
      void list(filters);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update stock.';
      const hint =
        /conflict|409/i.test(message)
          ? ' Another stock update happened recently. Refresh and try again.'
          : '';
      setStockErrors((prev) => ({ ...prev, [item.id]: `${message}${hint}` }));
      setStockDrafts((prev) => ({ ...prev, [item.id]: base }));
    } finally {
      setStockSaving((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const isEmpty = !loading && items.length === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Catalog</h2>
              <p className="text-sm text-text-secondary">Products and services used by your agents.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/catalog/new')}
              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Create item
            </button>
          </div>

          {/* Catalog status section */}
          <div className="rounded-2xl border border-border-color bg-card-bg p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Catalog status</h3>
            {statsLoading && (
              <div className="text-xs text-text-secondary py-2">Loading stats…</div>
            )}
            {statsError && !statsLoading && (
              <div className="text-xs text-red-600 dark:text-red-400 py-2">{statsError}</div>
            )}
            {!statsLoading && !statsError && stats && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-border-color bg-bg-primary px-3 py-2">
                    <div className="text-[11px] font-medium text-text-secondary">Total items</div>
                    <div className="text-lg font-semibold text-text-primary">{stats.total}</div>
                  </div>
                  <div className="rounded-xl border border-border-color bg-bg-primary px-3 py-2">
                    <div className="text-[11px] font-medium text-text-secondary">Products</div>
                    <div className="text-lg font-semibold text-text-primary">{stats.products}</div>
                  </div>
                  <div className="rounded-xl border border-border-color bg-bg-primary px-3 py-2">
                    <div className="text-[11px] font-medium text-text-secondary">Services</div>
                    <div className="text-lg font-semibold text-text-primary">{stats.services}</div>
                  </div>
                  <div className="rounded-xl border border-border-color bg-bg-primary px-3 py-2">
                    <div className="text-[11px] font-medium text-text-secondary">Avg price</div>
                    <div className="text-lg font-semibold text-text-primary">
                      <PriceDisplay amount={stats.averagePrice} currency="INR" />
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-border-color bg-bg-primary p-3 lg:col-span-2">
                    <div className="text-[11px] font-medium text-text-secondary mb-2">Availability</div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-text-primary">
                        Available {stats.availability?.available ?? 0}
                      </span>
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-text-primary">
                        Out of stock {stats.availability?.out_of_stock ?? 0}
                      </span>
                      <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-text-primary">
                        Discontinued {stats.availability?.discontinued ?? 0}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border-color bg-bg-primary p-3">
                    <div className="text-[11px] font-medium text-text-secondary mb-2">Best sold</div>
                    {bestSold && bestSold.length > 0 ? (
                      <ul className="space-y-1 text-xs text-text-secondary">
                        {bestSold.slice(0, 5).map((row) => (
                          <li key={row.catalog_item_id} className="flex justify-between gap-2">
                            <span className="line-clamp-1 text-text-primary">{row.name}</span>
                            <span className="shrink-0">{row.quantity_sold} sold</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-text-secondary">No order data yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <CatalogFilters
            categories={categories}
            tagsPool={tagsPool}
            initial={filters}
            onApply={(next) => setFilters((f) => ({ ...f, ...next }))}
          />

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && <div className="text-sm text-text-secondary">Loading catalog…</div>}

          {isEmpty && (
            <div className="rounded-2xl border border-border-color bg-card-bg px-6 py-10 text-center text-sm text-text-secondary">
              <p className="mb-2 font-medium text-text-primary">No items found</p>
              <p className="mb-4">Adjust filters or create a new product/service.</p>
              <button
                type="button"
                onClick={() => router.push('/catalog/new')}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Add item
              </button>
            </div>
          )}

          {!isEmpty && (
            <div className="overflow-hidden rounded-2xl border border-border-color bg-card-bg">
              <table className="min-w-full divide-y divide-border-color">
                <thead className="bg-bg-secondary text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Price</th>
                    <th className="px-4 py-3 text-left">Availability</th>
                    <th className="px-4 py-3 text-left">Stock</th>
                    <th className="px-4 py-3 text-left">Tags</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color text-sm">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-bg-secondary/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.images[0] ? (
                            <img
                              src={item.images[0]}
                              alt={item.name || 'Product image'}
                              className="h-12 w-12 rounded-md border border-border-color object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-border-color text-[10px] text-text-secondary">
                              No image
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-text-primary">{item.name}</div>
                            <div className="text-xs text-text-secondary line-clamp-2">{item.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs capitalize text-text-secondary">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{item.category || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        <PriceDisplay amount={item.price} currency={item.currency} />
                      </td>
                      <td className="px-4 py-3">
                        <AvailabilityBadge value={item.availability} />
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {item.type === 'product' ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => adjustDraft(item.id, baseStockText(item), -1)}
                                disabled={!!stockSaving[item.id]}
                                className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
                                aria-label={`Decrease stock for ${item.name}`}
                              >
                                -1
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={currentDraft(item.id, baseStockText(item))}
                                onChange={(e) => {
                                  setStockDrafts((prev) => ({ ...prev, [item.id]: e.target.value }));
                                  setStockErrors((prev) => ({ ...prev, [item.id]: null }));
                                  setStockUpdated((prev) => ({ ...prev, [item.id]: false }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void saveStock(item);
                                  }
                                  if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelDraft(item.id, baseStockText(item));
                                  }
                                }}
                                className="w-16 rounded border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                aria-label={`Stock for ${item.name}`}
                              />
                              <button
                                type="button"
                                onClick={() => adjustDraft(item.id, baseStockText(item), 1)}
                                disabled={!!stockSaving[item.id]}
                                className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
                                aria-label={`Increase stock for ${item.name}`}
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                onClick={() => void saveStock(item)}
                                disabled={!!stockSaving[item.id]}
                                className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-50"
                              >
                                {stockSaving[item.id] ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                            {stockErrors[item.id] && (
                              <div className="text-[11px] text-red-600">{stockErrors[item.id]}</div>
                            )}
                            {stockUpdated[item.id] && !stockErrors[item.id] && (
                              <div className="text-[11px] text-emerald-600">Updated</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-text-secondary">Not applicable</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 text-[11px] text-text-secondary">
                          {(item.tags || []).slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded-full bg-bg-secondary px-2 py-0.5">
                              {tag}
                            </span>
                          ))}
                          {(item.tags || []).length > 3 && (
                            <span className="text-[11px] text-text-secondary">
                              +{(item.tags || []).length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => router.push(`/catalog/${item.id}`)}
                            className="text-accent hover:underline"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/catalog/${item.id}?edit=1`)}
                            className="text-text-secondary hover:text-text-primary"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(String(item.id))}
                            className="text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between border-t border-border-color px-4 py-3 text-xs text-text-secondary">
                <div>
                  Page {page} of {totalPages} · {total} items
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (f.page || 1) - 1) }))}
                    className="rounded-md border border-border-color bg-bg-primary px-3 py-1 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}
                    className="rounded-md border border-border-color bg-bg-primary px-3 py-1 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {deleteId && (
            <ConfirmDialog
              open
              title="Delete item?"
              description="This will permanently remove the item."
              confirmLabel="Delete"
              cancelLabel="Cancel"
              loading={false}
              onConfirm={handleDelete}
              onCancel={() => setDeleteId(null)}
            />
          )}
        </div>
  );
}
