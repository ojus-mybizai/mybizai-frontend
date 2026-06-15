'use client';

/**
 * Shared React Query hooks for reference data.
 *
 * Reference data = data that changes infrequently and is needed by multiple
 * components on the same page (agents list, employees list, lead templates).
 *
 * Using React Query here gives us:
 *  - Automatic deduplication: multiple components calling the same hook
 *    during the same render cycle share a single network request.
 *  - Configurable staleness: data is considered fresh for `staleTime` ms,
 *    preventing refetch on every component mount.
 *  - In-memory cache across navigations (within the same React tree lifetime).
 */

import { useQuery } from '@tanstack/react-query';
import { listAgents } from '@/services/agents';
import { listEmployees } from '@/services/employees';
import { getLeadStats, type LeadStats } from '@/services/customers';
import { listModels } from '@/services/dynamic-data';
import { listChannels } from '@/services/channels';
import { queryKeys } from '@/lib/query-client';

// ---------------------------------------------------------------------------
// Agents list — stale after 5 minutes
// Multiple pages use this: customers/[id], agents/, dashboard widget, etc.
// ---------------------------------------------------------------------------
export function useAgentList(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.agents(),
    queryFn: () => listAgents(),
    staleTime: 5 * 60 * 1000,  // 5 minutes
    enabled: options?.enabled !== false,
  });
}

// ---------------------------------------------------------------------------
// Employees list — stale after 10 minutes
// Changes only when HR updates happen; safe to cache aggressively.
// ---------------------------------------------------------------------------
export function useEmployeeList() {
  return useQuery({
    queryKey: queryKeys.employees(),
    queryFn: () => listEmployees(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ---------------------------------------------------------------------------
// Datasheet models — stale after 5 minutes
// Used on dashboard chat view. Cached so switching views doesn't re-fetch.
// ---------------------------------------------------------------------------
export function useDatasheetModels(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.datasheetModels(),
    queryFn: () => listModels(),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled !== false,
  });
}

// ---------------------------------------------------------------------------
// Lead stats — stale after 2 minutes
// Used by dashboard metrics tab, leads page, and analytics dashboard.
// Sharing via React Query prevents duplicate /lead-stats calls across pages.
// ---------------------------------------------------------------------------
export function useLeadStats(options?: { enabled?: boolean }) {
  return useQuery<LeadStats>({
    queryKey: queryKeys.leadStats(),
    queryFn: () => getLeadStats(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: options?.enabled !== false,
  });
}

// ---------------------------------------------------------------------------
// Channels list — stale after 5 minutes
// ---------------------------------------------------------------------------
export function useChannelList() {
  return useQuery({
    queryKey: queryKeys.channels(),
    queryFn: () => listChannels(),
    staleTime: 5 * 60 * 1000,
  });
}
