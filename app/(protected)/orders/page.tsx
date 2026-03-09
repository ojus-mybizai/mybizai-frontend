'use client';

import { useEffect, useState } from 'react';
import type { Order, OrderStatus, PaymentStatus } from '@/services/orders';
import { listOrders, deleteOrder } from '@/services/orders';
import type { Appointment, AppointmentStatus } from '@/services/appointments';
import { listAppointments, deleteAppointment } from '@/services/appointments';
import { OrderFilters } from '@/components/orders-bookings/order-filters';
import { OrderTable } from '@/components/orders-bookings/order-table';
import { OrderDetailDrawer } from '@/components/orders-bookings/order-detail-drawer';
import { OrderCreateModal } from '@/components/orders-bookings/order-create-modal';
import { AppointmentFilters } from '@/components/orders-bookings/appointment-filters';
import { AppointmentTable } from '@/components/orders-bookings/appointment-table';
import { AppointmentDetailDrawer } from '@/components/orders-bookings/appointment-detail-drawer';
import { AppointmentCreateModal } from '@/components/orders-bookings/appointment-create-modal';

type Tab = 'orders' | 'appointments';

export default function OrdersPage() {
  const [tab, setTab] = useState<Tab>('orders');

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | ''>('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | ''>('');
  const [orderDeletingId, setOrderDeletingId] = useState<number | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);

  // Appointments state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<AppointmentStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appointmentDeletingId, setAppointmentDeletingId] = useState<number | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [appointmentDrawerOpen, setAppointmentDrawerOpen] = useState(false);
  const [orderCreateOpen, setOrderCreateOpen] = useState(false);
  const [appointmentCreateOpen, setAppointmentCreateOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    setOrdersLoading(true);
    setError(null);
    try {
      const data = await listOrders({
        status: orderStatusFilter || undefined,
        payment_status: paymentFilter || undefined,
      });
      setOrders(data);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load orders');
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadAppointments = async () => {
    setAppointmentsLoading(true);
    setError(null);
    try {
      const data = await listAppointments({
        status: appointmentStatusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setAppointments(data);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load appointments');
      setAppointments([]);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderStatusFilter, paymentFilter]);

  useEffect(() => {
    if (tab === 'appointments') {
      void loadAppointments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, appointmentStatusFilter, dateFrom, dateTo]);

  const handleOrderDelete = async (id: number) => {
    if (!window.confirm('Delete this order? This action cannot be undone.')) return;
    setOrderDeletingId(id);
    try {
      await deleteOrder(id);
      if (selectedOrderId === id) {
        setOrderDrawerOpen(false);
        setSelectedOrderId(null);
      }
      await loadOrders();
    } catch (e) {
      setError((e as Error).message ?? 'Failed to delete order');
    } finally {
      setOrderDeletingId(null);
    }
  };

  const handleAppointmentDelete = async (id: number) => {
    if (!window.confirm('Delete this appointment? This action cannot be undone.')) return;
    setAppointmentDeletingId(id);
    try {
      await deleteAppointment(id);
      if (selectedAppointmentId === id) {
        setAppointmentDrawerOpen(false);
        setSelectedAppointmentId(null);
      }
      await loadAppointments();
    } catch (e) {
      setError((e as Error).message ?? 'Failed to delete appointment');
    } finally {
      setAppointmentDeletingId(null);
    }
  };

  const openOrderDrawer = (id: number) => {
    setSelectedOrderId(id);
    setOrderDrawerOpen(true);
  };

  const openAppointmentDrawer = (id: number) => {
    setSelectedAppointmentId(id);
    setAppointmentDrawerOpen(true);
  };

  return (
    <div className="w-full max-w-full space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-text-primary">
                Orders / Bookings
              </h2>
              <p className="mt-0.5 text-base text-text-secondary">
                Track and manage orders and appointments linked to your customers.
              </p>
            </div>
            <div className="flex gap-2">
              {tab === 'orders' && (
                <button
                  type="button"
                  onClick={() => setOrderCreateOpen(true)}
                  className="rounded-lg border border-border-color bg-card-bg px-4 py-2.5 text-base font-medium text-text-primary hover:bg-bg-secondary"
                >
                  Create order
                </button>
              )}
              {tab === 'appointments' && (
                <button
                  type="button"
                  onClick={() => setAppointmentCreateOpen(true)}
                  className="rounded-lg border border-border-color bg-card-bg px-4 py-2.5 text-base font-medium text-text-primary hover:bg-bg-secondary"
                >
                  Create appointment
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-1 rounded-xl border border-border-color bg-card-bg p-1.5">
            <button
              type="button"
              onClick={() => setTab('orders')}
              className={`rounded-lg px-4 py-2.5 text-base font-medium transition-colors ${
                tab === 'orders'
                  ? 'bg-bg-secondary text-text-primary'
                  : 'text-text-secondary hover:bg-bg-secondary/60 hover:text-text-primary'
              }`}
            >
              Orders
            </button>
            <button
              type="button"
              onClick={() => setTab('appointments')}
              className={`rounded-lg px-4 py-2.5 text-base font-medium transition-colors ${
                tab === 'appointments'
                  ? 'bg-bg-secondary text-text-primary'
                  : 'text-text-secondary hover:bg-bg-secondary/60 hover:text-text-primary'
              }`}
            >
              Appointments
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
              {error}
            </div>
          )}

          {tab === 'orders' && (
            <>
              <OrderFilters
                status={orderStatusFilter}
                paymentStatus={paymentFilter}
                onStatusChange={setOrderStatusFilter}
                onPaymentStatusChange={setPaymentFilter}
              />
              <OrderTable
                orders={orders}
                loading={ordersLoading}
                onDelete={handleOrderDelete}
                deletingId={orderDeletingId}
                onSelectOrder={openOrderDrawer}
              />
            </>
          )}

          {tab === 'appointments' && (
            <>
              <AppointmentFilters
                status={appointmentStatusFilter}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onStatusChange={setAppointmentStatusFilter}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
              />
              <AppointmentTable
                appointments={appointments}
                loading={appointmentsLoading}
                onDelete={handleAppointmentDelete}
                deletingId={appointmentDeletingId}
                onSelectAppointment={openAppointmentDrawer}
              />
            </>
          )}

        <OrderDetailDrawer
          orderId={selectedOrderId}
          open={orderDrawerOpen}
          onClose={() => {
            setOrderDrawerOpen(false);
            setSelectedOrderId(null);
          }}
          onUpdated={loadOrders}
          onDeleted={() => {
            setOrderDrawerOpen(false);
            setSelectedOrderId(null);
            void loadOrders();
          }}
        />

        <AppointmentDetailDrawer
          appointmentId={selectedAppointmentId}
          open={appointmentDrawerOpen}
          onClose={() => {
            setAppointmentDrawerOpen(false);
            setSelectedAppointmentId(null);
          }}
          onUpdated={loadAppointments}
          onDeleted={() => {
            setAppointmentDrawerOpen(false);
            setSelectedAppointmentId(null);
            void loadAppointments();
          }}
        />

        <OrderCreateModal
          open={orderCreateOpen}
          onClose={() => setOrderCreateOpen(false)}
          onCreated={() => {
            setOrderCreateOpen(false);
            void loadOrders();
          }}
        />

        <AppointmentCreateModal
          open={appointmentCreateOpen}
          onClose={() => setAppointmentCreateOpen(false)}
          onCreated={() => {
            setAppointmentCreateOpen(false);
            void loadAppointments();
          }}
        />
    </div>
  );
}
