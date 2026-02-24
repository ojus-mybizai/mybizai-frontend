/**
 * Feature API layer. Re-exports service functions and adds normalized error handling.
 * All dynamic-data calls should go through this module from within the feature.
 */
export * from '@/services/dynamic-data';
export type { ApiResult, NormalizedError, NormalizedResult, BackendValidationError } from './types';
export { normalizeApiError } from './normalize-error';
