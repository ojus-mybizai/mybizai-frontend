'use client';

import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { ChartBlock } from '@/lib/agent-blocks';
import type { BlockProps } from './types';

// Shared palette — matches the dashboard / report charts already in the app.
const PALETTE = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#a4de6c'];

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border-color bg-card-bg p-4 shadow-sm">
      {title && <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>}
      <div className="min-h-[240px] w-full">
        <ResponsiveContainer width="100%" height={240}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function ChartBlockView({ block }: BlockProps<ChartBlock>) {
  const { kind, title, x_key, series, data } = block;
  const color = (i: number, s: { color?: string }) => s.color || PALETTE[i % PALETTE.length];

  if (!data || data.length === 0 || series.length === 0) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg p-6 text-sm text-text-secondary">
        {title ? `${title}: ` : ''}No chart data.
      </div>
    );
  }

  if (kind === 'pie') {
    const s = series[0];
    return (
      <Card title={title}>
        <PieChart>
          <Pie data={data} dataKey={s.key} nameKey={x_key} cx="50%" cy="50%" outerRadius={90} label>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </Card>
    );
  }

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
      {x_key && <XAxis dataKey={x_key} tick={{ fontSize: 11 }} />}
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip />
      <Legend />
    </>
  );

  if (kind === 'line') {
    return (
      <Card title={title}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          {axes}
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label || s.key} stroke={color(i, s)} strokeWidth={2} dot={{ r: 2 }} />
          ))}
        </LineChart>
      </Card>
    );
  }

  if (kind === 'area') {
    return (
      <Card title={title}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          {axes}
          {series.map((s, i) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label || s.key} stroke={color(i, s)} fill={color(i, s)} fillOpacity={0.2} strokeWidth={2} />
          ))}
        </AreaChart>
      </Card>
    );
  }

  // default: bar
  return (
    <Card title={title}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        {axes}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label || s.key} fill={color(i, s)} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </Card>
  );
}
