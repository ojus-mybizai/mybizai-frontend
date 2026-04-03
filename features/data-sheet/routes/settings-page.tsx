'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDataSheetContext } from '@/features/data-sheet/context/data-sheet-context';
import {
  updateModel,
  createField,
  updateField,
  deleteField,
  deleteModel,
  type DynamicField,
  type DynamicFieldCreate,
} from '@/features/data-sheet/api';
import { normalizeApiError } from '@/features/data-sheet/api/normalize-error';
import { getFieldTypeLabel, FIELD_TYPES } from '@/features/data-sheet/utils/field-registry';
import { FieldConfigPanel } from '@/features/data-sheet/components/field-config-panel';
import { DeleteModelModal } from '@/features/data-sheet/components/delete-model-modal';
import { ConfirmModal } from '@/features/data-sheet/components/confirm-modal';
import { CreateChildDatasheetModal } from '@/components/data-sheet/create-child-datasheet-modal';
import { getReverseRelations, type ReverseRelationMeta } from '@/services/dynamic-data';
import { Layers, ExternalLink, Plus } from 'lucide-react';

function SortableFieldRow({
  field,
  onEditClick,
  isEditing,
}: {
  field: DynamicField;
  onEditClick: () => void;
  isEditing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(field.id),
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const meta = FIELD_TYPE_META[field.field_type];
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 rounded-lg border bg-bg-primary px-4 py-3 transition-all ${
        isDragging ? 'opacity-70 z-10 shadow-lg border-accent/40' : isEditing ? 'border-accent/50 ring-1 ring-accent/20' : 'border-border-color hover:border-border-color/80 hover:shadow-sm'
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-text-secondary/40 hover:text-text-secondary active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>

      {/* Type icon */}
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-secondary text-sm font-bold ${meta?.color ?? 'text-text-secondary'}`}>
        {meta?.icon ?? '?'}
      </span>

      {/* Field info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary truncate">{field.display_name}</span>
          <span className="shrink-0 rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
            {getFieldTypeLabel(field.field_type)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-secondary/70">
          <code className="rounded bg-bg-secondary/60 px-1">{field.name}</code>
          {field.is_required && (
            <span className="rounded-full bg-red-100 px-1.5 py-px text-[10px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">required</span>
          )}
          {field.is_unique && (
            <span className="rounded-full bg-blue-100 px-1.5 py-px text-[10px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">unique</span>
          )}
          {field.field_type === 'computed' && (
            <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">auto</span>
          )}
        </div>
      </div>

      {/* Edit button */}
      <button
        type="button"
        onClick={onEditClick}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
          isEditing
            ? 'bg-accent text-white'
            : 'border border-border-color bg-bg-secondary text-text-secondary opacity-0 group-hover:opacity-100 hover:bg-bg-primary'
        }`}
      >
        {isEditing ? 'Editing' : 'Edit'}
      </button>
    </li>
  );
}

