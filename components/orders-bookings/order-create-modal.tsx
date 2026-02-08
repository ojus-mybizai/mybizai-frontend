'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  createOrder,
  type OrderCreatePayload,
  type OrderItem,
  type OrderStatus,
  type PaymentStatus,
} from '@/services/orders';
import { listLeadsForSelect, type LeadOption } from '@/services/customers';
import { listCatalogItems, type CatalogItem } from '@/lib/catalog-api';
import { LeadSelectWithCreate } from './lead-select-with-create';
import { SearchableSelect } from './searchable-select';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'refunded', label: 'Refunded' },
];

export interface OrderCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type LineRow = { product_id: number; quantity: number; price: number };

export function OrderCreateModal({ open, onClose, onCreated }: OrderCreateModalProps) {
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [leadsLoadError, setLeadsLoadError] = useState<string | null>(null);
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leadId, setLeadId] = useState<string>('');
  const [lines, setLines] = useState<LineRow[]>([{ product_id: 0, quantity: 1, price: 0 }]);
  const [currency, setCurrency] = useState('INR');
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');

  const loadLeads = useCallback(() => {
    setLeadsLoadError(null);
    setLoadingLeads(true);
    listLeadsForSelect({ per_page: 100 })
      .then(setLeads)
      .catch((err) => {
        setLeads([]);
        setLeadsLoadError((err as Error).message ?? 'Failed to load leads');
      })
      .finally(() => setLoadingLeads(false));
  }, []);

  const loadCatalog = useCallback(() => {
    setCatalogLoadError(null);
    setLoadingCatalog(true);
    listCatalogItems({ type: 'product', per_page: 100 })
      .then((r) => setCatalogItems(r.items ?? []))
      .catch((err) => {
        setCatalogItems([]);
        setCatalogLoadError((err as Error).message ?? 'Failed to load products');
      })
      .finally(() => setLoadingCatalog(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLeadId('');
    setLines([{ product_id: 0, quantity: 1, price: 0 }]);
    setCurrency('INR');
    setStatus('pending');
    setPaymentStatus('unpaid');
    setLeadsLoadError(null);
    setCatalogLoadError(null);
    loadLeads();
    loadCatalog();
  }, [open, loadLeads, loadCatalog]);

  const addLine = () => {
    setLines((prev) => [...prev, { product_id: 0, quantity: 1, price: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof LineRow, value: number) => {
    setLines((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const onProductSelect = (index: number, productId: number) => {
    const product = catalogItems.find((p) => p.id === productId);
    const price = product ? product.price : 0;
    updateLine(index, 'product_id', productId);
    updateLine(index, 'price', price);
  };

  const totalAmount = lines.reduce((sum, row) => sum + row.quantity * row.price, 0);
  const validLines = lines.filter((row) => row.product_id > 0 && row.quantity >= 1 && row.price >= 0);
  const items: OrderItem[] = validLines.map((row) => ({
    product_id: row.product_id,
    quantity: row.quantity,
    price: row.price,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lid = leadId ? parseInt(leadId, 10) : 0;
    if (!lid || items.length === 0) {
      setError('Select a lead and add at least one item.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: OrderCreatePayload = {
        lead_id: lid,
        items,
        total_amount: totalAmount,
        currency,
        status,
        payment_status: paymentStatus,
      };
      await createOrder(payload);
      onClose();
      onCreated();
    } catch (err) {
      setError((err as Error).message ?? 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" aria-hidden onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-color bg-bg-primary shadow-lg"
        role="dialog"
        aria-labelledby="order-create-title"
      >
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4">
          <h2 id="order-create-title" className="text-xl font-semibold text-text-primary">
            Create order
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-lg text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="max-h-[65vh] overflow-y-auto px-5 py-4 space-y-4 text-base">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
                {error}
              </div>
            )}
            <LeadSelectWithCreate
              leads={leads}
              loading={loadingLeads}
              loadError={leadsLoadError}
              onRetry={loadLeads}
              value={leadId}
              onChange={setLeadId}
              onLeadCreated={(l) => setLeads((prev) => [l, ...prev])}
              disabled={false}
              label="Lead"
            />
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-text-secondary">Items</label>
                <button type="button" onClick={addLine} className="text-sm font-medium text-text-secondary hover:underline">
                  Add line
                </button>
              </div>
              <div className="mt-2 space-y-3">
                {lines.map((row, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-3 rounded-lg border border-border-color bg-bg-secondary/40 p-3">
                    <div className="min-w-[200px] flex-1">
                      <SearchableSelect
                        options={catalogItems.map((p) => ({
                          value: p.id,
                          label: `${p.name} – ${p.currency} ${p.price}`,
                        }))}
                        value={row.product_id}
                        onChange={(v) => onProductSelect(index, Number(v))}
                        placeholder="Search product"
                        loading={loadingCatalog}
                        error={index === 0 ? catalogLoadError : null}
                        emptyMessage="No products. Add products in Catalog first."
                        onRetry={index === 0 ? loadCatalog : undefined}
                        disabled={loadingCatalog}
                        aria-label="Product"
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) => updateLine(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                      className="w-20 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary"
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={row.price}
                      onChange={(e) => updateLine(index, 'price', parseFloat(e.target.value) || 0)}
                      className="w-24 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 1}
                      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary">Currency</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 w-24 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Total</label>
                <p className="mt-1 text-base font-semibold text-text-primary">{currency} {totalAmount.toFixed(2)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrderStatus)}
                  className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Payment</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary"
                >
                  {PAYMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-border-color px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border-color px-4 py-2.5 text-base font-medium text-text-primary hover:bg-bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !leadId || items.length === 0}
              className="rounded-lg bg-text-primary px-4 py-2.5 text-base font-medium text-bg-primary hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create order'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
