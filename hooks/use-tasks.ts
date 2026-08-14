'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '@/lib/tasks/keys';
import {
  listTasks,
  getTask,
  completeTask,
  cancelTask,
  createTask,
  reassignTask,
  type Task,
  type TaskCreatePayload,
} from '@/services/tasks';

export function useMemberTasks(memberId: number | null) {
  return useQuery({
    queryKey: memberId ? taskKeys.member(memberId) : ['tasks', 'member', 'nil'],
    queryFn: () => listTasks({ assignee_member_id: memberId as number }),
    enabled: memberId != null,
    staleTime: 30_000,
  });
}

export function useTask(id: number | null) {
  return useQuery({
    queryKey: id ? taskKeys.detail(id) : ['tasks', 'detail', 'nil'],
    queryFn: () => getTask(id as number),
    enabled: id != null,
  });
}

export function useCompleteTask(memberId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => completeTask(id),
    onMutate: async (id) => {
      if (memberId == null) return;
      const key = taskKeys.member(memberId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Task[]>(key);
      qc.setQueryData<Task[]>(key, (old) =>
        (old ?? []).map((t) =>
          t.id === id ? { ...t, status: 'done', is_overdue: false } : t,
        ),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (memberId != null && ctx?.prev) {
        qc.setQueryData(taskKeys.member(memberId), ctx.prev);
      }
    },
    onSettled: () => {
      if (memberId != null) {
        qc.invalidateQueries({ queryKey: taskKeys.member(memberId) });
      }
    },
  });
}

export function useCancelTask(memberId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => cancelTask(id),
    onSettled: () => {
      if (memberId != null) {
        qc.invalidateQueries({ queryKey: taskKeys.member(memberId) });
      }
    },
  });
}

export function useReassignTask(memberId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assigneeMemberId }: { id: number; assigneeMemberId: number }) =>
      reassignTask(id, assigneeMemberId),
    onSettled: (_res, _err, vars) => {
      if (memberId != null) qc.invalidateQueries({ queryKey: taskKeys.member(memberId) });
      qc.invalidateQueries({ queryKey: taskKeys.member(vars.assigneeMemberId) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.id) });
    },
  });
}

export function useCreateTask(memberId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskCreatePayload) => createTask(payload),
    onSuccess: () => {
      if (memberId != null) {
        qc.invalidateQueries({ queryKey: taskKeys.member(memberId) });
      }
    },
  });
}
