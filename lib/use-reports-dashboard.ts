'use client';

import { useQuery } from '@tanstack/react-query';
import { getReportsDashboard, type ReportsDashboard } from '@/services/reports';

export function useReportsDashboard(days: number = 30, enabled: boolean = true) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports-dashboard', days],
    queryFn: () => getReportsDashboard(days),
    enabled,
  });

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to load dashboard reports') : null,
  };
}
