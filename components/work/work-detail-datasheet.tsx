'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Work, AssignedRecordOut } from '@/services/work';
import { getWorkAssignedRecords, updateWorkRecordStatus, startWork, getWork } from '@/services/work';
import { useAuthStore } from '@/lib/auth-store';
import { WorkDetailHeader } from '@/components/work/work-detail-header';

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

interface WorkDetailDatasheetProps {
  work: Work;
  onWorkUpdated: (w: Work) => void;
  /** From template.datasheet_ui_schema: display_fields, editable_fields, record_actions */
  uiSchema?: {
    display_fields?: string[];
    editable_fields?: string[];
    record_actions?: Array<{ type: string; label: string; field: string }>;
    auto_complete_work_when_all_done?: boolean;
  } | null;
}

export default function WorkDetailDatasheet({ work, onWorkUpdated, uiSchema }: WorkDetailDatasheetProps) {
  const user = useAuthStore((s) => s.user as { id?: number } | null);
  const canAct = work.assigned_to_id === user?.id || useAuthStore.getState().hasPermission('manage_work');

  const [records, setRecords] = useState<AssignedRecordOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayFields = uiSchema?.display_fields ?? [];
  const recordActions = uiSchema?.record_actions ?? [];

  const loadRecords = useCallback(async () => {
    try {
      const list = await getWorkAssignedRecords(work.id);
      setRecords(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [work.id]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

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

  const handleRecordStatus = async (dynamicRecordId: number, status: 'done' | 'skipped' | 'in_progress') => {
    if (!canAct) return;
    setActionLoading(`record-${dynamicRecordId}`);
    try {
      await updateWorkRecordStatus(work.id, dynamicRecordId, status);
      await loadRecords();
      const updated = await getWork(work.id);
      onWorkUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update record');
    } finally {
      setActionLoading(null);
    }
  };

  const doneCount = records.filter((r) => r.status === 'done').length;
  const totalCount = records.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const progressLabel = totalCount > 0 ? `${doneCount} of ${totalCount} records` : '';

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
        <div className="overflow-hidden rounded-xl border border-border-color">
          <div className="h-12 animate-pulse bg-bg-secondary" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse border-t border-border-color bg-card-bg" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <p className="rounded-xl border border-border-color bg-bg-secondary px-4 py-8 text-center text-sm text-text-secondary">
          No records assigned to this work.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-color shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary">
                  {displayFields.length > 0 ? (
                    displayFields.map((key) => (
                      <th
                        key={key}
                        className="px-4 py-3 font-semibold uppercase tracking-wide text-text-secondary"
                      >
                        {key.replace(/_/g, ' ')}
                      </th>
                    ))
                  ) : (
                    <th className="px-4 py-3 font-semibold uppercase tracking-wide text-text-secondary">Data</th>
                  )}
                  <th className="px-4 py-3 font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                  {canAct && (
                    <th className="px-4 py-3 font-semibold uppercase tracking-wide text-text-secondary text-right">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr
                    key={rec.dynamic_record_id}
                    className={`border-b border-border-color last:border-0 transition-colors ${
                      rec.status === 'done' ? 'bg-bg-secondary/50' : 'bg-card-bg hover:bg-bg-secondary/30'
                    }`}
                  >
                    {displayFields.length > 0 ? (
                      displayFields.map((key) => (
                        <td key={key} className="px-4 py-3 text-text-primary">
                          {String(rec.data[key] ?? '—')}
                        </td>
                      ))
                    ) : (
                      <td className="px-4 py-3 text-text-primary">
                        {Object.entries(rec.data)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ') || '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          rec.status === 'done'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : rec.status === 'skipped'
                              ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}
                      >
                        {rec.status.replace('_', ' ')}
                      </span>
                    </td>
                    {canAct && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {rec.status !== 'done' && (
                            <button
                              type="button"
                              onClick={() => handleRecordStatus(rec.dynamic_record_id, 'done')}
                              disabled={!!actionLoading}
                              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                            >
                              Mark done
                            </button>
                          )}
                          {rec.status !== 'skipped' && rec.status !== 'done' && (
                            <button
                              type="button"
                              onClick={() => handleRecordStatus(rec.dynamic_record_id, 'skipped')}
                              disabled={!!actionLoading}
                              className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-60"
                            >
                              Skip
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
