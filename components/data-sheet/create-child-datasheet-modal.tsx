'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Link2,
  Layers,
  GripVertical,
  ChevronDown,
} from 'lucide-react';
import { createChildModel, type DynamicFieldCreate } from '@/services/dynamic-data';
import { FIELD_TYPES, getFieldTypeLabel } from '@/features/data-sheet/utils/field-registry';
import { FieldConfigPanel } from '@/features/data-sheet/components/field-config-panel';

// ── Types ───────────────────────────────────────────────────────────

interface CreateChildDatasheetModalProps {
  parentModelId: number;
  parentModelName: string;
  parentDisplayName: string;
  onClose: () => void;
  onSuccess: (childModelId: number) => void;
}

interface DraftField {
  name: string;
  display_name: string;
  field_type: string;
  is_required: boolean;
  is_unique: boolean;
  /** true while the slug should keep tracking the display name */
  autoSlug: boolean;
  config: Record<string, unknown>;
  default_value?: unknown;
}

function slugFromDisplayName(displayName: string): string {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    || 'field';
}

const emptyField = (): DraftField => ({
  name: '',
  display_name: '',
  field_type: 'text',
  is_required: false,
  is_unique: false,
  autoSlug: true,
  config: {},
});

// Child sheets always get an auto-created relation to the parent — never let the
// user hand-pick a relation field here.
const CHILD_FIELD_TYPES = FIELD_TYPES.filter((t) => t !== 'relation');

// ── Sortable field card ─────────────────────────────────────────────

