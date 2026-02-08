'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getOrder,
  updateOrder,
  deleteOrder,
  type Order,
  type OrderStatus,
  type PaymentStatus,
} from '@/services/orders';

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

export interface OrderDetailDrawerProps {
  orderId: number | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function OrderDetailDrawer(p: OrderDetailDrawerProps) {
  const { orderId, open, onClose, onUpdated, onDeleted } = p;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || orderId == null) {
      setOrder(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getOrder(orderId)
      .then((data) => { if (!cancelled) setOrder(data); })
      .catch((e) => { if (!cancelled) setError((e as Error).message ?? 'Failed to load order'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, orderId]);

  const handleStatusChange = async (field: 'status' | 'payment_status', value: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      const updated = await updateOrder(order.id, { [field]: value });
      setOrder(updated);
      onUpdated();
    } catch (e) {
      setError((e as Error).message ?? 'Failed to update');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!order || !window.confirm('Delete this order? This action cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteOrder(order.id);
      onClose();
      onDeleted();
    } catch (e) {
      setError((e as Error).message ?? 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" aria-hidden onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border-color bg-bg-primary shadow-lg" role="dialog" aria-labelledby="order-drawer-title">
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4">
          <h2 id="order-drawer-title" className="text-xl font-semibold text-text-primary">Order details</h2>
          <button type="button" onClick={onClose} className="rounded p-2 text-lg text-text-secondary hover:bg-bg-secondary hover:text-text-primary" aria-label="Close">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-base">
          {loading && <p className="text-text-secondary">Loading order...</p>}
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">{error}</div>}
          {!loading && order && (
            <div className="space-y-4">
              <div>
                <span className="block text-sm font-medium text-text-secondary">Order #</span>
                <p className="mt-0.5 text-base font-medium text-text-primary">{order.id}</p>
              </div>
              <div>
                <span className="block text-sm font-medium text-text-secondary">Contact</span>
                <p className="mt-0.5">
                  <Link href={`/customers/${order.contact_id}`} className="text-base text-text-primary hover:underline">Contact #{order.contact_id}</Link>
                </p>
              </div>
              <div>
                <span className="block text-sm font-medium text-text-secondary">Amount</span>
                <p className="mt-0.5 text-base font-semibold text-text-primary">{order.currency} {order.total_amount.toFixed(2)}</p>
              </div>
              <div>
                <span className="block text-sm font-medium text-text-secondary">Status</span>
                <select value={order.status} onChange={(e) => handleStatusChange('status', e.target.value)} disabled={updating} className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary disabled:opacity-60">
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <span className="block text-sm font-medium text-text-secondary">Payment</span>
                <select value={order.payment_status} onChange={(e) => handleStatusChange('payment_status', e.target.value)} disabled={updating} className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary disabled:opacity-60">
                  {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <span className="block text-sm font-medium text-text-secondary">Created</span>
                <p className="mt-0.5 text-base text-text-secondary">{new Date(order.created_at).toLocaleString()}</p>
              </div>
              <div>
                <span className="block text-sm font-medium text-text-secondary">Items</span>
                <ul className="mt-1 list-inside list-disc space-y-1 text-base text-text-primary">
                  {order.items.map((item, i) => (
                    <li key={i}>Product #{item.product_id} × {item.quantity} @ {order.currency} {item.price.toFixed(2)}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
        {order && (
          <div className="border-t border-border-color px-5 py-4">
            <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-base font-medium text-red-700 hover:bg-red-100 disabled:opacity-60">
              {deleting ? 'Deleting...' : 'Delete order'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
