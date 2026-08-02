'use client';

import { useState } from 'react';
import { createQuickTask } from '@/services/work';
import { DateField } from '@/components/ui/date-field';

export interface QuickTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  employees: Array<{ user_id: number; name: string }>;
}

export function QuickTaskModal({ isOpen, onClose, onCreated, employees }: QuickTaskModalProps) {
  const [text, setText] = useState('');
  const [assignedToId, setAssignedToId] = useState<number | ''>('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const resetAndClose = () => {
    setText('');
    setAssignedToId('');
    setPriority('medium');
    setDueDate('');
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!text.trim() || !assignedToId) return;
    setSubmitting(true);
    setError('');
    try {
      await createQuickTask({
        text: text.trim(),
        assigned_to_id: Number(assignedToId),
        priority,
        due_date: dueDate || null,
      });
      onCreated?.();
      resetAndClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const priorityOptions: Array<{ value: 'low' | 'medium' | 'high'; label: string }> = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={resetAndClose} />

      {/* card */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border-color bg-card-bg p-6 shadow-xl">
        <h2 className="text-lg font-bold text-text-primary mb-4">Quick Task</h2>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Task text */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Task *</label>
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Assign to */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Assign to *</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.user_id} value={emp.user_id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority pills */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">Priority</label>
            <div className="flex gap-2">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    priority === opt.value
                      ? 'border-accent bg-accent/10 text-accent dark:bg-accent/20'
                      : 'border-border-color text-text-secondary hover:border-text-secondary/40'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Due date</label>
            <DateField
              value={dueDate}
              onChange={setDueDate}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={resetAndClose}
            disabled={submitting}
            className="rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !text.trim() || !assignedToId}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Assigning...' : 'Assign Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
