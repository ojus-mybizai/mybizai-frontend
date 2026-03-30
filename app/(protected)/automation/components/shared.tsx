'use client';

import { ChevronDown } from 'lucide-react';

/* ─── Toggle Switch ──────────────────────────────────────────────────────── */

export function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2 focus:ring-offset-card-bg disabled:opacity-50 ${
        checked ? 'bg-accent' : 'bg-bg-secondary'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

/* ─── Custom Select ──────────────────────────────────────────────────────── */

export function Select({
  value,
  onChange,
  children,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none rounded-lg border border-border-color bg-bg-primary px-3 py-2 pr-8 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 ${className}`}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
    </div>
  );
}

/* ─── Text Input ─────────────────────────────────────────────────────────── */

export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  className?: string;
}) {
  return (
    <div className="w-full">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors ${
          error ? 'border-red-500/60 focus:border-red-500' : 'border-border-color focus:border-accent'
        } ${className}`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

/* ─── Textarea ───────────────────────────────────────────────────────────── */

export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 2,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  error?: string;
}) {
  return (
    <div className="w-full">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full rounded-lg border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent/30 resize-none transition-colors ${
          error ? 'border-red-500/60 focus:border-red-500' : 'border-border-color focus:border-accent'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

/* ─── Field label ────────────────────────────────────────────────────────── */

export function FieldLabel({
  children,
  required,
  hint,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="mb-1.5">
      <label className="block text-xs font-medium text-text-secondary">
        {children}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[10px] text-text-secondary/60 mt-0.5">{hint}</p>}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

export function formatDate(d: string | null | undefined): string {
  if (!d) return 'Never';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return 'Never';
  const now = new Date();
  const diff = Math.floor((now.getTime() - x.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return x.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
