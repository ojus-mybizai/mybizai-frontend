'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getAppointment,
  updateAppointment,
  deleteAppointment,
  type Appointment,
  type AppointmentStatus,
} from '@/services/appointments';

const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
];

export interface AppointmentDetailDrawerProps {
  appointmentId: number | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function AppointmentDetailDrawer({
  appointmentId,
  open,
  onClose,
  onUpdated,
  onDeleted,
}: AppointmentDetailDrawerProps) {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || appointmentId == null) {
      setAppointment(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAppointment(appointmentId)
      .then((data) => {
        if (!cancelled) setAppointment(data);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message ?? 'Failed to load appointment');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, appointmentId]);

  const handleStatusChange = async (value: AppointmentStatus) => {
    if (!appointment) return;
    setUpdating(true);
    try {
      const updated = await updateAppointment(appointment.id, { status: value });
      setAppointment(updated);
      onUpdated();
    } catch (e) {
      setError((e as Error).message ?? 'Failed to update');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (
      !appointment ||
      !window.confirm('Delete this appointment? This action cannot be undone.')
    )
      return;
    setDeleting(true);
    try {
      await deleteAppointment(appointment.id);
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
      <div
        className="fixed inset-0 z-40 bg-black/40"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border-color bg-bg-primary shadow-lg"
        role="dialog"
        aria-labelledby="appointment-drawer-title"
      >
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4">
          <h2 id="appointment-drawer-title" className="text-xl font-semibold text-text-primary">
            Appointment details
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
        <div className="flex-1 overflow-y-auto px-5 py-4 text-base">
          {loading && <p className="text-text-secondary">Loading appointment…</p>}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
              {error}
            </div>
          )}
          {!loading && appointment && (
            <div className="space-y-4">
              <div>
                <span className="block text-sm font-medium text-text-secondary">#</span>
                <p className="mt-0.5 text-base font-medium text-text-primary">{appointment.id}</p>
              </div>
              <div>
                <span className="block text-sm font-medium text-text-secondary">Contact</span>
                <p className="mt-0.5">
                  <Link
                    href={`/customers/${appointment.contact_id}`}
                    className="text-base text-text-primary hover:underline"
                  >
                    Contact #{appointment.contact_id}
                  </Link>
                </p>
              </div>
              <div>
                <span className="block text-sm font-medium text-text-secondary">Service</span>
                <p className="mt-0.5">
                  <Link
                    href={`/catalog/${appointment.service_id}`}
                    className="text-base text-text-primary hover:underline"
                  >
                    Service #{appointment.service_id}
                  </Link>
                </p>
              </div>
              <div>
                <span className="block text-sm font-medium text-text-secondary">Date & time</span>
                <p className="mt-0.5 text-base text-text-primary">
                  {new Date(appointment.date_time).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="block text-sm font-medium text-text-secondary">Status</span>
                <select
                  value={appointment.status}
                  onChange={(e) => handleStatusChange(e.target.value as AppointmentStatus)}
                  disabled={updating}
                  className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary disabled:opacity-60"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="block text-sm font-medium text-text-secondary">Notes</span>
                <p className="mt-0.5 text-base text-text-secondary">{appointment.notes || '—'}</p>
              </div>
              <div>
                <span className="block text-sm font-medium text-text-secondary">Created</span>
                <p className="mt-0.5 text-base text-text-secondary">
                  {new Date(appointment.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
        {appointment && (
          <div className="border-t border-border-color px-5 py-4">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-base font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              {deleting ? 'Deleting…' : 'Delete appointment'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
