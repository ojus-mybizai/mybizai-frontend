'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import type { ReactNode } from 'react';

/**
 * Wraps the app with TanStack QueryClient so all pages can use
 * useQuery / useMutation hooks with automatic caching and deduplication.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
