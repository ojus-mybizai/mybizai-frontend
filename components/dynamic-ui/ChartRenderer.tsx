'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { apiFetch } from '@/lib/api-client';
import type { UIChart } from '@/types/ui-protocol';

interface ChartRendererProps {
  block: UIChart;
}

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#a4de6c'];

function normalizePath(path: string): string {
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

/** Expect API to return array of { name, value } or { label, value } or similar. */
function normalizeChartData(raw: unknown): { name: string; value: number }[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const name = (o.name ?? o.label ?? o.key ?? '') as string;
        const value = Number(o.value ?? o.count ?? o.total ?? 0);
        return { name: String(name), value };
      }
      return { name: '', value: 0 };
    });
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const items = (obj.items ?? obj.data ?? obj.series) as unknown;
    if (Array.isArray(items)) return normalizeChartData(items);
    return Object.entries(obj)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => ({ name: k, value: v as number }));
  }
  return [];
}

export default function ChartRenderer({ block }: ChartRendererProps) {
  const [data, setData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<unknown>(normalizePath(block.data_api))
      .then((res) => {
        if (!cancelled) {
          setData(normalizeChartData(res));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chart data');
          setData([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [block.data_api]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg p-6 text-sm text-text-secondary">
        Loading chart…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg p-6 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg p-6 text-sm text-text-secondary">
        No chart data
      </div>
    );
  }

  const chartType = (block.chart_type || 'bar').toLowerCase();

  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4">
      {block.title && (
        <h3 className="mb-3 text-base font-semibold text-text-primary">{block.title}</h3>
      )}
      <div className="min-h-[240px] w-full">
        <ResponsiveContainer width="100%" height={240}>
          {chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : chartType === 'line' ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                name="Value"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill={CHART_COLORS[0]} name="Value" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
