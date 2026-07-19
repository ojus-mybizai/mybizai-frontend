'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Table2,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import {
  queryReverseRecords,
  listFields,
  createLinkedRecord,
  updateRecord,
  deleteRecord,
  type ReverseRelationMeta,
  type ReverseRelationResponse,
  type DynamicField,
} from '@/features/data-sheet/api';
import { DataSheetCell } from '@/components/data-sheet/data-sheet-cell';
import { DatasheetFieldInput } from '@/components/data-sheet/datasheet-field-input';
import { formatApiErrorDetail } from '@/lib/api-client';

// ── Types ───────────────────────────────────────────────────────────

interface ReverseRelationSubTableProps {
  /** The model that owns the parent record (e.g. Leads model) */
  parentModelId: number | string;
  /** The parent record id (e.g. a specific Lead) */
  parentRecordId: number;
  /** Metadata describing the incoming relation */
  reverseRelation: ReverseRelationMeta;
  /** Called after a child record is created */
  onRecordCreated?: () => void;
  /** Called after a child record is deleted */
  onRecordDeleted?: () => void;
  /** Max rows before "Show all" link (default 5) */
  maxVisibleRows?: number;
  /** Compact mode for table-view expand rows */
  compact?: boolean;
  /** Parent record display label (shown in create modal) */
  parentLabel?: string;
}

type ChildRecord = ReverseRelationResponse['items'][number];

// ── Component ───────────────────────────────────────────────────────

