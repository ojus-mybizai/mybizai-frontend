'use client';

import { useEffect, useState, useCallback } from 'react';
import { createAppointment, type AppointmentStatus } from '@/services/appointments';
import { listLeadsForSelect, type LeadOption } from '@/services/customers';
import { listCatalogItems, type CatalogItem } from '@/lib/catalog-api';
import { LeadSelectWithCreate } from './lead-select-with-create';
import { SearchableSelect } from './searchable-select';

const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
];

export interface AppointmentCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AppointmentCreateModal({ open, onClose, onCreated }: AppointmentCreateModalProps) {
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);
  const [leadsLoadError, setLeadsLoadError] = useState<string | null>(null);
  const [servicesLoadError, setServicesLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leadId, setLeadId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [dateTime, setDateTime] = useState('');
  const [status, setStatus] = useState<AppointmentStatus>('pending');
  const [notes, setNotes] = useState('');

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

  const loadServices = useCallback(() => {
    setServicesLoadError(null);
    setLoadingServices(true);
    listCatalogItems({ type: 'service', per_page: 100 })
      .then((r) => setServices(r.items ?? []))
      .catch((err) => {
        setServices([]);
        setServicesLoadError((err as Error).message ?? 'Failed to load services');
      })
      .finally(() => setLoadingServices(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLeadId('');
    setServiceId('');
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setDateTime(now.toISOString().slice(0, 16));
    setStatus('pending');
    setNotes('');
    setLeadsLoadError(null);
    setServicesLoadError(null);
    loadLeads();
    loadServices();
  }, [open, loadLeads, loadServices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lid = leadId ? parseInt(leadId, 10) : 0;
    const sid = serviceId ? parseInt(serviceId, 10) : 0;
    if (!lid || !sid || !dateTime) {
      setError('Select lead, service, and date/time.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createAppointment({
        lead_id: lid,
        service_id: sid,
        date_time: new Date(dateTime).toISOString(),
        status,
        notes: notes.trim() || undefined,
      });
      onClose();
      onCreated();
    } catch (err) {
      setError((err as Error).message ?? 'Failed to create appointment');
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
        aria-labelledby="appointment-create-title"
      >
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4">
          <h2 id="appointment-create-title" className="text-xl font-semibold text-text-primary">
            Create appointment
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
              <label className="block text-sm font-medium text-text-secondary">Service</label>
              <div className="mt-1">
              <SearchableSelect
                options={services.map((s) => ({
                  value: s.id,
                  label: `${s.name} – ${s.currency} ${s.price}`,
                }))}
                value={serviceId}
                onChange={(v) => setServiceId(String(v))}
                placeholder="Search or select service"
                loading={loadingServices}
                error={servicesLoadError}
                emptyMessage="No services. Add services in Catalog first."
                onRetry={loadServices}
                disabled={loadingServices}
                aria-label="Service"
              />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Date and time</label>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary placeholder:text-text-secondary"
                placeholder="Optional notes"
              />
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
              disabled={submitting || !leadId || !serviceId || !dateTime}
              className="rounded-lg bg-text-primary px-4 py-2.5 text-base font-medium text-bg-primary hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create appointment'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
