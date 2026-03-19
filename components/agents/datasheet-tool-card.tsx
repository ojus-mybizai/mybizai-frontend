'use client';

import { useState } from 'react';
import type { DataSheetToolOut, DataSheetToolOperation } from '@/services/datasheet-tools';
import { ConfirmModal } from '@/features/data-sheet/components/confirm-modal';

// ─── Per-operation display metadata ──────────────────────────────────────────

const OP_META: Record<
  DataSheetToolOperation,
  { label: string; icon: string; badge: string }
> = {
  search:   { label: 'Search',    icon: '🔍', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  create:   { label: 'Create',    icon: '➕', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  bulk_add: { label: 'Bulk Add',  icon: '📋', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300' },
  update:   { label: 'Update',    icon: '✏️', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  delete:   { label: 'Delete',    icon: '🗑️', badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
};

// Resolve effective operations list — prefer allowed_operations, fall back to legacy operation field
function resolveOps(tool: DataSheetToolOut): DataSheetToolOperation[] {
  const ops = tool.config.allowed_operations ?? [];
  if (ops.length > 0) return ops;
  if (tool.config.operation) return [tool.config.operation as DataSheetToolOperation];
  return ['search'];
}

export interface DataSheetToolCardProps {
  tool: DataSheetToolOut;
  modelDisplayName?: string;
  enabled: boolean;
  onToggle: (toolId: number, next: boolean) => void;
  ruleText?: string;
  onRuleTextChange?: (toolId: number, next: string) => void;
  onEdit?: (tool: DataSheetToolOut) => void;
  onDelete?: (tool: DataSheetToolOut) => void;
  disabled?: boolean;
}

export function DataSheetToolCard({
  tool,
  modelDisplayName,
  enabled,
  onToggle,
  ruleText = '',
  onRuleTextChange,
  onEdit,
  onDelete,
  disabled = false,
}: DataSheetToolCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ops = resolveOps(tool);
  const hasSearch   = ops.includes('search');
  const hasWrite    = ops.some((o) => ['create', 'update', 'bulk_add'].includes(o));

  const instruction   = tool.description ?? tool.config.trigger_instruction ?? '';
  const readCount     = tool.config.allowed_read_fields?.length ?? 0;
  const filterCount   = tool.config.allowed_filter_fields?.length ?? 0;
  const writeCount    = tool.config.allowed_write_fields?.length ?? 0;
  const maxResults    = tool.config.max_results ?? 25;
  const searchMode    = tool.config.search_mode ?? 'structured';

  // Build field-summary line adapted to selected ops
  const fieldParts: string[] = [];
  if (hasSearch)  fieldParts.push(`${filterCount} filterable`);
  if (hasWrite)   fieldParts.push(`${writeCount} writable`);
  fieldParts.push(`${readCount} readable`);
  if (hasSearch)  fieldParts.push(`${searchMode === 'semantic' ? 'Semantic' : 'Structured'} · max ${maxResults}`);
  const fieldSummary = fieldParts.join(' · ');

  const displayName = modelDisplayName ?? tool.name.replace(/^ds_/, '').replace(/_[a-z0-9]{6}$/, '').replace(/_/g, ' ');

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(tool);
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-border-color bg-bg-primary/50 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Datasheet name + operation badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              {ops.map((op) => {
                const meta = OP_META[op] ?? OP_META.search;
                return (
                  <span
                    key={op}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}
                  >
                    {meta.icon} {meta.label}
                  </span>
                );
              })}
              <span className="text-sm font-semibold text-text-primary capitalize">{displayName}</span>
            </div>

            {/* Trigger instruction preview */}
            {instruction && (
              <p
                className="mt-1.5 truncate text-xs text-text-secondary leading-relaxed"
                title={instruction}
              >
                &ldquo;{instruction}&rdquo;
              </p>
            )}

            {/* Field access summary */}
            <p className="mt-0.5 text-[11px] text-text-secondary">{fieldSummary}</p>
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => !disabled && onToggle(tool.id, !enabled)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                enabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-border-color bg-bg-primary text-text-secondary'
              } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-accent'}`}
            >
              {enabled ? 'Enabled' : 'Enable'}
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(tool)}
                disabled={disabled}
                className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary disabled:opacity-50"
                title="Edit"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={disabled}
                className="rounded-lg p-1.5 text-text-secondary hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 disabled:opacity-50"
                title="Delete"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Per-agent rule text editor */}
        {onRuleTextChange && (
          <div className="mt-3.5 border-t border-border-color/60 pt-3">
            <label className="text-[11px] font-medium text-text-secondary">
              When to use (optional) — save below to apply
            </label>
            <textarea
              value={ruleText}
              disabled={disabled}
              onChange={(e) => onRuleTextChange(tool.id, e.target.value)}
              rows={2}
              placeholder="e.g. Only use when the customer asks about property availability."
              className="mt-1.5 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary/80 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
            />
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Data Sheet Tool"
          message={`Remove "${displayName}"? This tool will be disabled and unlinked from all agents.`}
          confirmLabel="Delete"
          variant="danger"
          loading={deleting}
          onConfirm={handleConfirmDelete}
          onClose={() => !deleting && setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
