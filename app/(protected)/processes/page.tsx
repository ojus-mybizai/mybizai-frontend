'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/permission-guard';
import {
  listProcesses,
  createProcess,
  type BusinessProcessListItem,
} from '@/services/processes';
import { listModels, type DynamicModel } from '@/services/dynamic-data';

// ─── Color helpers ────────────────────────────────────────────────────────────

const PROCESS_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
  '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#F97316',
];

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-border-color bg-card-bg p-4 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-bg-secondary" />
            <div className="h-4 w-48 rounded bg-bg-secondary" />
            <div className="ml-auto h-5 w-14 rounded-full bg-bg-secondary" />
          </div>
          <div className="mt-2 ml-6 h-3 w-64 rounded bg-bg-secondary" />
          <div className="mt-1.5 ml-6 h-3 w-36 rounded bg-bg-secondary" />
        </div>
      ))}
    </div>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateProcessModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState<'lead' | 'datasheet_record'>('lead');
  const [dynamicModelId, setDynamicModelId] = useState<number | null>(null);
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && !modelsLoaded) {
      listModels()
        .then((m) => {
          setModels(m);
          setModelsLoaded(true);
        })
        .catch(() => setModelsLoaded(true));
    }
  }, [open, modelsLoaded]);

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setEntityType('lead');
      setDynamicModelId(null);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (entityType === 'datasheet_record' && !dynamicModelId) {
      setError('Please select a datasheet');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const proc = await createProcess({
        name: name.trim(),
        description: description.trim() || undefined,
        entity_type: entityType,
        dynamic_model_id: entityType === 'datasheet_record' ? dynamicModelId : undefined,
        color: PROCESS_COLORS[Math.floor(Math.random() * PROCESS_COLORS.length)],
      });
      onCreated(proc.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to create process');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border-color bg-card-bg p-6 shadow-xl mx-4">
        <h2 className="text-lg font-semibold text-text-primary mb-4">New Process</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Patient Onboarding"
              autoFocus
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description..."
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
          </div>

          {/* Entity type */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Entity Type
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="entity_type"
                  checked={entityType === 'lead'}
                  onChange={() => {
                    setEntityType('lead');
                    setDynamicModelId(null);
                  }}
                  className="accent-accent"
                />
                <span className="text-sm text-text-primary">Lead</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="entity_type"
                  checked={entityType === 'datasheet_record'}
                  onChange={() => setEntityType('datasheet_record')}
                  className="accent-accent"
                />
                <span className="text-sm text-text-primary">Datasheet Record</span>
              </label>
            </div>
          </div>

          {/* Datasheet selector */}
          {entityType === 'datasheet_record' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Datasheet <span className="text-red-500">*</span>
              </label>
              <select
                value={dynamicModelId ?? ''}
                onChange={(e) => setDynamicModelId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Select a datasheet...</option>
                {models
                  .filter((m) => m.status === 'active')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name || m.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-border-color bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-primary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Process'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProcessesPage() {
  const router = useRouter();
  const [processes, setProcesses] = useState<BusinessProcessListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    loadProcesses();
  }, []);

  async function loadProcesses() {
    setLoading(true);
    setError('');
    try {
      const data = await listProcesses();
      setProcesses(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load processes');
    } finally {
      setLoading(false);
    }
  }

  function handleCreated(id: number) {
    setCreateOpen(false);
    router.push(`/processes/${id}`);
  }

  return (
    <PermissionGuard permission="manage_work" module="lms">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-text-primary">Processes</h1>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Process
          </button>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          Build and manage your business workflows
        </p>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
            <button
              onClick={loadProcesses}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && <ListSkeleton />}

        {/* Empty */}
        {!loading && !error && processes.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-color bg-card-bg py-16 px-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bg-secondary text-xl text-text-secondary">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">No processes yet</p>
            <p className="text-sm text-text-secondary mb-4">
              Create your first business workflow.
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Process
            </button>
          </div>
        )}

        {/* Process List */}
        {!loading && processes.length > 0 && (
          <div className="space-y-3">
            {processes.map((proc) => (
              <button
                key={proc.id}
                onClick={() => router.push(`/processes/${proc.id}`)}
                className="w-full text-left rounded-lg border border-border-color bg-card-bg p-4 hover:border-accent/40 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: proc.color || '#3B82F6' }}
                  />
                  <span className="text-base font-semibold text-text-primary group-hover:text-accent transition-colors truncate">
                    {proc.name}
                  </span>
                  <span className="ml-auto flex-shrink-0 rounded-full bg-bg-secondary px-2.5 py-0.5 text-xs font-medium text-text-secondary capitalize">
                    {proc.entity_type === 'lead' ? 'Lead' : proc.dynamic_model_name || 'Record'}
                  </span>
                </div>
                <div className="mt-1.5 ml-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                  <span>{proc.stage_count} stage{proc.stage_count !== 1 ? 's' : ''}</span>
                  <span className="text-border-color">|</span>
                  <span>{proc.active_entries} active entr{proc.active_entries !== 1 ? 'ies' : 'y'}</span>
                  {proc.created_at && (
                    <>
                      <span className="text-border-color">|</span>
                      <span>Created {formatDate(proc.created_at)}</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateProcessModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </PermissionGuard>
  );
}
