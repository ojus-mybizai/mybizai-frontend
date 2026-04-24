'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getDatasheetReport, getReportLayout, type DatasheetReport, type ReportLayout } from '@/services/reports';
import { useDateRangeStore } from '@/lib/stores/date-range-store';
import dynamic from 'next/dynamic';

const DatasheetReportView = dynamic(
  () => import('@/features/data-sheet/components/datasheet-report-view').then(m => m.DatasheetReportView),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-bg-secondary rounded-lg" /> }
);

export default function DatasheetReportsPage() {
  const params  = useParams<{ modelId: string }>();
  const modelId = params?.modelId ? Number(params.modelId) : null;

  const toDays    = useDateRangeStore((s) => s.toDays);
  const startDate = useDateRangeStore((s) => s.startDate);
  const endDate   = useDateRangeStore((s) => s.endDate);

  const [report, setReport] = useState<DatasheetReport | null>(null);
  const [layout, setLayout] = useState<ReportLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (modelId == null || Number.isNaN(modelId)) { setReport(null); setLayout(null); return; }
    setLoading(true);
    setError(null);
    try {
      const [data, layoutRes] = await Promise.all([
        getDatasheetReport(modelId, toDays(), 'auto'),
        getReportLayout(modelId).catch(() => null),
      ]);
      setReport(data);
      setLayout(layoutRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
      setReport(null);
      setLayout(null);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId, startDate, endDate]);

  useEffect(() => { void loadReport(); }, [loadReport]);

  if (modelId == null || Number.isNaN(modelId)) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg px-6 py-8 text-text-secondary">
        Invalid data sheet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href={`/data-sheet/${modelId}/reports/ai`} className="text-sm font-medium text-accent hover:underline">
          AI Report (generate from content)
        </Link>
      </div>
      <DatasheetReportView
        report={report}
        loading={loading}
        error={error}
        layout={layout}
      />
    </div>
  );
}