function SortableChildFieldCard({
  field,
  index,
  fieldsLength,
  updateField,
  removeField,
}: {
  field: DraftField;
  index: number;
  fieldsLength: number;
  updateField: (i: number, u: Partial<DraftField>) => void;
  removeField: (i: number) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(index),
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const inputCls =
    'w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 transition';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-border-color bg-card-bg p-4 space-y-3 ${
        isDragging ? 'opacity-70 shadow-lg z-10' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            className="cursor-grab touch-none rounded p-1 text-text-secondary hover:bg-bg-secondary active:cursor-grabbing"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder field"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold text-text-secondary">Field {index + 1}</span>
        </span>
        <button
          type="button"
          onClick={() => removeField(index)}
          disabled={fieldsLength <= 1}
          className="rounded p-1 text-text-secondary hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Remove field"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">Display name</label>
          <input
            type="text"
            className={inputCls}
            placeholder="e.g. Visit Date"
            value={field.display_name}
            onChange={(e) =>
              updateField(index, {
                display_name: e.target.value,
                ...(field.autoSlug ? { name: slugFromDisplayName(e.target.value) } : {}),
              })
            }
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">Type</label>
          <select
            className={inputCls}
            value={field.field_type}
            onChange={(e) =>
              updateField(index, { field_type: e.target.value, config: {}, default_value: undefined })
            }
          >
            {CHILD_FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {getFieldTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={field.is_required}
            onChange={(e) => updateField(index, { is_required: e.target.checked })}
            className="rounded border-border-color text-accent focus:ring-accent/30"
          />
          <span className="text-xs text-text-secondary">Required</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={field.is_unique}
            onChange={(e) => updateField(index, { is_unique: e.target.checked })}
            className="rounded border-border-color text-accent focus:ring-accent/30"
          />
          <span className="text-xs text-text-secondary">Unique</span>
        </label>
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="ml-auto flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-accent transition-colors"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          Advanced
        </button>
      </div>

      {advancedOpen && (
        <div className="rounded-lg border border-border-color bg-bg-secondary/30 p-3">
          <label className="mb-1 block text-xs font-medium text-text-secondary">Internal name</label>
          <input
            type="text"
            className={`${inputCls} font-mono`}
            placeholder="e.g. visit_date"
            value={field.name}
            onChange={(e) =>
              updateField(index, {
                name: e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase(),
                autoSlug: false,
              })
            }
          />
          <p className="mt-1 text-[11px] text-text-secondary/70">Lowercase, no spaces. Used in API and formulas.</p>
        </div>
      )}

      {/* Per-type configuration (options, currency, formula, default value, …) */}
      <div className="border-t border-border-color pt-3">
        <FieldConfigPanel
          fieldType={field.field_type}
          config={field.config}
          onConfigChange={(config) => updateField(index, { config })}
          relationModelId={null}
          onRelationModelIdChange={() => {}}
          relationKind={null}
          onRelationKindChange={() => {}}
          defaultValue={field.default_value}
          onDefaultValueChange={(v) => updateField(index, { default_value: v })}
        />
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────

export function CreateChildDatasheetModal({
  parentModelId,
  parentModelName,
  parentDisplayName,
  onClose,
  onSuccess,
}: CreateChildDatasheetModalProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Model info
  const [displayName, setDisplayName] = useState('');
  const [internalName, setInternalName] = useState('');
  const [description, setDescription] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);

  // Step 2: Fields
  const [fields, setFields] = useState<DraftField[]>([emptyField()]);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  // ── Handlers ──────────────────────────────────────────────────

  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    if (autoSlug) setInternalName(slugFromDisplayName(val));
  };

  const updateField = useCallback((index: number, updates: Partial<DraftField>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  }, []);

  const addField = () => setFields((prev) => [...prev, emptyField()]);
  const removeField = (index: number) => setFields((prev) => prev.filter((_, i) => i !== index));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over == null || active.id === over.id) return;
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return;
    setFields((prev) => arrayMove(prev, oldIndex, newIndex));
  }, []);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const fieldPayloads: DynamicFieldCreate[] = fields
        .filter((f) => f.display_name.trim())
        .map((f, idx) => ({
          name: (f.name || slugFromDisplayName(f.display_name)) || `field_${idx}`,
          display_name: f.display_name.trim(),
          field_type: f.field_type,
          is_required: f.is_required,
          is_unique: f.is_unique,
          is_editable: true,
          is_searchable: true,
          order_index: idx + 1,
          default_value: f.default_value,
          config: (() => {
            const c = f.config ?? {};
            if (Array.isArray(c.options)) {
              return { ...c, options: c.options.filter((x: unknown) => x != null && String(x).trim() !== '') };
            }
            return c;
          })(),
          relation_model_id: null,
          relation_kind: null,
        }));

      const child = await createChildModel(parentModelId, {
        name: internalName,
        display_name: displayName,
        description: description || undefined,
        fields: fieldPayloads,
      });
      onSuccess(child.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create child datasheet');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceedStep1 = displayName.trim().length > 0 && internalName.trim().length > 0;
  const validFieldCount = fields.filter((f) => f.display_name.trim()).length;
  const canSubmit = canProceedStep1 && validFieldCount > 0;

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 z-[70] flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border-color bg-card-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create child datasheet"
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="border-b border-border-color bg-bg-secondary/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                <Layers className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  {step === 1 ? 'Create Child Datasheet' : 'Define Fields'}
                </h2>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Link2 className="h-3 w-3 text-text-secondary" />
                  <p className="text-xs text-text-secondary">
                    Linked to <span className="font-medium text-accent">{parentDisplayName}</span>
                  </p>
                </div>
              </div>
            </div>
            <button
              className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="mt-3 flex items-center gap-2">
            <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-accent' : 'bg-border-color'}`} />
            <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-accent' : 'bg-border-color'}`} />
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            /* ── Step 1: Model info ──────────────────────── */
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-accent/15 bg-accent/5 px-4 py-3">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div className="text-xs text-text-secondary">
                  <p>
                    A <span className="font-semibold text-text-primary">relation field</span> pointing to{' '}
                    <span className="font-semibold text-accent">{parentDisplayName}</span> will be auto-created on this
                    datasheet.
                  </p>
                  <p className="mt-1 text-text-secondary/80">
                    Records here appear in the parent&apos;s &ldquo;Related Records&rdquo; section.
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Visit History, Lab Results, Notes"
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                  value={displayName}
                  onChange={(e) => handleDisplayNameChange(e.target.value)}
                  maxLength={128}
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Internal Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 font-mono text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                  value={internalName}
                  onChange={(e) => {
                    setAutoSlug(false);
                    setInternalName(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase());
                  }}
                  maxLength={128}
                />
                <p className="mt-1 text-[11px] text-text-secondary/70">Lowercase, no spaces. Used in API and formulas.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">Description</label>
                <textarea
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                  placeholder="Optional description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                />
              </div>
            </div>
          ) : (
            /* ── Step 2: Define fields ───────────────────── */
            <div className="space-y-3">
              {/* Auto-created relation field (locked) */}
              <div className="flex items-center gap-3 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
                <Link2 className="h-4 w-4 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-accent">
                    {parentModelName} <span className="font-normal text-text-secondary">→ {parentDisplayName}</span>
                  </p>
                  <p className="text-[11px] text-text-secondary">Relation field (auto-created)</p>
                </div>
                <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">AUTO</span>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={fields.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {fields.map((field, idx) => (
                      <SortableChildFieldCard
                        key={idx}
                        field={field}
                        index={idx}
                        fieldsLength={fields.length}
                        updateField={updateField}
                        removeField={removeField}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <button
                type="button"
                onClick={addField}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-color py-3 text-sm font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
              >
                <Plus className="h-4 w-4" />
                Add field
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-border-color bg-bg-secondary/20 px-6 py-3.5">
          <div className="text-xs text-text-secondary">
            {step === 2 && (
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-secondary"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step === 2 && (
              <span className="text-xs text-text-secondary">
                {validFieldCount} field{validFieldCount === 1 ? '' : 's'}
              </span>
            )}
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            {step === 1 ? (
              <button
                type="button"
                disabled={!canProceedStep1}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setStep(2)}
              >
                Next: Add Fields
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!canSubmit || submitting}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleSubmit}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Creating…
                  </span>
                ) : (
                  `Create ${displayName || 'Datasheet'}`
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
