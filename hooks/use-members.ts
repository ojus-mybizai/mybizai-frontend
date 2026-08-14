'use client';

import { useQuery } from '@tanstack/react-query';
import { memberKeys } from '@/lib/tasks/keys';
import { getMe, listMembers } from '@/services/members';

export function useMembers() {
  return useQuery({
    queryKey: memberKeys.all,
    queryFn: () => listMembers({ assignable_only: true }),
    staleTime: 60_000,
  });
}

export function useMe() {
  return useQuery({
    queryKey: memberKeys.me(),
    queryFn: () => getMe(),
    staleTime: 5 * 60_000,
  });
}
