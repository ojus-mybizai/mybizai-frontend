'use client';

import type { OrderStatus, PaymentStatus } from '@/services/orders';

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

export interface OrderFiltersProps {
  status: OrderStatus | '';
  paymentStatus: PaymentStatus | '';
  onStatusChange: (v: OrderStatus | '') => void;
  onPaymentStatusChange: (v: PaymentStatus | '') => void;
}

export function OrderFilters(props: OrderFiltersProps) {
  const { status, paymentStatus, onStatusChange, onPaymentStatusChange } = props;
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border-color bg-card-bg p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">Status</label>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as OrderStatus | '')}
          className="min-w-[160px] rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">Payment</label>
        <select
          value={paymentStatus}
          onChange={(e) => onPaymentStatusChange(e.target.value as PaymentStatus | '')}
          className="min-w-[160px] rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary"
        >
          <option value="">All payments</option>
          {PAYMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
