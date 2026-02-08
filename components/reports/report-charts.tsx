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
  const statusData = objToChartData(data.by_status);
  const sourceData = objToChartData(data.by_source);
  const hasAny = data.total_leads > 0 || statusData.length > 0 || sourceData.length > 0 || data.over_time.some((p) => p.count > 0);
  if (!hasAny) {
    return (
      <section id="leads" className="rounded-xl border border-border-color bg-card-bg p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Leads</h2>
        <p className="text-sm text-text-secondary mb-2">No lead data yet.</p>
        <Link href="/customers" className="text-sm font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          Add leads
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

export function CatalogCharts({ data }: { data: ReportsDashboard['catalog'] }) {
  const typeData = objToChartData(data.by_type);
  const availData = objToChartData(data.by_availability);
  const hasAny = data.total_items > 0 || typeData.length > 0 || availData.length > 0 || data.top_items.length > 0;
  if (!hasAny) {
    return (
      <section id="catalog" className="rounded-xl border border-border-color bg-card-bg p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Catalog</h2>
        <p className="text-sm text-text-secondary mb-2">No catalog data yet.</p>
        <Link href="/catalog" className="text-sm font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          Add catalog items
        </Link>
      </section>
    );
  }
  return (
    <section id="catalog" className="rounded-xl border border-border-color bg-card-bg p-5 space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Catalog</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <p className="text-sm text-text-secondary">Total items</p>
          <p className="text-2xl font-bold text-text-primary">{data.total_items}</p>
        </div>
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <p className="text-sm text-text-secondary">Average price</p>
          <p className="text-2xl font-bold text-text-primary">{data.average_price.toFixed(2)}</p>
        </div>
        {typeData.length > 0 && (
          <div className="rounded-xl border border-border-color bg-card-bg p-4 min-h-[240px]">
            <p className="text-sm text-text-secondary mb-2">By type</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {typeData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {availData.length > 0 && (
          <div className="rounded-xl border border-border-color bg-card-bg p-4 min-h-[240px]">
            <p className="text-sm text-text-secondary mb-2">By availability</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={availData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill={CHART_COLORS[1]} name="Items" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {data.top_items.length > 0 && (
        <div className="rounded-xl border border-border-color bg-card-bg p-4 min-h-[260px]">
          <p className="text-sm text-text-secondary mb-2">Top sold items</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.top_items.map((t) => ({ name: t.name.length > 18 ? t.name.slice(0, 18) + '…' : t.name, quantity_sold: t.quantity_sold, revenue: t.revenue }))}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="quantity_sold" fill={CHART_COLORS[2]} name="Quantity sold" radius={[0, 4, 4, 0]} />
            </BarChart>
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

export function OrdersCharts({ data }: { data: ReportsDashboard['orders'] }) {
  const statusData = objToChartData(data.by_status);
  const hasAny = data.total_orders > 0 || statusData.length > 0 || data.over_time.some((p) => p.order_count > 0 || p.revenue > 0);
  if (!hasAny) {
    return (
      <section id="orders" className="rounded-xl border border-border-color bg-card-bg p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Orders</h2>
        <p className="text-sm text-text-secondary mb-2">No order data yet.</p>
        <Link href="/orders" className="text-sm font-semibold text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          View orders
        </Link>
      </section>
    );
  }
  return (
    <section id="orders" className="rounded-xl border border-border-color bg-card-bg p-5 space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Orders</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <p className="text-sm text-text-secondary">Total orders</p>
          <p className="text-2xl font-bold text-text-primary">{data.total_orders}</p>
        </div>
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <p className="text-sm text-text-secondary">Total revenue</p>
          <p className="text-2xl font-bold text-text-primary">{data.total_revenue.toFixed(2)}</p>
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
      </div>
      {data.over_time.some((p) => p.order_count > 0 || p.revenue > 0) && (
        <div className="rounded-xl border border-border-color bg-card-bg p-4 min-h-[260px]">
          <p className="text-sm text-text-secondary mb-2">Orders and revenue over time</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.over_time} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border-color" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="order_count" name="Orders" stroke={CHART_COLORS[5]} strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS[6]} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
