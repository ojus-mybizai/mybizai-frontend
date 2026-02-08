'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { EditEmployeeModal } from '@/components/employees/edit-employee-modal';
import { useAuthStore } from '@/lib/auth-store';
import {
  getEmployeesReport,
  createEmployee,
  type EmployeeReportRow,
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

export default function EmployeesPage() {
  const user = useAuthStore((s) => s.user as { businesses?: { role?: string }[] } | null);
  const role = user?.businesses?.[0]?.role ?? 'owner';
  const canManageEmployees = role === 'owner' || role === 'manager';

  const [rows, setRows] = useState<EmployeeReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addRole, setAddRole] = useState<'manager' | 'executive'>('executive');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editEmployee, setEditEmployee] = useState<EmployeeReportRow | null>(null);

  const load = useCallback(async () => {
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

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (roleFilter && r.role !== roleFilter) return false;
      if (statusFilter === 'active' && !r.is_active) return false;
      if (statusFilter === 'inactive' && r.is_active) return false;
      return true;
    });
  }, [rows, roleFilter, statusFilter]);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = addEmail.trim();
    if (!email) return;
    setAddSubmitting(true);
    setAddError(null);
    try {
      await createEmployee({ email, name: addName.trim() || undefined, role: addRole });
      setAddOpen(false);
      setAddEmail('');
      setAddName('');
      setAddRole('executive');
      await load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add employee');
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleEditSaved = useCallback(() => {
    void load();
  }, [load]);

  return (
    <ProtectedShell>
      <ModuleGuard module="lms">
          <div className="w-full space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Team</h2>
                <p className="text-base text-text-secondary">
                  View team members, assigned leads and work, and manage roles.
                </p>
              </div>
              {canManageEmployees && (
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Add employee
                </button>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}

            {loading && <div className="text-base text-text-secondary">Loading…</div>}

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
                        <td className="px-4 py-2.5 text-base font-medium text-text-primary">{r.name}</td>
                        <td className="px-4 py-2.5 text-sm text-text-primary">{r.email}</td>
                        <td className="px-4 py-2.5 text-sm text-text-primary">{ROLE_LABELS[r.role] ?? r.role}</td>
                        <td className="px-4 py-2.5 text-sm">
                          <span className={r.is_active ? 'text-green-600 dark:text-green-400' : 'text-text-secondary'}>
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
                                Edit
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
                        <p className="mb-4">Add an employee to assign work and leads.</p>
                        {canManageEmployees && (
                          <button
                            type="button"
                            onClick={() => setAddOpen(true)}
                            className="text-sm font-semibold text-accent hover:underline"
                          >
                            Add employee
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
                    <h2 className="text-xl font-semibold text-text-primary">Add employee</h2>
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
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        required
                        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="colleague@example.com"
                      />
                      <p className="mt-1 text-xs text-text-secondary">
                        If they don&apos;t have an account, one will be created and they&apos;ll be added to this business.
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Name (optional)</label>
                      <input
                        type="text"
                        value={addName}
                        onChange={(e) => setAddName(e.target.value)}
                        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        placeholder="Display name for new users"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Role</label>
                      <select
                        value={addRole}
                        onChange={(e) => setAddRole(e.target.value as 'manager' | 'executive')}
                        className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="manager">Manager</option>
                        <option value="executive">Executive</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={addSubmitting}
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                      >
                        {addSubmitting ? 'Adding…' : 'Add'}
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
