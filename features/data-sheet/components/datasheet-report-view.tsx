'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { DatasheetReport } from '@/services/reports';

const DAYS_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

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

interface DatasheetReportViewProps {
  report: DatasheetReport | null;
  loading: boolean;
  error: string | null;
  days: number;
  onDaysChange: (days: number) => void;
}

export function DatasheetReportView({
  report,
  loading,
  error,
  days,
  onDaysChange,
}: DatasheetReportViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Report</h2>
        <div className="flex gap-2">
          {DAYS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onDaysChange(o.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                days === o.value
                  ? 'bg-accent text-white'
                  : 'border border-border-color bg-bg-primary text-text-primary hover:border-accent'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-sm text-text-secondary py-4">Loading report…</p>
      )}

      {!loading && report && (
        <div className="space-y-8">
          <div className="rounded-lg border border-border-color bg-bg-primary p-4 max-w-xs">
            <p className="text-sm text-text-secondary">Total records</p>
            <p className="text-2xl font-bold text-text-primary">{report.total_records}</p>
            <p className="text-xs text-text-secondary mt-1">
              {report.model_display_name} · last {days} days
            </p>
          </div>

          {report.over_time.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-text-primary mb-3">Records created over time</h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={report.over_time}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(v) => new Date(v).toLocaleDateString()}
                      formatter={(value: number | undefined) => [value ?? 0, 'Records']}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={CHART_COLORS[0]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Records"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {Object.keys(report.by_field).length > 0 && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-text-primary">By field</h3>
              <div className="grid gap-6 sm:grid-cols-2">
                {Object.entries(report.by_field).map(([fieldName, groups]) => {
                  if (groups.length === 0) return null;
                  const chartData = groups.map((g) => ({ name: g.value || '(empty)', count: g.count }));
                  return (
                    <div
                      key={fieldName}
                      className="rounded-xl border border-border-color bg-bg-primary p-4 min-h-[220px]"
                    >
                      <p className="text-sm font-medium text-text-secondary mb-2 capitalize">
                        {fieldName.replace(/_/g, ' ')}
                      </p>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={chartData}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {chartData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number | undefined) => [value ?? 0, 'Count']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {report.total_records === 0 && (
            <p className="text-sm text-text-secondary">
              No records in this data sheet for the selected period.
            </p>
          )}
        </div>
      )}

      {!loading && !report && !error && (
        <p className="text-sm text-text-secondary">No report data.</p>
      )}
    </div>
  );
}
