import type { ApiError } from '@/lib/api-client';
import type { BackendValidationError } from './types';

export interface NormalizedApiError {
  message: string;
  status?: number;
  details?: unknown;
  linked_tool_names?: string[];
}

export function normalizeApiError(e: unknown): NormalizedApiError {
  const err = e as ApiError & { data?: BackendValidationError };
  let message = err?.message ?? 'Request failed';
  let details: unknown = err?.data;
  let linked_tool_names: string[] | undefined;

  if (err?.data && typeof err.data === 'object') {
    const d = err.data as BackendValidationError;
    if (typeof d.detail === 'string') message = d.detail;
    else if (d.detail && typeof d.detail === 'object' && typeof (d.detail as { message?: string }).message === 'string')
      message = (d.detail as { message: string }).message;
    if (d.detail && typeof d.detail === 'object' && Array.isArray((d.detail as { errors?: unknown }).errors))
      details = (d.detail as { errors: unknown }).errors;
    if (d.detail && typeof d.detail === 'object' && Array.isArray((d.detail as { linked_tool_names?: string[] }).linked_tool_names))
      linked_tool_names = (d.detail as { linked_tool_names: string[] }).linked_tool_names;
  }

  return {
    message,
    status: typeof err?.status === 'number' ? err.status : undefined,
    details,
    linked_tool_names,
  };
}
