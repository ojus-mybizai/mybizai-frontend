'use client';

import {
  Line,
  LineChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ChartDataPoint {
  date: string;
  total_conversations: number;
  avg_response_time: number;
}

interface Props {
  chartData: ChartDataPoint[];
}

export default function AgentAnalyticsCharts({ chartData }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border-color bg-card-bg p-4">
        <h3 className="mb-2 text-sm font-semibold text-text-primary">
          Conversations over time
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" stroke="var(--text-secondary)" />
              <YAxis allowDecimals={false} stroke="var(--text-secondary)" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="total_conversations"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border-color bg-card-bg p-4">
        <h3 className="mb-2 text-sm font-semibold text-text-primary">
          Avg response time (s)
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip />
              <Bar dataKey="avg_response_time" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
