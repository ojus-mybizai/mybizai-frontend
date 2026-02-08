'use client';

import { useEffect, useState } from 'react';
import { getReportsDashboard, type ReportsDashboard } from '@/services/reports';

interface UseReportsDashboardState {
  data: ReportsDashboard | null;
  loading: boolean;
  error: string | null;
}

export function useReportsDashboard(days: number = 30): UseReportsDashboardState {
  const [data, setData] = useState<ReportsDashboard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getReportsDashboard(days)
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load dashboard reports');
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  return { data, loading, error };
}

