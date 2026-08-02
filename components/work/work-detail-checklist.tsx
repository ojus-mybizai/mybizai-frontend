'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Work, WorkStepOut, FormField } from '@/services/work';
import { getWorkSteps, completeWorkStep, revertWorkStep, startWork, getWork, submitStepFormData } from '@/services/work';
import { useAuthStore } from '@/lib/auth-store';
import { WorkDetailHeader } from '@/components/work/work-detail-header';
import { DynamicWorkForm } from '@/components/work/dynamic-work-form';
import { formatDateTime } from '@/lib/format-date';

interface StepSchema {
  order: number;
  label: string;
  form_schema?: FormField[];
}

interface WorkDetailChecklistProps {
  work: Work;
  onWorkUpdated: (w: Work) => void;
  stepsSchema?: StepSchema[] | null;
  globalFormSchema?: FormField[] | null;
}

function formatDate(d: string | null | undefined): string {
  return formatDateTime(d);
}

export default function WorkDetailChecklist({ work, onWorkUpdated, stepsSchema, globalFormSchema }: WorkDetailChecklistProps) {
  const user = useAuthStore((s) => s.user as { id?: number } | null);
  const canAct = work.assigned_to_id === user?.id || useAuthStore.getState().hasPermission('manage_work');

  const [steps, setSteps] = useState<WorkStepOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formModal, setFormModal] = useState<{ step: WorkStepOut; schema: FormField[]; stepIndex: number } | null>(null);
  const [expandedStepData, setExpandedStepData] = useState<Set<number>>(new Set());

  // Per-step mode: any step in stepsSchema has a form_schema
  const hasPerStepForms = stepsSchema?.some((s) => s.form_schema && s.form_schema.length > 0) ?? false;

  const getStepSchema = (stepOrder: number): FormField[] | null => {
    if (stepsSchema) {
      const stepDef = stepsSchema.find((s) => s.order === stepOrder);
      if (stepDef?.form_schema && stepDef.form_schema.length > 0) return stepDef.form_schema;
    }
    if (!hasPerStepForms && globalFormSchema && globalFormSchema.length > 0) return globalFormSchema;
    return null;
  };

  const loadSteps = useCallback(async () => {
    try {
      const list = await getWorkSteps(work.id);
      setSteps(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load steps');
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
    if (!canAct || work.status === 'pending') return;
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

  const handleOpenStepForm = (step: WorkStepOut, idx: number) => {
    const schema = getStepSchema(step.order);
    if (!schema) return;
    setFormModal({ step, schema, stepIndex: idx });
  };

  const handleSubmitStepForm = async (formData: Record<string, unknown>) => {
    if (!formModal) return;
    try {
      const updated = await submitStepFormData(work.id, formModal.step.order, formData);
      setSteps((prev) =>
        prev.map((s) => (s.order === formModal.step.order ? { ...s, form_data: updated.form_data } : s)),
      );
      setFormModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit form');
    }
  };

  const toggleExpandedStepData = (stepOrder: number) => {
    setExpandedStepData((prev) => {
      const next = new Set(prev);
      if (next.has(stepOrder)) next.delete(stepOrder);
      else next.add(stepOrder);
      return next;
    });
  };

  const completedCount = steps.filter((s) => s.completed_at).length;
  const totalCount = steps.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const filledFormCount = steps.filter((s) => s.form_data && Object.keys(s.form_data).length > 0).length;
  const stepsWithForm = steps.filter((s) => getStepSchema(s.order) !== null).length;

  const startAction =
    work.status === 'pending' && canAct ? (
      <button
        type="button"
        onClick={() => void handleStart()}
        disabled={!!actionLoading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
      >
        {actionLoading === 'start' ? 'Starting…' : 'Start work'}
      </button>
    ) : null;

  return (
    <div className="space-y-5">
      <WorkDetailHeader work={work} action={startAction} showBack={false} />

      {/* Notes — contextual info for the worker */}
      {work.notes && (
        <div className="rounded-lg border border-border-color bg-bg-secondary/60 px-4 py-3">
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{work.notes}</p>
        </div>
      )}

      {/* "Start work first" callout — blocks interaction when pending */}
      {work.status === 'pending' && canAct && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/10">
          <div className="flex items-center gap-2.5">
            <span className="text-lg" aria-hidden>⏳</span>
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Work hasn't started yet</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">Start this work to begin completing steps</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={!!actionLoading}
            className="shrink-0 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
          >
            {actionLoading === 'start' ? 'Starting…' : 'Start →'}
          </button>
        </div>
      )}

      {/* Progress */}
      {totalCount > 0 && (
        <div className="rounded-xl border border-border-color bg-bg-secondary/60 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-text-primary">
                {completedCount} of {totalCount} steps completed
              </span>
              {stepsWithForm > 0 && (
                <p className="text-xs text-text-secondary">
                  {filledFormCount} of {stepsWithForm} forms filled
                </p>
              )}
            </div>
            <span className="text-xl font-bold text-accent">{progressPct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg-primary border border-border-color">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {(work.started_at || work.completed_at) && (
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-secondary">
              {work.started_at && <span>Started {formatDate(work.started_at)}</span>}
              {work.completed_at && <span>Completed {formatDate(work.completed_at)}</span>}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Steps */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-bg-secondary" />
          ))}
        </div>
      ) : steps.length === 0 ? (
        <p className="rounded-xl border border-border-color bg-bg-secondary px-4 py-8 text-center text-sm text-text-secondary">
          No steps defined for this work.
        </p>
      ) : (
        <ul className="space-y-2" role="list">
          {steps.map((step, index) => {
            const schema = getStepSchema(step.order);
            const hasFilled = step.form_data && Object.keys(step.form_data as object).length > 0;
            const isExpanded = expandedStepData.has(step.order);
            const isDone = !!step.completed_at;
            const isActionLoading =
              actionLoading === `complete-${step.order}` || actionLoading === `revert-${step.order}`;
            const canInteract = canAct && work.status !== 'pending';

            return (
              <li
                key={step.id}
                className={`overflow-hidden rounded-xl border transition-colors ${
                  isDone
                    ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-900/10'
                    : 'border-border-color bg-card-bg shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3 p-4">
                  {/* Single unified toggle button — click to complete/revert */}
                  {canInteract ? (
                    <button
                      type="button"
                      onClick={() =>
                        isDone ? void handleRevertStep(step.order) : void handleCompleteStep(step.order)
                      }
                      disabled={isActionLoading || work.status === 'completed'}
                      title={isDone ? 'Click to undo' : 'Mark as done'}
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all focus:outline-none disabled:opacity-50 ${
                        isDone
                          ? 'border-emerald-500 bg-emerald-500 text-white hover:opacity-80'
                          : 'border-border-color bg-bg-primary hover:border-accent hover:ring-2 hover:ring-accent/20'
                      }`}
                      aria-label={isDone ? `Undo: ${step.label}` : `Complete: ${step.label}`}
                    >
                      {isActionLoading ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : isDone ? (
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : null}
                    </button>
                  ) : (
                    /* Read-only state indicator */
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                        isDone
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-border-color bg-bg-secondary text-text-secondary'
                      }`}
                    >
                      {isDone ? (
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </span>
                  )}

                  {/* Step label + completion time */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <span
                      className={`block text-sm font-medium ${
                        isDone ? 'text-text-secondary line-through' : 'text-text-primary'
                      }`}
                    >
                      {step.label}
                    </span>
                    {isDone && step.completed_at && (
                      <p className="text-xs text-text-secondary">{formatDate(step.completed_at)}</p>
                    )}
                  </div>

                  {/* Form action buttons — always available so workers can pre-fill forms */}
                  {schema && canAct && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {hasFilled && (
                        <button
                          type="button"
                          onClick={() => toggleExpandedStepData(step.order)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                        >
                          {isExpanded ? 'Hide' : '✓ View'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenStepForm(step, index)}
                        disabled={!!actionLoading}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          hasFilled
                            ? 'border border-border-color bg-bg-primary text-text-secondary hover:border-accent hover:text-accent'
                            : 'bg-accent text-white hover:opacity-90'
                        }`}
                      >
                        {hasFilled ? 'Edit form' : 'Fill form'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline submitted form data */}
                {hasFilled && isExpanded && step.form_data && (
                  <div className="border-t border-border-color bg-bg-secondary/60 px-4 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Submitted data</p>
                    <dl className="space-y-1.5">
                      {Object.entries(step.form_data as Record<string, unknown>).map(([k, v]) => (
                        <div key={k} className="flex gap-3 text-xs">
                          <dt className="w-28 shrink-0 font-medium capitalize text-text-secondary">
                            {k.replace(/_/g, ' ')}
                          </dt>
                          <dd className="min-w-0 flex-1 break-all text-text-primary">
                            {typeof v === 'string' && v.startsWith('data:image') ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={v} alt="uploaded" className="h-24 w-24 rounded-lg border border-border-color object-cover" />
                            ) : (
                              String(v ?? '—')
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Step form modal */}
      {formModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal
          onClick={(e) => {
            if (e.target === e.currentTarget) setFormModal(null);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card-bg shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-color px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                    {formModal.stepIndex + 1}
                  </span>
                  <h3 className="text-base font-semibold text-text-primary">Step form</h3>
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">{formModal.step.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setFormModal(null)}
                className="rounded-full p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <DynamicWorkForm
                fields={formModal.schema}
                initialValues={(formModal.step.form_data as Record<string, unknown>) ?? {}}
                onSubmit={handleSubmitStepForm}
                onCancel={() => setFormModal(null)}
                submitLabel="Save form"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
