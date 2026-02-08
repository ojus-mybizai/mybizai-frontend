'use client';

import type { AppointmentStatus } from '@/services/appointments';

const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
];

export interface AppointmentFiltersProps {
  status: AppointmentStatus | '';
  dateFrom: string;
  dateTo: string;
  onStatusChange: (value: AppointmentStatus | '') => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}

export function AppointmentFilters({
  status,
  dateFrom,
  dateTo,
  onStatusChange,
  onDateFromChange,
  onDateToChange,
}: AppointmentFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border-color bg-card-bg p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">Status</label>
        <select
          value={status}
          onChange={(e) => onStatusChange((e.target.value || '') as AppointmentStatus | '')}
          className="min-w-[160px] rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">From date</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="min-w-[160px] rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary">To date</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="min-w-[160px] rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary"
        />
      </div>
    </div>
  );
}
