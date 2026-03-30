import { apiFetch } from '@/lib/api-client';
import type { DatasheetReport } from './reports';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportSpec {
  data_source: 'datasheet' | 'leads' | 'work';
  model_id?: number | null;
  aggregation: string;
  group_by?: string | null;
  numeric_field?: string | null;
  time_bucket?: string | null;
  date_range?: { start: string; end: string } | null;
  filters: Array<{ field: string; op: string; value: unknown }>;
  suggested_chart: string;
  title: string;
  description?: string | null;
}

export interface ReportBuilderResponse {
  spec: ReportSpec;
  title: string;
  description?: string | null;
  suggested_chart: string;
  available_charts: string[];
  total_records: number;
  over_time?: Array<{ date: string; count: number }> | null;
  by_field?: Record<string, Array<{ value: string; count: number }>> | null;
  field_summaries?: Record<string, { count: number; sum: number; avg: number; min: number; max: number }> | null;
}

export interface DataSourceField {
  name: string;
  display_name: string;
  field_type: string;
}

export interface DataSourceInfo {
  key: string;
  display_name: string;
  model_id?: number | null;
  fields: DataSourceField[];
}

export interface ReportBuilderContext {
  datasheets: DataSourceInfo[];
  builtin_models: DataSourceInfo[];
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function buildReport(
  prompt: string,
  dateRangeStart?: string,
  dateRangeEnd?: string,
): Promise<ReportBuilderResponse> {
  return apiFetch<ReportBuilderResponse>('/reports/builder', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({
      prompt,
      date_range_start: dateRangeStart || null,
      date_range_end: dateRangeEnd || null,
    }),
  });
}

export async function getReportBuilderContext(): Promise<ReportBuilderContext> {
  return apiFetch<ReportBuilderContext>('/reports/builder/context', {
    method: 'GET',
    auth: true,
  });
}
