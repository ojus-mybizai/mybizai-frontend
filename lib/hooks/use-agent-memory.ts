'use client';

/** P3b — business agent memory list (TanStack Query). Mutations live in the page. */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { listMemory } from '@/services/agent-memory';

export function useAgentMemory() {
  return useQuery({
    queryKey: queryKeys.agentMemory(),
    queryFn: () => listMemory(),
    staleTime: 2 * 60 * 1000,
  });
}
