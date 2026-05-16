'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Users, MessageSquare, Wallet, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

interface Kpi {
  key: string;
  label: string;
  value: number;
  prev_value: number;
  delta_pct: number | null;
  href: string;
  is_currency?: boolean;
}

interface Response { window: { start_date: string; end_date: string }; kpis: Kpi[]; }

const ICONS: Record<string, { icon: React.ElementType; bg: string; cls: string }> = {
  new_leads:  { icon: Users,         bg: 'bg-blue-100 dark:bg-blue-500/15',       cls: 'text-blue-500'    },
  convos:     { icon: MessageSquare, bg: 'bg-emerald-100 dark:bg-emerald-500/15', cls: 'text-emerald-500' },
  spend:      { icon: Wallet,        bg: 'bg-rose-100 dark:bg-rose-500/15',       cls: 'text-rose-500'    },
  work_done:  { icon: CheckCircle2,  bg: 'bg-purple-100 dark:bg-purple-500/15',   cls: 'text-purple-500'  },
};

function DeltaPill({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta === 0) {
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-bg-secondary text-text-secondary">0%</span>;
  }
  const positive = delta > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const cls = positive
    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
    : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums ${cls}`}>
      <Icon size={10} />
      {positive ? '+' : ''}{delta.toFixed(1)}%
    </span>
  );
}

export function HeadlineKpis({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate)   params.set('end_date',   endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    setLoading(true);
    apiFetch<Response>(`/widgets/headline${qs}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  return (
    <div className="mb-7">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-5 rounded-full bg-blue-500" />
        <h2 className="text-sm font-semibold text-text-primary">Headline</h2>
        {data && (
          <span className="text-[10px] text-text-secondary font-medium bg-bg-secondary px-2 py-0.5 rounded-full">
            {data.window.start_date} → {data.window.end_date}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(data?.kpis ?? Array.from({ length: 4 }).map((_, i) => ({
          key: `loading_${i}`, label: '', value: 0, prev_value: 0, delta_pct: null, href: '#',
        }) as Kpi)).map((k) => {
          const meta = ICONS[k.key] ?? ICONS.new_leads;
          const Icon = meta.icon;
          return (
            <Link
              key={k.key}
              href={k.href}
              className="block group bg-card-bg border border-border-color rounded-2xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center`}>
                  <Icon size={16} className={meta.cls} />
                </div>
                <ArrowUpRight size={13} className="text-text-secondary opacity-30 group-hover:opacity-70 transition-opacity" />
              </div>
              {loading ? (
                <div className="h-6 w-16 bg-bg-secondary rounded-lg animate-pulse mb-2" />
              ) : (
                <p className="text-2xl font-bold text-text-primary tracking-tight leading-none mb-1.5">
                  {k.is_currency ? '₹' : ''}{k.value.toLocaleString()}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-text-secondary truncate">{k.label || '—'}</p>
                {!loading && <DeltaPill delta={k.delta_pct} />}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
