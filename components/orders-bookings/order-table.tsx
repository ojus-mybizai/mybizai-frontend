'use client';

import type { Order } from '@/services/orders';

export interface OrderTableProps {
  orders: Order[];
  loading: boolean;
  onDelete: (id: number) => void;
  deletingId: number | null;
  onSelectOrder?: (id: number) => void;
}

export function OrderTable({
  orders,
  loading,
  onDelete,
  deletingId,
  onSelectOrder,
}: OrderTableProps) {
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const isEmpty = !loading && sortedOrders.length === 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg px-6 py-8 text-base text-text-secondary">
        Loading orders…
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg px-6 py-8 text-base text-text-secondary">
        <p className="mb-1.5 font-medium text-text-primary">No orders yet</p>
        <p>Orders created via your storefront or CRM will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg">
      <table className="min-w-full divide-y divide-border-color text-base">
        <thead className="bg-bg-secondary/60">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Order</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Contact</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Amount</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Status</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Payment</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Created</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-text-secondary">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-color">
          {sortedOrders.map((order) => (
            <tr key={order.id} className="hover:bg-bg-secondary/60">
              <td className="px-4 py-3 align-middle">
                {onSelectOrder ? (
                  <button
                    type="button"
                    onClick={() => onSelectOrder(order.id)}
                    className="text-left text-base font-medium text-text-primary hover:underline"
                  >
                    #{order.id}
                  </button>
                ) : (
                  <div className="font-medium text-text-primary">#{order.id}</div>
                )}
                <div className="text-sm text-text-secondary">
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </div>
              </td>
              <td className="px-4 py-3 align-middle">
                <a
                  href={`/customers/${order.contact_id}`}
                  className="text-sm text-text-secondary hover:underline"
                >
                  Contact #{order.contact_id}
                </a>
              </td>
              <td className="px-4 py-3 align-middle">
                <div className="text-base font-semibold text-text-primary">
                  {order.currency} {order.total_amount.toFixed(2)}
                </div>
              </td>
              <td className="px-4 py-3 align-middle">
                <span className="inline-flex rounded-full bg-bg-secondary px-2.5 py-1 text-sm capitalize">
                  {order.status}
                </span>
              </td>
              <td className="px-4 py-3 align-middle">
                <span className="inline-flex rounded-full bg-bg-secondary px-2.5 py-1 text-sm capitalize">
                  {order.payment_status}
                </span>
              </td>
              <td className="px-4 py-3 align-middle text-sm text-text-secondary">
                {new Date(order.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3 align-middle text-right">
                {onSelectOrder && (
                  <button
                    type="button"
                    onClick={() => onSelectOrder(order.id)}
                    className="mr-3 text-sm font-medium text-text-secondary hover:underline"
                  >
                    View
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void onDelete(order.id)}
                  disabled={deletingId === order.id}
                  className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60"
                >
                  {deletingId === order.id ? 'Deleting…' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
