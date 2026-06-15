'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import {
  getLeadStats,
  getLeadStatsOverTime,
  type LeadStats,
  type LeadStatsOverTime,
} from '@/services/customers';
import { apiFetch } from '@/lib/api-client';
import { Users, TrendingUp, Trophy, BarChart2, ArrowRight, Clock } from 'lucide-react';

// ─── Recharts (lazy) ─────────────────────────────────────────

import dynamic from 'next/dynamic';
const AreaChart = dynamic(() => import('recharts').then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then((m) => m.Area), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });

// ─── Helpers ─────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Stat Card ───────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-text-primary">{value}</div>
          <div className="text-xs text-text-secondary">{label}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Bar Row ─────────────────────────────────────────────────

function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, (count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs text-text-secondary truncate">{label}</span>
      <div className="flex-1 h-5 rounded-full bg-bg-secondary overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-xs font-semibold text-text-primary text-right">{count}</span>
    </div>
  );
}

// ─── Priority Badge ──────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  contacted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  qualified: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  won: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

// ─── Main Page ───────────────────────────────────────────────

export default function HomePage() {
  const user = useAuthStore((s) => s.user as any);
  const firstName = (user?.name || user?.email || '').split(/[\s@]/)[0] || 'there';

  const [stats, setStats] = useState<LeadStats | null>(null);
  const [timeSeries, setTimeSeries] = useState<LeadStatsOverTime | null>(null);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getLeadStats().catch(() => null),
      getLeadStatsOverTime(30).catch(() => null),
      apiFetch<any>('/contacts-v2/?per_page=5&page=1').catch(() => ({ contacts: [] })),
    ]).then(([s, ts, contacts]) => {
      setStats(s);
      setTimeSeries(ts);
      setRecentLeads(contacts?.contacts || []);
    }).finally(() => setLoading(false));
  }, []);

  const total = stats?.total_leads ?? 0;
  const newCount = stats?.by_stage?.['New'] ?? stats?.by_stage?.['Unassigned'] ?? 0;
  const wonCount = stats?.by_stage?.['Won'] ?? stats?.by_stage?.['won'] ?? 0;
  const convRate = total > 0 ? ((wonCount / total) * 100).toFixed(1) : '0';

  // Sort stages and sources by count for bars
  const stageEntries = Object.entries(stats?.by_stage ?? {}).sort((a, b) => b[1] - a[1]);
  const sourceEntries = Object.entries(stats?.by_source ?? {}).sort((a, b) => b[1] - a[1]);
  const priorityEntries = Object.entries(stats?.by_priority ?? {}).sort((a, b) => b[1] - a[1]);
  const maxStage = Math.max(...stageEntries.map(([, v]) => v), 1);
  const maxSource = Math.max(...sourceEntries.map(([, v]) => v), 1);

  const STAGE_COLORS = ['bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-emerald-500', 'bg-red-400', 'bg-slate-400'];
  const SOURCE_COLORS = ['bg-accent', 'bg-blue-400', 'bg-purple-400', 'bg-amber-400', 'bg-emerald-400', 'bg-slate-400'];

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{greeting()}, {firstName}</h1>
          <p className="text-sm text-text-secondary mt-0.5">{today}</p>
        </div>
        <Link href="/contacts" className="text-sm text-accent hover:underline flex items-center gap-1">
          View all contacts <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-border-color bg-card-bg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Total Leads" value={total} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300" />
            <StatCard icon={TrendingUp} label="New Leads" value={newCount} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300" />
            <StatCard icon={Trophy} label="Won" value={wonCount} color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300" />
            <StatCard icon={BarChart2} label="Conversion Rate" value={`${convRate}%`} color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300" />
          </div>

          {/* Charts Row */}
          <div className="grid gap-5 lg:grid-cols-5">
            {/* Leads Over Time */}
            <div className="lg:col-span-3 rounded-xl border border-border-color bg-card-bg p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Leads — Last 30 Days</h3>
              {timeSeries && timeSeries.series.length > 0 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeries.series}>
                      <defs>
                        <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent, #6366f1)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--accent, #6366f1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} stroke="var(--text-secondary)" />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} stroke="var(--text-secondary)" />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border-color)' }} />
                      <Area type="monotone" dataKey="count" stroke="var(--accent, #6366f1)" fill="url(#leadGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-text-secondary py-8 text-center">No lead data yet</p>
              )}
            </div>

            {/* By Source */}
            <div className="lg:col-span-2 rounded-xl border border-border-color bg-card-bg p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">By Source</h3>
              {sourceEntries.length > 0 ? (
                <div className="space-y-2.5">
                  {sourceEntries.slice(0, 6).map(([source, count], i) => (
                    <BarRow key={source} label={source} count={count} max={maxSource} color={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-secondary py-8 text-center">No sources yet</p>
              )}
            </div>
          </div>

          {/* Pipeline + Priority Row */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Pipeline Stages */}
            <div className="rounded-xl border border-border-color bg-card-bg p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Pipeline</h3>
              {stageEntries.length > 0 ? (
                <div className="space-y-2.5">
                  {stageEntries.map(([stage, count], i) => (
                    <BarRow key={stage} label={stage} count={count} max={maxStage} color={STAGE_COLORS[i % STAGE_COLORS.length]} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-secondary py-8 text-center">No pipeline data yet</p>
              )}
            </div>

            {/* By Priority */}
            <div className="rounded-xl border border-border-color bg-card-bg p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">By Priority</h3>
              {priorityEntries.length > 0 ? (
                <div className="space-y-3">
                  {priorityEntries.map(([priority, count]) => (
                    <div key={priority} className="flex items-center justify-between">
                      <span className={`text-xs font-medium rounded-full px-2.5 py-1 capitalize ${PRIORITY_COLORS[priority.toLowerCase()] || 'bg-bg-secondary text-text-secondary'}`}>
                        {priority}
                      </span>
                      <span className="text-lg font-bold text-text-primary">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-secondary py-8 text-center">No priority data yet</p>
              )}
            </div>
          </div>

          {/* Recent Leads */}
          <div className="rounded-xl border border-border-color bg-card-bg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
              <h3 className="text-sm font-semibold text-text-primary">Recent Contacts</h3>
              <Link href="/contacts" className="text-xs text-accent hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recentLeads.length > 0 ? (
              <div className="divide-y divide-border-color">
                {recentLeads.map((lead: any) => (
                  <Link
                    key={lead.id}
                    href={`/contacts/${lead.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-bg-secondary/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-text-primary truncate">
                        {lead.name || lead.phone || 'Unnamed'}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-secondary">
                        {lead.source && <span className="capitalize">{lead.source}</span>}
                        {lead.phone && <span>{lead.phone}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {lead.status && (
                        <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 capitalize ${STATUS_COLORS[lead.status?.toLowerCase()] || 'bg-bg-secondary text-text-secondary'}`}>
                          {lead.status}
                        </span>
                      )}
                      {lead.created_at && (
                        <span className="text-[10px] text-text-secondary flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {timeAgo(lead.created_at)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-text-secondary">No leads yet</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
