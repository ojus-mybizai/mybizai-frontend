'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseFetchOptions {
  /** Skip the initial fetch (useful when dependencies aren't ready yet) */
  skip?: boolean;
}

interface UseFetchReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Generic data-fetching hook that replaces the repeated
 * useState + useCallback + useEffect pattern across client components.
 *
 * @param fetcher  Async function that returns data
 * @param deps     Dependency array — refetches when any value changes
 * @param options  { skip } to conditionally disable fetching
 */
export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[],
  options?: UseFetchOptions,
): UseFetchReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options?.skip);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refetch = useCallback(async () => {
    if (options?.skip) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) setData(result);
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'An unexpected error occurred');
        setData(null);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
