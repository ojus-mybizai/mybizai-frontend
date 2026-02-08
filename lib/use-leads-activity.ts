'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export interface LeadsActivityPoint {
  date: string;
  count: number;
}

interface LeadsActivityState {
  data: LeadsActivityPoint[];
  loading: boolean;
  error: string | null;
}

export function useLeadsActivity(days: number = 30): LeadsActivityState {
  const [data, setData] = useState<LeadsActivityPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch<{ series: LeadsActivityPoint[] }>(`/leads/stats/over_time?days=${days}`, {
      method: 'GET',
    })
      .then((res) => {
        if (cancelled) return;
        setData(Array.isArray(res.series) ? res.series : []);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load activity');
        setData([]);
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

