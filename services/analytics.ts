import { apiFetch } from '@/lib/api-client';

export interface AgentAnalyticsSummary {
  agent_id: number;
  agent_name: string;
  total_conversations: number;
  avg_response_time: number;
  resolution_rate: number;
  avg_sentiment?: number | null;
}

export interface AnalyticsOverviewResponse {
  total_agents: number;
  total_conversations: number;
  active_conversations: number;
  avg_response_time: number;
  resolution_rate: number;
  top_agents: AgentAnalyticsSummary[];
}

export interface ToolUsage {
  tool_name: string;
  count: number;
  avg_duration?: number | null;
}

export interface AgentAnalyticsResponse {
  agent_id: number;
  agent_name: string;
  date: string;
  total_conversations: number;
  active_conversations: number;
  resolved_conversations: number;
  avg_conversation_duration: number;
  avg_messages_per_conversation: number;
  total_messages: number;
  user_messages: number;
  agent_messages: number;
  tool_calls: number;
  avg_response_time: number;
  first_response_time: number;
  resolution_rate: number;
  handoff_rate: number;
  active_users: number;
  returning_users: number;
  new_users: number;
  avg_session_length: number;
  tool_usage: ToolUsage[];
  avg_sentiment?: number | null;
}

export interface AgentsSummaryParams {
  start_date: string;
  end_date: string;
  agent_ids?: number[];
  channel_ids?: number[];
}

export interface AgentAnalyticsParams {
  start_date: string;
  end_date: string;
  group_by?: 'day' | 'week' | 'month';
}

export interface AgentsByAgentParams {
  start_date: string;
  end_date: string;
  agent_ids?: number[];
}

export async function getAgentsSummary(params: AgentsSummaryParams): Promise<AnalyticsOverviewResponse> {
  const q = new URLSearchParams();
  q.set('start_date', params.start_date);
  q.set('end_date', params.end_date);
  if (params.agent_ids?.length) {
    params.agent_ids.forEach((id) => q.append('agent_ids', String(id)));
  }
  if (params.channel_ids?.length) {
    params.channel_ids.forEach((id) => q.append('channel_ids', String(id)));
  }
  return apiFetch<AnalyticsOverviewResponse>(`/analytics/agents/summary?${q.toString()}`, { method: 'GET' });
}

export async function getAgentsByAgentSummary(
  params: AgentsByAgentParams
): Promise<AgentAnalyticsSummary[]> {
  const q = new URLSearchParams();
  q.set('start_date', params.start_date);
  q.set('end_date', params.end_date);
  if (params.agent_ids?.length) {
    params.agent_ids.forEach((id) => q.append('agent_ids', String(id)));
  }
  return apiFetch<AgentAnalyticsSummary[]>(`/analytics/agents/by_agent?${q.toString()}`, {
    method: 'GET',
  });
}

export async function getAgentAnalytics(
  agentId: number | string,
  params: AgentAnalyticsParams
): Promise<AgentAnalyticsResponse[]> {
  const q = new URLSearchParams();
  q.set('start_date', params.start_date);
  q.set('end_date', params.end_date);
  if (params.group_by) q.set('group_by', params.group_by);
  return apiFetch<AgentAnalyticsResponse[]>(
    `/analytics/agents/${agentId}?${q.toString()}`,
    { method: 'GET' }
  );
}
