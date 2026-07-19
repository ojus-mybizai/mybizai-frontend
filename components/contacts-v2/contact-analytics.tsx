'use client';

import { useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, Users, AlertCircle, GitBranch, X, Loader2 } from 'lucide-react';
import { useContactV2Store } from '@/lib/contact-v2-store';
import { contactsV2Service } from '@/services/contacts-v2';
import { useState } from 'react';
import type { ContactStatsOverTime } from '@/services/contacts-v2';

interface Props {
  onClose: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  hot:    '#ef4444',
  high:   '#f97316',
  medium: '#eab308',
  low:    '#60a5fa',
};

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export function ContactAnalytics({ onClose }: Props) {
  const { stats, loadingStats, loadStats, groups } = useContactV2Store();
  const [overTime, setOverTime] = useState<ContactStatsOverTime[]>([]);
  const [loadingTime, setLoadingTime] = useState(false);

  useEffect(() => {
    loadStats();
    setLoadingTime(true);
    contactsV2Service.getStatsOverTime(30)
      .then(setOverTime)
      .finally(() => setLoadingTime(false));
  }, []);

  if (loadingStats && !stats) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  // Build chart data from dict responses
  const typeData = Object.entries(stats?.by_group ?? {}).map(([name, value], i) => ({
    name,
    value,
    color: groups.find(g => g.name === name)?.color ?? PIE_COLORS[i % PIE_COLORS.length],
  }));

  const priorityData = Object.entries(stats?.by_priority ?? {}).map(([priority, value]) => ({
    name: priority.charAt(0).toUpperCase() + priority.slice(1),
    value,
    fill: PRIORITY_COLORS[priority] ?? '#6366f1',
  }));

  const sourceData = Object.entries(stats?.by_source ?? {})
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="border-b border-border-color bg-bg-secondary/40">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border-color">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-text-primary">Analytics Overview</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-6 py-4">
        {/* KPI chips */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <KpiCard
            icon={<Users className="h-4 w-4 text-accent" />}
            label="Total Contacts"
            value={stats?.total ?? 0}
          />
          <KpiCard
            icon={<GitBranch className="h-4 w-4 text-violet-500" />}
            label="Groups"
            value={typeData.length}
          />
          <KpiCard
            icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
            label="Sources Tracked"
            value={sourceData.length}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-3 gap-4">
          {/* By group — pie */}
          <ChartCard title="By Group">
            {typeData.length > 0 ? (
              <div className="flex items-center gap-3">
                <ResponsiveContainer width={100} height={100}>
                  <PieChart>
                    <Pie data={typeData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={44}>
                      {typeData.map((entry, i) => (
                        <Cell key={i} fill={entry.color ?? PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {typeData.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color ?? PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-text-secondary truncate flex-1">{item.name}</span>
                      <span className="font-medium text-text-primary flex-shrink-0">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyChart />}
          </ChartCard>

          {/* By priority — bar */}
          <ChartCard title="By Priority">
            {priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={priorityData} barSize={24}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                    cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {priorityData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </ChartCard>

          {/* Over time — line */}
          <ChartCard title="New Contacts (30d)">
            {loadingTime ? (
              <div className="flex items-center justify-center h-[110px]">
                <Loader2 className="h-4 w-4 animate-spin text-text-secondary" />
              </div>
            ) : overTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={110}>
                <LineChart data={overTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}
                    cursor={{ stroke: '#6366f1', strokeWidth: 1 }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </ChartCard>
        </div>

        {/* Source bar (full width) */}
        {sourceData.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">By Source</p>
            <div className="flex items-end gap-2">
              {sourceData.map((item, i) => {
                const max = Math.max(...sourceData.map(s => s.value), 1);
                const pct = Math.round((item.value / max) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-text-primary">{item.value}</span>
                    <div className="w-full rounded-t" style={{ height: `${Math.max(pct * 0.6, 4)}px`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-[10px] text-text-secondary capitalize truncate w-full text-center">{item.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 ${warn && value > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-border-color bg-card-bg'}`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${warn && value > 0 ? 'bg-amber-100' : 'bg-bg-secondary'}`}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-text-primary leading-none">{value.toLocaleString()}</p>
        <p className="text-xs text-text-secondary mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-3">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[110px] text-xs text-text-secondary/50">
      No data yet
    </div>
  );
}
