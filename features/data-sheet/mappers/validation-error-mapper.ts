/**
 * Maps backend validation payloads to UI annotations for inline cell rendering and bulk result summaries.
 * Backend may return: { detail: { message: "...", errors: [{ field: "name", error: "required" }] } }
 */

export interface CellErrorAnnotation {
  rowKey: string;
  field: string;
  error: string;
}

export interface MappedValidation {
  message: string;
  cellErrors: CellErrorAnnotation[];
  byField: Record<string, string>;
}

/**
 * Map API error (e.g. 422) to structured validation for grid/cell display.
 * rowKey can be record_id or a temporary client key for new rows.
 */
export function mapBackendValidationToCellErrors(
  payload: unknown,
  rowKey: string = 'current'
): MappedValidation {
  const result: MappedValidation = {
    message: 'Validation failed',
    cellErrors: [],
    byField: {},
  };

  if (!payload || typeof payload !== 'object') return result;

  const obj = payload as Record<string, unknown>;
  const detail = obj.detail;

  if (typeof detail === 'string') {
    result.message = detail;
    return result;
  }

  if (detail && typeof detail === 'object') {
    const d = detail as Record<string, unknown>;
    if (typeof d.message === 'string') result.message = d.message;
    const errors = d.errors;
    if (Array.isArray(errors)) {
      for (const item of errors) {
        if (item && typeof item === 'object' && 'field' in item) {
          const field = String((item as { field: string }).field);
          const error = String((item as { error?: string }).error ?? 'invalid');
          result.cellErrors.push({ rowKey, field, error });
          result.byField[field] = error;
        }
      }
    }
  }

  return result;
}

/**
 * Map batch upsert result item to cell errors when ok: false.
 */
export function mapBatchResultToCellErrors(
  resultItem: { ok?: boolean; error?: string; record_id?: number },
  recordId: number | null
): CellErrorAnnotation[] {
  if (resultItem.ok !== false || !resultItem.error) return [];
  const rowKey = recordId != null ? String(recordId) : 'new';
  return [{ rowKey, field: '_row', error: resultItem.error }];
}
