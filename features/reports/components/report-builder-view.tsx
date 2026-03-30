'use client';

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
import type { ReportBuilderResponse } from '@/services/report-builder';

const CHART_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c',
  '#8dd1e1', '#a4de6c', '#d0ed57', '#83a6ed',
];

interface ReportBuilderViewProps {
  report: ReportBuilderResponse;
  chartType: string;
  availableCharts: string[];
  onChartTypeChange: (type: string) => void;
}

const CHART_LABELS: Record<string, string> = {
  pie: 'Pie',
  bar: 'Bar',
  line: 'Line',
  table: 'Table',
  kpi: 'Summary',
};

export default function ReportBuilderView({
  report,
  chartType,
  availableCharts,
  onChartTypeChange,
}: ReportBuilderViewProps) {
  return (
    <div className="space-y-4">
      {/* Title + description */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary">{report.title}</h3>
        {report.description && (
          <p className="text-sm text-text-secondary mt-0.5">{report.description}</p>
        )}
        <p className="text-xs text-text-secondary mt-1">
          {report.total_records.toLocaleString()} total records
        </p>
      </div>

      {/* View switcher */}
      {availableCharts.length > 1 && (
        <div className="flex gap-1.5">
          {availableCharts.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChartTypeChange(type)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                chartType === type
                  ? 'bg-accent text-white'
                  : 'border border-border-color bg-bg-primary text-text-primary hover:border-accent'
              }`}
            >
              {CHART_LABELS[type] || type}
            </button>
          ))}
        </div>
      )}

      {/* Chart area */}
      <div className="rounded-xl border border-border-color bg-card-bg p-4 min-h-[300px]">
        {chartType === 'pie' && <PieView report={report} />}
        {chartType === 'bar' && <BarView report={report} />}
        {chartType === 'line' && <LineView report={report} />}
        {chartType === 'table' && <TableView report={report} />}
        {chartType === 'kpi' && <KPIView report={report} />}
      </div>
    </div>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function getFieldData(report: ReportBuilderResponse): Array<{ name: string; value: number }> {
  const byField = report.by_field;
  if (!byField) return [];
  const firstKey = Object.keys(byField)[0];
  if (!firstKey) return [];
  return (byField[firstKey] || []).map((item) => ({
    name: item.value || '(empty)',
    value: item.count,
  }));
}

function PieView({ report }: { report: ReportBuilderResponse }) {
  const data = getFieldData(report);
  if (data.length === 0) {
    return <EmptyState />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, value }) => `${name}: ${value}`}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function BarView({ report }: { report: ReportBuilderResponse }) {
  const data = getFieldData(report);
  if (data.length === 0) {
    return <EmptyState />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="value" fill={CHART_COLORS[0]} name="Count" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineView({ report }: { report: ReportBuilderResponse }) {
  const data = report.over_time;
  if (!data || data.length === 0 || !data.some((pt) => pt.count > 0)) {
    return <EmptyState />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="count"
          name="Records"
          stroke={CHART_COLORS[0]}
          strokeWidth={2}
          dot={{ r: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TableView({ report }: { report: ReportBuilderResponse }) {
  const data = getFieldData(report);
  if (data.length === 0) {
    // Fall back to over_time as table
    const otData = report.over_time;
    if (!otData || otData.length === 0) return <EmptyState />;
    return (
      <div className="overflow-auto max-h-[400px]">
        <table className="min-w-full divide-y divide-border-color text-sm">
          <thead className="sticky top-0 bg-card-bg">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">Date</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color">
            {otData.filter((r) => r.count > 0).map((row) => (
              <tr key={row.date}>
                <td className="px-3 py-1.5 text-text-primary">{row.date}</td>
                <td className="px-3 py-1.5 text-right text-text-primary">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="min-w-full divide-y divide-border-color text-sm">
        <thead className="sticky top-0 bg-card-bg">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">Value</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary">Count</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-color">
          {data.map((row) => (
            <tr key={row.name}>
              <td className="px-3 py-1.5 text-text-primary">{row.name}</td>
              <td className="px-3 py-1.5 text-right text-text-primary">{row.value.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KPIView({ report }: { report: ReportBuilderResponse }) {
  const summaries = report.field_summaries;
  if (!summaries || Object.keys(summaries).length === 0) {
    // Show total records as KPI
    return (
      <div className="flex items-center justify-center h-[200px]">
        <div className="text-center">
          <p className="text-sm text-text-secondary">Total Records</p>
          <p className="text-4xl font-bold text-text-primary">{report.total_records.toLocaleString()}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(summaries).map(([field, stats]) => (
        <div key={field} className="space-y-2">
          <p className="text-sm font-medium text-text-primary">{field.replace(/_/g, ' ')}</p>
          <div className="grid grid-cols-5 gap-2 text-center">
            {(['count', 'sum', 'avg', 'min', 'max'] as const).map((k) => (
              <div key={k}>
                <p className="text-[10px] uppercase text-text-secondary">{k}</p>
                <p className="text-sm font-semibold text-text-primary">
                  {typeof stats[k] === 'number'
                    ? k === 'count'
                      ? stats[k].toLocaleString()
                      : stats[k].toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : '-'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-[200px] text-sm text-text-secondary">
      No data available for this view.
    </div>
  );
}
