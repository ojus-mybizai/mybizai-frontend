'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { EditEmployeeModal } from '@/components/employees/edit-employee-modal';
import { useAuthStore } from '@/lib/auth-store';
import {
  getEmployeeDetail,
  getEmployeeActivity,
  type EmployeeDetail,
  type EmployeeLifecycleEvent,
  type EmployeeReportRow,
  type EmployeeRole,
} from '@/services/employees';
import { listCustomers, type Customer } from '@/services/customers';
import { listWork, type Work } from '@/services/work';

type TabId = 'overview' | 'leads' | 'work' | 'activity';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'leads', label: 'Assigned leads' },
  { id: 'work', label: 'Assigned work' },
  { id: 'activity', label: 'Activity' },
];

const ROLE_LABELS: Record<EmployeeRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  executive: 'Executive',
};

const EVENT_LABELS: Record<string, string> = {
  invite_created: 'Invite sent',
  invite_accepted: 'Joined team',
  invite_resend: 'Invite resent',
  invite_revoked: 'Invite revoked',
  employee_created_compat: 'Added to team',
  employee_updated: 'Profile updated',
  role_changed: 'Role changed',
  employee_reactivated: 'Reactivated',
  employee_deactivated: 'Deactivated',
  employee_removed: 'Removed from team',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function statusLabel(status: string): string {
  if (status === 'in_progress') return 'In progress';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function toEmployeeReportRow(detail: EmployeeDetail): EmployeeReportRow {
  return {
    id: detail.id,
    user_id: detail.user_id,
    name: detail.name,
    email: detail.email,
    role: detail.role,
    is_active: detail.is_active,
    assigned_lead_count: detail.assigned_lead_count,
    assigned_work_count: detail.assigned_work_count,
  };
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const employeeId = Number(params?.id);
  const defaultRole = useAuthStore((s) => s.defaultRole);
  const user = useAuthStore((s) => s.user as { businesses?: { role?: string }[] } | null);
  const role = defaultRole ?? user?.businesses?.[0]?.role ?? 'owner';
  const canManageEmployees = role === 'owner' || role === 'manager';

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [editEmployee, setEditEmployee] = useState<EmployeeReportRow | null>(null);

  const [leads, setLeads] = useState<Customer[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsTotalPages, setLeadsTotalPages] = useState(1);
  const [leadsPage, setLeadsPage] = useState(1);

  const [workItems, setWorkItems] = useState<Work[]>([]);
  const [workLoading, setWorkLoading] = useState(false);
  const [workTotalPages, setWorkTotalPages] = useState(1);
  const [workPage, setWorkPage] = useState(1);

  const [activity, setActivity] = useState<EmployeeLifecycleEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityPage, setActivityPage] = useState(1);

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(employeeId)) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getEmployeeDetail(employeeId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee details.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const loadLeads = useCallback(async () => {
    if (!detail) return;
    setLeadsLoading(true);
    try {
      const data = await listCustomers({
        page: leadsPage,
        perPage: 10,
        assignedToId: detail.user_id,
      });
      setLeads(data.items);
      setLeadsTotalPages(data.totalPages);
    } catch {
      setLeads([]);
      setLeadsTotalPages(1);
    } finally {
      setLeadsLoading(false);
    }
  }, [detail, leadsPage]);

  const loadWork = useCallback(async () => {
    if (!detail) return;
    setWorkLoading(true);
    try {
      const data = await listWork({
        page: workPage,
        per_page: 10,
        assigned_to_id: detail.user_id,
      });
      setWorkItems(data.items);
      setWorkTotalPages(data.total_pages);
    } catch {
      setWorkItems([]);
      setWorkTotalPages(1);
    } finally {
      setWorkLoading(false);
    }
  }, [detail, workPage]);

  const loadActivity = useCallback(async () => {
    if (!detail) return;
    setActivityLoading(true);
    try {
      const data = await getEmployeeActivity(detail.id, { page: activityPage, per_page: 20 });
      setActivity(data.items);
      setActivityTotalPages(data.total_pages);
    } catch {
      setActivity([]);
      setActivityTotalPages(1);
    } finally {
      setActivityLoading(false);
    }
  }, [detail, activityPage]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (detail && activeTab === 'leads') void loadLeads();
  }, [detail, activeTab, loadLeads]);

  useEffect(() => {
    if (detail && activeTab === 'work') void loadWork();
  }, [detail, activeTab, loadWork]);

  useEffect(() => {
    if (detail && activeTab === 'activity') void loadActivity();
  }, [detail, activeTab, loadActivity]);

  const canManageThisEmployee = canManageEmployees && detail != null && detail.id !== 0;
  const breakdown = detail?.work_breakdown;
  const openWorkCount = useMemo(() => {
    if (!breakdown) return 0;
    return breakdown.pending + breakdown.in_progress;
  }, [breakdown]);

  if (!Number.isFinite(employeeId)) {
    return (
      <ProtectedShell>
        <ModuleGuard module="lms">
          <div className="w-full rounded-xl border border-border-color bg-card-bg p-4">
            <p className="text-base text-text-secondary">Invalid employee id.</p>
            <Link href="/employees" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
              Back to Team
            </Link>
          </div>
        </ModuleGuard>
      </ProtectedShell>
    );
  }

  return (
    <ProtectedShell>
      <ModuleGuard module="lms">
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between">
            <Link href="/employees" className="text-sm font-semibold text-accent hover:underline">
              ← Back to Team
            </Link>
            {canManageThisEmployee && detail && (
              <button
                type="button"
                onClick={() => setEditEmployee(toEmployeeReportRow(detail))}
                className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm font-semibold text-text-primary hover:border-accent"
              >
                Manage
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          {loading && <div className="text-base text-text-secondary">Loading employee details...</div>}

          {!loading && detail && (
            <>
              <div className="rounded-xl border border-border-color bg-card-bg p-4">
                <h1 className="text-xl font-semibold text-text-primary">{detail.name}</h1>
                <p className="mt-1 text-sm text-text-secondary">{detail.email}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-bg-secondary px-2.5 py-0.5 font-medium text-text-primary">
                    {ROLE_LABELS[detail.role]}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-medium ${
                      detail.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
                    }`}
                  >
                    {detail.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm text-text-secondary">Assigned leads</div>
                  <div className="text-2xl font-bold text-text-primary">{detail.assigned_lead_count}</div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm text-text-secondary">Total work</div>
                  <div className="text-2xl font-bold text-text-primary">{detail.assigned_work_count}</div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm text-text-secondary">Open work</div>
                  <div className="text-2xl font-bold text-text-primary">{openWorkCount}</div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm text-text-secondary">Completed</div>
                  <div className="text-2xl font-bold text-text-primary">{detail.work_breakdown.completed}</div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm text-text-secondary">Overdue</div>
                  <div className="text-2xl font-bold text-text-primary">{detail.work_breakdown.overdue}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-color bg-card-bg p-2">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      activeTab === tab.id
                        ? 'bg-accent text-white'
                        : 'bg-bg-primary text-text-primary hover:border-accent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <h2 className="text-lg font-semibold text-text-primary">Performance overview</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                      Pending: {detail.work_breakdown.pending}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      In progress: {detail.work_breakdown.in_progress}
                    </span>
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                      Completed: {detail.work_breakdown.completed}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-700 dark:bg-gray-700/40 dark:text-gray-300">
                      Cancelled: {detail.work_breakdown.cancelled}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/customers?assigned_to_id=${detail.user_id}`}
                      className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                    >
                      View assigned leads
                    </Link>
                    <Link
                      href={`/work?assigned_to_id=${detail.user_id}`}
                      className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                    >
                      View assigned work
                    </Link>
                  </div>
                </div>
              )}

              {activeTab === 'leads' && (
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  {leadsLoading ? (
                    <p className="text-base text-text-secondary">Loading leads...</p>
                  ) : leads.length === 0 ? (
                    <p className="text-base text-text-secondary">No leads assigned.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border-color">
                          <thead className="bg-bg-secondary">
                            <tr>
                              <th className="px-3 py-2 text-left text-sm font-semibold text-text-secondary">Name</th>
                              <th className="px-3 py-2 text-left text-sm font-semibold text-text-secondary">Phone</th>
                              <th className="px-3 py-2 text-left text-sm font-semibold text-text-secondary">Status</th>
                              <th className="px-3 py-2 text-right text-sm font-semibold text-text-secondary">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-color">
                            {leads.map((lead) => (
                              <tr key={lead.id}>
                                <td className="px-3 py-2 text-sm text-text-primary">{lead.name || '—'}</td>
                                <td className="px-3 py-2 text-sm text-text-primary">{lead.phone || '—'}</td>
                                <td className="px-3 py-2 text-sm text-text-secondary">{lead.status || '—'}</td>
                                <td className="px-3 py-2 text-right">
                                  <Link href={`/customers/${lead.id}`} className="text-sm font-semibold text-accent hover:underline">
                                    Open
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={leadsPage <= 1}
                          onClick={() => setLeadsPage((p) => Math.max(1, p - 1))}
                          className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-text-secondary">
                          Page {leadsPage} of {leadsTotalPages}
                        </span>
                        <button
                          type="button"
                          disabled={leadsPage >= leadsTotalPages}
                          onClick={() => setLeadsPage((p) => Math.min(leadsTotalPages, p + 1))}
                          className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'work' && (
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  {workLoading ? (
                    <p className="text-base text-text-secondary">Loading work...</p>
                  ) : workItems.length === 0 ? (
                    <p className="text-base text-text-secondary">No work assigned.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border-color">
                          <thead className="bg-bg-secondary">
                            <tr>
                              <th className="px-3 py-2 text-left text-sm font-semibold text-text-secondary">Title</th>
                              <th className="px-3 py-2 text-left text-sm font-semibold text-text-secondary">Status</th>
                              <th className="px-3 py-2 text-left text-sm font-semibold text-text-secondary">Priority</th>
                              <th className="px-3 py-2 text-left text-sm font-semibold text-text-secondary">Due</th>
                              <th className="px-3 py-2 text-right text-sm font-semibold text-text-secondary">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-color">
                            {workItems.map((w) => (
                              <tr key={w.id}>
                                <td className="px-3 py-2 text-sm text-text-primary">{w.title || w.work_type_name}</td>
                                <td className="px-3 py-2 text-sm text-text-secondary">{statusLabel(w.status)}</td>
                                <td className="px-3 py-2 text-sm text-text-secondary">{w.priority}</td>
                                <td className="px-3 py-2 text-sm text-text-secondary">{formatDate(w.due_date)}</td>
                                <td className="px-3 py-2 text-right">
                                  <Link href={`/work/${w.id}`} className="text-sm font-semibold text-accent hover:underline">
                                    Open
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={workPage <= 1}
                          onClick={() => setWorkPage((p) => Math.max(1, p - 1))}
                          className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-text-secondary">
                          Page {workPage} of {workTotalPages}
                        </span>
                        <button
                          type="button"
                          disabled={workPage >= workTotalPages}
                          onClick={() => setWorkPage((p) => Math.min(workTotalPages, p + 1))}
                          className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  {activityLoading ? (
                    <p className="text-base text-text-secondary">Loading activity...</p>
                  ) : activity.length === 0 ? (
                    <p className="text-base text-text-secondary">No activity found.</p>
                  ) : (
                    <div className="space-y-3">
                      {activity.map((evt) => (
                        <div key={evt.id} className="rounded-lg border border-border-color bg-bg-primary p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-text-primary">
                              {EVENT_LABELS[evt.event_type] || evt.event_type}
                            </p>
                            <p className="text-xs text-text-secondary">{formatDateTime(evt.created_at)}</p>
                          </div>
                          <p className="mt-1 text-xs text-text-secondary">
                            Actor: {evt.actor_name || 'System'}
                          </p>
                          {evt.metadata_json && Object.keys(evt.metadata_json).length > 0 && (
                            <p className="mt-2 text-xs text-text-secondary">
                              {JSON.stringify(evt.metadata_json)}
                            </p>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={activityPage <= 1}
                          onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                          className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-text-secondary">
                          Page {activityPage} of {activityTotalPages}
                        </span>
                        <button
                          type="button"
                          disabled={activityPage >= activityTotalPages}
                          onClick={() => setActivityPage((p) => Math.min(activityTotalPages, p + 1))}
                          className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <EditEmployeeModal
          isOpen={!!editEmployee}
          employee={editEmployee}
          onClose={() => setEditEmployee(null)}
          onSaved={() => {
            setEditEmployee(null);
            void loadDetail();
          }}
        />
      </ModuleGuard>
    </ProtectedShell>
  );
}
