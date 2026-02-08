'use client';

import type { DashboardStats, RecentActivityItem, DashboardInsights } from '@/lib/use-dashboard-stats';
import type { ReportsDashboard } from '@/services/reports';
import { useRouter } from 'next/navigation';
import { useLeadsActivity } from '@/lib/use-leads-activity';

interface MetricsViewProps {
  stats?: DashboardStats | null;
  recentActivity?: RecentActivityItem[];
  insights?: DashboardInsights | null;
  leadStatsError?: string | null;
  loading?: boolean;
  reportsDashboard?: ReportsDashboard | null;
  reportsLoading?: boolean;
  reportsError?: string | null;
}

export default function MetricsView({
  stats,
  recentActivity,
  insights,
  leadStatsError,
  loading,
  reportsDashboard,
  reportsLoading,
  reportsError,
}: MetricsViewProps) {
  const router = useRouter();
  const { data: activitySeries, loading: activityLoading, error: activityError } = useLeadsActivity(30);

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => router.push('/customers')}
          className="rounded-xl border border-border-color bg-card-bg px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-px hover:border-accent hover:shadow-md"
        >
          <div className="mb-1 text-sm font-medium text-text-secondary">Total leads</div>
          <div className="mb-1 text-2xl font-semibold text-text-primary">
            {loading ? '—' : leadStatsError ? '—' : (stats?.totalLeads ?? 0)}
          </div>
          <div className="text-sm text-text-secondary">
            {leadStatsError ?? 'From lead stats'}
          </div>
        </button>
        <button
          type="button"
          onClick={() => router.push('/customers')}
          className="rounded-xl border border-border-color bg-card-bg px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-px hover:border-accent hover:shadow-md"
        >
          <div className="mb-1 text-sm font-medium text-text-secondary">Conversion rate</div>
          <div className="mb-1 text-2xl font-semibold text-text-primary">
            {loading ? '—' : `${(stats?.conversionRate ?? 0).toFixed(1)}%`}
          </div>
          <div className="text-sm text-text-secondary">Won / total leads</div>
        </button>
        <button
          type="button"
          onClick={() => router.push('/orders')}
          className="rounded-xl border border-border-color bg-card-bg px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-px hover:border-accent hover:shadow-md"
        >
          <div className="mb-1 text-sm font-medium text-text-secondary">Orders (30 days)</div>
          <div className="mb-1 text-2xl font-semibold text-text-primary">
            {reportsLoading
              ? '—'
              : reportsDashboard
              ? reportsDashboard.orders.total_orders
              : '—'}
          </div>
          <div className="text-sm text-text-secondary">
            {reportsError ? 'Failed to load orders' : 'From reports'}
          </div>
        </button>
        <button
          type="button"
          onClick={() => router.push('/orders')}
          className="rounded-xl border border-border-color bg-card-bg px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-px hover:border-accent hover:shadow-md"
        >
          <div className="mb-1 text-sm font-medium text-text-secondary">Revenue (30 days)</div>
          <div className="mb-1 text-2xl font-semibold text-text-primary">
            {reportsLoading
              ? '—'
              : reportsDashboard
              ? `₹${reportsDashboard.orders.total_revenue.toLocaleString()}`
              : '—'}
          </div>
          <div className="text-sm text-text-secondary">Non-cancelled orders</div>
        </button>
      </div>

      {/* Trends charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border-color bg-card-bg p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">Leads over time</h3>
            <span className="text-sm text-text-secondary">Last 30 days</span>
          </div>
          <div className="flex h-40 items-center justify-center rounded-md bg-bg-secondary px-3">
            {activityLoading ? (
              <span className="text-sm text-text-secondary">Loading activity…</span>
            ) : activityError ? (
              <span className="text-sm text-text-secondary">{activityError}</span>
            ) : !activitySeries.length ? (
              <span className="text-sm text-text-secondary">
                No leads created in this period.
              </span>
            ) : (
              <div className="flex h-full w-full items-end gap-[2px]">
                {activitySeries.map((point) => (
                  <div
                    key={point.date}
                    className="flex-1 bg-accent-soft"
                    style={{
                      height:
                        Math.max(...activitySeries.map((p) => p.count)) === 0
                          ? '0%'
                          : `${
                              (point.count /
                                Math.max(...activitySeries.map((p) => p.count))) * 100
                            }%`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border-color bg-card-bg p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-text-primary">Orders & revenue</h3>
            <span className="text-sm text-text-secondary">Last 30 days</span>
          </div>
          <div className="flex h-40 items-center justify-center rounded-md bg-bg-secondary px-3">
            {reportsLoading ? (
              <span className="text-sm text-text-secondary">Loading orders…</span>
            ) : reportsError ? (
              <span className="text-sm text-text-secondary">{reportsError}</span>
            ) : !reportsDashboard?.orders.over_time.length ? (
              <span className="text-sm text-text-secondary">
                No orders created in this period.
              </span>
            ) : (
              <div className="flex h-full w-full items-end gap-[4px]">
                {reportsDashboard.orders.over_time.map((point) => {
                  const maxRevenue = Math.max(
                    ...reportsDashboard.orders.over_time.map((p) => p.revenue || 0),
                  );
                  const heightPct = maxRevenue === 0 ? 0 : (point.revenue / maxRevenue) * 100;
                  return (
                    <div
                      key={point.date}
                      className="flex-1 rounded-t bg-accent-soft"
                      style={{ height: `${heightPct}%` }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Work & team snapshot + Insights / Recent activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => router.push('/work')}
              className="rounded-xl border border-border-color bg-card-bg p-4 text-left shadow-sm transition-all hover:-translate-y-px hover:border-accent hover:shadow-md"
            >
              <div className="mb-1 text-sm font-medium text-text-secondary">Work items</div>
              <div className="mb-2 text-2xl font-semibold text-text-primary">
                {reportsLoading
                  ? '—'
                  : reportsDashboard
                  ? reportsDashboard.work.total
                  : '—'}
              </div>
              <div className="text-sm text-text-secondary">
                {reportsDashboard
                  ? `Statuses: ${Object.keys(reportsDashboard.work.by_status).join(', ') || '—'}`
                  : 'From work reports'}
              </div>
            </button>
            <button
              type="button"
              onClick={() => router.push('/employees')}
              className="rounded-xl border border-border-color bg-card-bg p-4 text-left shadow-sm transition-all hover:-translate-y-px hover:border-accent hover:shadow-md"
            >
              <div className="mb-1 text-sm font-medium text-text-secondary">Team</div>
              <div className="mb-2 text-2xl font-semibold text-text-primary">
                {reportsLoading
                  ? '—'
                  : reportsDashboard
                  ? reportsDashboard.team.total_team
                  : '—'}
              </div>
              <div className="text-sm text-text-secondary">
                {reportsDashboard
                  ? `Leads assigned: ${reportsDashboard.team.total_leads_assigned.toLocaleString()}`
                  : 'From reports'}
              </div>
            </button>
          </div>

          <div className="rounded-xl border border-border-color bg-card-bg p-4 shadow-sm">
            <h3 className="mb-2 text-base font-semibold text-text-primary">Recent activity</h3>
            <ul className="space-y-1 text-sm text-text-secondary">
              {(recentActivity && recentActivity.length > 0 ? recentActivity : []).map(
                (item, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md bg-bg-secondary px-3 py-2"
                  >
                    <span className="line-clamp-1">{item.label}</span>
                    <span className="ml-2 shrink-0 text-sm">{item.time}</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-border-color bg-card-bg p-4 shadow-sm">
          <h3 className="mb-2 text-base font-semibold text-text-primary">Lead insights</h3>
          {loading ? (
            <div className="text-sm text-text-secondary">Loading insights…</div>
          ) : !insights ? (
            <div className="space-y-2 text-sm text-text-secondary">
              <p>Enable Lead Management System to see insights from your leads.</p>
              <button
                type="button"
                onClick={() => router.push('/customers')}
                className="mt-1 inline-flex rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Go to leads
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-text-secondary">
              <p className="rounded-md bg-bg-secondary px-3 py-2">{insights.summary}</p>
              {insights.topSource && (
                <p className="rounded-md bg-bg-secondary px-3 py-2">{insights.topSource}</p>
              )}
              {insights.statusBreakdown && (
                <p className="rounded-md bg-bg-secondary px-3 py-2">
                  {insights.statusBreakdown}
                </p>
              )}
              <button
                type="button"
                onClick={() => router.push('/reports')}
                className="mt-1 inline-flex rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm font-semibold text-text-primary hover:border-accent"
              >
                See full reports
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
