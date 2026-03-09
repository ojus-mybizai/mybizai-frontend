'use client';

import React, { useState, useRef, useEffect, forwardRef } from 'react';
import type { DynamicField } from '@/services/dynamic-data';
import { listAttachments, uploadFileForAttachment, bindAttachment, deleteAttachment } from '@/services/dynamic-data';

function toDateInputValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  return '';
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: 'C$', AUD: 'A$', CHF: 'CHF', CNY: '¥' };

type AttachmentItem = { id: number; field_id: number; signed_url?: string; original_file_name?: string };

function ImageFileCell({
  field,
  value,
  recordId,
  modelId,
  onAttachmentAdded,
}: {
  field: DynamicField;
  value: unknown;
  recordId: number;
  modelId?: number | string;
  onAttachmentAdded?: () => void;
}) {
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const strVal = typeof value === 'string' ? value : '';
  const multiple = (field.config?.multiple as boolean) === true;

  const loadAttachments = () => {
    listAttachments(recordId)
      .then((list) => setAttachments((list as AttachmentItem[]) ?? []))
      .catch(() => setAttachments([]));
  };
  useEffect(() => {
    loadAttachments();
  }, [recordId]);

  const forField = attachments.filter((a) => a.field_id === field.id);
  const isImage = field.field_type === 'image';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !modelId) return;
    setUploadError(null);
    setUploading(true);
    try {
      const up = await uploadFileForAttachment(modelId, file);
      await bindAttachment(modelId, {
        dynamic_record_id: recordId,
        field_id: field.id,
        storage_key: up.storage_key,
        original_file_name: up.original_file_name,
        mime_type: up.mime_type ?? undefined,
        size_bytes: up.size_bytes ?? undefined,
      });
      loadAttachments();
      onAttachmentAdded?.();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (attachmentId: number) => {
    setUploadError(null);
    setDeletingId(attachmentId);
    try {
      await deleteAttachment(attachmentId);
      loadAttachments();
      onAttachmentAdded?.();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setDeletingId(null);
    }
  };

  const renderAttachment = (att: AttachmentItem) => (
    <span key={att.id} className="inline-flex items-center gap-1 rounded border border-border-color bg-bg-secondary/50 p-1">
      {att.signed_url ? (
        isImage ? (
          <img src={att.signed_url} alt="" className="max-h-10 max-w-[100px] rounded object-contain" />
        ) : (
          <a href={att.signed_url} target="_blank" rel="noopener noreferrer" className="truncate max-w-[120px] text-xs text-accent hover:underline">
            {att.original_file_name ?? 'File'}
          </a>
        )
      ) : (
        <span className="text-xs text-text-secondary">{att.original_file_name ?? '—'}</span>
      )}
      {modelId && (
        <button
          type="button"
          onClick={() => void handleRemove(att.id)}
          disabled={deletingId === att.id}
          className="shrink-0 rounded p-0.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </span>
  );

  return (
    <td className="max-w-[280px] px-4 py-3 text-text-primary">
      {forField.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {forField.map(renderAttachment)}
          {multiple && modelId && (
            <span className="inline-flex items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept={isImage ? 'image/*' : undefined}
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
              >
                {uploading ? '…' : '+ Add'}
              </button>
            </span>
          )}
          {!multiple && modelId && forField.length === 1 && (
            <span className="inline-flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept={isImage ? 'image/*' : undefined}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file || !modelId) return;
                  setUploadError(null);
                  setUploading(true);
                  try {
                    const up = await uploadFileForAttachment(modelId, file);
                    await bindAttachment(modelId, {
                      dynamic_record_id: recordId,
                      field_id: field.id,
                      storage_key: up.storage_key,
                      original_file_name: up.original_file_name,
                      mime_type: up.mime_type ?? undefined,
                      size_bytes: up.size_bytes ?? undefined,
                    });
                    if (forField[0]?.id != null) await deleteAttachment(forField[0].id);
                    loadAttachments();
                    onAttachmentAdded?.();
                  } catch (err) {
                    setUploadError(err instanceof Error ? err.message : 'Upload failed');
                  } finally {
                    setUploading(false);
                  }
                }}
                disabled={uploading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs text-text-secondary hover:underline"
              >
                {uploading ? '…' : 'Replace'}
              </button>
            </span>
          )}
        </div>
      ) : strVal ? (
        <span className="truncate text-xs text-text-secondary" title={strVal}>{strVal}</span>
      ) : (
        <>
          <span className="text-xs text-text-secondary">—</span>
          {modelId && (
            <div className="mt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept={isImage ? 'image/*' : undefined}
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          )}
        </>
      )}
      {uploadError && <p className="mt-0.5 text-xs text-red-600">{uploadError}</p>}
    </td>
  );
}

const RelationSelect = forwardRef<
  HTMLSelectElement,
  {
    value: string;
    onChange: (v: string) => void;
    onBlur: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    disabled: boolean;
    targetModelId: number;
    fetchRelatedRecords: (id: number) => Promise<Array<{ id: number; record_key?: string; data?: Record<string, unknown> }>>;
    className: string;
  }
