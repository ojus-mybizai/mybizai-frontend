'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Check,
  X,
  Layers,
  Plus,
  Info,
  Link2,
  Image as ImageIcon,
  FileText,
  Type,
  AlignLeft,
  Hash,
  IndianRupee,
  ToggleLeft,
  Calendar,
  Clock,
  ChevronDown,
  Phone,
  ListChecks,
  Calculator,
} from 'lucide-react';
import { useDataSheetContext } from '@/features/data-sheet/context/data-sheet-context';
import { ConfirmModal } from '@/features/data-sheet/components/confirm-modal';
import { RelationCell } from '@/components/data-sheet/relation-cell';
import { ReverseRelationSubTable } from '@/components/data-sheet/reverse-relation-subtable';
import { CreateChildDatasheetModal } from '@/components/data-sheet/create-child-datasheet-modal';
import { DatasheetFieldInput } from '@/components/data-sheet/datasheet-field-input';
import {
  FieldDisplay,
  pickTitleField,
  colorForOption,
  type FieldRelationLabel,
  type FieldAttachmentLite,
} from '@/components/data-sheet/field-display';
import {
  getRecord,
  updateRecord,
  deleteRecord,
  createRecord,
  queryRecords,
  listAttachments,
  uploadFileForAttachment,
  bindAttachment,
  deleteAttachment,
  searchBuiltinModel,
  getReverseRelations,
  listFields,
  type DynamicField,
  type DynamicRecord,
  type ReverseRelationMeta,
} from '@/features/data-sheet/api';
import { normalizeApiError } from '@/features/data-sheet/api/normalize-error';
import { queryParamsFromSearchParams } from '@/features/data-sheet/state/query-params';

type AttachmentLite = FieldAttachmentLite & { field_id: number };

/** lucide icon for a field-type label. */
function FieldTypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? 'h-3.5 w-3.5';
  switch (type) {
    case 'long_text': return <AlignLeft className={cls} />;
    case 'number': return <Hash className={cls} />;
    case 'currency': return <IndianRupee className={cls} />;
    case 'boolean': return <ToggleLeft className={cls} />;
    case 'date': return <Calendar className={cls} />;
    case 'time': return <Clock className={cls} />;
    case 'enum': return <ChevronDown className={cls} />;
    case 'multi_select': return <ListChecks className={cls} />;
    case 'phone': return <Phone className={cls} />;
    case 'computed': return <Calculator className={cls} />;
    case 'image': return <ImageIcon className={cls} />;
    case 'file': return <FileText className={cls} />;
    case 'relation': return <Link2 className={cls} />;
    default: return <Type className={cls} />;
  }
}

