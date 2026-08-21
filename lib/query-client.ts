import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient instance with sensible defaults for MyBizAI.
 *
 * staleTime  – how long data is considered fresh (no background refetch).
 * gcTime     – how long unused cache entries are kept in memory.
 * retry      – only retry once on failure (API errors are usually fatal).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 2 minutes default freshness – prevents refetch on every remount
      staleTime: 2 * 60 * 1000,
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Only retry once; our API errors are usually auth/4xx which won't resolve on retry
      retry: 1,
      // Don't refetch when the window regains focus (reduces surprise traffic)
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Query key factory — ensures consistent keys across all hooks
export const queryKeys = {
  agents: () => ['agents'] as const,
  agent: (id: number) => ['agents', id] as const,
  employees: () => ['employees'] as const,
  employee: (id: number) => ['employees', id] as const,
  members: () => ['members'] as const,
  leadStats: () => ['lead-stats'] as const,
  datasheetModels: () => ['datasheet-models'] as const,
  channels: () => ['channels'] as const,
  tools: () => ['tools'] as const,
  agentAnalytics: (params: Record<string, unknown>) => ['agent-analytics', params] as const,
  dashboardStats: (lmsEnabled: boolean) => ['dashboard-stats', lmsEnabled] as const,
  conversations: (params?: Record<string, unknown>) => ['conversations', params] as const,
  // Internal agent chat (P3b)
  internalAgents: () => ['internal-chat', 'agents'] as const,
  internalSessions: (agentId: number) => ['internal-chat', 'sessions', agentId] as const,
  internalSaved: (agentId: number) => ['internal-chat', 'saved', agentId] as const,
  internalModels: () => ['internal-chat', 'models'] as const,
  internalCommands: (agentId: number) => ['internal-chat', 'commands', agentId] as const,
  agentMemory: () => ['agent-memory'] as const,
};