>(function RelationSelect(
  { value, onChange, onBlur, onKeyDown, disabled, targetModelId, fetchRelatedRecords, className },
  ref
) {
  const [options, setOptions] = useState<Array<{ id: number; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);
    fetchRelatedRecords(targetModelId)
      .then((items) => {
        setOptions(
          items.map((r) => ({
            id: r.id,
            label: String(r.record_key ?? r.id),
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [targetModelId, fetchRelatedRecords]);

  return (
    <select
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      disabled={disabled || loading}
      className={className}
    >
      <option value="">—</option>
      {options.map((opt) => (
        <option key={opt.id} value={String(opt.id)}>
          {opt.label}
        </option>
      ))}
    </select>
  );
});

interface DataSheetCellProps {
  field: DynamicField;
  value: unknown;
  recordId: number;
  readOnly?: boolean;
  onSave: (value: unknown) => Promise<void>;
  error?: string | null;
  fetchRelatedRecords?: (targetModelId: number) => Promise<Array<{ id: number; record_key?: string; data?: Record<string, unknown> }>>;
  modelId?: number | string;
  onAttachmentAdded?: () => void;
}

function formatDisplay(value: unknown, fieldType: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (fieldType === 'date' && typeof value === 'string') {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatCurrency(value: unknown, currencyCode: string): string {
  if (value === null || value === undefined) return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDisplayWithField(field: DynamicField, value: unknown): React.ReactNode {
  if (field.field_type === 'currency' && (value !== null && value !== undefined)) {
    const code = (field.config?.currency_code as string) ?? 'USD';
    return formatCurrency(value, code);
  }
  if (field.field_type === 'enum' && value != null && value !== '') {
    return (
      <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
        {String(value)}
      </span>
    );
  }
  return formatDisplay(value, field.field_type);
}

export function DataSheetCell({
  field,
  value,
  recordId,
  readOnly,
  onSave,
  error,
  fetchRelatedRecords,
  modelId,
  onAttachmentAdded,
}: DataSheetCellProps) {
  const draftInitial = field.field_type === 'date' ? toDateInputValue(value) : formatDisplay(value, field.field_type);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(draftInitial);
  const [saving, setSaving] = useState(false);
  const [numberError, setNumberError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(field.field_type === 'date' ? toDateInputValue(value) : formatDisplay(value, field.field_type));
  }, [value, field.field_type]);

  const currentCompare = field.field_type === 'date' ? toDateInputValue(value) : formatDisplay(value, field.field_type);
  const handleBlur = async () => {
    if (!editing) return;
    setNumberError(null);
    if (draft === currentCompare) {
      setEditing(false);
      return;
    }
    if (field.field_type === 'number' || field.field_type === 'currency') {
      if (draft !== '') {
        const num = Number(draft);
        if (!Number.isFinite(num)) {
          setNumberError('Invalid number');
          return;
        }
      }
    }
    setSaving(true);
    try {
      let parsed: unknown = draft;
      if (field.field_type === 'number' || field.field_type === 'currency') {
        parsed = draft === '' ? null : Number(draft);
      } else if (field.field_type === 'boolean') {
        if (draft === '' || draft === '—') parsed = null;
        else parsed = draft === 'Yes' || /^(true|1|yes)$/i.test(draft);
      } else if (field.field_type === 'date') {
        parsed = draft === '' ? null : draft;
      } else if (field.field_type === 'relation') {
        parsed = draft === '' ? null : Number(draft);
      }
      await onSave(parsed);
      setEditing(false);
    } catch {
      // keep editing
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && field.field_type !== 'long_text') {
      void handleBlur();
    }
    if (e.key === 'Escape') {
      setDraft(field.field_type === 'date' ? toDateInputValue(value) : formatDisplay(value, field.field_type));
      setEditing(false);
    }
  };

  if (field.field_type === 'image' || field.field_type === 'file') {
    return (
      <ImageFileCell
        field={field}
        value={value}
        recordId={recordId}
        modelId={modelId}
        onAttachmentAdded={onAttachmentAdded}
      />
    );
  }

  if (readOnly || !field.is_editable) {
    return (
      <td
        className="max-w-[200px] truncate px-4 py-3 text-text-primary"
        title={formatDisplay(value, field.field_type)}
      >
        {formatDisplayWithField(field, value)}
      </td>
    );
  }

  if (editing) {
    const inputClass = "w-full min-w-[80px] rounded border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none";
    return (
      <td className="bg-inherit px-4 py-3">
        {field.field_type === 'boolean' ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={inputClass}
          >
            <option value="">—</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        ) : field.field_type === 'number' || field.field_type === 'currency' ? (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="number"
            value={draft}
            onChange={(e) => {
              setNumberError(null);
              setDraft(e.target.value);
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={inputClass}
          />
        ) : field.field_type === 'date' ? (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={inputClass}
          />
        ) : field.field_type === 'enum' ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={inputClass}
          >
            <option value="">—</option>
            {((field.config?.options as string[]) ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : field.field_type === 'relation' && field.relation_model_id && fetchRelatedRecords ? (
          <RelationSelect
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={draft}
            onChange={setDraft}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={saving}
            targetModelId={field.relation_model_id}
            fetchRelatedRecords={fetchRelatedRecords}
            className={inputClass}
          />
        ) : field.field_type === 'long_text' ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={saving}
            rows={3}
            className={inputClass}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className={inputClass}
          />
        )}
        {(error || numberError) && (
          <div className="mt-1 text-xs text-red-600">{numberError ?? error}</div>
        )}
      </td>
    );
  }

  const displayTitle = typeof formatDisplayWithField(field, value) === 'string'
    ? String(formatDisplayWithField(field, value))
    : formatDisplay(value, field.field_type);

  return (
    <td
      className="group max-w-[200px] cursor-pointer truncate px-4 py-3 text-text-primary hover:bg-bg-secondary/60 hover:border-b hover:border-dashed hover:border-border-color"
      onClick={() => setEditing(true)}
      title={displayTitle}
    >
      <span className="flex items-center gap-1.5">
        {formatDisplayWithField(field, value)}
        <span className="opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden>
          <svg className="h-3.5 w-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </span>
      </span>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </td>
  );
}
