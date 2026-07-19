'use client';

/**
 * Business Process — design system.
 *
 * One file, one source of truth. Every screen consumes these primitives
 * so spacing, type, color, radius and motion stay coherent.
 *
 * Type scale  : xs(12) sm(14) base(16) lg(20) 2xl(28)
 * Spacing     : 4 8 12 16 24 32
 * Radius      : sm(6) md(10) lg(14) full
 * Color       : accent · success · warn · danger · surface(card-bg) · surface-2(bg-secondary)
 * Motion      : transition-quick (120ms) · transition-card (200ms) · transition-drawer (260ms)
 */

import React from 'react';

// ─── Tokens (consumed in CSS class names) ─────────────────────────────────────

export const tokens = {
  // Semantic colors using Tailwind utilities (so dark mode handled by CSS vars)
  color: {
    success:  'text-emerald-600 dark:text-emerald-400',
    successBg:'bg-emerald-50 dark:bg-emerald-950/30',
    successBorder: 'border-emerald-200 dark:border-emerald-800/60',

    warn:     'text-amber-600 dark:text-amber-400',
    warnBg:   'bg-amber-50 dark:bg-amber-950/30',
    warnBorder:'border-amber-200 dark:border-amber-800/60',

    danger:   'text-red-600 dark:text-red-400',
    dangerBg: 'bg-red-50 dark:bg-red-950/30',
    dangerBorder:'border-red-200 dark:border-red-800/60',

    accent:   'text-accent',
    accentBg: 'bg-accent/10',
  },
  // Motion durations
  motion: {
    quick:  'duration-100 ease-out',
    card:   'duration-200 ease-out',
    drawer: 'duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
  },
} as const;

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatCurrency(v: number | null | undefined, compact = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '';
  if (compact && Math.abs(v) >= 1000) {
    if (Math.abs(v) >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(1)}Cr`;
    if (Math.abs(v) >= 1_00_000)    return `₹${(v / 1_00_000).toFixed(1)}L`;
    if (Math.abs(v) >= 1_000)       return `₹${(v / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(v);
}

export function formatNumber(v: number | null | undefined, compact = true): string {
  if (v === null || v === undefined) return '0';
  if (compact && Math.abs(v) >= 1000) {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  }
  return String(v);
}

export function formatPercent(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function relativeTime(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Primitives ───────────────────────────────────────────────────────────────

/** Money — large hero figure or inline */
export function Money({
  value, size = 'sm', tone = 'default', compact = true,
}: {
  value: number | null | undefined;
  size?: 'sm' | 'lg' | '2xl';
  tone?: 'default' | 'success' | 'muted';
  compact?: boolean;
}) {
  if (value === null || value === undefined) return <span className="text-text-secondary">—</span>;
  const sizeCls = size === '2xl' ? 'text-2xl font-bold tracking-tight'
    : size === 'lg' ? 'text-lg font-semibold'
    : 'text-sm font-semibold';
  const toneCls = tone === 'success' ? tokens.color.success
    : tone === 'muted' ? 'text-text-secondary'
    : 'text-text-primary';
  return <span className={`${sizeCls} ${toneCls} tabular-nums`}>{formatCurrency(value, compact)}</span>;
}

/** Delta — "+23%" or "−12%" with arrow */
export function Delta({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || !isFinite(value)) return null;
  const positive = value >= 0;
  const tone = positive ? tokens.color.success : tokens.color.danger;
  const sign = positive ? '↑' : '↓';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${tone} tabular-nums`}>
      {sign} {Math.abs(value * 100).toFixed(0)}%
    </span>
  );
}

/** Pill — uniform shape across the app */
export function Pill({
  children, tone = 'neutral', icon, size = 'sm',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'accent';
  icon?: React.ReactNode;
  size?: 'xs' | 'sm';
}) {
  const toneCls =
    tone === 'success' ? `${tokens.color.successBg} ${tokens.color.success} ${tokens.color.successBorder}`
    : tone === 'warn'  ? `${tokens.color.warnBg} ${tokens.color.warn} ${tokens.color.warnBorder}`
    : tone === 'danger'? `${tokens.color.dangerBg} ${tokens.color.danger} ${tokens.color.dangerBorder}`
    : tone === 'accent'? `${tokens.color.accentBg} ${tokens.color.accent} border-transparent`
    : 'bg-bg-secondary text-text-secondary border-border-color';
  const sizeCls = size === 'xs' ? 'px-1.5 py-0 text-[11px] h-4' : 'px-2 py-0.5 text-xs h-5';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border font-medium ${toneCls} ${sizeCls}`}>
      {icon}
      {children}
    </span>
  );
}

/** Priority dot — color-and-shape signal, accessible */
export function PriorityDot({ priority }: { priority: 'low' | 'medium' | 'high' | null | undefined }) {
  if (!priority) return null;
  const cls = priority === 'high' ? 'bg-red-500' : priority === 'medium' ? 'bg-amber-500' : 'bg-slate-400';
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} title={`Priority: ${priority}`} aria-label={`priority ${priority}`} />;
}

/** Avatar — initials with deterministic color */
export function Avatar({
  name, size = 'sm',
}: {
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  const initials = (name || '?').split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?';
  const sizeCls = size === 'xs' ? 'h-5 w-5 text-[10px]'
    : size === 'md' ? 'h-8 w-8 text-sm'
    : size === 'lg' ? 'h-10 w-10 text-base'
    : 'h-6 w-6 text-xs';
  let hash = 0;
  if (name) for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const palette = ['bg-blue-500','bg-emerald-500','bg-violet-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-fuchsia-500'];
  const bg = name ? palette[Math.abs(hash) % palette.length] : 'bg-bg-secondary';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-semibold ${bg} ${sizeCls}`}
      title={name || undefined}
      aria-label={name || 'unassigned'}
    >
      {initials}
    </span>
  );
}

/** SLA bar — progress bar 0→100% to breach.  Color shifts from accent → warn → danger. */
export function SlaBar({
  daysInStage, slaDays, warnDays, height = 3,
}: {
  daysInStage: number | null | undefined;
  slaDays: number | null | undefined;
  warnDays?: number | null | undefined;
  height?: 2 | 3;
}) {
  if (!slaDays || daysInStage === null || daysInStage === undefined) return null;
  const pct = Math.min(100, Math.round((daysInStage / slaDays) * 100));
  const warnPct = warnDays ? Math.round((warnDays / slaDays) * 100) : 70;
  const color = pct >= 100 ? 'bg-red-500'
    : pct >= warnPct ? 'bg-amber-500'
    : 'bg-emerald-500';
  return (
    <div
      className={`relative w-full ${height === 2 ? 'h-0.5' : 'h-[3px]'} rounded-full bg-bg-secondary overflow-hidden`}
      title={`${daysInStage} of ${slaDays} days · ${pct}% to breach`}
      aria-label={`${pct}% to SLA breach`}
    >
      <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Sparkline — tiny inline trend chart */
export function Sparkline({
  series, width = 80, height = 24, color = 'currentColor',
}: {
  series: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!series || series.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const step = width / (series.length - 1);
  const points = series.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} aria-hidden="true" className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// ─── KPI cards ────────────────────────────────────────────────────────────────

export function KpiHero({
  label, value, sub, tone = 'default', icon, action,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'default' | 'success' | 'warn' | 'danger';
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const toneCls = tone === 'success' ? `${tokens.color.successBg} ${tokens.color.successBorder}`
    : tone === 'warn' ? `${tokens.color.warnBg} ${tokens.color.warnBorder}`
    : tone === 'danger' ? `${tokens.color.dangerBg} ${tokens.color.dangerBorder}`
    : 'bg-card-bg border-border-color';
  return (
    <div className={`rounded-xl border ${toneCls} p-4 transition-card`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</p>
        {icon}
      </div>
      <div className="text-2xl font-bold text-text-primary tabular-nums leading-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-text-secondary flex items-center gap-1.5">{sub}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function KpiCompact({
  label, value, sub, tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'default' | 'success' | 'warn' | 'danger';
}) {
  const toneCls = tone === 'success' ? tokens.color.success
    : tone === 'warn' ? tokens.color.warn
    : tone === 'danger' ? tokens.color.danger
    : 'text-text-primary';
  return (
    <div className="rounded-xl border border-border-color bg-card-bg px-3.5 py-2.5 transition-card">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary truncate">{label}</p>
      <p className={`text-base font-semibold tabular-nums truncate ${toneCls}`}>{value}</p>
      {sub && <p className="text-[11px] text-text-secondary truncate">{sub}</p>}
    </div>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BtnSize = 'sm' | 'md';

export function Button({
  variant = 'secondary', size = 'sm', icon, children, className = '', ...rest
}: {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: React.ReactNode;
  children?: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const variantCls =
    variant === 'primary'   ? 'bg-accent text-white hover:bg-accent/90 border-transparent'
    : variant === 'ghost'   ? 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-secondary border-transparent'
    : variant === 'danger'  ? 'bg-transparent text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border-transparent'
    :                          'bg-bg-primary text-text-primary border-border-color hover:bg-bg-secondary';
  const sizeCls = size === 'md' ? 'h-9 px-4 text-sm' : 'h-8 px-3 text-xs';
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-quick focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${variantCls} ${sizeCls} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Icons (24x24 line, currentColor) ─────────────────────────────────────────
// Keeping a small in-file set avoids pulling in a new package and ensures stroke
// width is consistent across the module.

const I = ({ children, size = 14, className = '' }: { children: React.ReactNode; size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {children}
  </svg>
);

export const Icon = {
  plus:   ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><path d="M12 5v14M5 12h14" /></I>,
  search: ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></I>,
  close:  ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><path d="M6 18L18 6M6 6l12 12" /></I>,
  check:  ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><path d="M5 12l5 5L20 7" /></I>,
  bolt:   ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></I>,
  clock:  ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>,
  alert:  ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></I>,
  fire:   ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><path d="M12 2c1 3 3 5 3 8a3 3 0 11-6 0c0-1 .5-2 1-3M5 14a7 7 0 1014 0c0-3-2-5-4-6 0 3-2 5-3 6 0-2-1-3-3-4-2 2-4 4-4 4z" /></I>,
  phone:  ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><path d="M2 5a3 3 0 013-3h1.4a1 1 0 011 .76l.6 2.4a1 1 0 01-.55 1.16l-1.4.7a12 12 0 005.4 5.4l.7-1.4a1 1 0 011.16-.55l2.4.6a1 1 0 01.76 1V17a3 3 0 01-3 3A15.75 15.75 0 012 5z" /></I>,
  chat:   ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z" /></I>,
  more:   ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><circle cx="12" cy="5" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="19" r="1.5" fill="currentColor" /></I>,
  back:   ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><path d="M15 18l-6-6 6-6" /></I>,
  drag:   ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/></I>,
  gear:   ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></I>,
  trend:  ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" /></I>,
  funnel: ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><path d="M3 4h18l-7 9v7l-4-2v-5L3 4z" /></I>,
  list:   ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><path d="M3 6h18M3 12h18M3 18h18" /></I>,
  grid:   ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></I>,
  inbox:  ({ size = 14, className }: { size?: number; className?: string } = {}) => <I size={size} className={className}><path d="M3 13l3-9h12l3 9M3 13v6a2 2 0 002 2h14a2 2 0 002-2v-6M3 13h5l1 3h6l1-3h5" /></I>,
};

// ─── Section header ───────────────────────────────────────────────────────────

export function SectionHeader({ title, sub, action }: { title: string; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3 gap-3">
      <div>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({
  icon = '✨', title, body, action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-border-color bg-card-bg/50">
      <div className="h-14 w-14 rounded-full bg-bg-secondary flex items-center justify-center text-2xl mb-4">{icon}</div>
      <p className="text-sm font-semibold text-text-primary mb-1">{title}</p>
      {body && <p className="text-xs text-text-secondary max-w-xs mb-3">{body}</p>}
      {action}
    </div>
  );
}

// ─── Toast (lightweight, no extra deps) ───────────────────────────────────────

type Toast = { id: number; tone: 'success' | 'danger' | 'info'; message: string };
let _id = 0;
const _listeners = new Set<(t: Toast[]) => void>();
let _toasts: Toast[] = [];

export function pushToast(tone: Toast['tone'], message: string) {
  const t: Toast = { id: ++_id, tone, message };
  _toasts = [..._toasts, t];
  _listeners.forEach(fn => fn(_toasts));
  setTimeout(() => {
    _toasts = _toasts.filter(x => x.id !== t.id);
    _listeners.forEach(fn => fn(_toasts));
  }, 3500);
}

export function ToastHost() {
  const [items, setItems] = React.useState<Toast[]>(_toasts);
  React.useEffect(() => {
    _listeners.add(setItems);
    return () => { _listeners.delete(setItems); };
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {items.map(t => {
        const cls = t.tone === 'success' ? `${tokens.color.successBg} ${tokens.color.success} ${tokens.color.successBorder}`
          : t.tone === 'danger' ? `${tokens.color.dangerBg} ${tokens.color.danger} ${tokens.color.dangerBorder}`
          : 'bg-card-bg text-text-primary border-border-color';
        return (
          <div key={t.id} className={`rounded-md border px-3 py-2 text-xs font-medium shadow-lg animate-in slide-in-from-right-4 ${cls}`}>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

// ─── Re-exports for back-compat with shared.tsx callers ──────────────────────

export const STAGE_COLORS = [
  '#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444',
  '#EC4899','#06B6D4','#6366F1','#14B8A6','#F97316',
];
export function randomStageColor(): string {
  return STAGE_COLORS[Math.floor(Math.random() * STAGE_COLORS.length)];
}