export function SettingsPage() {
  const router = useRouter();
  const ctx = useDataSheetContext();
  const [error, setError] = useState<string | ReturnType<typeof normalizeApiError> | null>(null);
  const [saving, setSaving] = useState(false);
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [editFieldId, setEditFieldId] = useState<number | null>(null);
  const [deleteModelOpen, setDeleteModelOpen] = useState(false);
  const [deletingModel, setDeletingModel] = useState(false);
  const [confirmDeleteField, setConfirmDeleteField] = useState<DynamicField | null>(null);
  const [deletingField, setDeletingField] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [reordering, setReordering] = useState(false);

  // Child datasheets
  const [childSheetModalOpen, setChildSheetModalOpen] = useState(false);
  const [childRelations, setChildRelations] = useState<ReverseRelationMeta[]>([]);

  const modelId = ctx?.modelId ?? '';
  const model = ctx?.model;
  const fields = ctx?.fields ? [...ctx.fields].sort((a, b) => a.order_index - b.order_index) : [];

  // Fetch child relations (which models link to this one)
  useEffect(() => {
    if (!modelId) return;
    let cancelled = false;
    getReverseRelations(modelId)
      .then((rels) => { if (!cancelled) setChildRelations(rels); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [modelId]);

  const handleUpdateModel = useCallback(
    async (payload: { display_name?: string; description?: string | null; enable_embeddings?: boolean }) => {
      if (!modelId || saving) return;
      setSaving(true);
      setError(null);
      setSavedFeedback(false);
      try {
        await updateModel(modelId, payload);
        if (ctx?.refetchFields) await ctx.refetchFields();
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2500);
      } catch (e) {
        setError(normalizeApiError(e).message);
      } finally {
        setSaving(false);
      }
    },
    [modelId, saving, ctx?.refetchFields]
  );

  // Field creation is handled by InlineAddField directly (no modal, stays open for multi-add)

  const handleUpdateField = useCallback(
    async (fieldId: number, payload: Partial<DynamicField>) => {
      if (saving) return;
      setSaving(true);
      setError(null);
      try {
        await updateField(fieldId, {
          display_name: payload.display_name,
          is_required: payload.is_required,
          is_unique: payload.is_unique,
          is_editable: payload.is_editable,
          is_searchable: payload.is_searchable,
          order_index: payload.order_index,
          default_value: payload.default_value,
          config: payload.config,
        });
        setEditFieldId(null);
        if (ctx?.refetchFields) await ctx.refetchFields();
      } catch (e) {
        setError(normalizeApiError(e).message);
      } finally {
        setSaving(false);
      }
    },
    [saving, ctx?.refetchFields]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEndFields = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (over == null || active.id === over.id || reordering) return;
      const oldIndex = fields.findIndex((f) => String(f.id) === active.id);
      const newIndex = fields.findIndex((f) => String(f.id) === over.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const newOrder = arrayMove(fields, oldIndex, newIndex);
      setReordering(true);
      setError(null);
      try {
        await Promise.all(
          newOrder.map((f, i) => (f.order_index !== i ? updateField(f.id, { order_index: i }) : Promise.resolve()))
        );
        if (ctx?.refetchFields) await ctx.refetchFields();
      } catch (e) {
        setError(normalizeApiError(e).message);
      } finally {
        setReordering(false);
      }
    },
    [fields, reordering, ctx?.refetchFields]
  );

  const handleDeleteField = useCallback(
    async (fieldId: number) => {
      if (saving) return;
      setSaving(true);
      setError(null);
      try {
        await deleteField(fieldId);
        setEditFieldId(null);
        if (ctx?.refetchFields) await ctx.refetchFields();
      } catch (e) {
        setError(normalizeApiError(e).message);
      } finally {
        setSaving(false);
      }
    },
    [saving, ctx?.refetchFields]
  );

  const handleDeleteModelConfirm = useCallback(async () => {
    if (!modelId || deletingModel) return;
    setDeletingModel(true);
    setError(null);
    try {
      await deleteModel(modelId);
      setDeleteModelOpen(false);
      router.push('/data-sheet');
    } catch (e) {
      setError(normalizeApiError(e));
    } finally {
      setDeletingModel(false);
    }
  }, [modelId, deletingModel, router]);

  if (!ctx || !model) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border-color bg-card-bg p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Model settings</h2>
            <p className="text-xs text-text-secondary">Configure display name, description, and search settings</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Display name</label>
            <input
              type="text"
              defaultValue={model.display_name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== model.display_name) void handleUpdateModel({ display_name: v });
              }}
              className="block w-full max-w-md rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Description</label>
            <textarea
              rows={2}
              defaultValue={model.description ?? ''}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== (model.description ?? '')) void handleUpdateModel({ description: v });
              }}
              className="block w-full max-w-md rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={model.enable_embeddings}
              onClick={() => void handleUpdateModel({ enable_embeddings: !model.enable_embeddings })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
                model.enable_embeddings ? 'bg-accent' : 'bg-border-color'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  model.enable_embeddings ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <div>
              <label className="block text-sm font-medium text-text-primary">Semantic search</label>
              <p className="text-xs text-text-secondary">
                Generate AI embeddings for records so agents can search this datasheet by meaning, not just keywords.
              </p>
            </div>
          </div>
          {savedFeedback && (
            <p className="text-xs text-green-600 dark:text-green-400" role="status">Saved</p>
          )}
          <p className="text-xs text-text-secondary">
            Internal name: <code className="rounded bg-bg-secondary px-1">{model.name}</code>
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border-color bg-card-bg p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Fields</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <span className="font-medium text-text-primary">{fields.length}</span> field{fields.length !== 1 ? 's' : ''}
                  <span className="text-text-secondary/40 mx-0.5">·</span>
                  drag to reorder
                </span>
              </p>
            </div>
          </div>
          {!addFieldOpen && (
            <button
              type="button"
              onClick={() => setAddFieldOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity shrink-0"
            >
              <span className="text-base leading-none font-bold">+</span>
              Add field
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            {typeof error === 'string' ? error : error.message}
            {typeof error === 'object' && error.linked_tool_names?.length ? (
              <p className="mt-2 text-sm">
                Linked tools: {error.linked_tool_names.join(', ')}
              </p>
            ) : null}
          </div>
        )}

        {fields.length === 0 && !addFieldOpen ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-color py-10 text-center">
            <span className="text-3xl">📋</span>
            <p className="text-sm font-medium text-text-primary">No fields yet</p>
            <p className="text-xs text-text-secondary">Add your first field to define columns for the table.</p>
            <button
              type="button"
              onClick={() => setAddFieldOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <span className="text-base leading-none">+</span>
              Add first field
            </button>
          </div>
        ) : fields.length === 0 && addFieldOpen ? (
          <div className="mt-4">
            <InlineAddField
              modelId={modelId}
              onClose={() => setAddFieldOpen(false)}
              onFieldAdded={ctx?.refetchFields ?? (async () => {})}
            />
          </div>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEndFields}
            >
              <SortableContext
                items={fields.map((f) => String(f.id))}
                strategy={verticalListSortingStrategy}
              >
                <ul className="mt-4 space-y-2">
                  {fields.map((field) => (
                    <SortableFieldRow
                      key={field.id}
                      field={field}
                      onEditClick={() => setEditFieldId(editFieldId === field.id ? null : field.id)}
                      isEditing={editFieldId === field.id}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            {/* Inline add field panel or "+ Add field" row */}
            {addFieldOpen ? (
              <InlineAddField
                modelId={modelId}
                onClose={() => setAddFieldOpen(false)}
                onFieldAdded={ctx?.refetchFields ?? (async () => {})}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddFieldOpen(true)}
                className="mt-3 flex w-full items-center gap-2 rounded-lg border border-dashed border-border-color px-4 py-3 text-sm text-text-secondary hover:border-accent/60 hover:text-accent transition-colors group"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded border border-dashed border-current text-sm font-bold leading-none group-hover:border-accent">+</span>
                Add field
              </button>
            )}
          </>
        )}
        {reordering && (
          <p className="mt-2 text-xs text-text-secondary" role="status">Updating order…</p>
        )}
      </section>

      {/* ── Child Datasheets ───────────────────────────────────── */}
      <section className="rounded-xl border border-border-color bg-card-bg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Child Datasheets</h2>
              <p className="text-xs text-text-muted">
                Sub-tables that appear on each {model?.display_name || 'record'} record
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setChildSheetModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create Child Datasheet
          </button>
        </div>

        {childRelations.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-border-color py-8 text-center">
            <Layers className="h-8 w-8 mx-auto text-text-muted/40 mb-2" />
            <p className="text-sm text-text-muted">No child datasheets yet.</p>
            <p className="text-xs text-text-muted/70 mt-1">
              Create a child datasheet to see related records inline on each {model?.display_name || 'record'}.
            </p>
            <button
              type="button"
              onClick={() => setChildSheetModalOpen(true)}
              className="mt-3 text-sm text-primary hover:underline font-medium"
            >
              + Create your first child datasheet
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {childRelations.map((rel) => (
              <div
                key={`${rel.source_model_id}-${rel.field_id}`}
                className="flex items-center justify-between rounded-lg border border-border-color bg-bg-secondary/20 px-4 py-3 hover:bg-bg-secondary/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-bg-secondary">
                    <Layers className="h-4 w-4 text-text-muted" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {rel.source_model_display_name}
                    </p>
                    <p className="text-xs text-text-muted">
                      via <code className="bg-bg-secondary px-1 rounded text-[10px]">{rel.field_name}</code> field · {rel.relation_kind}
                    </p>
                  </div>
                </div>
                <a
                  href={`/data-sheet/${rel.source_model_id}`}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Child datasheet creation modal */}
      {childSheetModalOpen && model && (
        <CreateChildDatasheetModal
          parentModelId={Number(modelId)}
          parentModelName={model.name}
          parentDisplayName={model.display_name}
          onClose={() => setChildSheetModalOpen(false)}
          onSuccess={(childId) => {
            setChildSheetModalOpen(false);
            // Refresh child relations list
            getReverseRelations(modelId)
              .then(setChildRelations)
              .catch(() => {});
          }}
        />
      )}

      <section className="rounded-xl border border-red-200/60 bg-red-50/30 dark:border-red-900/40 dark:bg-red-950/10 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-red-700 dark:text-red-400">Danger zone</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Permanently delete <strong className="text-text-primary">{model.display_name}</strong> and all its records ({fields.length} field{fields.length !== 1 ? 's' : ''}). This cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setDeleteModelOpen(true)}
              className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors dark:border-red-700 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
            >
              Delete this datasheet
            </button>
          </div>
        </div>
      </section>

      {editFieldId && (
        <EditFieldModal
          field={fields.find((f) => f.id === editFieldId)!}
          onClose={() => setEditFieldId(null)}
          onSubmit={(payload) => handleUpdateField(editFieldId, payload)}
          onRequestDelete={(f) => {
            setConfirmDeleteField(f);
            setEditFieldId(null);
          }}
          saving={saving}
        />
      )}

      {confirmDeleteField && (
        <ConfirmModal
          title="Delete field"
          message={`Delete field "${confirmDeleteField.display_name}"? This cannot be undone.`}
          confirmLabel="Delete field"
          variant="danger"
          loading={deletingField}
          onConfirm={async () => {
            setDeletingField(true);
            try {
              await deleteField(confirmDeleteField.id);
              if (ctx?.refetchFields) await ctx.refetchFields();
              setConfirmDeleteField(null);
            } catch (e) {
              setError(normalizeApiError(e).message);
            } finally {
              setDeletingField(false);
            }
          }}
          onClose={() => setConfirmDeleteField(null)}
        />
      )}

      {deleteModelOpen && model && (
        <DeleteModelModal
          model={{ id: model.id, name: model.name, display_name: model.display_name }}
          onConfirm={handleDeleteModelConfirm}
          onClose={() => setDeleteModelOpen(false)}
          deleting={deletingModel}
        />
      )}
    </div>
  );
}

/* ─── Field type metadata ─────────────────────────────────────────────────── */

const FIELD_TYPE_META: Record<string, { icon: string; color: string; desc: string }> = {
  text:         { icon: 'Aa',  color: 'text-blue-500',    desc: 'Short text, names, titles' },
  long_text:    { icon: '¶',   color: 'text-indigo-500',  desc: 'Paragraphs, notes, descriptions' },
  number:       { icon: '123', color: 'text-green-500',   desc: 'Integer or decimal numbers' },
  currency:     { icon: '$',   color: 'text-emerald-500', desc: 'Money / price amount' },
  boolean:      { icon: '✓',   color: 'text-teal-500',    desc: 'Yes / No checkbox' },
  date:         { icon: '📅',  color: 'text-orange-400',  desc: 'Date or date-time value' },
  time:         { icon: '🕐',  color: 'text-orange-500',  desc: 'Time of day (HH:MM)' },
  enum:         { icon: '≡',   color: 'text-purple-500',  desc: 'Fixed dropdown options' },
  multi_select: { icon: '☰',   color: 'text-violet-500',  desc: 'Select multiple tags / options' },
  phone:        { icon: '📞',  color: 'text-sky-500',     desc: 'Phone number with country code' },
  computed:     { icon: 'fx',  color: 'text-amber-500',   desc: 'Auto-calculated formula field' },
  image:        { icon: '🖼',  color: 'text-pink-500',    desc: 'Image file upload' },
  file:         { icon: '📎',  color: 'text-rose-500',    desc: 'Any file attachment' },
  relation:     { icon: '↗',   color: 'text-cyan-500',    desc: 'Link to another sheet' },
};

const TYPE_ROWS: { label: string; types: string[] }[] = [
  { label: 'Basic', types: ['text', 'long_text', 'number', 'currency', 'boolean'] },
  { label: 'Structured', types: ['date', 'time', 'enum', 'multi_select', 'phone'] },
  { label: 'Advanced', types: ['computed', 'image', 'file', 'relation'] },
];

/* ─── InlineAddField ──────────────────────────────────────────────────────── */

/**
 * Inline panel (not a modal) for adding fields one-by-one.
 * - Stays open after each successful add so you can keep adding
 * - Shows a "Fields added" counter
 * - Press Enter or click "Add field" to submit
 * - Click "Done adding fields" to close
 */
function InlineAddField({
  modelId,
  onClose,
  onFieldAdded,
}: {
  modelId: string | number;
  onClose: () => void;
  onFieldAdded: () => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState('');
  const [customName, setCustomName] = useState('');
  const [fieldType, setFieldType] = useState<string>('text');
  const [isRequired, setIsRequired] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [relationModelId, setRelationModelId] = useState<number | null>(null);
  const [relationBuiltinModel, setRelationBuiltinModel] = useState<string | null>(null);
  const [relationKind, setRelationKind] = useState<'many_to_one' | 'one_to_many' | 'many_to_many' | null>(null);
  const [defaultValue, setDefaultValue] = useState<unknown>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [lastAdded, setLastAdded] = useState('');
  const [fieldError, setFieldError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-focus on open
  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const slugify = (s: string) =>
    s.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || '';

  const autoSlug = slugify(displayName);
  const finalName = slugify(customName) || autoSlug || 'field';

  const resetForm = () => {
    setDisplayName('');
    setCustomName('');
    setFieldType('text');
    setIsRequired(false);
    setConfig({});
    setRelationModelId(null);
    setRelationBuiltinModel(null);
    setRelationKind(null);
    setDefaultValue(undefined);
    setShowAdvanced(false);
    setFieldError('');
    setTimeout(() => nameRef.current?.focus(), 40);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    const name = finalName;
    if (!name) { setFieldError('Invalid field name.'); return; }
    setSaving(true);
    setFieldError('');
    try {
      const normalizedConfig = Object.keys(config).length
        ? { ...config, ...(Array.isArray(config.options) ? { options: (config.options as unknown[]).filter((x) => x != null && String(x).trim() !== '') } : {}) }
        : undefined;
      await createField(modelId, {
        name,
        display_name: displayName.trim(),
        field_type: fieldType,
        is_required: isRequired,
        is_unique: false,
        is_editable: true,
        is_searchable: true,
        config: normalizedConfig,
        relation_model_id: fieldType === 'relation' ? relationModelId : undefined,
        relation_builtin_model: fieldType === 'relation' ? relationBuiltinModel : undefined,
        relation_kind: fieldType === 'relation' ? relationKind : undefined,
        default_value: defaultValue,
      });
      setLastAdded(displayName.trim());
      setAddedCount((n) => n + 1);
      await onFieldAdded();
      resetForm();
    } catch (e) {
      setFieldError(normalizeApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const hasConfig = ['enum', 'multi_select', 'relation', 'currency', 'boolean', 'image', 'file', 'phone', 'time', 'computed'].includes(fieldType);

  return (
    <div className="mt-4 rounded-xl border-2 border-accent/30 bg-bg-secondary/40 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border-color bg-card-bg px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white text-xs font-bold leading-none">+</span>
          <span className="text-sm font-semibold text-text-primary">Add fields</span>
          {addedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
              <span>✓</span>
              <span>{addedCount} added{lastAdded ? ` · "${lastAdded}"` : ''}</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-text-secondary hover:text-text-primary font-medium px-2 py-1 rounded hover:bg-bg-secondary transition-colors"
        >
          Done adding
        </button>
      </div>

      <form onSubmit={handleAdd} className="p-4 space-y-4">
        {/* Field name */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <input
              ref={nameRef}
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Field name, e.g. Product Name, Due Date…"
              required
              className="block w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {autoSlug && (
              <p className="mt-1 text-[11px] text-text-secondary">
                slug: <code className="rounded bg-bg-primary px-1">{finalName}</code>
              </p>
            )}
          </div>
          {/* Required pill toggle */}
          <button
            type="button"
            onClick={() => setIsRequired((v) => !v)}
            title={isRequired ? 'Required: on' : 'Required: off'}
            className={`mt-0.5 shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
              isRequired
                ? 'border-accent bg-accent text-white'
                : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent/50'
            }`}
          >
            Required
          </button>
        </div>

        {/* Type picker — categorized rows */}
        <div className="space-y-3">
          {TYPE_ROWS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary/60">{group.label}</p>
              <div className="flex gap-1.5">
                {group.types.map((t) => {
                  const meta = FIELD_TYPE_META[t] ?? { icon: '?', color: '', desc: '' };
                  const selected = fieldType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      title={`${getFieldTypeLabel(t)} — ${meta.desc}`}
                      onClick={() => {
                        setFieldType(t);
                        setConfig({});
                        setRelationModelId(null);
                        setRelationBuiltinModel(null);
                        setRelationKind(null);
                      }}
                      className={`flex flex-1 flex-col items-center gap-1 rounded-lg border py-2.5 text-center transition-all ${
                        selected
                          ? 'border-accent bg-accent/10 shadow-sm ring-1 ring-accent/20'
                          : 'border-border-color bg-bg-primary hover:border-accent/40 hover:bg-bg-secondary'
                      }`}
                    >
                      <span className={`text-sm font-bold leading-none ${selected ? 'text-accent' : meta.color}`}>
                        {meta.icon}
                      </span>
                      <span className={`text-[10px] font-medium leading-tight ${selected ? 'text-accent' : 'text-text-secondary'}`}>
                        {getFieldTypeLabel(t).split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {/* Selected type description */}
          <div className="flex items-center gap-2 rounded-lg bg-bg-secondary/50 px-3 py-2">
            <span className={`text-sm font-bold ${FIELD_TYPE_META[fieldType]?.color ?? ''}`}>
              {FIELD_TYPE_META[fieldType]?.icon ?? '?'}
            </span>
            <div>
              <span className="text-xs font-medium text-text-primary">{getFieldTypeLabel(fieldType)}</span>
              <span className="mx-1 text-text-secondary/40">—</span>
              <span className="text-xs text-text-secondary">{FIELD_TYPE_META[fieldType]?.desc ?? ''}</span>
              {fieldType === 'relation' && (
                <span className="ml-1.5 text-xs text-amber-500">Cannot be changed after creation</span>
              )}
              {fieldType === 'computed' && (
                <span className="ml-1.5 text-xs text-amber-500">Read-only, auto-calculated</span>
              )}
            </div>
          </div>
        </div>

        {/* Type-specific config */}
        {hasConfig && (
          <div className="rounded-lg border border-border-color bg-bg-primary p-3">
            <FieldConfigPanel
              fieldType={fieldType}
              config={config}
              onConfigChange={setConfig}
              relationModelId={relationModelId}
              onRelationModelIdChange={setRelationModelId}
              relationBuiltinModel={relationBuiltinModel}
              onRelationBuiltinModelChange={setRelationBuiltinModel}
              relationKind={relationKind}
              onRelationKindChange={(kind) => setRelationKind(kind as 'many_to_one' | 'one_to_many' | 'many_to_many' | null)}
              excludeModelId={typeof modelId === 'number' ? modelId : null}
              defaultValue={defaultValue}
              onDefaultValueChange={setDefaultValue}
            />
          </div>
        )}

        {/* Advanced toggle (internal name + Unique/Editable/Searchable) */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            {showAdvanced ? '▾' : '▸'} Advanced options
          </button>
          {showAdvanced && (
            <div className="mt-2 rounded-lg border border-border-color bg-bg-primary p-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Internal name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={autoSlug || 'field_name'}
                  className="block w-full rounded border border-border-color bg-bg-secondary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
                />
                <p className="mt-0.5 text-[10px] text-text-secondary">Lowercase, underscores. Auto-generated if blank.</p>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {fieldError && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            {fieldError}
          </p>
        )}

        {/* Submit */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={saving || !displayName.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Adding…
              </>
            ) : (
              <>+ Add field</>
            )}
          </button>
          <span className="text-xs text-text-secondary">or press Enter</span>
        </div>
      </form>
    </div>
  );
}

function EditFieldModal({
  field,
  onClose,
  onSubmit,
  onRequestDelete,
  saving,
}: {
  field: DynamicField;
  onClose: () => void;
  onSubmit: (p: Partial<DynamicField>) => void;
  onRequestDelete: (f: DynamicField) => void;
  saving: boolean;
}) {
  const [displayName, setDisplayName] = useState(field.display_name);
  const [isRequired, setIsRequired] = useState(field.is_required);
  const [isUnique, setIsUnique] = useState(field.is_unique);
  const [isEditable, setIsEditable] = useState(field.is_editable);
  const [isSearchable, setIsSearchable] = useState(field.is_searchable);
  const [config, setConfig] = useState<Record<string, unknown>>(field.config ?? {});
  const [defaultValue, setDefaultValue] = useState<unknown>(field.default_value);
  const [showDelete, setShowDelete] = useState(false);

  const meta = FIELD_TYPE_META[field.field_type];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      display_name: displayName,
      is_required: isRequired,
      is_unique: isUnique,
      is_editable: isEditable,
      is_searchable: isSearchable,
      config,
      default_value: defaultValue,
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-[calc(100vw-2rem)] rounded-2xl border border-border-color bg-card-bg shadow-2xl max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border-color px-6 py-4">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-lg font-bold ${meta?.color ?? 'text-text-secondary'}`}>
            {meta?.icon ?? '?'}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-text-primary">Edit field</h3>
            <p className="text-xs text-text-secondary">
              <code className="rounded bg-bg-secondary px-1">{field.name}</code>
              <span className="mx-1.5">·</span>
              <span className={meta?.color ?? ''}>{getFieldTypeLabel(field.field_type)}</span>
              <span className="ml-1 text-text-secondary/50">(type cannot be changed)</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors" aria-label="Close">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="block w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Type-specific config */}
          <FieldConfigPanel
            fieldType={field.field_type}
            config={config}
            onConfigChange={setConfig}
            relationModelId={field.relation_model_id ?? null}
            onRelationModelIdChange={() => {}}
            relationBuiltinModel={field.relation_builtin_model ?? null}
            onRelationBuiltinModelChange={() => {}}
            relationKind={field.relation_kind as 'many_to_one' | 'one_to_many' | 'many_to_many' | null}
            onRelationKindChange={() => {}}
            relationReadOnly
            defaultValue={defaultValue}
            onDefaultValueChange={setDefaultValue}
          />

          {/* Field properties — styled toggle grid */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Properties</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'required', label: 'Required', desc: 'Must have a value', checked: isRequired, onChange: setIsRequired },
                { key: 'unique', label: 'Unique', desc: 'No duplicate values', checked: isUnique, onChange: setIsUnique },
                { key: 'editable', label: 'Editable', desc: 'Can be modified', checked: isEditable, onChange: setIsEditable },
                { key: 'searchable', label: 'Searchable', desc: 'Included in search', checked: isSearchable, onChange: setIsSearchable },
              ].map(({ key, label, desc, checked, onChange }) => (
                <label
                  key={key}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all ${
                    checked ? 'border-accent/40 bg-accent/5' : 'border-border-color bg-bg-primary hover:border-border-color/80'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-border-color text-accent focus:ring-accent"
                  />
                  <div>
                    <span className="text-sm font-medium text-text-primary">{label}</span>
                    <p className="text-[10px] text-text-secondary leading-tight">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-3 border-t border-border-color pt-4">
            {/* Delete — tucked away with confirmation */}
            <div>
              {!showDelete ? (
                <button
                  type="button"
                  onClick={() => setShowDelete(true)}
                  className="text-xs text-red-500/70 hover:text-red-600 transition-colors"
                >
                  Delete field
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">Are you sure?</span>
                  <button
                    type="button"
                    onClick={() => onRequestDelete(field)}
                    disabled={saving}
                    className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDelete(false)}
                    className="text-xs text-text-secondary hover:text-text-primary"
                  >
                    No
                  </button>
                </div>
              )}
            </div>

            {/* Save / Cancel */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
