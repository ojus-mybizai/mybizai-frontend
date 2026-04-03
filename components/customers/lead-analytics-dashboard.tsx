'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getLeadStats, getLeadStatsOverTime, type LeadStats, type LeadStatsOverTime } from '@/services/customers';

// ─── Colour palette (theme-safe) ──────────────────────────────────────────────

const STAGE_COLORS: string[] = [
  '#6366f1', '#3b82f6', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6b7280',
];
const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
};
const SOURCE_COLOR = '#6366f1';
const AREA_COLOR = '#6366f1';

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4 flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={`text-3xl font-bold ${color ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-xs text-text-secondary">{sub}</p>}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-color bg-card-bg px-3 py-2 text-xs shadow-lg">
      {label && <p className="font-semibold text-text-primary mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-text-secondary">
          {p.name ? `${p.name}: ` : ''}<span className="font-semibold text-text-primary">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4">
      <h3 className="text-sm font-semibold text-text-secondary mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeadAnalyticsDashboard() {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [timeSeries, setTimeSeries] = useState<LeadStatsOverTime['series']>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([getLeadStats(), getLeadStatsOverTime(days)])
      .then(([s, t]) => {
        setStats(s);
        setTimeSeries(t.series ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-bg-secondary" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  // ── Derived numbers ──────────────────────────────────────────────────────────
  const byStage = stats.by_stage ?? {};
  const byPriority = stats.by_priority ?? {};
  const bySource = stats.by_source ?? {};

  const total = stats.total_leads ?? 0;

  const stagePieData = Object.entries(byStage).map(([name, value]) => ({ name, value }));

  const sourceData = Object.entries(bySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));

  const priorityData = Object.entries(byPriority).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  // Format time series x-axis labels
  const formattedSeries = timeSeries.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Leads" value={total} />
        {stagePieData.slice(0, 3).map((s) => (
          <KpiCard key={s.name} label={s.name} value={s.value} />
        ))}
      </div>

      {/* Time-range selector + area chart */}
      <ChartSection title="Leads over time">
        <div className="flex justify-end mb-3 gap-1">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                days === d ? 'bg-accent text-white' : 'border border-border-color text-text-secondary hover:text-text-primary'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={formattedSeries} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={AREA_COLOR} stopOpacity={0.25} />
                <stop offset="95%" stopColor={AREA_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="count" name="New leads" stroke={AREA_COLOR} strokeWidth={2} fill="url(#leadGrad)" dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartSection>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stage pie */}
        <ChartSection title="Leads by stage">
          {stagePieData.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stagePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {stagePieData.map((entry, idx) => (
                    <Cell key={entry.name} fill={STAGE_COLORS[idx % STAGE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  formatter={(v) => <span className="text-xs capitalize text-text-secondary">{v}</span>}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartSection>

        {/* Priority bar */}
        <ChartSection title="Leads by priority">
          {priorityData.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityData} layout="horizontal" margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Leads" radius={[4, 4, 0, 0]}>
                  {priorityData.map((entry) => (
                    <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartSection>
      </div>

      {/* Source horizontal bar */}
      <ChartSection title="Leads by source">
        {sourceData.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-8">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, sourceData.length * 36)}>
            <BarChart data={sourceData} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} width={90} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Leads" fill={SOURCE_COLOR} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartSection>
    </div>
  );
}
