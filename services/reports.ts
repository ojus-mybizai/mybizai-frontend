import { apiFetch } from '@/lib/api-client';

export interface LeadsReport {
  total_leads: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_source: Record<string, number>;
  over_time: { date: string; count: number }[];
}

export interface WorkReport {
  total: number;
  by_status: Record<string, number>;
  by_type: { work_type_id: number; work_type_name: string; count: number }[];
  by_employee: { user_id: number; name: string; count: number }[];
}

export interface TeamReport {
  total_team: number;
  total_leads_assigned: number;
  total_work_assigned: number;
}

export interface ReportsDashboard {
  leads: LeadsReport;
  work: WorkReport;
  team: TeamReport;
}

export async function getReportsDashboard(days: number = 30): Promise<ReportsDashboard> {
  const params = new URLSearchParams({ days: String(days) });
  return apiFetch<ReportsDashboard>(`/reports/dashboard?${params.toString()}`, {
    method: 'GET',
    auth: true,
  });
}

/** Datasheet report: aggregates for one dynamic model (data sheet). */
export interface DatasheetReportSeriesPoint {
  date: string;
  count: number;
}

export interface DatasheetReportFieldGroup {
  value: string;
  count: number;
}

export interface DatasheetReportFieldSummary {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

export interface DatasheetReport {
  dynamic_model_id: number;
  model_display_name: string;
  total_records: number;
  over_time: DatasheetReportSeriesPoint[];
  by_field: Record<string, DatasheetReportFieldGroup[]>;
  field_summaries?: Record<string, DatasheetReportFieldSummary>;
}

/** Suggested report layout section (from backend report-layout). */
export interface ReportLayoutSection {
  type: 'time_series' | 'pie' | 'bar' | 'summary';
  field: string;
  title: string;
}

export interface ReportLayout {
  dynamic_model_id: number;
  sections: ReportLayoutSection[];
}

export async function getReportLayout(modelId: number): Promise<ReportLayout> {
  return apiFetch<ReportLayout>(
    `/dynamic-data/models/${modelId}/report-layout`,
    { method: 'GET', auth: true }
  );
}

export async function getDatasheetReport(
  modelId: number,
  days: number = 30,
  groupBy?: string | null
): Promise<DatasheetReport> {
  const params = new URLSearchParams({ days: String(days) });
  if (groupBy != null && groupBy !== '') params.set('group_by', groupBy);
  return apiFetch<DatasheetReport>(
    `/dynamic-data/models/${modelId}/report?${params.toString()}`,
    { method: 'GET', auth: true }
  );
}

/** AI-generated report (stored, on-demand generation). */
export interface DatasheetAIReportResponse {
  layout: ReportLayout;
  report: DatasheetReport;
  generated_at: string;
}

export async function getAIDatasheetReport(modelId: number): Promise<DatasheetAIReportResponse | null> {
  try {
    return await apiFetch<DatasheetAIReportResponse>(
      `/dynamic-data/models/${modelId}/ai-report`,
      { method: 'GET', auth: true }
    );
  } catch {
    return null;
  }
}

export async function generateAIDatasheetReport(
  modelId: number,
  days: number = 30
): Promise<DatasheetAIReportResponse> {
  const params = new URLSearchParams({ days: String(days) });
  return apiFetch<DatasheetAIReportResponse>(
    `/dynamic-data/models/${modelId}/ai-report/generate?${params.toString()}`,
    { method: 'POST', auth: true }
  );
}
