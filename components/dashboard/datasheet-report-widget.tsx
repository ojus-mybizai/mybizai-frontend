'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { getDatasheetReport, type DatasheetReport } from '@/services/reports';

const CHART_COLOR = '#8884d8';

interface DatasheetReportWidgetProps {
  modelId: number;
  displayName: string;
  onUnpin: () => void;
}

export function DatasheetReportWidget({ modelId, displayName, onUnpin }: DatasheetReportWidgetProps) {
  const [report, setReport] = useState<DatasheetReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDatasheetReport(modelId, 30)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary line-clamp-1">{displayName}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/data-sheet/${modelId}/reports`}
            className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft hover:text-accent"
          >
            View report
          </Link>
          <button
            type="button"
            onClick={onUnpin}
            className="rounded-md px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            aria-label="Unpin report"
          >
            Unpin
          </button>
        </div>
      </div>
      {loading && (
        <p className="text-sm text-text-secondary py-4">Loading…</p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 py-2">{error}</p>
      )}
      {!loading && report && (
        <>
          <div className="mb-3 rounded-lg border border-border-color bg-bg-secondary px-3 py-2">
            <p className="text-xs text-text-secondary">Total records</p>
            <p className="text-xl font-semibold text-text-primary">{report.total_records}</p>
            <p className="text-xs text-text-secondary">Last 30 days</p>
          </div>
          {report.over_time.length > 0 && (
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.over_time} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value: number | string | undefined) => [value ?? 0, 'Records']}
                    labelFormatter={(label) => String(label)}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={CHART_COLOR}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
