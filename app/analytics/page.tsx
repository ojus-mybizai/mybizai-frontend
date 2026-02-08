'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { getAgentsSummary } from '@/services/analytics';

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const [startDate, setStartDate] = useState(() => formatDate(new Date(Date.now() - 30 * 86400000)));
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getAgentsSummary>> | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAgentsSummary({
        start_date: `${startDate}T00:00:00`,
        end_date: `${endDate}T23:59:59`,
      });
      setSummary(res);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load analytics');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  return (
    <ProtectedShell>
      <ModuleGuard module="agents">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Analytics</h2>
              <p className="text-sm text-text-secondary">
                Agent performance and conversation metrics.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
              <span className="text-text-secondary">–</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
              <button
                type="button"
                onClick={() => void fetchSummary()}
                disabled={loading}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {loading ? 'Loading…' : 'Apply'}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          {loading && !summary && (
            <div className="rounded-2xl border border-border-color bg-card-bg p-8 text-center text-sm text-text-secondary">
              Loading analytics…
            </div>
          )}

          {!loading && summary && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border-color bg-card-bg px-4 py-3">
                  <div className="text-xs font-medium text-text-secondary mb-1">Total agents</div>
                  <div className="text-xl font-semibold text-text-primary">{summary.total_agents}</div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg px-4 py-3">
                  <div className="text-xs font-medium text-text-secondary mb-1">Total conversations</div>
                  <div className="text-xl font-semibold text-text-primary">{summary.total_conversations}</div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg px-4 py-3">
                  <div className="text-xs font-medium text-text-secondary mb-1">Active conversations</div>
                  <div className="text-xl font-semibold text-text-primary">{summary.active_conversations}</div>
                </div>
                <div className="rounded-xl border border-border-color bg-card-bg px-4 py-3">
                  <div className="text-xs font-medium text-text-secondary mb-1">Avg response time</div>
                  <div className="text-xl font-semibold text-text-primary">
                    {summary.avg_response_time.toFixed(1)}s
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border-color bg-card-bg p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Resolution rate</h3>
                <div className="text-2xl font-semibold text-text-primary">
                  {summary.resolution_rate.toFixed(1)}%
                </div>
              </div>

              {summary.top_agents && summary.top_agents.length > 0 && (
                <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
                  <h3 className="text-sm font-semibold text-text-primary p-4 border-b border-border-color">
                    Top agents
                  </h3>
                  <table className="min-w-full divide-y divide-border-color">
                    <thead className="bg-bg-secondary text-xs uppercase text-text-secondary">
                      <tr>
                        <th className="px-4 py-3 text-left">Agent</th>
                        <th className="px-4 py-3 text-left">Conversations</th>
                        <th className="px-4 py-3 text-left">Avg response (s)</th>
                        <th className="px-4 py-3 text-left">Resolution %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color text-sm">
                      {summary.top_agents.map((a) => (
                        <tr key={a.agent_id}>
                          <td className="px-4 py-3 font-medium text-text-primary">{a.agent_name}</td>
                          <td className="px-4 py-3 text-text-secondary">{a.total_conversations}</td>
                          <td className="px-4 py-3 text-text-secondary">
                            {a.avg_response_time.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {a.resolution_rate.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
        </ModuleGuard>
    </ProtectedShell>
  );
}
