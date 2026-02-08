'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createWork, listWorkTypes, type WorkType } from '@/services/work';
import { listEmployees, type Employee } from '@/services/employees';
import { listLeadsForSelect, type LeadOption } from '@/services/customers';

export interface AssignWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (workId: number) => void;
}

export function AssignWorkModal({ isOpen, onClose, onCreated }: AssignWorkModalProps) {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [assignedToId, setAssignedToId] = useState<number | null>(null);
  const [workTypeId, setWorkTypeId] = useState<number | null>(null);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      listEmployees().then(setEmployees).catch(() => setEmployees([]));
      listWorkTypes().then(setWorkTypes).catch(() => setWorkTypes([]));
      listLeadsForSelect({ per_page: 100 }).then(setLeads).catch(() => setLeads([]));
      setAssignedToId(null);
      setWorkTypeId(null);
      setLeadId(null);
      setTitle('');
      setNotes('');
      setDueDate('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (workTypeId == null || assignedToId == null) {
      setError('Please select a work type and an employee.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await createWork({
        work_type_id: workTypeId,
        assigned_to_id: assignedToId,
        lead_id: leadId || undefined,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        due_date: dueDate ? dueDate : undefined,
      });
      onClose();
      onCreated?.(created.id);
      router.push(`/work/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign work');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border-color bg-card-bg p-6 m-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-primary">Assign work</h2>
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
          Assign a work type to an employee. Optionally link to a lead or set a due date.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Work type *</label>
            <select
              value={workTypeId ?? ''}
              onChange={(e) => setWorkTypeId(e.target.value === '' ? null : Number(e.target.value))}
              required
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Select type</option>
              {workTypes.filter((t) => t.is_active).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Assign to *</label>
            <select
              value={assignedToId ?? ''}
              onChange={(e) => setAssignedToId(e.target.value === '' ? null : Number(e.target.value))}
              required
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.user_id} value={emp.user_id}>
                  {emp.name || emp.email}{emp.id === 0 ? ' (Owner)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deliver order #123"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Link to lead (optional)</label>
            <select
              value={leadId ?? ''}
              onChange={(e) => setLeadId(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">None</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name || l.phone || `Lead #${l.id}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Due date (optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Instructions or context"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Assign work'}
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
