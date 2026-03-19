'use client';

import { useState, FormEvent } from 'react';
import { DynamicLeadFieldsInput } from './dynamic-lead-fields-input';
import type { LeadCreate } from '@/services/customers';
import type { LeadFieldConfig } from '@/services/lead-fields';

interface CreateLeadFormProps {
  onSubmit: (data: LeadCreate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  fieldConfigs?: LeadFieldConfig[];
}

const STATUS_OPTIONS = [
  { value: 'new',       label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'lost',      label: 'Lost' },
  { value: 'won',       label: 'Won' },
];

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
];

const SOURCE_OPTIONS = [
  { value: 'whatsapp',   label: 'WhatsApp' },
  { value: 'website',    label: 'Website' },
  { value: 'referral',   label: 'Referral' },
  { value: 'walk-in',    label: 'Walk-in' },
  { value: 'ad_campaign',label: 'Ad Campaign' },
  { value: 'other',      label: 'Other' },
];

const STATUS_COLORS: Record<string, string> = {
  new:       'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
  contacted: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  qualified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  lost:      'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  won:       'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  low:    'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  high:   'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const INPUT_CLS =
  'w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-colors';
const INPUT_ERROR_CLS =
  'w-full rounded-lg border border-red-400 bg-red-50/30 dark:bg-red-950/10 px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-red-400/40 transition-colors';

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-color bg-bg-secondary/50">
        <span className="text-base">{icon}</span>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-text-secondary mb-1.5">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

export function CreateLeadForm({ onSubmit, onCancel, isLoading = false, fieldConfigs }: CreateLeadFormProps) {
  const [formData, setFormData] = useState<LeadCreate>({
    name: '',
    phone: '',
    email: '',
    status: 'new',
    priority: 'medium',
    source: 'whatsapp',
    notes: '',
    extra_data: {},
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = 'Name is required';
    if (!formData.phone.trim()) {
      e.phone = 'Phone is required';
    } else if (formData.phone.length < 10 || formData.phone.length > 20) {
      e.phone = 'Must be 10–20 characters';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      e.email = 'Invalid email address';
    }
    if (formData.notes && formData.notes.length > 2000) {
      e.notes = 'Max 2000 characters';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit({
      ...formData,
      email: formData.email || undefined,
      notes: formData.notes || undefined,
      extra_data: Object.keys(formData.extra_data || {}).length > 0 ? formData.extra_data : undefined,
    });
  };

  const set = (field: keyof LeadCreate, value: unknown) => {
    setFormData((p) => ({ ...p, [field]: value }));
    if (errors[field as string]) setErrors((p) => ({ ...p, [field]: '' }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Contact information ── */}
      <SectionCard title="Contact Information" icon="👤">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div className="md:col-span-2">
            <FieldLabel label="Full Name" required />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Harish Kumar"
              className={errors.name ? INPUT_ERROR_CLS : INPUT_CLS}
              autoFocus
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Phone */}
          <div>
            <FieldLabel label="Phone" required />
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+91 9999999999"
              className={errors.phone ? INPUT_ERROR_CLS : INPUT_CLS}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
          </div>

          {/* Email */}
          <div>
            <FieldLabel label="Email" />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="lead@example.com"
              className={errors.email ? INPUT_ERROR_CLS : INPUT_CLS}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>
        </div>
      </SectionCard>

      {/* ── Lead classification ── */}
      <SectionCard title="Classification" icon="🏷">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Status pill selector */}
          <div>
            <FieldLabel label="Status" />
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set('status', o.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                    formData.status === o.value
                      ? `${STATUS_COLORS[o.value]} border-transparent ring-2 ring-offset-1 ring-current/30`
                      : 'border-border-color bg-bg-secondary text-text-secondary hover:border-accent/40'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority pill selector */}
          <div>
            <FieldLabel label="Priority" />
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set('priority', o.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
                    formData.priority === o.value
                      ? `${PRIORITY_COLORS[o.value]} border-transparent ring-2 ring-offset-1 ring-current/30`
                      : 'border-border-color bg-bg-secondary text-text-secondary hover:border-accent/40'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source */}
          <div>
            <FieldLabel label="Source" />
            <select
              value={formData.source}
              onChange={(e) => set('source', e.target.value)}
              className={INPUT_CLS}
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      {/* ── Custom / dynamic fields ── */}
      <SectionCard title="Custom Fields" icon="⚙">
        <DynamicLeadFieldsInput
          value={formData.extra_data ?? {}}
          onChange={(v) => set('extra_data', v)}
          fields={fieldConfigs}
        />
      </SectionCard>

      {/* ── Notes ── */}
      <SectionCard title="Notes" icon="📝">
        <textarea
          value={formData.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Requirements, preferences, or any other details…"
          rows={3}
          maxLength={2000}
          className={errors.notes ? INPUT_ERROR_CLS : INPUT_CLS}
        />
        <div className="mt-1.5 flex justify-between text-xs text-text-secondary">
          <span>{errors.notes && <span className="text-red-500">{errors.notes}</span>}</span>
          <span>{formData.notes?.length ?? 0} / 2000</span>
        </div>
      </SectionCard>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border-color bg-bg-primary px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-bg-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60 transition-colors"
        >
          {isLoading && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          {isLoading ? 'Creating…' : 'Create Lead'}
        </button>
      </div>
    </form>
  );
}
