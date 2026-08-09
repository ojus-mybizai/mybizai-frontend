'use client';

/**
 * useDatasheetSchema — schema-aware data hook (AUTOMATION_REDESIGN_SPEC F2).
 *
 * Fetches a datasheet's field schema (GET /models/{id}/fields) so the shared
 * <ConditionBuilder> and the datasheet automation drawer can offer real
 * columns/operators/value-inputs instead of a raw text box.
 */

import { useQuery } from '@tanstack/react-query';
import { listFields, type DynamicField } from '@/services/dynamic-data';

export function useDatasheetSchema(modelId?: number | string | null) {
  return useQuery<DynamicField[]>({
    queryKey: ['datasheet-schema', modelId],
    queryFn: () => listFields(modelId!),
    enabled: modelId != null && modelId !== '',
    staleTime: 60_000,
  });
}
