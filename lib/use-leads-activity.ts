'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface LeadsActivityPoint {
  date: string;
  count: number;
}

export function useLeadsActivity(days: number = 30) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['leads-activity', days],
    queryFn: ({ signal }) =>
      apiFetch<{ series: LeadsActivityPoint[] }>(`/leads/stats/over_time?days=${days}`, {
        method: 'GET',
        signal,
      }).then((res) => (Array.isArray(res.series) ? res.series : [])),
  });

  return {
    data: data ?? [],
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to load activity') : null,
  };
}
