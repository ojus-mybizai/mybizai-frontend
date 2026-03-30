'use client';

import { useEffect, useState } from 'react';

/**
 * Debounces a value by the given delay (ms).
 * Useful for search inputs and filters to avoid excessive API calls.
 *
 * Usage:
 *   const [search, setSearch] = useState('');
 *   const debouncedSearch = useDebounce(search, 300);
 *   // use debouncedSearch in your fetch/filter logic
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
