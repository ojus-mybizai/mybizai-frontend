'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getDatasheetReport, getReportLayout, type DatasheetReport, type ReportLayout } from '@/services/reports';
import { DatasheetReportView } from '@/features/data-sheet/components/datasheet-report-view';

export default function DatasheetReportsPage() {
  const params = useParams<{ modelId: string }>();
  const modelId = params?.modelId ? Number(params.modelId) : null;
  const [report, setReport] = useState<DatasheetReport | null>(null);
  const [layout, setLayout] = useState<ReportLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const loadReport = useCallback(async () => {
    if (modelId == null || Number.isNaN(modelId)) {
      setReport(null);
      setLayout(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [data, layoutRes] = await Promise.all([
        getDatasheetReport(modelId, days, 'auto'),
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
  }, [modelId, days]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

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
        <Link
          href={`/data-sheet/${modelId}/reports/ai`}
          className="text-sm font-medium text-accent hover:underline"
        >
          AI Report (generate from content)
        </Link>
      </div>
      <DatasheetReportView
        report={report}
        loading={loading}
        error={error}
        days={days}
        onDaysChange={setDays}
        layout={layout}
      />
    </div>
  );
}
