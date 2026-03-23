import { apiFetch } from '@/lib/api-client';

export type CallDisposition =
  | 'answered'
  | 'no_answer'
  | 'busy'
  | 'voicemail'
  | 'callback_requested'
  | 'wrong_number';

export interface CallLogCreate {
  lead_id: number;
  work_id?: number;
  phone_number?: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  disposition: CallDisposition;
  notes?: string;
}

export interface CallLog {
  id: number;
  business_id: number;
  lead_id: number;
  lead_name: string | null;
  caller_user_id: number | null;
  caller_name: string | null;
  work_id: number | null;
  phone_number: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  disposition: CallDisposition;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CallLogListResponse {
  items: CallLog[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface CallStats {
  total_calls: number;
  by_disposition: Record<string, number>;
  avg_duration_seconds: number | null;
  calls_today: number;
  calls_this_week: number;
}

export async function createCallLog(data: CallLogCreate): Promise<CallLog> {
  return apiFetch<CallLog>('/call-logs/', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function listCallLogs(params: Record<string, string | number | undefined> = {}): Promise<CallLogListResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) searchParams.append(key, String(value));
  });
  const qs = searchParams.toString();
  return apiFetch<CallLogListResponse>(`/call-logs/${qs ? `?${qs}` : ''}`, { method: 'GET', auth: true });
}

export async function getCallStats(callerUserId?: number): Promise<CallStats> {
  const qs = callerUserId ? `?caller_user_id=${callerUserId}` : '';
  return apiFetch<CallStats>(`/call-logs/stats${qs}`, { method: 'GET', auth: true });
}

export async function getLeadCallHistory(leadId: number): Promise<CallLogListResponse> {
  return apiFetch<CallLogListResponse>(`/call-logs/lead/${leadId}`, { method: 'GET', auth: true });
}
