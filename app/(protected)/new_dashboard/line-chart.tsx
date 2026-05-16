'use client';

import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Point { date: string; value: number; }

export default function LineChartBox({ data, color = '#3B82F6' }: { data: Point[]; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" strokeOpacity={0.2} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => d.slice(5)}
          tick={{ fontSize: 10, fill: 'currentColor' }}
          stroke="currentColor"
          strokeOpacity={0.3}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'currentColor' }}
          stroke="currentColor"
          strokeOpacity={0.3}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--card-bg, #fff)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
