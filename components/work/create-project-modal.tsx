'use client';

import { useEffect, useState } from 'react';
import { createProject, updateProject, type WorkProject, type WorkProjectCreate } from '@/services/work';
import { DateField } from '@/components/ui/date-field';

const PRESET_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (project: WorkProject) => void;
  editProject?: WorkProject | null;
  employees?: Array<{ user_id: number; name: string }>;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
  editProject = null,
  employees = [],
}: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [ownerId, setOwnerId] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editProject;

  // Populate fields when editing or reset when opening fresh
  useEffect(() => {
    if (!isOpen) return;
    if (editProject) {
      setName(editProject.name);
      setDescription(editProject.description ?? '');
      setColor(editProject.color ?? PRESET_COLORS[0]);
      setOwnerId(editProject.owner_id ?? '');
      setDueDate(editProject.due_date ?? '');
    } else {
      setName('');
      setDescription('');
      setColor(PRESET_COLORS[0]);
      setOwnerId('');
      setDueDate('');
    }
    setError(null);
    setSaving(false);
  }, [isOpen, editProject]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Project name is required.');
      return;
    }

    setError(null);
    setSaving(true);

    const payload: WorkProjectCreate = {
      name: trimmed,
      description: description.trim() || null,
      color,
      owner_id: ownerId === '' ? null : Number(ownerId),
      due_date: dueDate || null,
    };

    try {
      let project: WorkProject;
      if (isEdit && editProject) {
        project = await updateProject(editProject.id, payload);
      } else {
        project = await createProject(payload);
      }
      onCreated?.(project);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save project.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg mx-4 rounded-xl bg-card-bg border border-border-color shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
          <h2 className="text-lg font-semibold text-text-primary">
            {isEdit ? 'Edit Project' : 'Create Project'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-text-primary mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q2 Marketing Campaign"
              autoFocus
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="project-desc" className="block text-sm font-medium text-text-primary mb-1">
              Description
            </label>
            <textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of this project..."
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors resize-none"
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Color</label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c
                      ? 'border-text-primary scale-110 ring-2 ring-accent/30'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Owner */}
          <div>
            <label htmlFor="project-owner" className="block text-sm font-medium text-text-primary mb-1">
              Owner
            </label>
            <select
              id="project-owner"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            >
              <option value="">No owner</option>
              {employees.map((emp) => (
                <option key={emp.user_id} value={emp.user_id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor="project-due" className="block text-sm font-medium text-text-primary mb-1">
              Due Date
            </label>
            <DateField
              id="project-due"
              value={dueDate}
              onChange={setDueDate}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-secondary border border-border-color transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
