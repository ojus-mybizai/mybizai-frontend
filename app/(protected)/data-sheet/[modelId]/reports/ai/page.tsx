'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getAIDatasheetReport,
  generateAIDatasheetReport,
  type DatasheetAIReportResponse,
} from '@/services/reports';
import { DatasheetReportView } from '@/features/data-sheet/components/datasheet-report-view';

export default function DatasheetAIReportPage() {
  const params = useParams<{ modelId: string }>();
  const modelId = params?.modelId ? Number(params.modelId) : null;
  const [data, setData] = useState<DatasheetAIReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (modelId == null || Number.isNaN(modelId)) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getAIDatasheetReport(modelId);
      setData(result ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleGenerate = async () => {
    if (modelId == null || Number.isNaN(modelId) || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateAIDatasheetReport(modelId, 30);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  if (modelId == null || Number.isNaN(modelId)) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg px-6 py-8 text-text-secondary">
        Invalid data sheet.
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg px-6 py-8">
        <p className="text-text-secondary">Loading…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-dashed border-border-color bg-card-bg p-8 text-center">
          <h2 className="text-lg font-semibold text-text-primary mb-2">AI Report</h2>
          <p className="text-sm text-text-secondary mb-4">
            Generate a report that analyzes your data content and suggests the best charts. This runs only when you click below.
          </p>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate report'}
          </button>
        </div>
      </div>
    );
  }

  const generatedDate = data.generated_at
    ? new Date(data.generated_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          Report generated on {generatedDate}
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-50"
        >
          {generating ? 'Regenerating…' : 'Regenerate report'}
        </button>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
      <DatasheetReportView
        report={data.report}
        loading={false}
        error={null}
        days={30}
        onDaysChange={() => {}}
        layout={data.layout}
      />
    </div>
  );
}
