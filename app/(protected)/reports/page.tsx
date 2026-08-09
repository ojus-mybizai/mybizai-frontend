'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import PermissionGuard from '@/components/permission-guard';
import { useAuthStore } from '@/lib/auth-store';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useDateRangeStore } from '@/lib/stores/date-range-store';

const ReportChartsOverview = dynamic(
  () => import('@/components/reports/report-charts-lazy'),
  { ssr: false }
);
import { getEmployeesReport, type EmployeeReportRow } from '@/services/employees';
import { getReportsDashboard, type ReportsDashboard } from '@/services/reports';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  executive: 'Executive',
};

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'executive', label: 'Executive' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user as { id?: number; businesses?: { lms_enabled?: boolean }[] } | null);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const lmsEnabled    = user?.businesses?.[0]?.lms_enabled !== false;
  const isExecutive   = !hasPermission('view_all_work');
  const currentUserId = user?.id;

  const toDays    = useDateRangeStore((s) => s.toDays);
  const startDate = useDateRangeStore((s) => s.startDate);
  const endDate   = useDateRangeStore((s) => s.endDate);
  const preset    = useDateRangeStore((s) => s.preset);

  const [rows, setRows]                   = useState<EmployeeReportRow[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [roleFilter, setRoleFilter]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [dashboard, setDashboard]         = useState<ReportsDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getEmployeesReport());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      setDashboard(await getReportsDashboard(toDays()));
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Failed to load charts');
    } finally {
      setDashboardLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  useEffect(() => { if (lmsEnabled) void load(); }, [load, lmsEnabled]);
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const initialLoading = dashboardLoading || (lmsEnabled && loading);

  const filteredRows = useMemo(() => rows.filter((r) => {
    if (roleFilter && r.role !== roleFilter) return false;
    if (statusFilter === 'active'   && !r.is_active) return false;
    if (statusFilter === 'inactive' &&  r.is_active) return false;
    return true;
  }), [rows, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const total  = rows.length;
    const byRole = { owner: 0, manager: 0, executive: 0 };
    let totalLeads = 0, totalWork = 0;
    rows.forEach((r) => {
      if (r.role in byRole) byRole[r.role as keyof typeof byRole]++;
      totalLeads += r.assigned_lead_count;
      totalWork  += r.assigned_work_count;
    });
    return { total, byRole, totalLeads, totalWork };
  }, [rows]);

  const executiveRow = useMemo(() => (rows.length === 1 && isExecutive ? rows[0] : null), [rows, isExecutive]);

  // Human-readable range label for the section heading
  const presetLabel: Record<string, string> = {
    today: 'Today', yesterday: 'Yesterday', this_week: 'This Week',
    last_week: 'Last Week', month_to_date: 'Month to Date',
    last_month: 'Last Month', last_7_days: 'Last 7 Days',
    last_30_days: 'Last 30 Days', last_90_days: 'Last 90 Days',
  };
  const rangeLabel = preset !== 'custom'
    ? presetLabel[preset] ?? 'Selected range'
    : `${startDate} – ${endDate}`;

  return (
    <PermissionGuard permission="view_reports">
    <div className="w-full space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">Reports</h1>
          <p className="text-base text-text-secondary">Overview of leads, work, and team.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker />
          <Link
            href="/reports/builder"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Report Builder
          </Link>
          {!isExecutive && lmsEnabled && (
            <Link
              href="/members"
              className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Manage team
            </Link>
          )}
        </div>
      </div>

      {/* On this page */}
      <nav aria-label="On this page" className="flex flex-wrap items-center gap-2 rounded-xl border border-border-color bg-card-bg px-4 py-3">
        <span className="text-sm font-medium text-text-secondary mr-1">Jump to:</span>
        <a href="#leads" className="text-sm font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1">Leads</a>
        <a href="#work"  className="text-sm font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1">Work</a>
        {lmsEnabled && (
          <a href="#team-report" className="text-sm font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1">Team report</a>
        )}
        <Link href="/data-sheet" className="text-sm font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1">Data sheets</Link>
      </nav>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Overview charts */}
      <section className="rounded-xl border border-border-color bg-card-bg p-5 space-y-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-text-primary">Overview</h2>
          <p className="text-sm text-text-secondary">{rangeLabel}</p>
        </div>

        {dashboardError && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            {dashboardError}
          </div>
        )}
        {initialLoading && <div className="text-base text-text-secondary py-8">Loading reports…</div>}
        {!dashboardLoading && dashboard && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-border-color bg-bg-primary p-3">
                <div className="text-xs text-text-secondary">Action: follow up new leads</div>
                <div className="mt-1 text-lg font-semibold text-text-primary">{dashboard.leads.by_stage?.open ?? 0}</div>
              </div>
              <div className="rounded-lg border border-border-color bg-bg-primary p-3">
                <div className="text-xs text-text-secondary">Action: open work tasks</div>
                <div className="mt-1 text-lg font-semibold text-text-primary">
                  {(dashboard.work.by_status.todo ?? 0) + (dashboard.work.by_status.in_progress ?? 0)}
                </div>
              </div>
            </div>
            <ReportChartsOverview dashboard={dashboard} />
          </>
        )}
      </section>

      {/* Team report section (LMS only) */}
      {lmsEnabled && (
        <section id="team-report" className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Team report</h2>
          <p className="text-sm text-text-secondary">Leads and work assigned per team member.</p>
          {loading && <div className="text-base text-text-secondary">Loading team report…</div>}
          {!loading && rows.length > 0 && (
            <>
              {isExecutive && executiveRow ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border-color bg-card-bg p-4">
                    <div className="text-sm text-text-secondary">Your leads</div>
                    <div className="text-2xl font-bold text-text-primary">{executiveRow.assigned_lead_count}</div>
                    <Link
                      href={`/customers${currentUserId ? `?assigned_to_id=${currentUserId}` : ''}`}
                      className="mt-2 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      View my leads
                    </Link>
                  </div>
                  <div className="rounded-xl border border-border-color bg-card-bg p-4">
                    <div className="text-sm text-text-secondary">Your work</div>
                    <div className="text-2xl font-bold text-text-primary">{executiveRow.assigned_work_count}</div>
                    <Link
                      href={`/work${currentUserId ? `?assigned_to_id=${currentUserId}` : ''}`}
                      className="mt-2 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      View my work
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-border-color bg-card-bg p-4">
                    <div className="text-sm text-text-secondary">Team size</div>
                    <div className="text-2xl font-bold text-text-primary">{stats.total}</div>
                  </div>
                  <div className="rounded-xl border border-border-color bg-card-bg p-4">
                    <div className="text-sm text-text-secondary">Total leads assigned</div>
                    <div className="text-2xl font-bold text-text-primary">{stats.totalLeads}</div>
                  </div>
                  <div className="rounded-xl border border-border-color bg-card-bg p-4">
                    <div className="text-sm text-text-secondary">Total work assigned</div>
                    <div className="text-2xl font-bold text-text-primary">{stats.totalWork}</div>
                  </div>
                  <div className="rounded-xl border border-border-color bg-card-bg p-4">
                    <div className="text-sm text-text-secondary">By role</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-sm">
                      {stats.byRole.owner > 0 && (
                        <span className="rounded-full bg-bg-secondary px-2.5 py-0.5 font-medium text-text-primary">Owner: {stats.byRole.owner}</span>
                      )}
                      {stats.byRole.manager > 0 && (
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Manager: {stats.byRole.manager}</span>
                      )}
                      {stats.byRole.executive > 0 && (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">Executive: {stats.byRole.executive}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!isExecutive && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-color bg-card-bg px-4 py-2">
                  <span className="text-sm font-medium text-text-secondary">Filters:</span>
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
                    className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent">
                    {ROLE_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent">
                    {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          {lmsEnabled && !loading && (
            <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border-color">
                  <thead className="bg-bg-secondary">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Name</th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Email</th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Role</th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Status</th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Leads</th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Work</th>
                      {!isExecutive && <th className="px-4 py-2.5 text-right text-sm font-semibold text-text-secondary">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    {filteredRows.map((r) => (
                      <tr key={r.user_id} className="hover:bg-bg-secondary/60">
                        <td className="px-4 py-2.5 text-base font-medium">
                          <Link href="/members" className="text-text-primary hover:text-accent">{r.name}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-text-primary">{r.email}</td>
                        <td className="px-4 py-2.5 text-sm text-text-primary">{ROLE_LABELS[r.role] ?? r.role}</td>
                        <td className="px-4 py-2.5 text-sm">
                          <span className={r.is_active ? 'text-green-600 dark:text-green-400' : 'text-text-secondary'}>
                            {r.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm font-medium text-text-primary">{r.assigned_lead_count}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-text-primary">{r.assigned_work_count}</td>
                        {!isExecutive ? (
                          <td className="px-4 py-2.5 text-right text-sm">
                            <Link href={`/customers?assigned_to_id=${r.user_id}`} className="text-accent hover:underline mr-2">View leads</Link>
                            <Link href={`/work?assigned_to_id=${r.user_id}`} className="text-accent hover:underline">View work</Link>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredRows.length === 0 && (
                <div className="px-6 py-10 text-center text-base text-text-secondary">
                  {rows.length === 0 ? (
                    <>
                      <p className="mb-2 font-medium text-text-primary">
                        {isExecutive ? 'No leads or work assigned to you' : 'No team members in report'}
                      </p>
                      {isExecutive ? (
                        <p>Your assigned leads and work will appear here once assigned.</p>
                      ) : (
                        <>
                          <p className="mb-4">Add team members in Team to see report data.</p>
                          <Link href="/employees" className="text-sm font-semibold text-accent hover:underline">Manage team</Link>
                        </>
                      )}
                    </>
                  ) : (
                    <p>No team members match the current filters.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {!lmsEnabled && (
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          <p className="text-sm text-text-secondary">
            Team report is available when LMS is enabled. Enable LMS in Settings.
          </p>
        </div>
      )}
    </div>
    </PermissionGuard>
  );
}