export function ReverseRelationSubTable({
  parentModelId,
  parentRecordId,
  reverseRelation,
  onRecordCreated,
  onRecordDeleted,
  maxVisibleRows = 5,
  compact = false,
  parentLabel,
}: ReverseRelationSubTableProps) {
  const router = useRouter();

  // ── State ───────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ChildRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(compact ? maxVisibleRows : 20);

  // FIX #1: Auto-collapse empty sections after first load
  const [collapsed, setCollapsed] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Child model fields (for column headers + create modal)
  const [childFields, setChildFields] = useState<DynamicField[]>([]);
  const [fieldsLoaded, setFieldsLoaded] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createData, setCreateData] = useState<Record<string, unknown>>({});
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Names of required fields left empty on the last submit attempt (for highlight)
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());

  // FIX #3: Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Inline editing
  const [editingCell, setEditingCell] = useState<{
    recordId: number;
    fieldName: string;
  } | null>(null);

  const sourceModelId = reverseRelation.source_model_id;
  const sourceFieldId = reverseRelation.field_id;

  // ── Data fetching ─────────────────────────────────────────────

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await queryReverseRecords(parentModelId, parentRecordId, {
        source_model_id: sourceModelId,
        source_field_id: sourceFieldId,
        page,
        per_page: perPage,
      });
      setItems(resp.items);
      setTotal(resp.total);

      // FIX #1: Auto-collapse empty sections on first load
      if (!hasLoadedOnce) {
        setHasLoadedOnce(true);
        if (resp.total === 0 && compact) {
          setCollapsed(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch reverse records:', err);
    } finally {
      setLoading(false);
    }
  }, [parentModelId, parentRecordId, sourceModelId, sourceFieldId, page, perPage, hasLoadedOnce, compact]);

  const fetchFields = useCallback(async () => {
    if (fieldsLoaded) return;
    try {
      const fields = await listFields(sourceModelId);
      setChildFields(fields);
      setFieldsLoaded(true);
    } catch (err) {
      console.error('Failed to fetch child model fields:', err);
    }
  }, [sourceModelId, fieldsLoaded]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    if (!collapsed || showCreate) {
      fetchFields();
    }
  }, [collapsed, showCreate, fetchFields]);

  // ── Derived ───────────────────────────────────────────────────

  const visibleColumns = useMemo(() => {
    return childFields
      .filter(
        (f) =>
          f.field_type !== 'relation' &&
          f.field_type !== 'image' &&
          f.field_type !== 'file' &&
          f.name !== 'id' &&
          !f.name.startsWith('_')
      )
      .sort((a, b) => a.order_index - b.order_index)
      .slice(0, compact ? 4 : 6);
  }, [childFields, compact]);

  const createFields = useMemo(() => {
    return childFields
      .filter(
        (f) =>
          f.is_editable &&
          f.id !== reverseRelation.field_id
      )
      .sort((a, b) => a.order_index - b.order_index);
  }, [childFields, reverseRelation.field_id]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // ── Handlers ──────────────────────────────────────────────────

  const openCreate = () => {
    setCreateError(null);
    setMissingFields(new Set());
    setShowCreate(true);
  };

  const handleCellSave = async (
    recordId: number,
    fieldName: string,
    value: unknown
  ) => {
    try {
      await updateRecord(sourceModelId, recordId, {
        data: { [fieldName]: value },
        mode: 'merge',
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === recordId
            ? { ...item, data: { ...item.data, [fieldName]: value } }
            : item
        )
      );
    } catch (err) {
      console.error('Failed to update child record:', err);
    }
    setEditingCell(null);
  };

  // FIX #3: Delete with confirmation
  const handleDeleteConfirmed = async (recordId: number) => {
    try {
      await deleteRecord(sourceModelId, recordId);
      setItems((prev) => prev.filter((item) => item.id !== recordId));
      setTotal((prev) => prev - 1);
      onRecordDeleted?.();
    } catch (err) {
      console.error('Failed to delete child record:', err);
    }
    setConfirmDeleteId(null);
  };

  const handleCreate = async () => {
    // Client-side required-field validation — block submit and highlight any
    // required field left empty, so the user gets immediate feedback instead of
    // a silently-swallowed 422 from the backend.
    const missing = createFields.filter(
      (f) => f.is_required && isEmptyValue(createData[f.name])
    );
    if (missing.length > 0) {
      setMissingFields(new Set(missing.map((f) => f.name)));
      setCreateError(
        missing.length === 1
          ? `${missing[0].display_name} is required.`
          : `Please fill in the required fields: ${missing
              .map((f) => f.display_name)
              .join(', ')}.`
      );
      return;
    }

    setMissingFields(new Set());
    setCreateError(null);
    setCreateSaving(true);
    try {
      await createLinkedRecord(
        sourceModelId,
        createData,
        reverseRelation.field_id,
        parentRecordId
      );
      setShowCreate(false);
      setCreateData({});
      await fetchRecords();
      onRecordCreated?.();
    } catch (err) {
      console.error('Failed to create linked record:', err);
      // Surface the backend error (e.g. validation detail) in the modal instead
      // of only logging it to the console.
      setCreateError(formatApiErrorDetail(err));
    } finally {
      setCreateSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────

  const displayName =
    reverseRelation.source_model_display_name ||
    reverseRelation.source_model_name;
  const singularName = displayName.replace(/s$/i, '');

  // FIX #5: Color-code the count badge
  const countBadgeClass =
    total > 0
      ? 'rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent'
      : 'rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-text-muted';

  return (
    <div className={`mb-3 ${compact ? '' : 'rounded-lg border border-border-color overflow-hidden'}`}>
      {/* ── Section header ──────────────────────────────────────── */}
      <div
        className={`flex cursor-pointer items-center justify-between ${
          compact ? 'px-0 py-2' : 'px-4 py-2.5'
        } select-none group ${
          compact ? '' : total > 0 ? 'bg-bg-secondary/20' : 'bg-transparent'
        } hover:bg-bg-secondary/30 transition-colors`}
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-text-primary transition-colors" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-muted group-hover:text-text-primary transition-colors" />
          )}
          {/* FIX #7: Add icon before section name */}
          <Table2 className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">
            {displayName}
          </span>
          <span className={countBadgeClass}>{total}</span>
        </div>

        {/* Add button */}
        <button
          className="flex items-center gap-1 rounded-md bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20 transition-colors opacity-80 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            openCreate();
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add {singularName}</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* ── Collapsed → nothing more ────────────────────────────── */}
      {collapsed ? null : (
        <div className={compact ? '' : 'px-4 pb-3'}>
          {loading && items.length === 0 ? (
            /* FIX #4: Compact loading state */
            <div className="flex items-center justify-center py-4 text-xs text-text-muted gap-2">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              Loading…
            </div>
          ) : items.length === 0 ? (
            /* FIX #4: Shorter, less verbose empty state */
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-text-muted">
              <span>No {displayName.toLowerCase()} yet.</span>
              <button
                className="text-accent hover:underline font-medium"
                onClick={openCreate}
              >
                + Create first one
              </button>
            </div>
          ) : (
            <>
              {/* ── Data table ────────────────────────────────────── */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-color bg-bg-secondary/30">
                      {visibleColumns.map((col) => (
                        <th
                          key={col.id}
                          className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted"
                        >
                          {col.display_name}
                        </th>
                      ))}
                      <th className="w-[72px] px-1 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`border-b border-border-color/40 transition-colors cursor-default
                          ${idx % 2 === 1 ? 'bg-bg-secondary/10' : ''}
                          hover:bg-accent/5`}
                      >
                        {visibleColumns.map((col, colIdx) => {
                          const isEditing =
                            editingCell?.recordId === item.id &&
                            editingCell?.fieldName === col.name;
                          // The first column acts as the record's title link —
                          // clicking it opens the record (always visible on the
                          // left, so routing is discoverable even when the
                          // actions column is scrolled off).
                          const isTitleCol = colIdx === 0;
                          if (isTitleCol && !isEditing) {
                            return (
                              <td key={col.id} className="px-3 py-2 max-w-[180px]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    router.push(`/data-sheet/${sourceModelId}/${item.id}`)
                                  }
                                  title={`Open ${singularName}`}
                                  className="group/title flex w-full items-center gap-1 text-left"
                                >
                                  <span className="truncate text-[13px] font-medium text-accent group-hover/title:underline">
                                    {formatCellValue(item.data[col.name], col) || `#${item.id}`}
                                  </span>
                                  <ArrowUpRight className="h-3 w-3 shrink-0 text-accent opacity-0 transition-opacity group-hover/title:opacity-100" />
                                </button>
                              </td>
                            );
                          }
                          return (
                            <td
                              key={col.id}
                              className={`px-3 py-2 max-w-[180px] ${
                                col.is_editable && col.field_type !== 'relation'
                                  ? 'cursor-pointer hover:bg-accent/5'
                                  : ''
                              }`}
                              onClick={() => {
                                if (col.is_editable && col.field_type !== 'relation') {
                                  setEditingCell({
                                    recordId: item.id,
                                    fieldName: col.name,
                                  });
                                }
                              }}
                            >
                              {isEditing ? (
                                <DataSheetCell
                                  field={col}
                                  value={item.data[col.name]}
                                  recordId={item.id}
                                  onSave={async (val) => {
                                    await handleCellSave(item.id, col.name, val);
                                  }}
                                  modelId={sourceModelId}
                                />
                              ) : (
                                <span className="truncate block text-text-primary text-[13px]">
                                  {formatCellValue(item.data[col.name], col)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-1 py-2">
                          {/* FIX #3: Delete with confirmation inline */}
                          {confirmDeleteId === item.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                                onClick={() => handleDeleteConfirmed(item.id)}
                              >
                                Yes
                              </button>
                              <button
                                className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-bg-secondary text-text-muted hover:bg-bg-secondary/80 transition-colors"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                className="rounded p-1 text-text-muted/60 hover:bg-accent/10 hover:text-accent transition-colors"
                                title={`Open ${singularName}`}
                                onClick={() =>
                                  router.push(`/data-sheet/${sourceModelId}/${item.id}`)
                                }
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="rounded p-1 text-text-muted/50 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition-colors"
                                title={`Delete ${singularName}`}
                                onClick={() => setConfirmDeleteId(item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ────────────────────────────────────── */}
              {totalPages > 1 && (
                <div className="mt-2 flex items-center justify-between text-xs text-text-muted px-1">
                  <span>
                    {total} record{total !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page <= 1}
                      className="rounded px-2 py-0.5 hover:bg-bg-secondary disabled:opacity-40 text-[11px]"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      ← Prev
                    </button>
                    <span className="text-[11px] px-1">
                      {page}/{totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      className="rounded px-2 py-0.5 hover:bg-bg-secondary disabled:opacity-40 text-[11px]"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Create modal ─────────────────────────────────────────── */}
      {showCreate && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]"
            onClick={() => setShowCreate(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-[70] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card-bg shadow-2xl border border-border-color overflow-hidden">
            {/* FIX #10: Show parent context in modal header */}
            <div className="px-5 py-4 border-b border-border-color bg-bg-secondary/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">
                    New {singularName}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Linked to record #{parentRecordId}
                    {parentLabel ? ` — ${parentLabel}` : ''}
                  </p>
                </div>
                <button
                  className="rounded-lg p-1.5 hover:bg-bg-secondary text-text-muted hover:text-text-primary transition-colors"
                  onClick={() => setShowCreate(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[55vh] space-y-4 overflow-y-auto p-5">
              {createError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-px" />
                  <span className="whitespace-pre-line">{createError}</span>
                </div>
              )}
              {createFields.map((f) => {
                const isMissing = missingFields.has(f.name);
                return (
                  <div key={f.id}>
                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                      {f.display_name}
                      {f.is_required && (
                        <span className="ml-1 text-red-500">*</span>
                      )}
                    </label>
                    <div
                      className={
                        isMissing
                          ? 'rounded-lg ring-1 ring-red-500/60'
                          : undefined
                      }
                    >
                      {renderCreateInput(f, createData, (updater) => {
                        setCreateData(updater);
                        // Clear this field's error highlight as soon as the user edits it.
                        if (isMissing) {
                          setMissingFields((prev) => {
                            const next = new Set(prev);
                            next.delete(f.name);
                            return next;
                          });
                        }
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3.5 flex items-center justify-end gap-3 border-t border-border-color bg-bg-secondary/10">
              <button
                className="rounded-lg px-4 py-2 text-sm text-text-muted hover:bg-bg-secondary transition-colors"
                onClick={() => {
                  setShowCreate(false);
                  setCreateData({});
                }}
              >
                Cancel
              </button>
              <button
                disabled={createSaving}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-colors shadow-sm"
                onClick={handleCreate}
              >
                {createSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Creating…
                  </span>
                ) : (
                  `Create ${singularName}`
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

/** True when a field value counts as "not provided" for required validation. */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function formatCellValue(value: unknown, field: DynamicField): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field.field_type === 'boolean') return value ? 'Yes' : 'No';
  if (field.field_type === 'date') {
    try {
      return new Date(String(value)).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return String(value);
    }
  }
  if (field.field_type === 'currency') {
    const code = (field.config?.currency_code as string) || 'USD';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
      }).format(Number(value));
    } catch {
      return String(value);
    }
  }
  if (field.field_type === 'enum') return String(value);
  const str = String(value);
  return str.length > 50 ? str.slice(0, 47) + '…' : str;
}

function renderCreateInput(
  field: DynamicField,
  data: Record<string, unknown>,
  setData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
) {
  // The create-field list already excludes relation/image/file, so every field
  // here is a scalar handled by the shared renderer.
  return (
    <DatasheetFieldInput
      field={field}
      value={data[field.name] ?? ''}
      onChange={(v) => setData((prev) => ({ ...prev, [field.name]: v }))}
    />
  );
}
