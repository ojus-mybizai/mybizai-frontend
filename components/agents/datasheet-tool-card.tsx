'use client';

import { useState } from 'react';
import type { DataSheetToolOut } from '@/services/datasheet-tools';
import { ConfirmModal } from '@/features/data-sheet/components/confirm-modal';

const OPERATION_STYLES: Record<string, string> = {
  search: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  create: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  update: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

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
  const op = tool.config.operation?.toLowerCase() ?? 'search';
  const badgeClass = OPERATION_STYLES[op] ?? OPERATION_STYLES.search;

  const instruction = tool.description ?? tool.config.trigger_instruction ?? '';
  const readCount = tool.config.allowed_read_fields?.length ?? 0;
  const filterCount = tool.config.allowed_filter_fields?.length ?? 0;
  const writeCount = tool.config.allowed_write_fields?.length ?? 0;
  const maxResults = tool.config.max_results ?? 25;
  const searchMode = (tool.config as { search_mode?: string }).search_mode ?? 'structured';

  const fieldSummary =
    op === 'search'
      ? `${searchMode === 'semantic' ? 'Semantic' : 'Structured'} · ${readCount} readable · ${filterCount} filterable · Max ${maxResults} results`
      : `${writeCount} writable · ${readCount} readable`;

  const displayName = modelDisplayName ?? tool.name.replace(/^ds_tool_/, '').replace(/_/g, ' ');

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
      <div className="rounded-xl border border-border-color bg-card-bg px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}
              >
                {op.charAt(0).toUpperCase() + op.slice(1)}
              </span>
              <span className="text-sm font-semibold text-text-primary">{displayName}</span>
            </div>
            {instruction && (
              <p className="mt-1 truncate text-xs text-text-secondary" title={instruction}>
                &ldquo;{instruction}&rdquo;
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-text-secondary">{fieldSummary}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => !disabled && onToggle(tool.id, !enabled)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
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
                className="rounded p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary disabled:opacity-50"
                title="Edit"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={disabled}
                className="rounded p-1.5 text-text-secondary hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 disabled:opacity-50"
                title="Delete"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {enabled && onRuleTextChange && (
          <div className="mt-3">
            <label className="text-[11px] font-medium text-text-secondary">
              Tool rule (optional) — use Save below to apply
            </label>
            <textarea
              value={ruleText}
              disabled={disabled}
              onChange={(e) => onRuleTextChange(tool.id, e.target.value)}
              rows={2}
              placeholder="e.g. Only use for product inquiries."
              className="mt-1 w-full rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
            />
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Data Sheet Tool"
          message={`Remove "${displayName}"? This tool will be disabled and unlinked from agents. You can create a new one later.`}
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
