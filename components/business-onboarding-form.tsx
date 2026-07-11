'use client';

import { FormEvent, useState } from 'react';
import {
  Building2, Phone, Loader2, ArrowRight, Sparkles,
  MessageCircle, Users, Bot, Clock, Package, Briefcase, Layers,
} from 'lucide-react';
import { apiFetch, type ApiError } from '@/lib/api-client';

interface BusinessOnboardingResponse {
  message: string;
  business_onboarded: boolean;
  requires_plan_selection?: boolean;
}

const BUSINESS_TYPES = [
  { value: 'product', label: 'Product', icon: Package,  desc: 'Sell physical or digital products' },
  { value: 'service', label: 'Service', icon: Briefcase, desc: 'Provide services to customers' },
  { value: 'both',    label: 'Both',    icon: Layers,    desc: 'Products and services' },
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

const VALUE_PROPS = [
  { icon: MessageCircle, text: 'Reply to WhatsApp automatically' },
  { icon: Users,         text: 'Organize every contact' },
  { icon: Bot,           text: 'Agents that follow up for you' },
];

export default function BusinessOnboardingForm() {
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
          phone_number: `+91${phoneNumber.replace(/\D/g, '')}`,
          business_type: businessType,
          industry: industry || null,
        }),
      });

      if (data.business_onboarded) {
        // P5: business creation is step zero, not the end of onboarding — the
        // conductor's interview still gates the app (Business.onboarding_completed
        // is False until write_memory runs). Reload into the SAME /onboarding
        // route so OnboardingRouter re-checks and now finds a business, handing
        // off to the conductor shell.
        window.location.assign('/onboarding');
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
    <div className="grid w-full max-w-4xl animate-page-in overflow-hidden rounded-3xl border border-border-color bg-card-bg shadow-sm md:grid-cols-[0.85fr_1fr]">

      {/* ── Brand / value panel ─────────────────────────────────────────── */}
      <aside className="hidden flex-col justify-between bg-accent-soft p-8 md:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-accent">MyBizAI</span>
        </div>

        <div className="my-10">
          <p className="text-[22px] font-bold leading-snug text-accent">
            Your business,<br />run by AI in minutes.
          </p>
          <ul className="mt-6 space-y-3.5">
            {VALUE_PROPS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[14px] text-accent/90">
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 border-t border-accent/15 pt-5 text-[13px] text-accent/80">
          <Clock className="h-4 w-4" />
          Takes about 30 seconds
        </div>
      </aside>

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <div className="p-8 md:p-10">
        {/* Mobile-only header (brand panel is hidden < md) */}
        <div className="mb-6 flex items-center gap-2.5 md:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <Building2 className="h-4 w-4 text-accent" />
          </div>
          <span className="text-[15px] font-semibold text-text-primary">MyBizAI</span>
        </div>

        <h1 className="text-xl font-bold text-text-primary">Set up your business</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Just the basics — refine everything later in Settings.
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Business name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              Business name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Caps Right Price"
              autoFocus
              className="w-full rounded-xl border border-border-color bg-bg-primary px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {/* Phone number */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              Phone number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border-color bg-bg-secondary px-3 text-sm text-text-secondary">
                <Phone className="h-4 w-4" /> +91
              </span>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="98765 43210"
                className="w-full rounded-xl border border-border-color bg-bg-primary px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          {/* Business type — radio cards */}
          <div>
            <label className="mb-2 block text-sm font-medium text-text-primary">
              Business type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {BUSINESS_TYPES.map((t) => {
                const Icon = t.icon;
                const selected = businessType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setBusinessType(t.value)}
                    title={t.desc}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 transition-all active:scale-[0.97] ${
                      selected
                        ? 'border-accent bg-accent/5 text-accent'
                        : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent/40'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[13px] font-semibold">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Industry — dropdown */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              Industry <span className="text-xs text-text-secondary">(optional)</span>
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-bg-primary px-4 py-2.5 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Setting up...</>
            ) : (
              <>Continue <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
