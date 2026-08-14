'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { templateKeys } from '@/lib/tasks/keys';
import {
  listTaskTemplates,
  getTaskTemplate,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
  type TaskTemplate,
  type TaskTemplateCreatePayload,
  type TaskTemplateUpdatePayload,
} from '@/services/taskTemplates';

export function useTaskTemplates(activeOnly = true) {
  return useQuery<TaskTemplate[]>({
    queryKey: templateKeys.list(activeOnly),
    queryFn: () => listTaskTemplates(activeOnly),
    staleTime: 60_000,
  });
}

export function useTaskTemplate(id: number | null) {
  return useQuery({
    queryKey: id ? templateKeys.detail(id) : ['templates', 'detail', 'nil'],
    queryFn: () => getTaskTemplate(id as number),
    enabled: id != null,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskTemplateCreatePayload) => createTaskTemplate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TaskTemplateUpdatePayload }) =>
      updateTaskTemplate(id, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: templateKeys.all });
      qc.setQueryData(templateKeys.detail(data.id), data);
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTaskTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}