/** Singularize a display name for the "Record" fallback title. */
function singular(name: string): string {
  if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
  if (name.endsWith('ses') || name.endsWith('xes') || name.endsWith('zes')) return name.slice(0, -2);
  if (name.endsWith('s') && !name.endsWith('ss')) return name.slice(0, -1);
  return name;
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function RecordDetailPage() {
  const ctx = useDataSheetContext();
  const params = useParams<{ modelId: string; recordId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const recordId = Number(params?.recordId);

  const [record, setRecord] = useState<DynamicRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // enrichments
  const [attachmentsByField, setAttachmentsByField] = useState<Record<number, AttachmentLite[]>>({});
  const [relationLabels, setRelationLabels] = useState<Record<string, FieldRelationLabel[]>>({});
  const [relationDetails, setRelationDetails] = useState<Record<string, Array<{ id: number; data: Record<string, unknown> }>>>({});
  const [reverseRelations, setReverseRelations] = useState<ReverseRelationMeta[]>([]);

  // prev/next navigation
  const [siblingIds, setSiblingIds] = useState<number[]>([]);

  // inline edit
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<unknown>('');
  const [saving, setSaving] = useState(false);

  // create-linked-record modal
  const [createRelModal, setCreateRelModal] = useState<{ field: DynamicField; relModelId: number } | null>(null);
  const [createRelFields, setCreateRelFields] = useState<DynamicField[]>([]);
  const [createRelData, setCreateRelData] = useState<Record<string, unknown>>({});
  const [createRelSaving, setCreateRelSaving] = useState(false);

  // child datasheet + delete
  const [childSheetModal, setChildSheetModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeRelTab, setActiveRelTab] = useState(0);

  const fields = ctx?.fields ?? [];
  const modelId = ctx?.modelId ?? params?.modelId;
  const data = (record?.data ?? record?.normalized_data ?? {}) as Record<string, unknown>;

  const preservedQuery = useMemo(() => {
    const s = searchParams?.toString() ?? '';
    return s ? `?${s}` : '';
  }, [searchParams]);

  // ── Load record ──
  const loadRecord = useCallback(async () => {
    if (!modelId || !Number.isFinite(recordId)) return;
    setLoading(true);
    setError(null);
    try {
      const rec = await getRecord(modelId, recordId);
      setRecord(rec);
    } catch (e) {
      setError(normalizeApiError(e).message);
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [modelId, recordId]);

  useEffect(() => { void loadRecord(); }, [loadRecord]);

  // ── Attachments ──
  const refreshAttachments = useCallback(async () => {
    if (!Number.isFinite(recordId)) return;
    try {
      const all = (await listAttachments(recordId)) as any[];
      const grouped: Record<number, AttachmentLite[]> = {};
      for (const att of all) {
        const fid = att.field_id as number;
        (grouped[fid] ??= []).push(att);
      }
      setAttachmentsByField(grouped);
    } catch { /* ignore */ }
  }, [recordId]);

  useEffect(() => { void refreshAttachments(); }, [refreshAttachments]);

  // ── Reverse relations (child models pointing here) ──
  useEffect(() => {
    if (!modelId) return;
    let cancelled = false;
    getReverseRelations(modelId).then((m) => { if (!cancelled) setReverseRelations(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, [modelId]);

  // ── Relation labels + nested details ──
  useEffect(() => {
    if (!record) return;
    const relationFields = fields.filter(
      (f) => f.field_type === 'relation' && data[f.name] != null && data[f.name] !== ''
    );
    if (!relationFields.length) { setRelationLabels({}); setRelationDetails({}); return; }
    let cancelled = false;
    const labels: Record<string, FieldRelationLabel[]> = {};
    const details: Record<string, Array<{ id: number; data: Record<string, unknown> }>> = {};
    const promises = relationFields.map(async (f) => {
      const raw = data[f.name];
      const ids: number[] = Array.isArray(raw)
        ? raw.map(Number)
        : String(raw).includes(',')
          ? String(raw).split(',').map((s) => Number(s.trim())).filter(Boolean)
          : [Number(raw)];
      if (!ids.length || ids.every((id) => isNaN(id))) return;
      try {
        if (f.relation_builtin_model) {
          const results = await searchBuiltinModel(f.relation_builtin_model, '', 1, 200);
          labels[f.name] = ids.map((id) => {
            const match = results.items.find((r) => Number(r.id) === id);
            return { id, label: match ? String(match.label || id) : String(id) };
          });
        } else if (f.relation_model_id) {
          const resp = await queryRecords(f.relation_model_id, { page: 1, per_page: 200 });
          const allItems = (resp.items || []) as Array<Record<string, unknown>>;
          const displayField = f.config?.relation_display_field as string | undefined;
          labels[f.name] = [];
          details[f.name] = [];
          for (const id of ids) {
            const match = allItems.find((r) => Number(r.id) === id);
            if (match) {
              const d = (match.data ?? match.normalized_data ?? {}) as Record<string, unknown>;
              const lbl = String(
                displayField && d[displayField]
                  ? d[displayField]
                  : d['name'] ?? d['title'] ?? d['display_name'] ?? match.record_key ?? id
              );
              labels[f.name].push({ id, label: lbl });
              details[f.name].push({ id, data: d });
            } else {
              labels[f.name].push({ id, label: String(id) });
            }
          }
        }
      } catch { /* ignore */ }
    });
    void Promise.all(promises).then(() => {
      if (cancelled) return;
      setRelationLabels(labels);
      setRelationDetails(details);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, fields]);

  // ── Sibling ids for prev/next (respects the table's URL filters/sort) ──
  useEffect(() => {
    if (!modelId) return;
    let cancelled = false;
    const q = queryParamsFromSearchParams(new URLSearchParams(searchParams?.toString() ?? ''));
    queryRecords(modelId, {
      page: 1,
      per_page: 200,
      sort: q.sort.map((s) => ({ field: s.field, direction: s.direction || 'asc' })),
      filters: q.filters,
      keyword: q.keyword || undefined,
    })
      .then((res) => { if (!cancelled) setSiblingIds(res.items.map((r) => Number(r.id))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [modelId, searchParams]);

  const currentIndex = siblingIds.indexOf(recordId);
  const prevId = currentIndex > 0 ? siblingIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < siblingIds.length - 1 ? siblingIds[currentIndex + 1] : null;
  const goTo = (id: number | null) => { if (id != null) router.push(`/data-sheet/${modelId}/${id}${preservedQuery}`); };

  // ── Save a single field ──
  const saveField = useCallback(
    async (fieldName: string, value: unknown) => {
      if (!modelId) return;
      setSaving(true);
      try {
        await updateRecord(modelId, recordId, { data: { [fieldName]: value }, mode: 'merge' });
        setRecord((prev) => prev
          ? { ...prev, data: { ...(prev.data ?? {}), [fieldName]: value }, normalized_data: { ...(prev.normalized_data ?? {}), [fieldName]: value } }
          : prev);
        setEditingField(null);
      } catch (e) {
        setError(normalizeApiError(e).message);
      } finally {
        setSaving(false);
      }
    },
    [modelId, recordId]
  );

  // ── File / image upload ──
  const handleUpload = useCallback(async (field: DynamicField, file: File) => {
    if (!modelId) return;
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
      await refreshAttachments();
    } catch (e) { setError(normalizeApiError(e).message); }
  }, [modelId, recordId, refreshAttachments]);

  const handleDeleteAttachment = useCallback(async (attId: number) => {
    try {
      await deleteAttachment(attId);
      setAttachmentsByField((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) next[Number(k)] = next[Number(k)].filter((a) => a.id !== attId);
        return next;
      });
    } catch { /* ignore */ }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!modelId) return;
    setDeleting(true);
    try {
      await deleteRecord(modelId, recordId);
      router.push(`/data-sheet/${modelId}${preservedQuery}`);
    } catch (e) {
      setConfirmDelete(false);
      setError(normalizeApiError(e).message);
      setDeleting(false);
    }
  }, [modelId, recordId, router, preservedQuery]);

  // ── Derived: title, chips, metrics ──
  const titleField = useMemo(() => pickTitleField(fields), [fields]);
  const titleValue = titleField ? String(data[titleField.name] ?? '') : '';
  const heroTitle = titleValue || `${singular(ctx?.model?.display_name || 'Record')} #${recordId}`;
  const heroInitial = (titleValue || 'R').charAt(0).toUpperCase();

  const statusFields = useMemo(
    () => fields.filter((f) => f.field_type === 'enum' && data[f.name] != null && data[f.name] !== '').slice(0, 3),
    [fields, data]
  );
  const metricFields = useMemo(
    () => fields.filter((f) => (f.field_type === 'currency' || f.field_type === 'number') && data[f.name] != null && data[f.name] !== '').slice(0, 3),
    [fields, data]
  );

  const relationFieldsWithValue = useMemo(
    () => fields.filter((f) => f.field_type === 'relation' && data[f.name] != null && data[f.name] !== ''),
    [fields, data]
  );

  // ── Field grouping for the Details card (media handled separately) ──
  const detailFields = fields.filter((f) => f.field_type !== 'image' && f.field_type !== 'file');
  const mediaFields = fields.filter((f) => f.field_type === 'image' || f.field_type === 'file');

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-28 w-full animate-pulse rounded-2xl bg-bg-secondary" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
          <div className="h-80 animate-pulse rounded-2xl bg-bg-secondary" />
          <div className="h-56 animate-pulse rounded-2xl bg-bg-secondary" />
        </div>
      </div>
    );
  }

  if (error && !record) {
    return (
      <div className="rounded-2xl border border-border-color bg-card-bg px-6 py-8">
        <p className="font-medium text-text-primary">{error}</p>
        <Link href={`/data-sheet/${modelId}`} className="mt-2 inline-block text-sm text-accent hover:underline">
          ← Back to records
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-16">
      {error && (
        <div className="mb-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm whitespace-pre-line text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Sub top-bar: back · breadcrumb · prev/next · delete ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/data-sheet/${modelId}${preservedQuery}`)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-color bg-card-bg text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
          title="Back to records"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <nav className="flex min-w-0 items-center gap-2 text-sm text-text-secondary">
          <Link href={`/data-sheet/${modelId}${preservedQuery}`} className="truncate hover:text-accent">
            {ctx?.model?.display_name || 'Records'}
          </Link>
          <span className="text-text-muted">/</span>
          <span className="truncate font-semibold text-text-primary">{record?.record_key || `#${recordId}`}</span>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {siblingIds.length > 0 && currentIndex >= 0 && (
            <div className="flex items-center gap-0.5 rounded-lg border border-border-color bg-card-bg p-0.5">
              <button
                type="button"
                onClick={() => goTo(prevId)}
                disabled={prevId == null}
                className="flex h-7 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary disabled:opacity-30"
                title="Previous record"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-text-secondary whitespace-nowrap">
                {currentIndex + 1} of {siblingIds.length}
              </span>
              <button
                type="button"
                onClick={() => goTo(nextId)}
                disabled={nextId == null}
                className="flex h-7 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary disabled:opacity-30"
                title="Next record"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-transparent hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl border border-border-color bg-card-bg p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent to-purple-500" />
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-purple-500 text-2xl font-bold text-white shadow-lg shadow-accent/25">
            {heroInitial}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">{heroTitle}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {statusFields.map((f) => {
                const v = String(data[f.name]);
                return (
                  <span key={f.id} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${colorForOption(f, v)}`}>
                    {v}
                  </span>
                );
              })}
              <span className="font-mono text-xs text-text-muted">· {record?.record_key || `#${recordId}`}</span>
            </div>
          </div>
          {metricFields.length > 0 && (
            <div className="flex flex-wrap gap-2.5">
              {metricFields.map((f) => (
                <div key={f.id} className="min-w-[120px] rounded-xl border border-border-color bg-bg-secondary px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
                    <FieldTypeIcon type={f.field_type} className="h-3 w-3" />
                    {f.display_name}
                  </div>
                  <div className={`mt-1 text-xl font-bold tracking-tight ${f.field_type === 'currency' ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-primary'}`}>
                    <FieldDisplay field={f} value={data[f.name]} density="detail" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_340px]">
        {/* LEFT */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* Details */}
          <section className="overflow-hidden rounded-2xl border border-border-color bg-card-bg shadow-sm">
            <header className="flex items-center gap-2.5 border-b border-border-color px-5 py-3.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <AlignLeft className="h-4 w-4" />
              </span>
              <h2 className="flex-1 text-sm font-bold text-text-primary">Details</h2>
              <span className="rounded-full bg-bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-text-muted">
                {detailFields.length} field{detailFields.length !== 1 ? 's' : ''}
              </span>
            </header>
            <div className="grid grid-cols-1 gap-1 p-3 sm:grid-cols-2">
              {detailFields.map((field) => {
                const value = data[field.name];
                const isRelation = field.field_type === 'relation';
                const isLong = field.field_type === 'long_text';
                const isFullWidth = isRelation || isLong;
                const isEditing = editingField === field.name;
                const canEdit = field.is_editable && field.field_type !== 'computed';

                return (
                  <div
                    key={field.id}
                    className={`group relative rounded-xl px-3.5 py-3 transition-colors ${isFullWidth ? 'sm:col-span-2' : ''} ${isEditing ? 'bg-bg-secondary ring-1 ring-accent/30' : canEdit && !isRelation ? 'cursor-pointer hover:bg-bg-secondary' : ''}`}
                    onClick={() => {
                      if (!canEdit || isRelation || isEditing) return;
                      setEditingField(field.name);
                      setEditDraft(value ?? '');
                    }}
                  >
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">
                      <FieldTypeIcon type={field.field_type} />
                      <span>{field.display_name}</span>
                      {field.is_required && <span className="text-red-500">*</span>}
                    </div>

                    {isRelation ? (
                      <RelationField
                        field={field}
                        value={value}
                        recordId={recordId}
                        labels={relationLabels[field.name] ?? []}
                        details={relationDetails[field.name] ?? []}
                        onSave={(v) => saveField(field.name, v)}
                        onCreateLinked={() => {
                          setCreateRelModal({ field, relModelId: field.relation_model_id! });
                          setCreateRelData({});
                          listFields(field.relation_model_id!).then(setCreateRelFields).catch(() => {});
                        }}
                      />
                    ) : isEditing ? (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <DatasheetFieldInput
                          field={field}
                          value={editDraft}
                          onChange={setEditDraft}
                          autoFocus
                          className="block w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingField(null)}
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-primary"
                          >
                            <X className="h-3.5 w-3.5" /> Cancel
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void saveField(field.name, editDraft)}
                            className="inline-flex items-center gap-1 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="min-h-[22px] text-sm text-text-primary">
                        <FieldDisplay field={field} value={value} density="detail" />
                      </div>
                    )}

                    {canEdit && !isRelation && !isEditing && (
                      <Pencil className="absolute right-3 top-3 h-3.5 w-3.5 text-text-muted opacity-0 transition-opacity group-hover:opacity-60" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Media */}
          {mediaFields.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-border-color bg-card-bg shadow-sm">
              <header className="flex items-center gap-2.5 border-b border-border-color px-5 py-3.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <ImageIcon className="h-4 w-4" />
                </span>
                <h2 className="flex-1 text-sm font-bold text-text-primary">Attachments &amp; media</h2>
              </header>
              <div className="space-y-5 p-5">
                {mediaFields.map((field) => (
                  <MediaField
                    key={field.id}
                    field={field}
                    attachments={attachmentsByField[field.id] ?? []}
                    onUpload={(file) => handleUpload(field, file)}
                    onDeleteAttachment={handleDeleteAttachment}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Related records (child datasheets) */}
          <section className="overflow-hidden rounded-2xl border border-border-color bg-card-bg shadow-sm">
            <header className="flex items-center gap-2.5 border-b border-border-color px-5 py-3.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Layers className="h-4 w-4" />
              </span>
              <h2 className="flex-1 text-sm font-bold text-text-primary">Related records</h2>
              {reverseRelations.length > 0 && (
                <span className="rounded-full bg-bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-text-muted">
                  {reverseRelations.length} linked sheet{reverseRelations.length !== 1 ? 's' : ''}
                </span>
              )}
            </header>

            {reverseRelations.length > 0 ? (
              <div className="p-4">
                {reverseRelations.length > 1 && (
                  <div className="mb-3 flex gap-1 border-b border-border-color">
                    {reverseRelations.map((rel, i) => (
                      <button
                        key={`${rel.source_model_id}-${rel.field_id}`}
                        type="button"
                        onClick={() => setActiveRelTab(i)}
                        className={`px-3 py-2 text-sm font-semibold transition-colors ${i === activeRelTab ? 'border-b-2 border-accent text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                      >
                        {rel.source_model_display_name}
                      </button>
                    ))}
                  </div>
                )}
                {reverseRelations.map((rel, i) => (
                  <div key={`${rel.source_model_id}-${rel.field_id}`} className={reverseRelations.length > 1 && i !== activeRelTab ? 'hidden' : ''}>
                    <ReverseRelationSubTable
                      parentModelId={modelId!}
                      parentRecordId={recordId}
                      reverseRelation={rel}
                      onRecordCreated={() => {}}
                      onRecordDeleted={() => {}}
                      compact={false}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setChildSheetModal(true)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-border-color py-2.5 text-xs font-semibold text-text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  <Plus className="h-3.5 w-3.5" /> Create new child datasheet
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setChildSheetModal(true)}
                className="m-4 flex flex-col items-center gap-1 rounded-xl border-[1.5px] border-dashed border-border-color py-6 text-text-muted transition-colors hover:border-accent hover:text-accent"
                style={{ width: 'calc(100% - 2rem)' }}
              >
                <Layers className="mb-1 h-5 w-5" />
                <span className="text-sm font-semibold">Create child datasheet</span>
                <span className="text-[11px]">Add sub-tables like visits, orders or notes</span>
              </button>
            )}
          </section>
        </div>

        {/* SIDEBAR */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-2">
          {/* Record info */}
          <section className="overflow-hidden rounded-2xl border border-border-color bg-card-bg shadow-sm">
            <header className="flex items-center gap-2.5 border-b border-border-color px-5 py-3.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Info className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold text-text-primary">Record info</h2>
            </header>
            <dl className="text-sm">
              <MetaRow k="Record key" v={<span className="font-mono">{record?.record_key || '—'}</span>} />
              <MetaRow k="Record ID" v={<span className="font-mono">#{recordId}</span>} />
              <MetaRow k="Created" v={fmtDateTime(record?.created_at)} />
              <MetaRow k="Last updated" v={fmtDateTime(record?.updated_at)} />
            </dl>
          </section>

          {/* Linked to */}
          {relationFieldsWithValue.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-border-color bg-card-bg shadow-sm">
              <header className="flex items-center gap-2.5 border-b border-border-color px-5 py-3.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Link2 className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-bold text-text-primary">Linked to</h2>
              </header>
              <div className="flex flex-col gap-3 p-4">
                {relationFieldsWithValue.map((f) => (
                  <div key={f.id}>
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">{f.display_name}</div>
                    <FieldDisplay field={f} value={data[f.name]} density="detail" enrichments={{ relationLabels: relationLabels[f.name] ?? [] }} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>

      {/* ── Modals ── */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete record"
          message="Are you sure you want to delete this record? This cannot be undone."
          confirmLabel="Delete record"
          variant="danger"
          loading={deleting}
          onConfirm={() => void handleDelete()}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      {childSheetModal && ctx?.model?.name && (
        <CreateChildDatasheetModal
          parentModelId={Number(modelId)}
          parentModelName={ctx.model.name}
          parentDisplayName={ctx.model.display_name || ctx.model.name}
          onClose={() => setChildSheetModal(false)}
          onSuccess={() => {
            setChildSheetModal(false);
            getReverseRelations(modelId!).then(setReverseRelations).catch(() => {});
          }}
        />
      )}

      {createRelModal && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setCreateRelModal(null)} aria-hidden />
          <div
            className="fixed left-1/2 top-1/2 z-[70] max-h-[80vh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border-color bg-card-bg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-base font-semibold text-text-primary">Create &amp; link new record</h3>
            <div className="space-y-3">
              {createRelFields
                .filter((f) => f.is_editable && !['relation', 'image', 'file'].includes(f.field_type))
                .map((f) => (
                  <div key={f.id}>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      {f.display_name}{f.is_required && <span className="ml-0.5 text-red-500">*</span>}
                    </label>
                    <DatasheetFieldInput
                      field={f}
                      value={createRelData[f.name]}
                      onChange={(v) => setCreateRelData((prev) => ({ ...prev, [f.name]: v }))}
                    />
                  </div>
                ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setCreateRelModal(null); setCreateRelData({}); setCreateRelFields([]); }}
                className="rounded-lg border border-border-color px-4 py-2 text-sm text-text-secondary hover:bg-bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createRelSaving}
                onClick={async () => {
                  if (!createRelModal) return;
                  setCreateRelSaving(true);
                  try {
                    const newRec = await createRecord(createRelModal.relModelId, createRelData);
                    await saveField(createRelModal.field.name, (newRec as any).id);
                    setCreateRelModal(null);
                    setCreateRelData({});
                    setCreateRelFields([]);
                  } catch (e) {
                    setError(normalizeApiError(e).message);
                  } finally {
                    setCreateRelSaving(false);
                  }
                }}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {createRelSaving ? 'Creating…' : 'Create & Link'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */

function MetaRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border-color px-5 py-3 first:border-t-0">
      <dt className="text-text-secondary">{k}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-text-primary">{v}</dd>
    </div>
  );
}

/** Relation field: label pills (FieldDisplay) + inline picker + nested detail cards + create-linked. */
function RelationField({
  field,
  value,
  recordId,
  labels,
  details,
  onSave,
  onCreateLinked,
}: {
  field: DynamicField;
  value: unknown;
  recordId: number;
  labels: FieldRelationLabel[];
  details: Array<{ id: number; data: Record<string, unknown> }>;
  onSave: (v: unknown) => Promise<void>;
  onCreateLinked: () => void;
}) {
  const router = useRouter();
  const nestedFields = (field.config?.nested_display_fields as string[]) || [];
  // Only custom-model relations have a datasheet record page to route to;
  // builtin relations (contacts/users/work) live elsewhere.
  const relModelId = field.relation_builtin_model ? null : field.relation_model_id;
  return (
    <div className="space-y-2.5">
      <div className="overflow-hidden rounded-lg border border-border-color">
        <RelationCell value={value} field={field} recordId={recordId} onSave={onSave} />
      </div>
      {details.length > 0 && (
        <div className="space-y-2">
          {details.map((item) => {
            const keys = (nestedFields.length ? nestedFields : Object.keys(item.data).slice(0, 6))
              .filter((k) => item.data[k] != null && item.data[k] !== '');
            if (!keys.length) return null;
            const canOpen = relModelId != null;
            return (
              <div
                key={item.id}
                role={canOpen ? 'button' : undefined}
                tabIndex={canOpen ? 0 : undefined}
                onClick={canOpen ? () => router.push(`/data-sheet/${relModelId}/${item.id}`) : undefined}
                onKeyDown={
                  canOpen
                    ? (e) => {
                        if (e.key === 'Enter') router.push(`/data-sheet/${relModelId}/${item.id}`);
                      }
                    : undefined
                }
                className={`group/rel relative rounded-lg border border-border-color bg-bg-secondary/50 px-4 py-3 ${
                  canOpen ? 'cursor-pointer transition-colors hover:border-accent/50 hover:bg-bg-secondary' : ''
                }`}
              >
                {canOpen && (
                  <ArrowUpRight className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-text-muted opacity-0 transition-opacity group-hover/rel:opacity-70" />
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {keys.map((k) => (
                    <div key={k} className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{k.replace(/_/g, ' ')}</p>
                      <p className="truncate text-sm text-text-primary" title={String(item.data[k])}>{String(item.data[k])}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {field.relation_model_id && !field.relation_builtin_model && (
        <button
          type="button"
          onClick={onCreateLinked}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" /> Create &amp; link new record
        </button>
      )}
    </div>
  );
}

/** Image/file field with gallery/file rows + upload button. */
function MediaField({
  field,
  attachments,
  onUpload,
  onDeleteAttachment,
}: {
  field: DynamicField;
  attachments: AttachmentLite[];
  onUpload: (file: File) => void;
  onDeleteAttachment: (attId: number) => void;
}) {
  const isImage = field.field_type === 'image';
  const allowMultiple = !!field.config?.multiple;
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">
        <FieldTypeIcon type={field.field_type} />
        {field.display_name}
      </div>
      {isImage && attachments.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {attachments.map((att) => (
            <div key={att.id} className="group relative">
              <a href={att.signed_url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={att.signed_url} alt={att.original_file_name || ''} className="h-24 w-24 rounded-xl border border-border-color object-cover transition hover:opacity-80" />
              </a>
              <button
                type="button"
                onClick={() => onDeleteAttachment(att.id)}
                className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white group-hover:flex"
              >×</button>
            </div>
          ))}
        </div>
      )}
      {!isImage && attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div key={att.id} className="group flex items-center gap-3 rounded-xl border border-border-color bg-bg-secondary/50 px-3.5 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                <FileText className="h-4 w-4" />
              </span>
              <a href={att.signed_url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-accent hover:underline">
                {att.original_file_name || 'file'}
              </a>
              <button
                type="button"
                onClick={() => onDeleteAttachment(att.id)}
                className="hidden text-xs font-medium text-red-500 hover:text-red-600 group-hover:block"
              >Remove</button>
            </div>
          ))}
        </div>
      )}
      {(!attachments.length || allowMultiple) && (
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-dashed border-border-color px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent">
          {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          <span>{isImage ? 'Add image' : 'Add file'}</span>
          <input
            type="file"
            accept={isImage ? 'image/*' : undefined}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
        </label>
      )}
    </div>
  );
}
