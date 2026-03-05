'use client';

import { useState, useEffect } from 'react';
import type { EmployeeReportRow } from '@/services/employees';
import {
  listEmployees,
  getAssignableRoles,
  updateEmployee,
  deactivateEmployee,
  removeEmployee,
  type AssignableRole,
} from '@/services/employees';
import type { ApiError } from '@/lib/api-client';

export interface EditEmployeeModalProps {
  isOpen: boolean;
  employee: EmployeeReportRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditEmployeeModal({ isOpen, employee, onClose, onSaved }: EditEmployeeModalProps) {
  const [role, setRole] = useState<string>('executive');
  const [roleId, setRoleId] = useState<number | ''>('');
  const [assignableRoles, setAssignableRoles] = useState<AssignableRole[]>([]);
  const [assignableRolesLoading, setAssignableRolesLoading] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [reason, setReason] = useState('');
  const [reassignOpenLeads, setReassignOpenLeads] = useState(true);
  const [reassignOpenWork, setReassignOpenWork] = useState(true);
  const [reassignToUserId, setReassignToUserId] = useState<number | ''>('');
  const [forceDeactivate, setForceDeactivate] = useState(false);
  const [members, setMembers] = useState<Array<{ id: number; user_id: number; name: string; is_active: boolean }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      setRole(employee.role);
      setIsActive(employee.is_active);
      setRoleId('');
      setReason('');
      setReassignOpenLeads(true);
      setReassignOpenWork(true);
      setReassignToUserId('');
      setForceDeactivate(false);
      setError(null);
      setSuccess(null);
    }
  }, [employee]);

  useEffect(() => {
    if (!isOpen || !employee) return;
    let cancelled = false;
    async function loadMembers() {
      try {
        const data = await listEmployees();
        if (!cancelled) setMembers(data);
      } catch {
        if (!cancelled) setMembers([]);
      }
    }
    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [isOpen, employee]);

  useEffect(() => {
    if (!isOpen || !employee) return;
    setAssignableRolesLoading(true);
    getAssignableRoles()
      .then((roles) => {
        setAssignableRoles(roles);
        const match = roles.find((r) => r.slug === employee.role || r.name === employee.role);
        if (match) setRoleId(match.id);
      })
      .catch(() => setAssignableRoles([]))
      .finally(() => setAssignableRolesLoading(false));
  }, [isOpen, employee]);

  if (!isOpen || !employee || employee.id === 0) return null;

  const handleRoleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (employee.role === 'owner') return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateEmployee(employee.id, {
        role_id: roleId !== '' ? roleId : undefined,
        role: roleId === '' ? (role as 'manager' | 'executive') : undefined,
        is_active: isActive,
      });
      setSuccess('Employee role/status updated.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await deactivateEmployee(employee.id, {
        reason: reason.trim() || undefined,
        reassign_open_leads: reassignOpenLeads,
        reassign_open_work: reassignOpenWork,
        reassign_to_user_id: reassignToUserId === '' ? undefined : Number(reassignToUserId),
        force: forceDeactivate,
      });
      setSuccess(
        `Employee deactivated. Reassigned ${result.reassigned_leads} leads and ${result.reassigned_work} work items.`,
      );
      onSaved();
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 409 && apiError.data && typeof apiError.data === 'object') {
        const detail = (apiError.data as { detail?: { message?: string; open_leads?: number; open_work?: number } }).detail;
        if (detail?.message) {
          setError(
            `${detail.message} Open leads: ${detail.open_leads ?? 0}, open work: ${detail.open_work ?? 0}.`,
          );
        } else {
          setError(apiError.message || 'Could not deactivate employee.');
        }
      } else {
        setError(apiError.message || 'Could not deactivate employee.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    const confirmed = window.confirm(
      'Remove employee from this business? This only works when they have no active assignments.',
    );
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await removeEmployee(employee.id);
      setSuccess('Employee removed.');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove employee.');
    } finally {
      setLoading(false);
    }
  };

  const reassignOptions = members.filter((m) => {
    if (m.user_id === employee.user_id) return false;
    return m.id === 0 || m.is_active;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border-color bg-card-bg p-6 m-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-primary">Edit employee</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-text-secondary">
          {employee.name} · {employee.email}
        </p>

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
            {success}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            <p>{error}</p>
            {error.includes('active assignments') && (
              <p className="mt-2 font-medium">Use the reassign options below, or check &quot;Force deactivation&quot; to proceed.</p>
            )}
          </div>
        )}

        <form onSubmit={handleRoleUpdate} className="space-y-4 border-b border-border-color pb-4">
          <h3 className="text-sm font-semibold text-text-primary">Role and status</h3>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Role</label>
            {assignableRolesLoading ? (
              <p className="text-sm text-text-secondary">Loading roles…</p>
            ) : assignableRoles.length > 0 ? (
              <select
                value={roleId === '' ? '' : String(roleId)}
                onChange={(e) => setRoleId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Select role</option>
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            ) : (
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="manager">Manager</option>
                <option value="executive">Executive</option>
              </select>
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-border-color focus:ring-accent"
              />
              Active
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>

        <div className="space-y-3 border-b border-border-color py-4" id="edit-employee-deactivate-section">
          <h3 className="text-sm font-semibold text-text-primary">Deactivate with reassignment</h3>
          {error && error.includes('active assignments') && (
            <p className="text-xs text-amber-700 dark:text-amber-400">Select reassign options or force deactivation below, then click Deactivate again.</p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Left organization / role change / etc."
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={reassignOpenLeads}
              onChange={(e) => setReassignOpenLeads(e.target.checked)}
            />
            Reassign open leads
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={reassignOpenWork}
              onChange={(e) => setReassignOpenWork(e.target.checked)}
            />
            Reassign open work
          </label>
          {(reassignOpenLeads || reassignOpenWork) && (
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Reassign to</label>
              <select
                value={reassignToUserId}
                onChange={(e) => setReassignToUserId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Select assignee</option>
                {reassignOptions.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name} {m.id === 0 ? '(Owner)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={forceDeactivate}
              onChange={(e) => setForceDeactivate(e.target.checked)}
            />
            Force deactivation if no reassignment selected
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleDeactivate()}
              disabled={
                loading ||
                !isActive ||
                ((reassignOpenLeads || reassignOpenWork) && reassignToUserId === '')
              }
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60 dark:bg-amber-900/30 dark:text-amber-300"
            >
              {loading ? 'Processing...' : 'Deactivate employee'}
            </button>
          </div>
        </div>

        <div className="space-y-3 py-4">
          <h3 className="text-sm font-semibold text-text-primary">Danger zone</h3>
          <p className="text-sm text-text-secondary">
            Remove this employee only if they have no active assignments.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={loading}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 dark:bg-red-900/30 dark:text-red-300"
            >
              Remove employee
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
