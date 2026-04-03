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

    if (typeof d.detail === 'string') {
      message = d.detail;
    } else if (d.detail && typeof d.detail === 'object') {
      const detail = d.detail as { message?: string; errors?: Array<{ field?: string; display_name?: string; error?: string; message?: string }>; linked_tool_names?: string[] };

      // Extract field-level errors with human-readable messages
      if (Array.isArray(detail.errors) && detail.errors.length > 0) {
        details = detail.errors;
        // Build user-friendly message from field errors
        const fieldMessages = detail.errors
          .map((fe) => {
            // Prefer the backend's human-readable message
            if (fe.message) return fe.message;
            // Fallback: build from display_name + error code
            const label = fe.display_name || fe.field || 'Field';
            const code = fe.error || 'invalid';
            if (code === 'required') return `"${label}" is required.`;
            if (code === 'not_unique') return `"${label}" must be unique — this value already exists.`;
            if (code === 'invalid_relation') return `"${label}": could not find the linked record.`;
            return `"${label}": ${code}`;
          })
          .filter(Boolean);
        if (fieldMessages.length > 0) {
          message = fieldMessages.join('\n');
        }
      } else if (typeof detail.message === 'string') {
        // No field errors — use the top-level detail message
        message = detail.message;
      }

      if (Array.isArray(detail.linked_tool_names)) {
        linked_tool_names = detail.linked_tool_names;
      }
    }
  }

  return {
    message,
    status: typeof err?.status === 'number' ? err.status : undefined,
    details,
    linked_tool_names,
  };
}
