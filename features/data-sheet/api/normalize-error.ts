import type { ApiError } from '@/lib/api-client';
import type { BackendValidationError } from './types';
import type { DeleteImpact, DeleteImpactGroup } from '@/services/dynamic-data';

export interface ReferencingField {
  model_id: number;
  model_name: string;
  field_id: number;
  field_name: string;
}

export interface NormalizedApiError {
  message: string;
  status?: number;
  details?: unknown;
  linked_tool_names?: string[];
  /**
   * When the backend refuses a delete because the record is still referenced
   * by relations (400 with {detail: {message, impact}}), this field is set so
   * callers can render a rich UI.
   */
  delete_impact?: DeleteImpact;
  /**
   * When the backend refuses to delete a *data sheet* because other sheets have
   * relation columns pointing at it (400 with {detail: {referencing_fields,
   * can_detach}}), these let the UI list the offending sheets/columns and offer
   * a "detach links & delete" action.
   */
  referencing_fields?: ReferencingField[];
  can_detach?: boolean;
}

function formatDeleteImpactMessage(impact: DeleteImpact): string {
  const groups: DeleteImpactGroup[] = impact.by_source_model ?? [];
  const total = impact.total ?? impact.references.length;

  if (groups.length === 0) {
    return `Can't delete — this record is linked from ${total} other record${total === 1 ? '' : 's'}. Remove those links first.`;
  }

  const lines: string[] = [
    `Can't delete — this record is still linked from ${total} other record${total === 1 ? '' : 's'}:`,
  ];

  for (const g of groups) {
    const countLabel = `${g.count} ${g.count === 1 ? 'row' : 'rows'}`;
    const samples =
      g.sample_labels.length > 0
        ? ` (${g.sample_labels.slice(0, 3).join(', ')}${
            g.count > g.sample_labels.length ? '…' : ''
          })`
        : '';
    lines.push(
      `  • ${countLabel} in "${g.source_model_name}" via field "${g.field_display_name}"${samples}`,
    );
  }

  lines.push('');
  lines.push('Open those records and clear the link field, then try again.');
  return lines.join('\n');
}

export function normalizeApiError(e: unknown): NormalizedApiError {
  const err = e as ApiError & { data?: BackendValidationError };
  let message = err?.message ?? 'Request failed';
  let details: unknown = err?.data;
  let linked_tool_names: string[] | undefined;
  let delete_impact: DeleteImpact | undefined;
  let referencing_fields: ReferencingField[] | undefined;
  let can_detach: boolean | undefined;

  if (err?.data && typeof err.data === 'object') {
    const d = err.data as BackendValidationError;

    if (typeof d.detail === 'string') {
      message = d.detail;
    } else if (d.detail && typeof d.detail === 'object') {
      const detail = d.detail as {
        message?: string;
        errors?: Array<{ field?: string; display_name?: string; error?: string; message?: string }>;
        linked_tool_names?: string[];
        impact?: DeleteImpact;
        referencing_fields?: ReferencingField[];
        referencing_models?: string[];
        can_detach?: boolean;
      };

      // Special case: data-sheet delete blocked by relation columns on other sheets.
      if (Array.isArray(detail.referencing_fields)) {
        referencing_fields = detail.referencing_fields;
        can_detach = detail.can_detach === true;
      }

      // Special case: delete-impact 400 (record referenced by relations)
      if (detail.impact && typeof detail.impact === 'object' && detail.impact.blocked) {
        delete_impact = detail.impact as DeleteImpact;
        message = formatDeleteImpactMessage(delete_impact);
        details = delete_impact;
      }
      // Field-level validation errors
      else if (Array.isArray(detail.errors) && detail.errors.length > 0) {
        details = detail.errors;
        const fieldMessages = detail.errors
          .map((fe) => {
            if (fe.message) return fe.message;
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
      }
      // Plain top-level message
      else if (typeof detail.message === 'string') {
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
    delete_impact,
    referencing_fields,
    can_detach,
  };
}
