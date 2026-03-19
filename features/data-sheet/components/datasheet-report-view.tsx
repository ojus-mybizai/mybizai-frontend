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
  BarChart,
  Bar,
} from 'recharts';
import type { DatasheetReport, ReportLayout, ReportLayoutSection } from '@/services/reports';

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
  /** When provided, sections are rendered in this order (time_series, pie, bar, summary). */
  layout?: ReportLayout | null;
}

export function DatasheetReportView({
  report,
  loading,
  error,
  days,
  onDaysChange,
  layout = null,
}: DatasheetReportViewProps) {
  const sections = layout?.sections ?? null;

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

          {sections && sections.length > 0 ? (
            sections.map((sec, idx) => (
              <ReportSection
                key={`${sec.type}-${sec.field}-${idx}`}
                section={sec}
                report={report}
                days={days}
              />
            ))
          ) : (
            <>
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
                        <CategoricalChart
                          key={fieldName}
                          title={fieldName.replace(/_/g, ' ')}
                          chartData={chartData}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </>
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

function ReportSection({
  section,
  report,
  days,
}: {
  section: ReportLayoutSection;
  report: DatasheetReport;
  days: number;
}) {
  const { type, field, title } = section;

  if (type === 'time_series' && (field === 'created_at' || !field)) {
    if (!report.over_time.length) return null;
    return (
      <div>
        <h3 className="text-base font-semibold text-text-primary mb-3">{title}</h3>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={report.over_time} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
    );
  }

  if ((type === 'pie' || type === 'bar') && report.by_field[field]?.length) {
    const groups = report.by_field[field];
    const chartData = groups.map((g) => ({ name: g.value || '(empty)', count: g.count }));
    const totalCategories = chartData.length;
    // Use pie for few categories (≤8), horizontal bar for many (readable labels), table for very many
    const PIE_MAX = 8;
    const BAR_TOP_N = 20;
    const usePie = totalCategories <= PIE_MAX;
    const useTable = totalCategories > 25;
    const barData = useTable ? chartData.slice(0, BAR_TOP_N) : chartData;

    if (usePie) {
      return (
        <div className="rounded-xl border border-border-color bg-bg-primary p-4 min-h-[220px]">
          <h3 className="text-base font-semibold text-text-primary mb-3">{title}</h3>
          <p className="text-xs text-text-secondary mb-2">{totalCategories} categories</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
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
    }

    if (useTable) {
      return (
        <div className="rounded-xl border border-border-color bg-bg-primary p-4">
          <h3 className="text-base font-semibold text-text-primary mb-3">{title}</h3>
          <p className="text-xs text-text-secondary mb-3">
            Top {BAR_TOP_N} of {totalCategories} categories
          </p>
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-bg-secondary border-b border-border-color">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Value</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {barData.map((row, i) => (
                  <tr key={i} className="text-text-primary">
                    <td className="px-3 py-2 truncate max-w-[200px]" title={row.name}>{row.name}</td>
                    <td className="px-3 py-2 text-right font-medium">{row.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Horizontal bar for 9–25 categories (better than pie for many labels)
    return (
      <div className="rounded-xl border border-border-color bg-bg-primary p-4 min-h-[220px]">
        <h3 className="text-base font-semibold text-text-primary mb-3">{title}</h3>
        <p className="text-xs text-text-secondary mb-2">{totalCategories} categories</p>
        <ResponsiveContainer width="100%" height={Math.max(220, Math.min(400, barData.length * 28))}>
          <BarChart
            data={barData}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: number | undefined) => [value ?? 0, 'Count']} />
            <Bar dataKey="count" fill={CHART_COLORS[1]} name="Count" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'summary' && report.field_summaries?.[field]) {
    const s = report.field_summaries[field];
    return (
      <div className="rounded-xl border border-border-color bg-bg-primary p-4">
        <h3 className="text-base font-semibold text-text-primary mb-3">{title}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-border-color bg-bg-secondary px-3 py-2">
            <p className="text-xs text-text-secondary">Count</p>
            <p className="text-lg font-semibold text-text-primary">{s.count}</p>
          </div>
          <div className="rounded-lg border border-border-color bg-bg-secondary px-3 py-2">
            <p className="text-xs text-text-secondary">Sum</p>
            <p className="text-lg font-semibold text-text-primary">{s.sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-lg border border-border-color bg-bg-secondary px-3 py-2">
            <p className="text-xs text-text-secondary">Avg</p>
            <p className="text-lg font-semibold text-text-primary">{s.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-lg border border-border-color bg-bg-secondary px-3 py-2">
            <p className="text-xs text-text-secondary">Min</p>
            <p className="text-lg font-semibold text-text-primary">{s.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-lg border border-border-color bg-bg-secondary px-3 py-2">
            <p className="text-xs text-text-secondary">Max</p>
            <p className="text-lg font-semibold text-text-primary">{s.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/** Renders pie, bar, or table based on number of categories. */
function CategoricalChart({
  title,
  chartData,
}: {
  title: string;
  chartData: { name: string; count: number }[];
}) {
  const totalCategories = chartData.length;
  const PIE_MAX = 8;
  const BAR_TOP_N = 20;
  const usePie = totalCategories <= PIE_MAX;
  const useTable = totalCategories > 25;
  const barData = useTable ? chartData.slice(0, BAR_TOP_N) : chartData;

  if (chartData.length === 0) return null;

  if (usePie) {
    return (
      <div className="rounded-xl border border-border-color bg-bg-primary p-4 min-h-[220px]">
        <p className="text-sm font-medium text-text-secondary mb-2 capitalize">{title}</p>
        <p className="text-xs text-text-secondary mb-2">{totalCategories} categories</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={70}
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
  }

  if (useTable) {
    return (
      <div className="rounded-xl border border-border-color bg-bg-primary p-4">
        <p className="text-sm font-medium text-text-secondary mb-2 capitalize">{title}</p>
        <p className="text-xs text-text-secondary mb-3">Top {BAR_TOP_N} of {totalCategories} categories</p>
        <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-bg-secondary border-b border-border-color">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Value</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {barData.map((row, i) => (
                <tr key={i} className="text-text-primary">
                  <td className="px-3 py-2 truncate max-w-[200px]" title={row.name}>{row.name}</td>
                  <td className="px-3 py-2 text-right font-medium">{row.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-color bg-bg-primary p-4 min-h-[220px]">
      <p className="text-sm font-medium text-text-secondary mb-2 capitalize">{title}</p>
      <p className="text-xs text-text-secondary mb-2">{totalCategories} categories</p>
      <ResponsiveContainer width="100%" height={Math.max(220, Math.min(400, barData.length * 28))}>
        <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value: number | undefined) => [value ?? 0, 'Count']} />
          <Bar dataKey="count" fill={CHART_COLORS[1]} name="Count" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
