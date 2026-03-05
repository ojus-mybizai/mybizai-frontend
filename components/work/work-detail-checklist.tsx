'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Work, WorkStepOut } from '@/services/work';
import { getWorkSteps, completeWorkStep, revertWorkStep, startWork, getWork } from '@/services/work';
import { useAuthStore } from '@/lib/auth-store';
import { WorkDetailHeader } from '@/components/work/work-detail-header';

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

interface WorkDetailChecklistProps {
  work: Work;
  onWorkUpdated: (w: Work) => void;
}

export default function WorkDetailChecklist({ work, onWorkUpdated }: WorkDetailChecklistProps) {
  const user = useAuthStore((s) => s.user as { id?: number } | null);
  const canAct = work.assigned_to_id === user?.id || useAuthStore.getState().hasPermission('manage_work');

  const [steps, setSteps] = useState<WorkStepOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSteps = useCallback(async () => {
    try {
      const list = await getWorkSteps(work.id);
      setSteps(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load steps');
      setSteps([]);
    } finally {
      setLoading(false);
    }
  }, [work.id]);

  useEffect(() => {
    void loadSteps();
  }, [loadSteps]);

  const handleStart = async () => {
    if (!canAct || work.status !== 'pending') return;
    setActionLoading('start');
    try {
      const updated = await startWork(work.id);
      onWorkUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteStep = async (stepOrder: number) => {
    if (!canAct) return;
    setActionLoading(`complete-${stepOrder}`);
    try {
      await completeWorkStep(work.id, stepOrder);
      await loadSteps();
      const updated = await getWork(work.id);
      onWorkUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete step');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevertStep = async (stepOrder: number) => {
    if (!canAct) return;
    setActionLoading(`revert-${stepOrder}`);
    try {
      await revertWorkStep(work.id, stepOrder);
      await loadSteps();
      const updated = await getWork(work.id);
      onWorkUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revert step');
    } finally {
      setActionLoading(null);
    }
  };

  const completedCount = steps.filter((s) => s.completed_at).length;
  const totalCount = steps.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const progressLabel = totalCount > 0 ? `${completedCount} of ${totalCount} steps` : '';

  const startAction =
    work.status === 'pending' && canAct ? (
      <button
        type="button"
        onClick={handleStart}
        disabled={!!actionLoading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
      >
        {actionLoading === 'start' ? 'Starting…' : 'Start work'}
      </button>
    ) : null;

  return (
    <div className="space-y-6">
      <WorkDetailHeader work={work} action={startAction} />

      {progressLabel && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-text-primary">{progressLabel}</span>
            <span className="text-text-secondary">{progressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {(work.started_at || work.completed_at) && (
            <p className="text-xs text-text-secondary">
              {work.started_at && `Started ${formatDate(work.started_at)}`}
              {work.started_at && work.completed_at && ' · '}
              {work.completed_at && `Completed ${formatDate(work.completed_at)}`}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-bg-secondary" />
          ))}
        </div>
      ) : steps.length === 0 ? (
        <p className="rounded-xl border border-border-color bg-bg-secondary px-4 py-6 text-center text-sm text-text-secondary">
          No steps defined for this work.
        </p>
      ) : (
        <ul className="space-y-3" role="list">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                step.completed_at
                  ? 'border-border-color bg-bg-secondary'
                  : 'border-border-color bg-card-bg shadow-sm'
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-sm font-semibold text-text-secondary">
                {index + 1}
              </span>
              {canAct && step.completed_at == null ? (
                <button
                  type="button"
                  onClick={() => handleCompleteStep(step.order)}
                  disabled={!!actionLoading}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border-color bg-bg-primary ring-2 ring-transparent hover:border-accent hover:ring-accent/20 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                  aria-label={`Complete: ${step.label}`}
                />
              ) : step.completed_at ? (
                <button
                  type="button"
                  onClick={() => handleRevertStep(step.order)}
                  disabled={!!actionLoading || work.status === 'completed'}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-accent text-white hover:opacity-90 disabled:opacity-50"
                  aria-label={`Revert: ${step.label}`}
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border-color bg-bg-secondary" />
              )}
              <div className="min-w-0 flex-1">
                <span
                  className={
                    step.completed_at
                      ? 'text-text-secondary line-through'
                      : 'font-medium text-text-primary'
                  }
                >
                  {step.label}
                </span>
                {step.completed_at && (
                  <p className="mt-0.5 text-xs text-text-secondary">{formatDate(step.completed_at)}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
