'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { Work, AssignedRecordOut, FormField } from '@/services/work';
import { getWorkAssignedRecords, updateWorkRecordStatus, startWork, getWork, submitRecordFormData, createWorkRecord } from '@/services/work';
import { listFields, queryRecords, updateRecord, uploadFileForAttachment, bindAttachment, listAttachments, deleteAttachment, type DynamicField } from '@/services/dynamic-data';
import { useAuthStore } from '@/lib/auth-store';
import { WorkDetailHeader } from '@/components/work/work-detail-header';
import { DynamicWorkForm } from '@/components/work/dynamic-work-form';

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

interface WorkDetailDatasheetProps {
  work: Work;
  onWorkUpdated: (w: Work) => void;
  uiSchema?: {
    display_fields?: string[];
    editable_fields?: string[];
    record_actions?: Array<{ type: string; label: string; field: string }>;
    auto_complete_work_when_all_done?: boolean;
    form_mode?: 'per_record' | 'single';
  } | null;
  /** Only passed when form_mode === 'per_record'. Single-form mode is handled in the parent page. */
  formSchema?: FormField[] | null;
}

/** Gets a short readable label for a record from its data */
function getRecordLabel(rec: AssignedRecordOut, displayFields: string[]): string {
  if (displayFields.length > 0) {
    const parts = displayFields.slice(0, 2).map((f) => String(rec.data[f] ?? '')).filter(Boolean);
    if (parts.length > 0) return parts.join(' · ');
  }
  const entries = Object.entries(rec.data).slice(0, 2);
  return entries.map(([, v]) => String(v)).filter(Boolean).join(' · ') || `Record #${rec.dynamic_record_id}`;
}

