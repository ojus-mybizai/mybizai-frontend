'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApiError } from '@/lib/api-client';
import {
  CatalogItem,
  CatalogItemCreate,
  CatalogItemUpdate,
  CatalogTemplate,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
} from '@/lib/catalog-api';
import ImageUploader from './image-uploader';
import TagInput from './tag-input';
import MetadataEditor from './metadata-editor';
import VariantsEditor from './variants-editor';
import ConfirmDialog from './confirm-dialog';
import TemplateModal from './template-modal';

interface CatalogFormProps {
  mode: 'create' | 'edit';
  item?: CatalogItem;
  templates: CatalogTemplate[];
}

export default function CatalogForm({ mode, item, templates }: CatalogFormProps) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [availability, setAvailability] = useState<'available' | 'out_of_stock' | 'discontinued'>(
    'available',
  );
  const [type, setType] = useState<'product' | 'service'>('product');
  const [sku, setSku] = useState('');
  const [stock, setStock] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [variants, setVariants] = useState<Record<string, unknown> | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [templateId, setTemplateId] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [templateOptions, setTemplateOptions] = useState<CatalogTemplate[]>(templates || []);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  useEffect(() => {
    setTemplateOptions(templates || []);
  }, [templates]);
  const currentTemplate = useMemo(
    () => templateOptions.find((t) => t.id === templateId) || null,
    [templateId, templateOptions],
  );

  useEffect(() => {
    if (!item) return;
    setName(item.name || '');
    setDescription(item.description ?? '');
    setCategory(item.category ?? '');
    setPrice(String(item.price));
    setCurrency(item.currency || 'INR');
    setAvailability(item.availability);
    setType(item.type);
    setSku(item.sku ?? '');
    setStock(item.stock != null ? String(item.stock) : '');
    setLowStockThreshold(item.low_stock_threshold != null ? String(item.low_stock_threshold) : '');
    setTags(item.tags ?? []);
    setVariants(item.variants ?? null);
    setImages(item.images ?? []);
    setMetadata(item.metadata ?? {});
    setTemplateId(item.template_id ?? null);
  }, [item]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (name.trim().length > 255) {
      setError('Name must be at most 255 characters.');
      return;
    }
    if (category && category.length > 100) {
      setError('Category must be at most 100 characters.');
      return;
    }

    const priceValue = Number(price);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setError('Price must be a number greater than or equal to 0.');
      return;
    }

    const stockValue = stock.trim() ? Number(stock) : null;
    if (stockValue != null && (!Number.isInteger(stockValue) || stockValue < 0)) {
      setError('Stock must be an integer greater than or equal to 0.');
      return;
    }

    const lowStockValue = lowStockThreshold.trim() ? Number(lowStockThreshold) : null;
    if (lowStockValue != null && (!Number.isInteger(lowStockValue) || lowStockValue < 0)) {
      setError('Low stock threshold must be an integer greater than or equal to 0.');
      return;
    }

    const basePayload: CatalogItemCreate = {
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      price: priceValue,
      currency: currency || 'INR',
      availability,
      type,
      sku: sku.trim() || null,
      stock: type === 'product' ? stockValue : null,
      low_stock_threshold: type === 'product' ? lowStockValue : null,
      tags: tags.length ? tags : undefined,
      variants: variants ?? undefined,
      images: images,
      metadata: metadata,
      template_id: templateId ?? undefined,
    };

    setSubmitting(true);

    try {
      if (mode === 'create') {
        const created = await createCatalogItem(basePayload);
        setSuccess('Catalog item created.');
        router.replace('/catalog');
        return;
      }

      if (!item) {
        setError('No item loaded to update.');
        return;
      }

      const updatePayload: CatalogItemUpdate = basePayload;
      const updated = await updateCatalogItem(item.id, updatePayload);
      setSuccess('Changes saved.');
      // Refresh current route so any consuming components see latest data
      router.replace(`/catalog/${updated.id}`);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to save catalog item.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await deleteCatalogItem(item.id);
      setDeleteLoading(false);
      setDeleteOpen(false);
      router.replace('/catalog');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to delete catalog item.');
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary">
            {success}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-primary">Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-primary">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-text-primary">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-text-primary">Availability</label>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value as any)}
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="available">Available</option>
                    <option value="out_of_stock">Out of stock</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-text-primary">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="product">Product</option>
                    <option value="service">Service</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-medium text-text-primary">Pricing & stock</h2>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-sm font-medium text-text-primary">Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-text-primary">Currency</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-text-primary">SKU</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {type === 'product' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-text-primary">Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-text-primary">
                      Low stock threshold
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-primary">Tags</label>
                <TagInput
                  value={tags}
                  onChange={setTags}
                  placeholder="Add tags like summer, veg, discount"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-primary">Variants (JSON)</label>
                <VariantsEditor value={variants} onChange={setVariants} />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-text-primary">Metadata</label>
                <MetadataEditor
                  value={metadata}
                  onChange={setMetadata}
                  templateKeys={currentTemplate?.extra_metadata}
                  contextKey={item ? `item-${item.id}` : `mode-${mode}`}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-text-primary">Template</label>
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(true)}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Create template
                </button>
              </div>
              <select
                value={templateId ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setTemplateId(value ? Number(value) : null);
                }}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">No template</option>
                {templateOptions.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-text-primary">Images</label>
                <span className="text-[11px] text-text-secondary">First image is used as cover</span>
              </div>
              <ImageUploader images={images} onChange={setImages} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          {mode === 'edit' && item && (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="text-sm text-text-secondary hover:text-text-primary"
            >
              Delete item
            </button>
          )}

          <div className="flex flex-1 justify-end gap-2 text-sm">
            <button
              type="button"
              onClick={() => router.replace('/catalog')}
              disabled={submitting}
              className="rounded-md border border-border-color bg-bg-primary px-4 py-2 text-text-secondary hover:text-text-primary disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting
                ? mode === 'create'
                  ? 'Creating...'
                  : 'Saving...'
                : mode === 'create'
                ? 'Create item'
                : 'Save changes'}
            </button>
          </div>
        </div>
      </form>

      {mode === 'edit' && item && (
        <ConfirmDialog
          open={deleteOpen}
          title="Delete catalog item?"
          description={
            <span>
              This will permanently delete <span className="font-semibold">{item.name}</span> and
              its images.
            </span>
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => setDeleteOpen(false)}
        />
      )}

      <TemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onCreated={(template) => {
          setTemplateOptions((prev) => {
            const existing = prev.filter((t) => t.id !== template.id);
            return [template, ...existing];
          });
          setTemplateId(template.id);
        }}
      />
    </>
  );
}
