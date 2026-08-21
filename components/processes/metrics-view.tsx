'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell,
} from 'recharts';
import {
  getProcessMetrics, getProcessVelocity, getProcessLeaderboard, getProcessStuck,
  type ProcessMetrics, type Velocity, type Leaderboard, type Stuck,
} from '@/services/processes';
import { formatCurrency, formatNumber, Avatar } from './shared';
import { formatDayMonth } from '@/lib/format-date';

interface Props {
  processId: number;
}

const PERIODS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

export default function MetricsView({ processId }: Props) {
  const [period, setPeriod] = useState(30);
  const [metrics, setMetrics] = useState<ProcessMetrics | null>(null);
  const [velocity, setVelocity] = useState<Velocity | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [stuck, setStuck] = useState<Stuck | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getProcessMetrics(processId, period),
      getProcessVelocity(processId, period),
      getProcessLeaderboard(processId, period),
      getProcessStuck(processId, 7),
    ])
      .then(([m, v, l, s]) => { setMetrics(m); setVelocity(v); setLeaderboard(l); setStuck(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [processId, period]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="rounded-lg border border-border-color bg-card-bg p-4 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!metrics) return <p className="text-sm text-text-secondary">No metrics available.</p>;

  const funnelData = metrics.by_stage.map(s => ({
    name: s.stage_name, count: s.count, value: s.sum_value, fill: s.stage_color || '#3B82F6',
  }));

  const velocityData = (velocity?.series || []).map(p => ({
    date: formatDayMonth(p.date),
    added: p.added, completed: p.completed, dropped: p.dropped,
  }));

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-secondary">Period:</span>
        <div className="flex items-center rounded-md border border-border-color overflow-hidden">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${period === p.value ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi title="Active" value={formatNumber(metrics.total_active)} hint="In-flight entries" />
        <Kpi title="Pipeline Value" value={formatCurrency(metrics.total_value, true)} hint="Σ expected value" />
        <Kpi title="Weighted" value={formatCurrency(metrics.weighted_value, true)} hint="× win probability" tone="emerald" />
        <Kpi
          title="Win Rate"
          value={`${(metrics.win_rate * 100).toFixed(0)}%`}
          hint={`${metrics.win_count} won · ${metrics.loss_count} lost`}
          tone={metrics.win_rate >= 0.5 ? 'emerald' : metrics.win_rate >= 0.25 ? 'amber' : 'red'}
        />
      </div>

      {/* Funnel chart */}
      <div className="rounded-lg border border-border-color bg-card-bg p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Pipeline Funnel</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(val: any, name: any) => name === 'value' ? formatCurrency(val) : val}
              />
              <Bar dataKey="count" name="Entries">
                {funnelData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Velocity */}
      <div className="rounded-lg border border-border-color bg-card-bg p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Velocity (last {velocity?.period_days ?? period}d)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={velocityData}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="added" stroke="#3B82F6" strokeWidth={2} dot={false} name="Added" />
              <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} dot={false} name="Won" />
              <Line type="monotone" dataKey="dropped" stroke="#EF4444" strokeWidth={2} dot={false} name="Lost" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leaderboard */}
        <div className="rounded-lg border border-border-color bg-card-bg p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Leaderboard (last {period}d)</h3>
          {(!leaderboard?.rows || leaderboard.rows.length === 0) ? (
            <p className="text-xs text-text-secondary">No data yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-text-secondary border-b border-border-color">
                <tr>
                  <th className="text-left py-1.5 pl-1 font-medium">Member</th>
                  <th className="text-right py-1.5 font-medium">Active</th>
                  <th className="text-right py-1.5 font-medium">Won</th>
                  <th className="text-right py-1.5 font-medium">Win %</th>
                  <th className="text-right py-1.5 pr-1 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.rows.map(r => (
                  <tr key={r.user_id} className="border-b border-border-color/50">
                    <td className="py-1.5 pl-1 flex items-center gap-2 truncate">
                      <Avatar name={r.user_name} size="xs" /> {r.user_name || `User #${r.user_id}`}
                    </td>
                    <td className="text-right">{r.active}</td>
                    <td className="text-right">{r.won}</td>
                    <td className="text-right">{(r.win_rate * 100).toFixed(0)}%</td>
                    <td className="text-right pr-1 font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(r.revenue, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Stuck */}
        <div className="rounded-lg border border-border-color bg-card-bg p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center justify-between">
            <span>Stuck entries</span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-normal">
              {stuck?.entries.length || 0} over SLA
            </span>
          </h3>
          {(!stuck?.entries || stuck.entries.length === 0) ? (
            <p className="text-xs text-text-secondary">Nothing stuck. 🎉</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {stuck.entries.slice(0, 20).map(s => (
                <div key={s.entry.id} className={`flex items-center justify-between gap-2 rounded-md border p-2 text-xs ${s.sla_status === 'breach' ? 'border-red-300 bg-red-50/30 dark:bg-red-950/10' : 'border-amber-300 bg-amber-50/30 dark:bg-amber-950/10'}`}>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.entry.title || s.entry.entity_name}</p>
                    <p className="text-text-secondary truncate">
                      {s.entry.current_stage_name} · {s.entry.assigned_member_name || 'unassigned'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${s.sla_status === 'breach' ? 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-200' : 'bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'}`}>
                    {s.days_in_stage}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, value, hint, tone }: { title: string; value: string; hint?: string; tone?: 'emerald'|'amber'|'red' }) {
  const toneCls = tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-400'
    : tone === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : tone === 'red' ? 'text-red-600 dark:text-red-400'
    : 'text-text-primary';
  return (
    <div className="rounded-lg border border-border-color bg-card-bg p-4">
      <p className="text-[11px] text-text-secondary uppercase tracking-wide font-medium">{title}</p>
      <p className={`mt-1 text-xl font-bold ${toneCls}`}>{value}</p>
      {hint && <p className="text-[10px] text-text-secondary mt-0.5">{hint}</p>}
    </div>
  );
}
