'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, type ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

interface BusinessOnboardingResponse {
  message: string;
  business_onboarded: boolean;
}

type KeyStringValueRow = { key: string; value: string };

type DeliveryOptionRow = { key: string; value: boolean };

export default function BusinessOnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const setOnboardingRequired = useAuthStore((s) => s.setOnboardingRequired);

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [numberOfEmployees, setNumberOfEmployees] = useState('');
  const [businessType, setBusinessType] = useState<'product' | 'service' | 'both'>('product');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [subIndustry, setSubIndustry] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [serviceLocationsInput, setServiceLocationsInput] = useState('');

  const [businessHoursRows, setBusinessHoursRows] = useState<KeyStringValueRow[]>([{
    key: 'mon',
    value: '',
  }]);
  const [policiesRows, setPoliciesRows] = useState<KeyStringValueRow[]>([{
    key: '',
    value: '',
  }]);
  const [deliveryOptionRows, setDeliveryOptionRows] = useState<DeliveryOptionRow[]>([
    { key: 'delivery', value: true },
    { key: 'pickup', value: false },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAddBusinessHourRow = () => {
    setBusinessHoursRows((rows) => [...rows, { key: '', value: '' }]);
  };

  const handleRemoveBusinessHourRow = (index: number) => {
    setBusinessHoursRows((rows) => rows.filter((_, i) => i !== index));
  };

  const handleAddPolicyRow = () => {
    setPoliciesRows((rows) => [...rows, { key: '', value: '' }]);
  };

  const handleRemovePolicyRow = (index: number) => {
    setPoliciesRows((rows) => rows.filter((_, i) => i !== index));
  };

  const handleAddDeliveryOptionRow = () => {
    setDeliveryOptionRows((rows) => [...rows, { key: '', value: true }]);
  };

  const handleRemoveDeliveryOptionRow = (index: number) => {
    setDeliveryOptionRows((rows) => rows.filter((_, i) => i !== index));
  };

  const parseBusinessHours = (): Record<string, string[]> | null => {
    const result: Record<string, string[]> = {};
    for (const row of businessHoursRows) {
      const key = row.key.trim();
      const value = row.value.trim();
      if (!key || !value) continue;
      const slots = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (slots.length) {
        result[key] = slots;
      }
    }
    return Object.keys(result).length ? result : null;
  };

  const parsePolicies = (): Record<string, string> | null => {
    const result: Record<string, string> = {};
    for (const row of policiesRows) {
      const key = row.key.trim();
      const value = row.value.trim();
      if (!key || !value) continue;
      result[key] = value;
    }
    return Object.keys(result).length ? result : null;
  };

  const parseDeliveryOptions = (): Record<string, boolean> | null => {
    const result: Record<string, boolean> = {};
    for (const row of deliveryOptionRows) {
      const key = row.key.trim();
      if (!key) continue;
      result[key] = row.value;
    }
    return Object.keys(result).length ? result : null;
  };

  const parseServiceLocations = (): string[] | null => {
    const raw = serviceLocationsInput.trim();
    if (!raw) return null;
    const items = raw
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    return items.length ? items : null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!name.trim() || !phoneNumber.trim() || !businessType) {
      setError('Name, phone number, and business type are required');
      return;
    }

    setLoading(true);

    const businessHours = parseBusinessHours();
    const policies = parsePolicies();
    const deliveryOptions = parseDeliveryOptions();
    const serviceLocations = parseServiceLocations();

    const payload: any = {
      name: name.trim(),
      phone_number: phoneNumber.trim(),
      business_type: businessType,
      website: website.trim() || null,
      address: address.trim() || null,
      number_of_employees: numberOfEmployees.trim() || null,
      description: description.trim() || null,
      industry: industry.trim() || null,
      sub_industry: subIndustry.trim() || null,
      target_audience: targetAudience.trim() || null,
      business_hours: businessHours,
      policies,
      delivery_options: deliveryOptions,
      service_locations: serviceLocations,
    };

    try {
      const data = await apiFetch<BusinessOnboardingResponse>('/business/onboarding', {
        method: 'POST',
        auth: true,
        body: JSON.stringify(payload),
      });

      if (data.business_onboarded) {
        setOnboardingRequired(false);
        setSuccessMessage(data.message || 'Onboarding complete');
        router.replace(next || '/dashboard');
        return;
      }

      setSuccessMessage(data.message || 'Onboarding saved');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Could not complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl rounded-2xl border border-border-color bg-card-bg p-8 md:p-10 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border border-border-color bg-bg-primary px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
            MyBizAI
          </span>
        </div>
      </div>

      <h1 className="text-2xl font-semibold text-text-primary mb-2">Business onboarding</h1>
      <p className="text-sm text-text-secondary mb-6 max-w-2xl">
        Tell us a bit about your business so we can configure your workspace. You can change
        these details later.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">Business name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">Phone number *</label>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">Number of employees</label>
            <input
              type="text"
              value={numberOfEmployees}
              onChange={(e) => setNumberOfEmployees(e.target.value)}
              placeholder="e.g. 1-5, 10-50"
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-primary">Address</label>
          <textarea
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">Business type *</label>
            <div className="inline-flex rounded-md border border-border-color bg-bg-primary p-1 text-xs">
              {(['product', 'service', 'both'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setBusinessType(type)}
                  className={`flex-1 rounded-sm px-3 py-1 capitalize transition-colors ${
                    businessType === type
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:bg-bg-secondary'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">Industry</label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-primary">Sub-industry</label>
            <input
              type="text"
              value={subIndustry}
              onChange={(e) => setSubIndustry(e.target.value)}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-primary">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does your business do?"
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-primary">Target audience</label>
          <textarea
            rows={2}
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="Who are your ideal customers?"
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <label className="block text-sm font-medium text-text-primary">Service locations</label>
            <span className="text-[11px] text-text-secondary">One per line or comma separated</span>
          </div>
          <textarea
            rows={2}
            value={serviceLocationsInput}
            onChange={(e) => setServiceLocationsInput(e.target.value)}
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-text-primary">Business hours</h2>
              <p className="text-xs text-text-secondary">
                Use day keys like "mon", "tue" and comma-separated time ranges (e.g. 09:00-18:00, 19:00-21:00).
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddBusinessHourRow}
              className="text-xs font-medium text-accent hover:underline"
            >
              Add row
            </button>
          </div>

          <div className="space-y-2">
            {businessHoursRows.map((row, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  placeholder="mon"
                  value={row.key}
                  onChange={(e) => {
                    const value = e.target.value;
                    setBusinessHoursRows((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, key: value } : r)),
                    );
                  }}
                  className="w-24 rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <input
                  type="text"
                  placeholder="09:00-18:00, 19:00-21:00"
                  value={row.value}
                  onChange={(e) => {
                    const value = e.target.value;
                    setBusinessHoursRows((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, value } : r)),
                    );
                  }}
                  className="flex-1 rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveBusinessHourRow(index)}
                  className="text-[11px] text-text-secondary hover:text-text-primary"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-text-primary">Policies</h2>
              <p className="text-xs text-text-secondary">
                Add any refund, warranty or cancellation policies as key-value pairs.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddPolicyRow}
              className="text-xs font-medium text-accent hover:underline"
            >
              Add row
            </button>
          </div>

          <div className="space-y-2">
            {policiesRows.map((row, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  placeholder="refund"
                  value={row.key}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPoliciesRows((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, key: value } : r)),
                    );
                  }}
                  className="w-32 rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <input
                  type="text"
                  placeholder="7-day refund policy"
                  value={row.value}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPoliciesRows((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, value } : r)),
                    );
                  }}
                  className="flex-1 rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => handleRemovePolicyRow(index)}
                  className="text-[11px] text-text-secondary hover:text-text-primary"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-text-primary">Delivery options</h2>
              <p className="text-xs text-text-secondary">
                Configure delivery, pickup and any other options as boolean flags.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddDeliveryOptionRow}
              className="text-xs font-medium text-accent hover:underline"
            >
              Add option
            </button>
          </div>

          <div className="space-y-2">
            {deliveryOptionRows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="delivery"
                  value={row.key}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDeliveryOptionRows((rows) =>
                      rows.map((r, i) => (i === index ? { ...r, key: value } : r)),
                    );
                  }}
                  className="w-32 rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <label className="inline-flex items-center gap-1 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={row.value}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setDeliveryOptionRows((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, value: checked } : r)),
                      );
                    }}
                    className="h-3 w-3 rounded border-border-color bg-bg-primary text-accent focus:ring-accent"
                  />
                  <span>Enabled</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleRemoveDeliveryOptionRow(index)}
                  className="ml-auto text-[11px] text-text-secondary hover:text-text-primary"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Saving...' : 'Complete onboarding'}
          </button>
        </div>
      </form>
    </div>
  );
}
