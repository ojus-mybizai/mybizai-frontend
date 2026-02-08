'use client';

import { useState, useEffect } from 'react';
import type { EmployeeReportRow } from '@/services/employees';
import { updateEmployee } from '@/services/employees';

export interface EditEmployeeModalProps {
  isOpen: boolean;
  employee: EmployeeReportRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditEmployeeModal({ isOpen, employee, onClose, onSaved }: EditEmployeeModalProps) {
  const [role, setRole] = useState<string>('executive');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      setRole(employee.role);
      setIsActive(employee.is_active);
      setError(null);
    }
  }, [employee]);

  if (!isOpen || !employee || employee.id === 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (employee.role === 'owner') return;
    setLoading(true);
    setError(null);
    try {
      await updateEmployee(employee.id, {
        role: role as 'manager' | 'executive',
        is_active: isActive,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee');
    } finally {
      setLoading(false);
    }
  };

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

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="manager">Manager</option>
              <option value="executive">Executive</option>
            </select>
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
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
