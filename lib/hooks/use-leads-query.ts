'use client';

/**
 * React Query hooks for leads-related data.
 *
 * Provides automatic caching and deduplication for lead fields and pipeline
 * stages — data that rarely changes and is needed by multiple components.
 */

import { useQuery } from '@tanstack/react-query';
import { listLeadFields } from '@/services/lead-fields';
import { listPipelineStages } from '@/services/customers';
import { queryKeys } from '@/lib/query-client';

/**
 * Lead fields configuration — stale after 5 minutes.
 * Used by leads page, lead detail, filters, and import mapping.
 */
export function useLeadFields(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.leadFields(),
    queryFn: () => listLeadFields(),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
}

/**
 * Pipeline stages — stale after 5 minutes.
 * Used by leads page pipeline view and Kanban board.
 */
export function usePipelineStages(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.pipelineStages(),
    queryFn: () => listPipelineStages(),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
}
