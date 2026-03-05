'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { EditEmployeeModal } from '@/components/employees/edit-employee-modal';
import { useAuthStore } from '@/lib/auth-store';
import {
  getEmployeesReport,
  createEmployeeInvite,
  listEmployeeInvites,
  resendEmployeeInvite,
  revokeEmployeeInvite,
  type EmployeeReportRow,
  type EmployeeInvite,
  type ManagedEmployeeRole,
} from '@/services/employees';

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

const INVITE_STATUS_OPTIONS = [
  { value: '', label: 'All invite statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' },
];

type ActiveTab = 'team' | 'invites';

export default function EmployeesPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManageEmployees = hasPermission('manage_employees');

  const [activeTab, setActiveTab] = useState<ActiveTab>('team');
  const [rows, setRows] = useState<EmployeeReportRow[]>([]);
  const [invites, setInvites] = useState<EmployeeInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [inviteStatusFilter, setInviteStatusFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<ManagedEmployeeRole>('executive');
  const [inviteExpiryHours, setInviteExpiryHours] = useState(72);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [inviteActionId, setInviteActionId] = useState<number | null>(null);
  const [editEmployee, setEditEmployee] = useState<EmployeeReportRow | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEmployeesReport();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvites = useCallback(async () => {
    setInvitesLoading(true);
    try {
      const data = await listEmployeeInvites();
      setInvites(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadTeam(), loadInvites()]);
  }, [loadTeam, loadInvites]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter && r.role !== roleFilter) return false;
      if (statusFilter === 'active' && !r.is_active) return false;
      if (statusFilter === 'inactive' && r.is_active) return false;
      if (q) {
        const hay = `${r.name} ${r.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, roleFilter, statusFilter, search]);

  const filteredInvites = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invites.filter((invite) => {
      if (inviteStatusFilter && invite.status !== inviteStatusFilter) return false;
      if (q) {
        const hay = `${invite.name || ''} ${invite.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [invites, inviteStatusFilter, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const byRole = { owner: 0, manager: 0, executive: 0 };
    let active = 0;
    let totalLeads = 0;
    let totalWork = 0;
    rows.forEach((r) => {
      if (r.role in byRole) byRole[r.role as keyof typeof byRole]++;
      if (r.is_active) active++;
      totalLeads += r.assigned_lead_count;
      totalWork += r.assigned_work_count;
    });
    return { total, byRole, active, inactive: total - active, totalLeads, totalWork };
  }, [rows]);

  const inviteStats = useMemo(() => {
    const acc = { pending: 0, accepted: 0, expired: 0, revoked: 0 };
    for (const invite of invites) {
      if (invite.status in acc) acc[invite.status as keyof typeof acc] += 1;
    }
    return acc;
  }, [invites]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setAddSubmitting(true);
    setAddError(null);
    try {
      await createEmployeeInvite({
        email,
        name: inviteName.trim() || undefined,
        role: inviteRole,
        expires_in_hours: inviteExpiryHours,
      });
      setAddOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('executive');
      setInviteExpiryHours(72);
      setNotice(`Invite sent to ${email}.`);
      setActiveTab('invites');
      await Promise.all([loadTeam(), loadInvites()]);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleResendInvite = async (inviteId: number) => {
    setInviteActionId(inviteId);
    setError(null);
    try {
      const updated = await resendEmployeeInvite(inviteId);
      setInvites((prev) => prev.map((i) => (i.id === inviteId ? updated : i)));
      setNotice(`Invite resent to ${updated.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invite');
    } finally {
      setInviteActionId(null);
    }
  };

  const handleRevokeInvite = async (inviteId: number) => {
    setInviteActionId(inviteId);
    setError(null);
    try {
      const updated = await revokeEmployeeInvite(inviteId);
      setInvites((prev) => prev.map((i) => (i.id === inviteId ? updated : i)));
      setNotice(`Invite revoked for ${updated.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite');
    } finally {
      setInviteActionId(null);
    }
  };

  const handleEditSaved = useCallback(() => {
    void Promise.all([loadTeam(), loadInvites()]);
  }, [loadTeam, loadInvites]);

  const formatDateTime = (value?: string | null): string => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  return (
    <ProtectedShell>
      <ModuleGuard module="lms">
        <div className="w-full space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Team</h2>
              <p className="text-base text-text-secondary">
                Manage active members, invites, and assignment ownership.
              </p>
            </div>
            {canManageEmployees && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Send invite
              </button>
            )}
          </div>

          {notice && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
              {notice}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-color bg-card-bg p-2">
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'team'
                ? 'bg-accent text-white'
                : 'bg-bg-primary text-text-primary hover:border-accent'
                }`}
            >
              Team members ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invites')}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'invites'
                ? 'bg-accent text-white'
                : 'bg-bg-primary text-text-primary hover:border-accent'
                }`}
            >
              Invites ({invites.length})
            </button>
            <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email"
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent sm:w-72"
              />
            </div>
          </div>

          {activeTab === 'team' && (
            <>
              {!loading && rows.length > 0 && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-border-color bg-card-bg p-4">
                      <div className="text-sm text-text-secondary">Team size</div>
                      <div className="text-2xl font-bold text-text-primary">{stats.total}</div>
                    </div>
                    <div className="rounded-xl border border-border-color bg-card-bg p-4">
                      <div className="text-sm text-text-secondary">By role</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-sm">
                        {stats.byRole.owner > 0 && (
                          <span className="rounded-full bg-bg-secondary px-2.5 py-0.5 font-medium text-text-primary">
                            Owner: {stats.byRole.owner}
                          </span>
                        )}
                        {stats.byRole.manager > 0 && (
                          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                            Manager: {stats.byRole.manager}
                          </span>
                        )}
                        {stats.byRole.executive > 0 && (
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                            Executive: {stats.byRole.executive}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border-color bg-card-bg p-4">
                      <div className="text-sm text-text-secondary">Status</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-sm">
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                          Active: {stats.active}
                        </span>
                        {stats.inactive > 0 && (
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-600 dark:bg-gray-700/40 dark:text-gray-400">
                            Inactive: {stats.inactive}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border-color bg-card-bg p-4">
                      <div className="text-sm text-text-secondary">Assigned</div>
                      <div className="mt-1 text-sm text-text-primary">
                        {stats.totalLeads} leads · {stats.totalWork} work
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-color bg-card-bg px-4 py-2">
                    <span className="text-sm font-medium text-text-secondary">Filters:</span>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {ROLE_FILTER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {STATUS_FILTER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {loading && <div className="text-base text-text-secondary">Loading team...</div>}
              {!loading && (
                <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm">
                  <table className="min-w-full divide-y divide-border-color">
                    <thead className="bg-bg-secondary">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Name</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Email</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Role</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Status</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Leads</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Work</th>
                        {canManageEmployees && <th className="px-4 py-2.5 text-right text-sm font-semibold text-text-secondary">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color">
                      {filteredRows.map((r) => (
                        <tr key={r.user_id} className="hover:bg-bg-secondary/60">
                          <td className="px-4 py-2.5 text-base font-medium">
                            <Link href={`/employees/${r.id}`} className="text-text-primary hover:text-accent">
                              {r.name}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-text-primary">{r.email}</td>
                          <td className="px-4 py-2.5 text-sm text-text-primary">{ROLE_LABELS[r.role] ?? r.role}</td>
                          <td className="px-4 py-2.5 text-sm">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
                                }`}
                            >
                              {r.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-sm">
                            <span className="font-medium text-text-primary">{r.assigned_lead_count}</span>
                            {' · '}
                            <Link
                              href={`/customers?assigned_to_id=${r.user_id}`}
                              className="font-semibold text-accent hover:underline"
                            >
                              View leads
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-sm">
                            <span className="font-medium text-text-primary">{r.assigned_work_count}</span>
                            {' · '}
                            <Link
                              href={`/work?assigned_to_id=${r.user_id}`}
                              className="font-semibold text-accent hover:underline"
                            >
                              View work
                            </Link>
                          </td>
                          {canManageEmployees && (
                            <td className="px-4 py-2.5 text-right">
                              {r.id === 0 ? (
                                <span className="text-sm text-text-secondary">—</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditEmployee(r)}
                                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm font-semibold text-text-primary hover:border-accent"
                                >
                                  Manage
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredRows.length === 0 && (
                    <div className="px-6 py-10 text-center text-base text-text-secondary">
                      {rows.length === 0 ? (
                        <>
                          <p className="mb-2 font-medium text-text-primary">No team members yet</p>
                          <p className="mb-4">Send your first invite to start assigning work.</p>
                          {canManageEmployees && (
                            <button
                              type="button"
                              onClick={() => setAddOpen(true)}
                              className="text-sm font-semibold text-accent hover:underline"
                            >
                              Send invite
                            </button>
                          )}
                        </>
                      ) : (
                        <p>No team members match the current filters.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'invites' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm text-text-secondary">Pending</div>
                  <div className="text-2xl font-bold text-text-primary">{inviteStats.pending}</div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm text-text-secondary">Accepted</div>
                  <div className="text-2xl font-bold text-text-primary">{inviteStats.accepted}</div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm text-text-secondary">Expired</div>
                  <div className="text-2xl font-bold text-text-primary">{inviteStats.expired}</div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg p-4">
                  <div className="text-sm text-text-secondary">Revoked</div>
                  <div className="text-2xl font-bold text-text-primary">{inviteStats.revoked}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-color bg-card-bg px-4 py-2">
                <span className="text-sm font-medium text-text-secondary">Filters:</span>
                <select
                  value={inviteStatusFilter}
                  onChange={(e) => setInviteStatusFilter(e.target.value)}
                  className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {INVITE_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {invitesLoading && <div className="text-base text-text-secondary">Loading invites...</div>}
              {!invitesLoading && (
                <div className="overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm">
                  <table className="min-w-full divide-y divide-border-color">
                    <thead className="bg-bg-secondary">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Invitee</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Role</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Status</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Expires</th>
                        <th className="px-4 py-2.5 text-left text-sm font-semibold text-text-secondary">Sent</th>
                        <th className="px-4 py-2.5 text-right text-sm font-semibold text-text-secondary">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color">
                      {filteredInvites.map((invite) => (
                        <tr key={invite.id} className="hover:bg-bg-secondary/60">
                          <td className="px-4 py-2.5">
                            <div className="text-sm font-medium text-text-primary">{invite.name || '—'}</div>
                            <div className="text-sm text-text-secondary">{invite.email}</div>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-text-primary">{ROLE_LABELS[invite.role] ?? invite.role}</td>
                          <td className="px-4 py-2.5 text-sm">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${invite.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              : invite.status === 'accepted'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                : invite.status === 'revoked'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
                              }`}>
                              {invite.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-text-secondary">{formatDateTime(invite.expires_at)}</td>
                          <td className="px-4 py-2.5 text-sm text-text-secondary">{invite.send_count}</td>
                          <td className="px-4 py-2.5 text-right">
                            {canManageEmployees && invite.status === 'pending' ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={inviteActionId === invite.id}
                                  onClick={() => void handleResendInvite(invite.id)}
                                  className="rounded-lg border border-border-color bg-bg-primary px-2.5 py-1 text-xs font-semibold text-text-primary hover:border-accent disabled:opacity-60"
                                >
                                  Resend
                                </button>
                                <button
                                  type="button"
                                  disabled={inviteActionId === invite.id}
                                  onClick={() => void handleRevokeInvite(invite.id)}
                                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 disabled:opacity-60"
                                >
                                  Revoke
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-text-secondary">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredInvites.length === 0 && (
                    <div className="px-6 py-10 text-center text-base text-text-secondary">
                      {invites.length === 0 ? (
                        <>
                          <p className="mb-2 font-medium text-text-primary">No invites yet</p>
                          <p className="mb-4">Send an invite to onboard your first employee.</p>
                          {canManageEmployees && (
                            <button
                              type="button"
                              onClick={() => setAddOpen(true)}
                              className="text-sm font-semibold text-accent hover:underline"
                            >
                              Send invite
                            </button>
                          )}
                        </>
                      ) : (
                        <p>No invites match the current filters.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {addOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
              onClick={() => setAddOpen(false)}
            >
              <div
                className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border-color bg-card-bg p-6 m-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-text-primary">Send employee invite</h2>
                  <button
                    type="button"
                    onClick={() => setAddOpen(false)}
                    className="rounded-md p-2 text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                  >
                    ✕
                  </button>
                </div>
                {addError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {addError}
                  </div>
                )}
                <form onSubmit={handleAdd} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">Email</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="colleague@example.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">Name (optional)</label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Display name in invite"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as ManagedEmployeeRole)}
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="manager">Manager</option>
                      <option value="executive">Executive</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Invite expiry (hours)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={inviteExpiryHours}
                      onChange={(e) => setInviteExpiryHours(Number(e.target.value || 72))}
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <p className="text-xs text-text-secondary">
                    Employee receives a secure link to set password and join your workspace.
                  </p>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={addSubmitting}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {addSubmitting ? 'Sending...' : 'Send invite'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddOpen(false)}
                      className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <EditEmployeeModal
            isOpen={!!editEmployee}
            employee={editEmployee}
            onClose={() => setEditEmployee(null)}
            onSaved={handleEditSaved}
          />
        </div>
      </ModuleGuard>
    </ProtectedShell>
  );
}
