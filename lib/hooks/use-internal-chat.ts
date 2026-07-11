'use client';

/**
 * P3b — TanStack Query hooks for the internal-chat cacheable lists (agents,
 * sessions, saved views). The live thread itself is NOT here — that's the
 * Zustand store (lib/internal-chat-store.ts).
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { listInternalAgents, listSessions, listSaved, listModels, listCommands } from '@/services/internal-chat';

export function useInternalAgents() {
  return useQuery({
    queryKey: queryKeys.internalAgents(),
    queryFn: () => listInternalAgents(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSessions(agentId: number | null) {
  return useQuery({
    queryKey: queryKeys.internalSessions(agentId ?? 0),
    queryFn: () => listSessions(agentId as number),
    enabled: agentId != null,
    staleTime: 30 * 1000,
  });
}

export function useSavedViews(agentId: number | null) {
  return useQuery({
    queryKey: queryKeys.internalSaved(agentId ?? 0),
    queryFn: () => listSaved(agentId as number),
    enabled: agentId != null,
    staleTime: 30 * 1000,
  });
}

export function useModels(enabled = true) {
  return useQuery({
    queryKey: queryKeys.internalModels(),
    queryFn: () => listModels(),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCommands(agentId: number | null) {
  return useQuery({
    queryKey: queryKeys.internalCommands(agentId ?? 0),
    queryFn: () => listCommands(agentId as number),
    enabled: agentId != null,
    staleTime: 60 * 1000,
  });
}
