'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Phone, Briefcase, Loader2 } from 'lucide-react';
import { apiFetch, type ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

interface BusinessOnboardingResponse {
  message: string;
  business_onboarded: boolean;
  requires_plan_selection?: boolean;
}

const BUSINESS_TYPES = [
  { value: 'product', label: 'Product', desc: 'Sell physical or digital products' },
  { value: 'service', label: 'Service', desc: 'Provide services to customers' },
  { value: 'both', label: 'Both', desc: 'Products and services' },
] as const;

const INDUSTRIES = [
  'Retail & E-commerce',
  'Real Estate',
  'Healthcare & Wellness',
  'Education & Coaching',
  'Food & Restaurant',
  'Beauty & Salon',
  'Automotive',
  'Travel & Hospitality',
  'Professional Services',
  'Technology',
  'Other',
];

export default function BusinessOnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setOnboardingRequired = useAuthStore((s) => s.setOnboardingRequired);

  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessType, setBusinessType] = useState<'product' | 'service' | 'both'>('service');
  const [industry, setIndustry] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !phoneNumber.trim()) {
      setError('Business name and phone number are required');
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch<BusinessOnboardingResponse>('/business/onboarding', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          name: name.trim(),
          phone_number: phoneNumber.trim(),
          business_type: businessType,
          industry: industry || null,
        }),
      });

      if (data.business_onboarded) {
        setOnboardingRequired(false);
        // Redirect to plan selection (new flow) instead of /home
        router.replace('/plan-selection');
        return;
      }

      setError('Something went wrong. Please try again.');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Could not complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg rounded-2xl border border-border-color bg-card-bg p-8 shadow-sm">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent/10">
          <Building2 className="h-5 w-5 text-accent" />
        </div>
        <h1 className="text-xl font-bold text-text-primary">Set up your business</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Just the basics — you can add more details in Settings later.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Business name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Business name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Caps Right Price"
            autoFocus
            className="w-full rounded-xl border border-border-color bg-bg-primary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Phone number */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Phone number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full rounded-xl border border-border-color bg-bg-primary py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {/* Business type — radio cards */}
        <div>
          <label className="mb-2 block text-sm font-medium text-text-primary">
            Business type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {BUSINESS_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setBusinessType(t.value)}
                className={`rounded-xl border-2 px-3 py-3 text-center transition-all ${
                  businessType === t.value
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-border-color bg-bg-primary text-text-secondary hover:border-text-secondary/30'
                }`}
              >
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className="block mt-0.5 text-[10px] leading-tight">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Industry — dropdown */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary">
            Industry <span className="text-text-secondary text-xs">(optional)</span>
          </label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full rounded-xl border border-border-color bg-bg-primary px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Select industry...</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !name.trim() || !phoneNumber.trim()}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" /> Setting up...</>
          ) : (
            'Continue'
          )}
        </button>

        <p className="text-center text-[11px] text-text-secondary">
          Takes 30 seconds. You can customize everything else in Settings later.
        </p>
      </form>
    </div>
  );
}