/** Modal for filling a form for a record — shows record context in header */
function RecordFormModal({
  record,
  fields,
  displayFields,
  markDoneAfterSave,
  onSave,
  onClose,
}: {
  record: AssignedRecordOut;
  fields: FormField[];
  displayFields: string[];
  markDoneAfterSave?: boolean;
  onSave: (recordId: number, values: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const label = getRecordLabel(record, displayFields);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border-color bg-card-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4">
          <div className="min-w-0 flex-1 pr-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-text-primary">
                {markDoneAfterSave ? 'Fill form to complete' : 'Fill form'}
              </h3>
              {markDoneAfterSave && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  → marks done
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-text-secondary">{label}</p>
            {markDoneAfterSave && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Submit this form to mark the record as done
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <DynamicWorkForm
            fields={fields}
            initialValues={(record.form_data as Record<string, unknown>) ?? {}}
            onSubmit={(values) => onSave(record.dynamic_record_id, values)}
            onCancel={onClose}
            submitLabel={markDoneAfterSave ? 'Submit & mark done ✓' : 'Save form data'}
          />
        </div>
      </div>
    </div>
  );
}

/** Read-only view of submitted form data for a record */
function RecordFormDataView({
  formData,
  fields,
}: {
  formData: Record<string, unknown>;
  fields: FormField[];
}) {
  const [expanded, setExpanded] = useState(false);
  const filled = fields.filter((f) => formData[f.id] !== '' && formData[f.id] != null);
  if (filled.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs font-medium text-accent hover:underline"
      >
        {expanded ? 'Hide form data ↑' : `View form (${filled.length} field${filled.length > 1 ? 's' : ''}) ↓`}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1 rounded-lg border border-border-color bg-bg-secondary p-3">
          {filled.map((f) => (
            <div key={f.id} className="grid grid-cols-[140px_1fr] gap-2 text-xs">
              <span className="truncate font-medium text-text-secondary">{f.label}</span>
              <span className="break-words text-text-primary">
                {f.type === 'image' && formData[f.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={String(formData[f.id])}
                    alt={f.label}
                    className="max-h-24 rounded object-contain border border-border-color"
                  />
                ) : f.type === 'location' && formData[f.id] ? (
                  <a
                    href={`https://www.google.com/maps?q=${encodeURIComponent(String(formData[f.id]))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {String(formData[f.id])}
                  </a>
                ) : (
                  String(formData[f.id])
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Create-records mode: employee creates N new records in the datasheet */
function CreateRecordsView({
  work,
  onWorkUpdated,
}: {
  work: Work;
  onWorkUpdated: (w: Work) => void;
}) {
  const user = useAuthStore((s) => s.user as { id?: number } | null);
  const canAct = work.assigned_to_id === user?.id || useAuthStore.getState().hasPermission('manage_work');

  const progress = work.datasheet_progress!;
  const modelId = progress.dynamic_model_id;

  const [fields, setFields] = useState<DynamicField[]>([]);
  const [records, setRecords] = useState<AssignedRecordOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const targetCount = progress.target_count ?? 0;
  const createdCount = progress.created_count ?? 0;
  const isComplete = progress.completed || createdCount >= targetCount;
  const progressPct = targetCount > 0 ? Math.round((createdCount / targetCount) * 100) : 0;

  // Load datasheet fields
  useEffect(() => {
    if (modelId == null) { setFieldsLoading(false); return; }
    listFields(modelId)
      .then(setFields)
      .catch(() => setFields([]))
      .finally(() => setFieldsLoading(false));
  }, [modelId]);

  // Load created records
  const loadRecords = useCallback(async () => {
    try {
      const list = await getWorkAssignedRecords(work.id);
      setRecords(list);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [work.id]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const handleStart = async () => {
    if (!canAct || work.status !== 'pending') return;
    setActionLoading('start');
    try {
      const updated = await startWork(work.id);
      onWorkUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateRecord = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Separate file fields from regular data
      const dataFields: Record<string, unknown> = {};
      const fileFields: Array<{ field: DynamicField; files: FileList }> = [];

      for (const [key, val] of Object.entries(formValues)) {
        const field = editableFields.find((f) => f.name === key);
        if (field && (field.field_type === 'image' || field.field_type === 'file') && val instanceof FileList) {
          fileFields.push({ field, files: val });
        } else {
          dataFields[key] = val;
        }
      }

      // Step 1: Create record with non-file data
      const result = await createWorkRecord(work.id, dataFields) as { dynamic_record_id: number };
      const newRecordId = result.dynamic_record_id;

      // Step 2: Upload and bind files
      if (fileFields.length > 0 && modelId) {
        for (const { field, files } of fileFields) {
          for (const file of Array.from(files)) {
            try {
              const uploaded = await uploadFileForAttachment(modelId, file);
              await bindAttachment(modelId, {
                dynamic_record_id: newRecordId,
                field_id: field.id,
                storage_key: uploaded.storage_key,
                original_file_name: uploaded.original_file_name,
                mime_type: uploaded.mime_type ?? undefined,
                size_bytes: uploaded.size_bytes ?? undefined,
              });
            } catch (uploadErr) {
              console.warn('File upload failed for field', field.name, uploadErr);
            }
          }
        }
      }

      setFormValues({});
      setShowForm(false);
      await loadRecords();
      const updated = await getWork(work.id);
      onWorkUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create record');
    } finally {
      setSubmitting(false);
    }
  };

  const editableFields = fields.filter((f) => f.is_editable !== false);
  const [relationOptions, setRelationOptions] = useState<Record<number, Array<{ id: number; label: string }>>>({});
  const [editingCell, setEditingCell] = useState<{ recId: number; fieldName: string } | null>(null);
  const [editDraft, setEditDraft] = useState<unknown>('');

  // Load relation options for relation fields
  useEffect(() => {
    const relationFields = editableFields.filter((f) => f.field_type === 'relation' && f.relation_model_id);
    if (relationFields.length === 0) return;
    relationFields.forEach((rf) => {
      queryRecords(rf.relation_model_id!, { page: 1, per_page: 200 })
        .then((res) => {
          const opts = (res.items || []).map((item: any) => ({
            id: Number(item.id),
            label: item.data?.name || item.data?.title || item.record_key || `#${item.id}`,
          }));
          setRelationOptions((prev) => ({ ...prev, [rf.relation_model_id!]: opts }));
        })
        .catch(() => {});
    });
  }, [fields]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Render a form input for a DynamicField */
  function renderFieldInput(field: DynamicField, value: unknown, onChange: (v: unknown) => void) {
    const inputCls = 'w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none';

    switch (field.field_type) {
      case 'long_text':
        return (
          <textarea
            rows={3}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            required={field.is_required}
            placeholder={field.display_name || field.name}
            className={`${inputCls} resize-none`}
          />
        );

      case 'number':
      case 'currency':
        return (
          <div className="relative">
            {field.field_type === 'currency' && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">
                {(field.config?.currency_code as string) ?? '₹'}
              </span>
            )}
            <input
              type="number"
              step={field.field_type === 'currency' ? '0.01' : '1'}
              value={String(value ?? '')}
              onChange={(e) => onChange(e.target.value)}
              required={field.is_required}
              placeholder={field.display_name || field.name}
              className={`${inputCls} ${field.field_type === 'currency' ? 'pl-7' : ''}`}
            />
          </div>
        );

      case 'enum':
        return (
          <select
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            required={field.is_required}
            className={inputCls}
          >
            <option value="">Select {field.display_name || field.name}...</option>
            {(Array.isArray(field.config?.options) ? (field.config.options as string[]) : []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value === true || value === 'true'}
              onChange={(e) => onChange(e.target.checked)}
              className="rounded border-border-color text-accent focus:ring-accent h-4 w-4"
            />
            <span className="text-sm text-text-secondary">{value === true || value === 'true' ? 'Yes' : 'No'}</span>
          </label>
        );

      case 'date':
        return (
          <input
            type="date"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            required={field.is_required}
            className={inputCls}
          />
        );

      case 'relation': {
        const opts = field.relation_model_id ? (relationOptions[field.relation_model_id] ?? []) : [];
        return (
          <select
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            required={field.is_required}
            className={inputCls}
          >
            <option value="">Select {field.display_name || field.name}...</option>
            {opts.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        );
      }

      case 'image':
      case 'file': {
        const currentFiles = (value instanceof FileList || Array.isArray(value)) ? value : null;
        const isImage = field.field_type === 'image';
        return (
          <div className="space-y-2">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border-color bg-bg-secondary/30 px-4 py-4 transition hover:border-accent hover:bg-accent/5">
              <span className="text-2xl">{isImage ? '📷' : '📎'}</span>
              <span className="text-xs text-text-secondary">
                {currentFiles ? `${Array.from(currentFiles as any).length} file(s) selected` : `Click to select ${isImage ? 'image' : 'file'}`}
              </span>
              <input
                type="file"
                accept={isImage ? 'image/*' : undefined}
                multiple={!!field.config?.multiple}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onChange(e.target.files);
                  }
                }}
              />
            </label>
            {currentFiles && Array.from(currentFiles as FileList).map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded border border-border-color bg-bg-primary px-3 py-1.5 text-xs text-text-primary">
                <span className="truncate flex-1">{f.name}</span>
                <span className="text-text-secondary">{(f.size / 1024).toFixed(0)}KB</span>
              </div>
            ))}
          </div>
        );
      }

      default: // text and any unknown
        return (
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            required={field.is_required}
            placeholder={field.display_name || field.name}
            className={inputCls}
          />
        );
    }
  }

  /** Save an inline edit on a record */
  const handleInlineEdit = async (recId: number, fieldName: string, value: unknown) => {
    if (!modelId) return;
    setActionLoading(`edit-${recId}-${fieldName}`);
    try {
      await updateRecord(modelId, recId, { data: { [fieldName]: value }, mode: 'merge' });
      await loadRecords();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setActionLoading(null);
      setEditingCell(null);
    }
  };

  /** Format a cell value for display */
  function formatCellValue(field: DynamicField, value: unknown): React.ReactNode {
    if (value == null || value === '') return <span className="text-text-secondary">—</span>;
    if (field.field_type === 'boolean') {
      return value === true || value === 'true'
        ? <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Yes</span>
        : <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">No</span>;
    }
    if (field.field_type === 'enum') {
      return <span className="inline-flex rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">{String(value)}</span>;
    }
    if (field.field_type === 'currency') {
      const code = (field.config?.currency_code as string) ?? '₹';
      return `${code} ${Number(value).toLocaleString()}`;
    }
    if (field.field_type === 'date' && value) {
      return new Date(String(value)).toLocaleDateString();
    }
    if (field.field_type === 'relation') {
      const opts = field.relation_model_id ? (relationOptions[field.relation_model_id] ?? []) : [];
      const match = opts.find((o) => o.id === Number(value));
      return match
        ? <span className="inline-flex rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">{match.label}</span>
        : String(value);
    }
    if (field.field_type === 'image' || field.field_type === 'file') {
      // Rendered separately by AttachmentCellView
      return null;
    }
    return String(value);
  }

  /** Inline attachment viewer for image/file cells in records table */
  function AttachmentCellView({ recordId, field }: { recordId: number; field: DynamicField }) {
    const [attachments, setAttachments] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
      listAttachments(recordId)
        .then((all: any[]) => setAttachments(all.filter((a: any) => a.field_id === field.id)))
        .catch(() => {});
    }, [recordId, field.id]);

    const handleUpload = async (file: File) => {
      if (!modelId) return;
      setUploading(true);
      try {
        const uploaded = await uploadFileForAttachment(modelId, file);
        await bindAttachment(modelId, {
          dynamic_record_id: recordId,
          field_id: field.id,
          storage_key: uploaded.storage_key,
          original_file_name: uploaded.original_file_name,
          mime_type: uploaded.mime_type ?? undefined,
          size_bytes: uploaded.size_bytes ?? undefined,
        });
        const all = await listAttachments(recordId);
        setAttachments((all as any[]).filter((a: any) => a.field_id === field.id));
      } catch {
        // silent
      } finally {
        setUploading(false);
      }
    };

    const handleDelete = async (attId: number) => {
      try {
        await deleteAttachment(attId);
        setAttachments((prev) => prev.filter((a) => a.id !== attId));
      } catch {}
    };

    const isImage = field.field_type === 'image';

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {attachments.map((att: any) => (
          <div key={att.id} className="group relative">
            {isImage && att.signed_url ? (
              <a href={att.signed_url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={att.signed_url} alt="" className="h-8 w-8 rounded border border-border-color object-cover" />
              </a>
            ) : (
              <a href={att.signed_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-accent hover:underline truncate max-w-[80px] block">
                {att.original_file_name || 'file'}
              </a>
            )}
            {canAct && (
              <button
                type="button"
                onClick={() => void handleDelete(att.id)}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white group-hover:flex"
              >×</button>
            )}
          </div>
        ))}
        {canAct && (!attachments.length || !!(field.config?.multiple)) && (
          <label className={`cursor-pointer rounded border border-dashed border-border-color px-2 py-1 text-xs text-text-secondary hover:border-accent hover:text-accent ${uploading ? 'opacity-50' : ''}`}>
            {uploading ? '...' : isImage ? '+ img' : '+ file'}
            <input type="file" accept={isImage ? 'image/*' : undefined} className="hidden"
              onChange={(e) => e.target.files?.[0] && void handleUpload(e.target.files[0])} />
          </label>
        )}
      </div>
    );
  }

  const startAction =
    work.status === 'pending' && canAct ? (
      <button
        type="button"
        onClick={() => void handleStart()}
        disabled={!!actionLoading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
      >
        {actionLoading === 'start' ? 'Starting...' : 'Start work'}
      </button>
    ) : null;

  return (
    <div className="space-y-5">
      <WorkDetailHeader work={work} action={startAction} showBack={false} />

      {/* Notes */}
      {work.notes && (
        <div className="rounded-lg border border-border-color bg-bg-secondary/60 px-4 py-3">
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{work.notes}</p>
        </div>
      )}

      {/* Start work callout */}
      {work.status === 'pending' && canAct && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/10">
          <div className="flex items-center gap-2.5">
            <span className="text-lg" aria-hidden>&#9203;</span>
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Work hasn&apos;t started yet</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">Start this work to begin creating records</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={!!actionLoading}
            className="shrink-0 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
          >
            {actionLoading === 'start' ? 'Starting...' : 'Start'}
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div className="rounded-xl border border-border-color bg-bg-secondary/60 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="text-sm font-semibold text-text-primary">
              {createdCount} of {targetCount} records created
            </span>
            {isComplete && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Target reached</p>
            )}
          </div>
          <span className="text-xl font-bold text-accent">{progressPct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg-primary border border-border-color">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
        {(work.started_at || work.completed_at) && (
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-secondary">
            {work.started_at && <span>Started {formatDate(work.started_at)}</span>}
            {work.completed_at && <span>Completed {formatDate(work.completed_at)}</span>}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Create New Record button */}
      {canAct && work.status !== 'pending' && !isComplete && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => { setShowForm(true); setFormValues({}); }}
            disabled={fieldsLoading}
            className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
          >
            + Create New Record
          </button>
        </div>
      )}

      {isComplete && work.status !== 'completed' && canAct && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center dark:border-emerald-800/40 dark:bg-emerald-900/10">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            All {targetCount} records have been created!
          </p>
          <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
            The work will be automatically marked as completed.
          </p>
        </div>
      )}

      {/* Create record form modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border-color bg-card-bg shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-color px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-text-primary">Create New Record</h3>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Record {createdCount + 1} of {targetCount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-full p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              {fieldsLoading ? (
                <div className="py-8 text-center text-sm text-text-secondary">Loading fields...</div>
              ) : editableFields.length === 0 ? (
                <div className="py-8 text-center text-sm text-text-secondary">
                  No editable fields found for this datasheet.
                </div>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); void handleCreateRecord(); }}
                  className="space-y-4"
                >
                  {editableFields.map((field) => (
                    <div key={field.id}>
                      <label className="mb-1.5 block text-sm font-medium text-text-primary">
                        {field.display_name || field.name}
                        {field.is_required && <span className="text-red-500"> *</span>}
                      </label>
                      {renderFieldInput(field, formValues[field.name], (v) => setFormValues((prev) => ({ ...prev, [field.name]: v })))}
                    </div>
                  ))}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="flex-1 rounded-lg border border-border-color py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
                    >
                      {submitting ? 'Creating...' : 'Create Record'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List of created records */}
      {loading ? (
        <div className="overflow-hidden rounded-xl border border-border-color">
          <div className="h-12 animate-pulse bg-bg-secondary" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse border-t border-border-color bg-card-bg" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-10 text-center">
          <p className="text-sm font-medium text-text-secondary">No records created yet</p>
          <p className="mt-1 text-xs text-text-secondary">
            Use the button above to start creating records for this work
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border-color shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border-color bg-bg-secondary">
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary w-10">#</th>
                    {editableFields.slice(0, 6).map((f) => (
                      <th key={f.id} className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        {f.display_name || f.name}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, idx) => (
                    <tr
                      key={rec.dynamic_record_id}
                      className="border-b border-border-color last:border-0 bg-card-bg hover:bg-bg-secondary/20 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-text-secondary text-xs font-mono">{idx + 1}</td>
                      {editableFields.slice(0, 6).map((f) => {
                        const cellValue = rec.data[f.name];
                        const isFileField = f.field_type === 'image' || f.field_type === 'file';
                        const isEditing = editingCell?.recId === rec.dynamic_record_id && editingCell?.fieldName === f.name;
                        const isSaving = actionLoading === `edit-${rec.dynamic_record_id}-${f.name}`;

                        return (
                          <td key={f.id} className="px-3 py-2.5">
                            {isFileField ? (
                              <AttachmentCellView recordId={rec.dynamic_record_id} field={f} />
                            ) : isEditing ? (
                              <div className="flex items-center gap-1">
                                <div className="flex-1 min-w-[120px]">
                                  {renderFieldInput(f, editDraft, setEditDraft)}
                                </div>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => void handleInlineEdit(rec.dynamic_record_id, f.name, editDraft)}
                                  className="shrink-0 rounded bg-accent px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-60"
                                >
                                  {isSaving ? '...' : '✓'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCell(null)}
                                  className="shrink-0 rounded bg-bg-secondary px-2 py-1 text-xs text-text-secondary hover:bg-bg-primary"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div
                                className={`text-sm text-text-primary ${canAct && f.is_editable ? 'cursor-pointer hover:bg-accent/5 rounded px-1 py-0.5 -mx-1' : ''}`}
                                onClick={() => {
                                  if (!canAct || !f.is_editable) return;
                                  setEditingCell({ recId: rec.dynamic_record_id, fieldName: f.name });
                                  setEditDraft(cellValue ?? '');
                                }}
                                title={canAct && f.is_editable ? 'Click to edit' : undefined}
                              >
                                {formatCellValue(f, cellValue)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5">
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function WorkDetailDatasheet({ work, onWorkUpdated, uiSchema, formSchema }: WorkDetailDatasheetProps) {
  const isCreateRecordsMode = work.datasheet_progress?.assignment_mode === 'create_records';

  const user = useAuthStore((s) => s.user as { id?: number } | null);
  const canAct = work.assigned_to_id === user?.id || useAuthStore.getState().hasPermission('manage_work');
  const isManager = useAuthStore.getState().hasPermission('manage_work');

  const [records, setRecords] = useState<AssignedRecordOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formModalRecord, setFormModalRecord] = useState<AssignedRecordOut | null>(null);
  const [markDoneAfterForm, setMarkDoneAfterForm] = useState(false);
  const [markAllConfirm, setMarkAllConfirm] = useState(false);

  const displayFields = uiSchema?.display_fields ?? [];
  const hasFormFields = formSchema && formSchema.length > 0;

  const loadRecords = useCallback(async () => {
    try {
      const list = await getWorkAssignedRecords(work.id);
      setRecords(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [work.id]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handleStart = async () => {
    if (!canAct || work.status !== 'pending') return;
    setActionLoading('start');
    try {
      const updated = await startWork(work.id);
      onWorkUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecordStatus = async (dynamicRecordId: number, status: 'done' | 'skipped' | 'in_progress') => {
    if (!canAct) return;
    setActionLoading(`record-${dynamicRecordId}`);
    try {
      await updateWorkRecordStatus(work.id, dynamicRecordId, status);
      await loadRecords();
      const updated = await getWork(work.id);
      onWorkUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update record');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllDone = async () => {
    if (!canAct) return;
    setMarkAllConfirm(false);
    setActionLoading('mark-all');
    try {
      const pending = records.filter((r) => r.status !== 'done' && r.status !== 'skipped');
      for (const rec of pending) {
        await updateWorkRecordStatus(work.id, rec.dynamic_record_id, 'done');
      }
      await loadRecords();
      const updated = await getWork(work.id);
      onWorkUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark all done');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFormSave = async (recordId: number, values: Record<string, unknown>) => {
    await submitRecordFormData(work.id, recordId, values);
    // If the form was opened as a gate for marking done, also mark done now
    if (markDoneAfterForm) {
      await updateWorkRecordStatus(work.id, recordId, 'done');
    }
    await loadRecords();
    const updated = await getWork(work.id);
    onWorkUpdated(updated);
    setFormModalRecord(null);
    setMarkDoneAfterForm(false);
  };

  /** Open the form modal. If afterDone=true, submitting form will also mark the record done. */
  const openFormModal = (rec: AssignedRecordOut, afterDone = false) => {
    setFormModalRecord(rec);
    setMarkDoneAfterForm(afterDone);
  };

  /** Handle the "Done" button click. Gates on form fill if formSchema present and form not yet filled. */
  const handleDoneClick = (rec: AssignedRecordOut) => {
    if (!canAct) return;
    const hasFilledForm = rec.form_data && Object.keys(rec.form_data).some(
      (k) => rec.form_data![k] !== '' && rec.form_data![k] != null,
    );
    if (hasFormFields && !hasFilledForm) {
      // Form not yet filled — open form modal, which will also mark done after submit
      openFormModal(rec, true);
    } else {
      void handleRecordStatus(rec.dynamic_record_id, 'done');
    }
  };

  const doneCount = records.filter((r) => r.status === 'done').length;
  const skippedCount = records.filter((r) => r.status === 'skipped').length;
  const totalCount = records.length;
  const pendingCount = totalCount - doneCount - skippedCount;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const filledFormCount = hasFormFields
    ? records.filter((r) => r.form_data && Object.keys(r.form_data).some((k) => r.form_data![k] !== '' && r.form_data![k] != null)).length
    : 0;

  const startAction =
    work.status === 'pending' && canAct ? (
      <button
        type="button"
        onClick={() => void handleStart()}
        disabled={!!actionLoading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
      >
        {actionLoading === 'start' ? 'Starting…' : 'Start work'}
      </button>
    ) : null;

  // Route to create-records view when in create_records mode
  if (isCreateRecordsMode) {
    return <CreateRecordsView work={work} onWorkUpdated={onWorkUpdated} />;
  }

  return (
    <div className="space-y-5">
      <WorkDetailHeader work={work} action={startAction} showBack={false} />

      {/* Notes */}
      {work.notes && (
        <div className="rounded-lg border border-border-color bg-bg-secondary/60 px-4 py-3">
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{work.notes}</p>
        </div>
      )}

      {/* "Start work first" callout */}
      {work.status === 'pending' && canAct && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/10">
          <div className="flex items-center gap-2.5">
            <span className="text-lg" aria-hidden>⏳</span>
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Work hasn't started yet</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">Start this work to begin processing records</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={!!actionLoading}
            className="shrink-0 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
          >
            {actionLoading === 'start' ? 'Starting…' : 'Start →'}
          </button>
        </div>
      )}

      {/* Progress */}
      {totalCount > 0 && (
        <div className="rounded-xl border border-border-color bg-bg-secondary/60 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-sm font-semibold text-text-primary">
                {doneCount} of {totalCount} records done
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-secondary">
                {pendingCount > 0 && <span>{pendingCount} pending</span>}
                {skippedCount > 0 && <span>{skippedCount} skipped</span>}
                {hasFormFields && <span>{filledFormCount}/{totalCount} forms filled</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-accent">{progressPct}%</span>
              {/* Mark all done — managers only, when there are pending records */}
              {isManager && canAct && pendingCount > 0 && work.status !== 'pending' && (
                <>
                  {markAllConfirm ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-text-secondary">Confirm?</span>
                      <button
                        type="button"
                        onClick={() => void handleMarkAllDone()}
                        disabled={actionLoading === 'mark-all'}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarkAllConfirm(false)}
                        className="rounded-lg border border-border-color px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMarkAllConfirm(true)}
                      disabled={!!actionLoading}
                      className="rounded-lg border border-border-color bg-bg-primary px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-60"
                    >
                      Mark all done
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg-primary border border-border-color">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {(work.started_at || work.completed_at) && (
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-secondary">
              {work.started_at && <span>Started {formatDate(work.started_at)}</span>}
              {work.completed_at && <span>Completed {formatDate(work.completed_at)}</span>}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="overflow-hidden rounded-xl border border-border-color">
          <div className="h-12 animate-pulse bg-bg-secondary" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse border-t border-border-color bg-card-bg" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-10 text-center">
          <p className="text-sm font-medium text-text-secondary">No records assigned to this work</p>
          <p className="mt-1 text-xs text-text-secondary">Records are assigned when the work is created from a datasheet template</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border-color shadow-sm sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border-color bg-bg-secondary">
                    {displayFields.length > 0 ? (
                      displayFields.map((key) => (
                        <th key={key} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                          {key.replace(/_/g, ' ')}
                        </th>
                      ))
                    ) : (
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Data</th>
                    )}
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                    {hasFormFields && (
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Form</th>
                    )}
                    {canAct && work.status !== 'pending' && (
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => {
                    const isLoading = actionLoading === `record-${rec.dynamic_record_id}`;
                    const hasFilledForm = rec.form_data && Object.keys(rec.form_data).some(
                      (k) => rec.form_data![k] !== '' && rec.form_data![k] != null
                    );

                    return (
                      <tr
                        key={rec.dynamic_record_id}
                        className={`border-b border-border-color last:border-0 transition-colors ${
                          rec.status === 'done' ? 'bg-bg-secondary/40' : 'bg-card-bg hover:bg-bg-secondary/20'
                        }`}
                      >
                        {displayFields.length > 0 ? (
                          displayFields.map((key) => (
                            <td key={key} className="px-4 py-3 align-top text-text-primary">
                              {String(rec.data[key] ?? '—')}
                              {key === displayFields[0] && hasFormFields && hasFilledForm && (
                                <RecordFormDataView
                                  formData={rec.form_data as Record<string, unknown>}
                                  fields={formSchema!}
                                />
                              )}
                            </td>
                          ))
                        ) : (
                          <td className="px-4 py-3 align-top text-text-primary">
                            {Object.entries(rec.data)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(', ') || '—'}
                            {hasFormFields && hasFilledForm && (
                              <RecordFormDataView
                                formData={rec.form_data as Record<string, unknown>}
                                fields={formSchema!}
                              />
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              rec.status === 'done'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : rec.status === 'skipped'
                                  ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            }`}
                          >
                            {rec.status.replace('_', ' ')}
                          </span>
                        </td>
                        {hasFormFields && (
                          <td className="px-4 py-3 align-top">
                            {canAct ? (
                              <button
                                type="button"
                                onClick={() => openFormModal(rec, false)}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                  hasFilledForm
                                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                                    : 'border border-border-color bg-bg-primary text-text-secondary hover:border-accent hover:text-text-primary'
                                }`}
                              >
                                {hasFilledForm ? '✓ Filled' : '+ Fill form'}
                              </button>
                            ) : (
                              <span className={`text-xs ${hasFilledForm ? 'text-emerald-600' : 'text-text-secondary'}`}>
                                {hasFilledForm ? '✓ Filled' : '—'}
                              </span>
                            )}
                          </td>
                        )}
                        {canAct && work.status !== 'pending' && (
                          <td className="px-4 py-3 text-right align-top">
                            <div className="flex justify-end gap-1.5">
                              {rec.status !== 'done' && (
                                <button
                                  type="button"
                                  onClick={() => handleDoneClick(rec)}
                                  disabled={!!actionLoading || isLoading}
                                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 ${
                                    hasFormFields && !(rec.form_data && Object.keys(rec.form_data).some((k) => rec.form_data![k] !== '' && rec.form_data![k] != null))
                                      ? 'bg-amber-500'
                                      : 'bg-accent'
                                  }`}
                                  title={hasFormFields && !(rec.form_data && Object.keys(rec.form_data).some((k) => rec.form_data![k] !== '' && rec.form_data![k] != null)) ? 'Fill form first' : undefined}
                                >
                                  {isLoading ? '…' : hasFormFields && !(rec.form_data && Object.keys(rec.form_data).some((k) => rec.form_data![k] !== '' && rec.form_data![k] != null)) ? '📋 Fill & Done' : 'Done'}
                                </button>
                              )}
                              {rec.status !== 'skipped' && rec.status !== 'done' && (
                                <button
                                  type="button"
                                  onClick={() => void handleRecordStatus(rec.dynamic_record_id, 'skipped')}
                                  disabled={!!actionLoading}
                                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-60"
                                >
                                  Skip
                                </button>
                              )}
                              {rec.status === 'done' && (
                                <button
                                  type="button"
                                  onClick={() => void handleRecordStatus(rec.dynamic_record_id, 'in_progress')}
                                  disabled={!!actionLoading}
                                  className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-60"
                                >
                                  Undo
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card list */}
          <div className="space-y-2 sm:hidden">
            {records.map((rec) => {
              const isLoading = actionLoading === `record-${rec.dynamic_record_id}`;
              const hasFilledForm = rec.form_data && Object.keys(rec.form_data).some(
                (k) => rec.form_data![k] !== '' && rec.form_data![k] != null
              );
              const label = getRecordLabel(rec, displayFields);

              return (
                <div
                  key={rec.dynamic_record_id}
                  className={`overflow-hidden rounded-xl border p-4 transition-colors ${
                    rec.status === 'done'
                      ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/40 dark:bg-emerald-900/10'
                      : 'border-border-color bg-card-bg'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">{label}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            rec.status === 'done'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : rec.status === 'skipped'
                                ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}
                        >
                          {rec.status.replace('_', ' ')}
                        </span>
                        {hasFormFields && hasFilledForm && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ Form filled</span>
                        )}
                      </div>
                    </div>

                    {canAct && (
                      <div className="flex shrink-0 flex-col gap-1.5">
                        {/* Status actions — only when work has started */}
                        {work.status !== 'pending' && rec.status !== 'done' && (
                          <button
                            type="button"
                            onClick={() => handleDoneClick(rec)}
                            disabled={!!actionLoading || isLoading}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 ${
                              hasFormFields && !hasFilledForm ? 'bg-amber-500' : 'bg-accent'
                            }`}
                          >
                            {isLoading ? '…' : hasFormFields && !hasFilledForm ? '📋 Fill & Done' : 'Done'}
                          </button>
                        )}
                        {work.status !== 'pending' && rec.status !== 'skipped' && rec.status !== 'done' && (
                          <button
                            type="button"
                            onClick={() => void handleRecordStatus(rec.dynamic_record_id, 'skipped')}
                            disabled={!!actionLoading}
                            className="rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-60"
                          >
                            Skip
                          </button>
                        )}
                        {work.status !== 'pending' && rec.status === 'done' && (
                          <button
                            type="button"
                            onClick={() => void handleRecordStatus(rec.dynamic_record_id, 'in_progress')}
                            disabled={!!actionLoading}
                            className="rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-60"
                          >
                            Undo
                          </button>
                        )}
                        {/* Form fill — always available regardless of work status */}
                        {hasFormFields && (
                          <button
                            type="button"
                            onClick={() => openFormModal(rec, false)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                              hasFilledForm
                                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                                : 'border border-border-color bg-bg-primary text-text-secondary hover:border-accent'
                            }`}
                          >
                            {hasFilledForm ? 'Edit form' : 'Fill form'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Show all display field data on mobile */}
                  {displayFields.length > 1 && (
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border-color pt-3">
                      {displayFields.slice(1).map((key) => (
                        <div key={key} className="text-xs">
                          <dt className="capitalize text-text-secondary">{key.replace(/_/g, ' ')}</dt>
                          <dd className="font-medium text-text-primary">{String(rec.data[key] ?? '—')}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Record form modal */}
      {formModalRecord && formSchema && (
        <RecordFormModal
          record={formModalRecord}
          fields={formSchema}
          displayFields={displayFields}
          markDoneAfterSave={markDoneAfterForm}
          onSave={handleFormSave}
          onClose={() => { setFormModalRecord(null); setMarkDoneAfterForm(false); }}
        />
      )}
    </div>
  );
}
