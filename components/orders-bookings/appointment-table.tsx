'use client';

import type { Appointment } from '@/services/appointments';

export interface AppointmentTableProps {
  appointments: Appointment[];
  loading: boolean;
  onDelete: (id: number) => void;
  deletingId: number | null;
  onSelectAppointment?: (id: number) => void;
}

function truncate(str: string | null, max: number): string {
  if (!str) return '—';
  return str.length <= max ? str : `${str.slice(0, max)}…`;
}

export function AppointmentTable({
  appointments,
  loading,
  onDelete,
  deletingId,
  onSelectAppointment,
}: AppointmentTableProps) {
  const sorted = [...appointments].sort(
    (a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime()
  );
  const isEmpty = !loading && sorted.length === 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg px-6 py-8 text-base text-text-secondary">
        Loading appointments…
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg px-6 py-8 text-base text-text-secondary">
        <p className="mb-1.5 font-medium text-text-primary">No appointments yet</p>
        <p>Appointments booked via your storefront or CRM will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg">
      <table className="min-w-full divide-y divide-border-color text-base">
        <thead className="bg-bg-secondary/60">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">#</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Contact</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Service</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Date and time</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Status</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-text-secondary">Notes</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-text-secondary">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-color">
          {sorted.map((apt) => (
            <tr key={apt.id} className="hover:bg-bg-secondary/60">
              <td className="px-4 py-3 align-middle">
                {onSelectAppointment ? (
                  <button
                    type="button"
                    onClick={() => onSelectAppointment(apt.id)}
                    className="text-base font-medium text-text-primary hover:underline"
                  >
                    #{apt.id}
                  </button>
                ) : (
                  <span className="font-medium text-text-primary">#{apt.id}</span>
                )}
              </td>
              <td className="px-4 py-3 align-middle">
                <a
                  href={`/customers/${apt.contact_id}`}
                  className="text-sm text-text-secondary hover:underline"
                >
                  Contact #{apt.contact_id}
                </a>
              </td>
              <td className="px-4 py-3 align-middle">
                <a
                  href={`/catalog/${apt.service_id}`}
                  className="text-sm text-text-secondary hover:underline"
                >
                  Service #{apt.service_id}
                </a>
              </td>
              <td className="px-4 py-3 align-middle text-sm text-text-secondary">
                {new Date(apt.date_time).toLocaleString()}
              </td>
              <td className="px-4 py-3 align-middle">
                <span className="inline-flex rounded-full bg-bg-secondary px-2.5 py-1 text-sm capitalize">
                  {apt.status}
                </span>
              </td>
              <td className="max-w-[180px] px-4 py-3 align-middle">
                <span className="text-sm text-text-secondary" title={apt.notes ?? undefined}>
                  {truncate(apt.notes, 40)}
                </span>
              </td>
              <td className="px-4 py-3 align-middle text-right">
                {onSelectAppointment && (
                  <button
                    type="button"
                    onClick={() => onSelectAppointment(apt.id)}
                    className="mr-3 text-sm font-medium text-text-secondary hover:underline"
                  >
                    View
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void onDelete(apt.id)}
                  disabled={deletingId === apt.id}
                  className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60"
                >
                  {deletingId === apt.id ? 'Deleting…' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
