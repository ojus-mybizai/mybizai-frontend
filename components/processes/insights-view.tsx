'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell,
} from 'recharts';
import {
  getProcessMetrics, getProcessVelocity, getProcessLeaderboard, getProcessStuck, getProcessActivity,
  type ProcessMetrics, type Velocity, type Leaderboard, type Stuck, type ActivityEvent,
} from '@/services/processes';
import {
  Money, Delta, Avatar, Pill, Icon, EmptyState, SectionHeader,
  formatNumber, formatPercent, formatCurrency, relativeTime,
} from './design-system';
import { formatDayMonth } from '@/lib/format-date';

interface Props { processId: number; }

type Tab = 'overview' | 'funnel' | 'velocity' | 'team' | 'stuck';
const PERIODS: { label: string; value: number }[] = [
  { label: '7 days',  value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

export default function InsightsView({ processId }: Props) {
  const [period, setPeriod] = useState(30);
  const [tab, setTab] = useState<Tab>('overview');
  const [metrics, setMetrics] = useState<ProcessMetrics | null>(null);
  const [velocity, setVelocity] = useState<Velocity | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [stuck, setStuck] = useState<Stuck | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getProcessMetrics(processId, period),
      getProcessVelocity(processId, period),
      getProcessLeaderboard(processId, period),
      getProcessStuck(processId, 7),
      getProcessActivity(processId, 30, 0),
    ])
      .then(([m, v, l, s, a]) => {
        setMetrics(m); setVelocity(v); setLeaderboard(l); setStuck(s); setActivity(a.events);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [processId, period]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1,2,3].map(i => <div key={i} className="h-32 rounded-xl bg-bg-secondary animate-pulse" />)}
      </div>
    );
  }
  if (!metrics) return <EmptyState icon="📊" title="No insights yet" body="Add a few entries and move them through stages — insights will appear here." />;

  const insights = buildInsights(metrics, velocity);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
      {/* Main column */}
      <div className="space-y-4">
        {/* Period + tab switcher */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center rounded-md border border-border-color bg-card-bg overflow-hidden">
            {([
              ['overview','Overview'],['funnel','Funnel'],['velocity','Velocity'],['team','Team'],['stuck','Stuck'],
            ] as const).map(([k,l]) => (
              <button
                key={k} onClick={() => setTab(k as Tab)}
                className={`px-3 py-1.5 text-xs font-medium transition-quick ${tab === k ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-secondary'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">Period:</span>
            <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}
              className="rounded-md border border-border-color bg-card-bg px-2 py-1 text-xs">
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        {/* Insight hero card — narrative summary */}
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0">
              <Icon.trend size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">Today's insight</p>
              <ul className="space-y-1 text-sm text-text-primary">
                {insights.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </div>
          </div>
        </div>

        {tab === 'overview' && <Overview metrics={metrics} velocity={velocity} />}
        {tab === 'funnel'   && <Funnel metrics={metrics} />}
        {tab === 'velocity' && <VelocityChart velocity={velocity} period={period} />}
        {tab === 'team'     && <Team leaderboard={leaderboard} period={period} />}
        {tab === 'stuck'    && <StuckPanel stuck={stuck} />}
      </div>

      {/* Activity rail */}
      <aside className="hidden lg:block">
        <ActivityRail events={activity} />
      </aside>
    </div>
  );
}

// ─── Insight narrative ────────────────────────────────────────────────────────

function buildInsights(m: ProcessMetrics, v: Velocity | null): React.ReactNode[] {
  const out: React.ReactNode[] = [];

  // Win rate signal
  if (m.win_count + m.loss_count > 0) {
    const tone = m.win_rate >= 0.5 ? 'success' : m.win_rate >= 0.25 ? 'warn' : 'danger';
    const adj = m.win_rate >= 0.5 ? 'strong' : m.win_rate >= 0.25 ? 'steady' : 'weak';
    out.push(<span key="wr"><span className="font-semibold">{adj.charAt(0).toUpperCase() + adj.slice(1)} win rate</span> — {formatPercent(m.win_rate)} ({m.win_count} won / {m.loss_count} lost in period).</span>);
  }

  // Weakest funnel step
  if (m.funnel.length > 0) {
    const worst = [...m.funnel].sort((a, b) => a.conversion_rate - b.conversion_rate)[0];
    if (worst.moved_count > 0 || m.funnel.some(f => f.moved_count > 0)) {
      out.push(<span key="fn">Weakest step: <span className="font-semibold">{worst.from_stage_name} → {worst.to_stage_name}</span> at {formatPercent(worst.conversion_rate)} conversion.</span>);
    }
  }

  // Velocity signal
  if (v && v.series.length > 0) {
    const added = v.series.reduce((s, p) => s + p.added, 0);
    const completed = v.series.reduce((s, p) => s + p.completed, 0);
    if (added > 0 || completed > 0) {
      out.push(<span key="vl"><span className="font-semibold">{added}</span> entries added · <span className="font-semibold">{completed}</span> won in last {v.period_days} days.</span>);
    }
  }

  // Money in pipeline
  if (m.total_value > 0) {
    out.push(<span key="mv"><span className="font-semibold">{formatCurrency(m.total_value, true)}</span> in pipeline, weighted to <span className="font-semibold">{formatCurrency(m.weighted_value, true)}</span>.</span>);
  }

  if (out.length === 0) {
    out.push(<span key="empty" className="text-text-secondary">Move entries through stages to start seeing insights.</span>);
  }
  return out;
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function Overview({ metrics, velocity }: { metrics: ProcessMetrics; velocity: Velocity | null }) {
  const velocityData = (velocity?.series || []).map(p => ({
    date: formatDayMonth(p.date),
    added: p.added, completed: p.completed, dropped: p.dropped,
  }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi label="Active" value={formatNumber(metrics.total_active)} />
        <Kpi label="Pipeline" value={formatCurrency(metrics.total_value, true)} />
        <Kpi label="Weighted" value={formatCurrency(metrics.weighted_value, true)} tone="success" />
        <Kpi label="Avg cycle" value={metrics.avg_cycle_days != null ? `${Math.round(metrics.avg_cycle_days)}d` : '—'} />
      </div>

      {velocityData.length > 0 && (
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <SectionHeader title="Velocity" sub="Daily added / won / lost" />
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={velocityData}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="added"     stroke="var(--accent, #3B82F6)" strokeWidth={2} dot={false} name="Added" />
                <Line type="monotone" dataKey="completed" stroke="#10B981"                 strokeWidth={2} dot={false} name="Won" />
                <Line type="monotone" dataKey="dropped"   stroke="#EF4444"                 strokeWidth={2} dot={false} name="Lost" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

function Funnel({ metrics }: { metrics: ProcessMetrics }) {
  if (metrics.by_stage.length === 0) return <EmptyState icon="🚪" title="No stages yet" />;

  // Two views: stage volume bars + conversion arrows
  const max = Math.max(...metrics.by_stage.map(s => s.count), 1);

  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4">
      <SectionHeader title="Pipeline funnel" sub="Width = entries currently in stage · Arrows = conversion in period" />

      <div className="space-y-1">
        {metrics.by_stage.map((s, i) => {
          const width = (s.count / max) * 100;
          const conv = metrics.funnel.find(f => f.from_stage_id === s.stage_id);
          return (
            <React.Fragment key={s.stage_id}>
              <div className="relative">
                <div
                  className="rounded-md flex items-center justify-between px-3 h-9 text-sm font-medium text-white transition-card"
                  style={{ width: `${Math.max(width, 12)}%`, background: s.stage_color || '#6B7280', minWidth: 120 }}
                >
                  <span className="truncate">{s.stage_name}</span>
                  <span className="tabular-nums ml-2">{s.count}</span>
                </div>
                <div className="absolute right-0 top-0 h-9 flex items-center text-xs text-text-secondary">
                  {s.sum_value > 0 && (
                    <span className="ml-3"><Money value={s.sum_value} compact size="sm" tone="muted" /></span>
                  )}
                </div>
              </div>
              {conv && i < metrics.by_stage.length - 1 && (
                <div className="pl-3 text-[11px] text-text-secondary flex items-center gap-1">
                  <Icon.back size={10} />
                  <span><span className="font-semibold text-text-primary">{conv.moved_count}</span> moved · {formatPercent(conv.conversion_rate)} conversion</span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Velocity ─────────────────────────────────────────────────────────────────

function VelocityChart({ velocity, period }: { velocity: Velocity | null; period: number }) {
  const data = (velocity?.series || []).map(p => ({
    date: formatDayMonth(p.date),
    added: p.added, completed: p.completed, dropped: p.dropped,
  }));
  if (data.every(d => d.added === 0 && d.completed === 0 && d.dropped === 0)) {
    return <EmptyState icon="📈" title="No activity in this period" />;
  }
  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4">
      <SectionHeader title={`Velocity · last ${period} days`} />
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="added"     fill="var(--accent, #3B82F6)" name="Added" />
            <Bar dataKey="completed" fill="#10B981"                 name="Won" />
            <Bar dataKey="dropped"   fill="#EF4444"                 name="Lost" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────

function Team({ leaderboard, period }: { leaderboard: Leaderboard | null; period: number }) {
  if (!leaderboard || leaderboard.rows.length === 0) {
    return <EmptyState icon="👥" title="No team data yet" body="Assign entries to teammates to see who's winning." />;
  }
  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4 overflow-hidden">
      <SectionHeader title={`Leaderboard · last ${period} days`} />
      <table className="w-full text-sm">
        <thead className="text-xs text-text-secondary border-b border-border-color">
          <tr>
            <th className="text-left py-2 px-2 font-medium">Member</th>
            <th className="text-right py-2 font-medium">Active</th>
            <th className="text-right py-2 font-medium">Won</th>
            <th className="text-right py-2 font-medium">Lost</th>
            <th className="text-right py-2 font-medium">Win %</th>
            <th className="text-right py-2 px-2 font-medium">Revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-color">
          {leaderboard.rows.map(r => (
            <tr key={r.user_id} className="hover:bg-bg-secondary/40">
              <td className="py-2 px-2 flex items-center gap-2 truncate">
                <Avatar name={r.user_name} size="sm" />
                <span className="truncate">{r.user_name || `User #${r.user_id}`}</span>
              </td>
              <td className="text-right tabular-nums">{r.active}</td>
              <td className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">{r.won}</td>
              <td className="text-right tabular-nums">{r.lost}</td>
              <td className="text-right tabular-nums">{formatPercent(r.win_rate)}</td>
              <td className="text-right tabular-nums font-semibold pr-2"><Money value={r.revenue} compact tone="success" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Stuck panel ──────────────────────────────────────────────────────────────

function StuckPanel({ stuck }: { stuck: Stuck | null }) {
  if (!stuck || stuck.entries.length === 0) {
    return <EmptyState icon="🎉" title="Nothing stuck" body="Every active entry is within its SLA. Great job." />;
  }
  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4">
      <SectionHeader
        title={`${stuck.entries.length} stuck entries`}
        sub="Entries that have exceeded their stage SLA or warning threshold"
      />
      <div className="space-y-1.5">
        {stuck.entries.map(s => (
          <div key={s.entry.id} className={`flex items-center justify-between gap-2 rounded-md border p-2 text-sm
            ${s.sla_status === 'breach'
              ? 'border-red-300 bg-red-50/40 dark:border-red-800 dark:bg-red-950/15'
              : 'border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/15'}`}>
            <div className="min-w-0">
              <p className="font-medium text-text-primary truncate">{s.entry.title || s.entry.entity_name}</p>
              <p className="text-xs text-text-secondary truncate">
                {s.entry.current_stage_name} · {s.entry.assigned_member_name || 'Unassigned'}
              </p>
            </div>
            <Pill tone={s.sla_status === 'breach' ? 'danger' : 'warn'} size="sm">
              {s.days_in_stage}d{s.sla_days ? ` / ${s.sla_days}` : ''}
            </Pill>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity rail ────────────────────────────────────────────────────────────

function ActivityRail({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg p-3">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Activity</p>
        <p className="text-xs text-text-secondary">No activity yet.</p>
      </div>
    );
  }
  // Group by date
  const groups: Record<string, ActivityEvent[]> = {};
  for (const ev of events) {
    const d = ev.created_at ? new Date(ev.created_at).toDateString() : 'Unknown';
    (groups[d] = groups[d] || []).push(ev);
  }
  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-3 sticky top-4 max-h-[calc(100vh-160px)] overflow-y-auto">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Activity</p>
      {Object.entries(groups).map(([day, items]) => (
        <div key={day} className="mb-3 last:mb-0">
          <p className="text-[10px] uppercase tracking-wide text-text-secondary/70 mb-1.5">
            {formatDayMonth(day)}
          </p>
          <div className="space-y-1.5">
            {items.map(ev => (
              <div key={`${ev.entity_type}-${ev.id}`} className="text-xs">
                <p className="text-text-primary truncate">
                  <span className="font-medium">{ev.actor_name || 'System'}</span>{' '}
                  <span className="text-text-secondary">{ev.description}</span>
                </p>
                {ev.metadata?.from_stage && ev.metadata?.to_stage && (
                  <p className="text-[10px] text-text-secondary">{ev.metadata.from_stage} → {ev.metadata.to_stage}</p>
                )}
                <p className="text-[10px] text-text-secondary">{relativeTime(ev.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'success' }) {
  const cls = tone === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-primary';
  return (
    <div className="rounded-md border border-border-color bg-card-bg px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={`text-base font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}
