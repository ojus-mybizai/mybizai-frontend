'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getDatasheetReport, type DatasheetReport } from '@/services/reports';
import { DatasheetReportView } from '@/features/data-sheet/components/datasheet-report-view';

export default function DatasheetReportsPage() {
  const params = useParams<{ modelId: string }>();
  const modelId = params?.modelId ? Number(params.modelId) : null;
  const [report, setReport] = useState<DatasheetReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const loadReport = useCallback(async () => {
    if (modelId == null || Number.isNaN(modelId)) {
      setReport(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getDatasheetReport(modelId, days, 'auto');
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
      setReport(null);
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
    <DatasheetReportView
      report={report}
      loading={loading}
      error={error}
      days={days}
      onDaysChange={setDays}
    />
  );
}
