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
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border border-border-color bg-bg-primary px-4 py-3 ${isDragging ? 'opacity-70 z-10' : ''}`}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-text-secondary hover:bg-bg-secondary active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path d="M7 2a1 1 0 011 1v1h3V3a1 1 0 112 0v1h3a1 1 0 110 2h-3v1a1 1 0 11-2 0V6H8v1a1 1 0 01-2 0V4H3a1 1 0 010-2h3V3a1 1 0 011-1zm-4 9a1 1 0 011-1h3v1a1 1 0 11-2 0v-1H4a1 1 0 01-1-1zm12 0a1 1 0 01-1 1h-3v1a1 1 0 112 0v1h3a1 1 0 110 2h-3v1a1 1 0 11-2 0v-1h-3a1 1 0 01-1-1zM7 14a1 1 0 011 1v3h3a1 1 0 110 2H8v3a1 1 0 11-2 0v-3H3a1 1 0 110-2h3v-3a1 1 0 011-1z" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <span className="font-medium text-text-primary">{field.display_name}</span>
        <span className="ml-2 text-xs text-text-secondary">
          {field.name} · {getFieldTypeLabel(field.field_type)}
          {field.is_required && ' · required'}
          {field.is_unique && ' · unique'}
        </span>
      </div>
      <button
        type="button"
        onClick={onEditClick}
        className="rounded-md border border-border-color bg-bg-secondary px-2 py-1 text-xs text-text-secondary hover:bg-bg-primary"
      >
        {isEditing ? 'Done' : 'Edit'}
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

  const modelId = ctx?.modelId ?? '';
  const model = ctx?.model;
  const fields = ctx?.fields ? [...ctx.fields].sort((a, b) => a.order_index - b.order_index) : [];

  const handleUpdateModel = useCallback(
    async (payload: { display_name?: string; description?: string | null }) => {
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
        <h2 className="text-lg font-semibold text-text-primary">Model settings</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary">Display name</label>
            <input
              type="text"
              defaultValue={model.display_name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== model.display_name) void handleUpdateModel({ display_name: v });
              }}
              className="mt-1 block w-full max-w-md rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Description</label>
            <textarea
              rows={2}
              defaultValue={model.description ?? ''}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== (model.description ?? '')) void handleUpdateModel({ description: v });
              }}
              className="mt-1 block w-full max-w-md rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary"
            />
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
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Fields</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              {fields.length} field{fields.length !== 1 ? 's' : ''} · drag to reorder
            </p>
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

      <section className="rounded-xl border border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20 p-6">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">Danger zone</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Delete this data sheet. This action cannot be undone. All records, fields, and data will be permanently deleted.
        </p>
        <button
          type="button"
          onClick={() => setDeleteModelOpen(true)}
          className="mt-4 rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:border-red-700"
        >
          Delete this model
        </button>
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
  text:      { icon: 'Aa',  color: 'text-blue-500',    desc: 'Short text, names, titles' },
  long_text: { icon: '¶',   color: 'text-indigo-500',  desc: 'Paragraphs, notes, descriptions' },
  number:    { icon: '123', color: 'text-green-500',   desc: 'Integer or decimal numbers' },
  currency:  { icon: '$',   color: 'text-emerald-500', desc: 'Money / price amount' },
  boolean:   { icon: '✓',   color: 'text-teal-500',    desc: 'Yes / No checkbox' },
  date:      { icon: '📅',  color: 'text-orange-400',  desc: 'Date or date-time value' },
  enum:      { icon: '≡',   color: 'text-purple-500',  desc: 'Fixed dropdown options' },
  image:     { icon: '🖼',  color: 'text-pink-500',    desc: 'Image file upload' },
  file:      { icon: '📎',  color: 'text-rose-500',    desc: 'Any file attachment' },
  relation:  { icon: '↗',   color: 'text-cyan-500',    desc: 'Link to another sheet' },
};

const TYPE_ROWS: string[][] = [
  ['text', 'long_text', 'number', 'currency', 'boolean'],
  ['date', 'enum', 'image', 'file', 'relation'],
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

  const hasConfig = ['enum', 'relation', 'currency', 'boolean', 'image', 'file'].includes(fieldType);

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

        {/* Type picker — 2 rows × 5 chips */}
        <div className="space-y-1.5">
          {TYPE_ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-1.5">
              {row.map((t) => {
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
                    className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg border py-2.5 text-center transition-all ${
                      selected
                        ? 'border-accent bg-accent/10 shadow-sm'
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
          ))}
          <p className="text-[11px] text-text-secondary pt-0.5">
            <span className="font-medium text-text-primary">{getFieldTypeLabel(fieldType)}</span>
            {' — '}
            {FIELD_TYPE_META[fieldType]?.desc ?? ''}
            {fieldType === 'relation' && (
              <span className="ml-1 text-amber-500">· Cannot be changed after creation</span>
            )}
          </p>
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
              onRelationKindChange={setRelationKind}
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[calc(100vw-2rem)] rounded-xl border border-border-color bg-card-bg p-6 shadow-lg max-h-[90vh] overflow-y-auto sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-text-primary">Edit field</h3>
        <p className="mt-1 text-sm text-text-secondary">
          {field.name} · {getFieldTypeLabel(field.field_type)}
        </p>
        <p className="mt-0.5 text-xs text-text-secondary">Type cannot be changed.</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary"
            />
          </div>
          <div className="border-t border-border-color pt-3">
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
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
              <span className="text-sm text-text-secondary">Required</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isUnique} onChange={(e) => setIsUnique(e.target.checked)} />
              <span className="text-sm text-text-secondary">Unique</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isEditable} onChange={(e) => setIsEditable(e.target.checked)} />
              <span className="text-sm text-text-secondary">Editable</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isSearchable} onChange={(e) => setIsSearchable(e.target.checked)} />
              <span className="text-sm text-text-secondary">Searchable</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border-color">
            <button type="button" onClick={onClose} className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onRequestDelete(field)}
              disabled={saving}
              className="rounded-lg border border-red-200 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 dark:border-red-700"
            >
              Delete field
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md border border-border-color bg-bg-secondary px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
