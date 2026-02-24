/**
 * Re-export and extend types from the shared dynamic-data service.
 * Used by feature module only; app can still use @/services/dynamic-data types.
 */
export type {
  DynamicModel,
  DynamicModelCreate,
  DynamicModelUpdate,
  DynamicField,
  DynamicFieldCreate,
  DynamicFieldUpdate,
  DynamicRecord,
  QueryRequest,
  QueryResponse,
  BatchUpsertItem,
  BatchUpsertRequest,
  BatchUpsertResult,
  DynamicImportOut,
  DynamicViewOut,
  DeleteImpact,
} from '@/services/dynamic-data';

export interface NormalizedResult<T> {
  data: T;
  error: null;
}

export interface NormalizedError {
  data: null;
  error: {
    message: string;
    status?: number;
    details?: unknown;
  };
}

export type ApiResult<T> = NormalizedResult<T> | NormalizedError;

/** Backend validation error shape (e.g. 422 with { detail: { errors: [...] } }) */
export interface BackendValidationError {
  message?: string;
  detail?:
    | string
    | { message?: string; errors?: Array<{ field: string; error?: string }> };
}
