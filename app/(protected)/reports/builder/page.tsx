'use client';

import { useState, useEffect, FormEvent } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  buildReport,
  getReportBuilderContext,
  type ReportBuilderResponse,
  type ReportBuilderContext,
} from '@/services/report-builder';

const ReportBuilderView = dynamic(
  () => import('@/features/reports/components/report-builder-view'),
  { ssr: false }
);

const STATIC_PRESETS = [
  { label: 'Leads by status', prompt: 'Show leads grouped by status' },
  { label: 'Leads by source', prompt: 'Show leads grouped by source' },
  { label: 'Leads over time', prompt: 'Show leads created over time' },
  { label: 'Work by status', prompt: 'Show work items grouped by status' },
  { label: 'Work by type', prompt: 'Show work items grouped by work type' },
];

export default function ReportBuilderPage() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportBuilderResponse | null>(null);
  const [chartType, setChartType] = useState<string>('bar');
  const [context, setContext] = useState<ReportBuilderContext | null>(null);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Load context on mount
  useEffect(() => {
    getReportBuilderContext()
      .then(setContext)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e?: FormEvent, presetPrompt?: string) => {
    if (e) e.preventDefault();
    const q = presetPrompt || prompt;
    if (!q.trim()) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const result = await buildReport(
        q,
        dateStart || undefined,
        dateEnd || undefined,
      );
      setReport(result);
      setChartType(result.suggested_chart || 'bar');
      if (!presetPrompt) setPrompt(q);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreset = (presetPrompt: string) => {
    setPrompt(presetPrompt);
    handleSubmit(undefined, presetPrompt);
  };

  // Build dynamic presets from context
  const dynamicPresets = (context?.datasheets || []).flatMap((ds) => {
    const presets: Array<{ label: string; prompt: string }> = [];
    presets.push({
      label: `${ds.display_name} over time`,
      prompt: `Show ${ds.display_name} records created over time`,
    });
    const firstEnum = ds.fields.find((f) => f.field_type === 'enum');
    if (firstEnum) {
      presets.push({
        label: `${ds.display_name} by ${firstEnum.display_name}`,
        prompt: `Show ${ds.display_name} grouped by ${firstEnum.name}`,
      });
    }
    return presets;
  });

  const allPresets = [...STATIC_PRESETS, ...dynamicPresets];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/reports"
              className="text-sm text-text-secondary hover:text-accent"
            >
              Reports
            </Link>
            <span className="text-text-secondary">/</span>
            <span className="text-sm text-text-primary font-medium">Builder</span>
          </div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">
            Report Builder
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Describe the report you want in plain English
          </p>
        </div>
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2"
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Show patients by status, Revenue over time, Leads by source..."
          className="flex-1 rounded-xl border border-border-color bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
        >
          {loading ? 'Analyzing...' : 'Generate'}
        </button>
      </form>

      {/* Date range */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-text-secondary">Date range:</span>
        <input
          type="date"
          value={dateStart}
          onChange={(e) => setDateStart(e.target.value)}
          className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <span className="text-text-secondary">to</span>
        <input
          type="date"
          value={dateEnd}
          onChange={(e) => setDateEnd(e.target.value)}
          className="rounded-lg border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        {(dateStart || dateEnd) && (
          <button
            type="button"
            onClick={() => { setDateStart(''); setDateEnd(''); }}
            className="text-xs text-text-secondary hover:text-accent"
          >
            Clear
          </button>
        )}
      </div>

      {/* Preset chips (shown when no report) */}
      {!report && !loading && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
            Quick reports
          </p>
          <div className="flex flex-wrap gap-2">
            {allPresets.map((preset) => (
              <button
                key={preset.prompt}
                type="button"
                onClick={() => handlePreset(preset.prompt)}
                className="rounded-full border border-border-color bg-bg-primary px-3.5 py-1.5 text-xs font-medium text-text-primary hover:border-accent hover:text-accent transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-border-color bg-card-bg p-8 flex items-center justify-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm text-text-secondary">Analyzing your request...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Report result */}
      {report && !loading && (
        <div className="rounded-xl border border-border-color bg-card-bg p-5">
          <ReportBuilderView
            report={report}
            chartType={chartType}
            availableCharts={report.available_charts}
            onChartTypeChange={setChartType}
          />
        </div>
      )}
    </div>
  );
}
