import type { ApiError } from '@/lib/api-client';
import type { BackendValidationError } from './types';

export function normalizeApiError(e: unknown): { message: string; status?: number; details?: unknown } {
  const err = e as ApiError & { data?: BackendValidationError };
  let message = err?.message ?? 'Request failed';
  let details: unknown = err?.data;

  if (err?.data && typeof err.data === 'object') {
    const d = err.data as BackendValidationError;
    if (typeof d.detail === 'string') message = d.detail;
    else if (d.detail && typeof d.detail === 'object' && typeof (d.detail as { message?: string }).message === 'string')
      message = (d.detail as { message: string }).message;
    if (d.detail && typeof d.detail === 'object' && Array.isArray((d.detail as { errors?: unknown }).errors))
      details = (d.detail as { errors: unknown }).errors;
  }

  return {
    message,
    status: typeof err?.status === 'number' ? err.status : undefined,
    details,
  };
}
