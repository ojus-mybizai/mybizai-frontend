'use client';

import { useState, FormEvent } from 'react';
import { CustomFieldsEditor } from './custom-fields-editor';
import type { LeadCreate } from '@/services/customers';

interface CreateLeadFormProps {
  onSubmit: (data: LeadCreate) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'lost', label: 'Lost' },
  { value: 'won', label: 'Won' },
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const sourceOptions = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'walk-in', label: 'Walk-in' },
  { value: 'ad_campaign', label: 'Ad Campaign' },
  { value: 'other', label: 'Other' },
];

export function CreateLeadForm({ onSubmit, onCancel, isLoading = false }: CreateLeadFormProps) {
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (formData.phone.length < 10 || formData.phone.length > 20) {
      newErrors.phone = 'Phone number must be between 10-20 characters';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.notes && formData.notes.length > 2000) {
      newErrors.notes = 'Notes must be 2000 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const submitData: LeadCreate = {
      ...formData,
      email: formData.email || undefined,
      notes: formData.notes || undefined,
      extra_data: Object.keys(formData.extra_data || {}).length > 0 ? formData.extra_data : undefined,
    };

    await onSubmit(submitData);
  };

  const handleInputChange = (field: keyof LeadCreate, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4 rounded-2xl border border-border-color bg-card-bg p-5">
        <h3 className="text-sm font-semibold text-text-primary">Lead Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter full name"
              className={`w-full rounded-md border ${
                errors.name ? 'border-red-500' : 'border-border-color'
              } bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Phone *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+91 9999999999"
              className={`w-full rounded-md border ${
                errors.phone ? 'border-red-500' : 'border-border-color'
              } bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent`}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="lead@example.com"
              className={`w-full rounded-md border ${
                errors.email ? 'border-red-500' : 'border-border-color'
              } bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent`}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Source</label>
            <select
              value={formData.source}
              onChange={(e) => handleInputChange('source', e.target.value)}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {sourceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Status & Priority */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border-color bg-card-bg p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Status</h3>
          <select
            value={formData.status}
            onChange={(e) => handleInputChange('status', e.target.value)}
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-border-color bg-card-bg p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Priority</h3>
          <select
            value={formData.priority}
            onChange={(e) => handleInputChange('priority', e.target.value)}
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {priorityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom Fields */}
      <div className="rounded-2xl border border-border-color bg-card-bg p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Custom Fields</h3>
        <CustomFieldsEditor
          data={formData.extra_data || {}}
          onChange={(data) => handleInputChange('extra_data', data)}
          placeholder={{
            key: 'Field name (e.g., budget, location, interest)',
            value: 'Field value',
          }}
        />
        <p className="mt-3 text-xs text-text-secondary">
          Add custom fields to capture specific information about this lead (budget, preferences, product interest, etc.).
        </p>
      </div>

      {/* Notes */}
      <div className="rounded-2xl border border-border-color bg-card-bg p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Additional Notes</h3>
        <textarea
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          placeholder="Additional information about this lead, requirements, preferences, etc."
          rows={4}
          maxLength={2000}
          className={`w-full rounded-md border ${
            errors.notes ? 'border-red-500' : 'border-border-color'
          } bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent`}
        />
        <div className="mt-2 flex justify-between text-xs text-text-secondary">
          <span>{errors.notes && <span className="text-red-600">{errors.notes}</span>}</span>
          <span>{formData.notes?.length || 0}/2000 characters</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {isLoading ? 'Creating...' : 'Create Lead'}
        </button>
      </div>
    </form>
  );
}