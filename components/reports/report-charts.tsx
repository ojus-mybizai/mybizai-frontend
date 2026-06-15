'use client';

import Link from 'next/link';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import type { ReportsDashboard } from '@/services/reports';

const CHART_COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7c7c',
  '#8dd1e1',
  '#a4de6c',
  '#d0ed57',
  '#83a6ed',
];

function objToChartData(obj: Record<string, number>, labelKey: string = 'name', valueKey: string = 'value') {
  return Object.entries(obj)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ [labelKey]: k, [valueKey]: v }));
}

export function LeadsCharts({ data }: { data: ReportsDashboard['leads'] }) {
  const stageData = objToChartData(data.by_stage ?? {});
  const sourceData = objToChartData(data.by_source);
  const hasAny = data.total_leads > 0 || stageData.length > 0 || sourceData.length > 0 || data.over_time.some((p) => p.count > 0);
  if (!hasAny) {
    return (
      <section id="leads" className="rounded-xl border border-border-color bg-card-bg p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Leads</h2>
        <p className="text-sm text-text-secondary mb-2">No lead data yet.</p>
        <Link href='/contacts' className="text-sm font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          Add contacts
        </Link>
      </section>
    );
  }
  return (
    <section id="leads" className="rounded-xl border border-border-color bg-card-bg p-5 space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Leads</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <p className="text-sm text-text-secondary mb-2">Total leads</p>
          <p className="text-2xl font-bold text-text-primary">{data.total_leads}</p>
        </div>
        {stageData.length > 0 && (
          <div className="rounded-xl border border-border-color bg-card-bg p-4 min-h-[240px]">
            <p className="text-sm text-text-secondary mb-2">By stage</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={stageData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {stageData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {sourceData.length > 0 && (
          <div className="rounded-xl border border-border-color bg-card-bg p-4 min-h-[240px]">
            <p className="text-sm text-text-secondary mb-2">By source</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sourceData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill={CHART_COLORS[0]} name="Leads" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {data.over_time.some((p) => p.count > 0) && (
        <div className="rounded-xl border border-border-color bg-card-bg p-4 min-h-[260px]">
          <p className="text-sm text-text-secondary mb-2">Leads over time</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.over_time} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" name="Leads" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export function WorkCharts({ data }: { data: ReportsDashboard['work'] }) {
  const statusData = objToChartData(data.by_status);
  const hasAny = data.total > 0 || statusData.length > 0 || data.by_type.length > 0 || data.by_employee.length > 0;
  if (!hasAny) {
    return (
      <section id="work" className="rounded-xl border border-border-color bg-card-bg p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Work</h2>
        <p className="text-sm text-text-secondary mb-2">No work data yet.</p>
        <Link href="/work" className="text-sm font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          Assign work
        </Link>
      </section>
    );
  }
  return (
    <section id="work" className="rounded-xl border border-border-color bg-card-bg p-5 space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Work</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <p className="text-sm text-text-secondary">Total work</p>
          <p className="text-2xl font-bold text-text-primary">{data.total}</p>
        </div>
        {statusData.length > 0 && (
          <div className="rounded-xl border border-border-color bg-card-bg p-4 min-h-[240px]">
            <p className="text-sm text-text-secondary mb-2">By status</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {data.by_type.length > 0 && (
          <div className="rounded-xl border border-border-color bg-card-bg p-4 min-h-[240px]">
            <p className="text-sm text-text-secondary mb-2">By type</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={data.by_type.map((t) => ({ name: t.work_type_name || `Type ${t.work_type_id}`, count: t.count }))}
                margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill={CHART_COLORS[3]} name="Work" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {data.by_employee.length > 0 && (
        <div className="rounded-xl border border-border-color bg-card-bg p-4 min-h-[260px]">
          <p className="text-sm text-text-secondary mb-2">By employee</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.by_employee.map((e) => ({ name: e.name || `User ${e.user_id}`, count: e.count }))}
              margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_COLORS[4]} name="Work" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
