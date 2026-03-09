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
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createModel, createFieldsBatch } from '@/features/data-sheet/api';
import { normalizeApiError } from '@/features/data-sheet/api/normalize-error';
import type { DynamicFieldCreate } from '@/services/dynamic-data';
import { FIELD_TYPES, getFieldTypeLabel } from '@/features/data-sheet/utils/field-registry';
import { FieldConfigPanel } from '@/features/data-sheet/components/field-config-panel';

function slugFromDisplayName(displayName: string): string {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    || 'field';
}

interface DraftField extends Omit<DynamicFieldCreate, 'order_index'> {
  order_index?: number;
}

const emptyDraftField = (orderIndex: number): DraftField => ({
  name: '',
  display_name: '',
  field_type: 'text',
  is_required: false,
  is_unique: false,
  is_editable: true,
  is_searchable: true,
  order_index: orderIndex,
  config: {},
  relation_model_id: null,
  relation_kind: null,
});

function SortableFieldCard({
  field,
  index,
  setField,
  removeField,
  fieldsLength,
}: {
  field: DraftField;
  index: number;
  setField: (i: number, u: Partial<DraftField>) => void;
  removeField: (i: number) => void;
  fieldsLength: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(index),
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-border-color bg-bg-primary p-4 space-y-3 ${isDragging ? 'opacity-70 z-10' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
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
          <span className="text-sm font-medium text-text-primary">Field {index + 1}</span>
        </span>
        <button
          type="button"
          onClick={() => removeField(index)}
          disabled={fieldsLength <= 1}
          className="text-sm text-red-600 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-text-secondary">Display name</label>
          <input
            type="text"
            value={field.display_name}
            onChange={(e) => setField(index, { display_name: e.target.value })}
            placeholder="e.g. Product Name"
            className="mt-1 block w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary">Internal name</label>
          <input
            type="text"
            value={field.name}
            onChange={(e) => setField(index, { name: e.target.value })}
            placeholder="e.g. product_name"
            className="mt-1 block w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-text-secondary">Type</label>
          <select
            value={field.field_type}
            onChange={(e) => setField(index, { field_type: e.target.value, config: {}, relation_model_id: null, relation_kind: null })}
            className="mt-1 block w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {getFieldTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4 pt-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={field.is_required ?? false}
              onChange={(e) => setField(index, { is_required: e.target.checked })}
            />
            <span className="text-sm text-text-secondary">Required</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={field.is_unique ?? false}
              onChange={(e) => setField(index, { is_unique: e.target.checked })}
            />
            <span className="text-sm text-text-secondary">Unique</span>
          </label>
        </div>
      </div>
      <div className="border-t border-border-color pt-3">
        <FieldConfigPanel
          fieldType={field.field_type}
          config={field.config ?? {}}
          onConfigChange={(config) => setField(index, { config })}
          relationModelId={field.relation_model_id ?? null}
          onRelationModelIdChange={(id) => setField(index, { relation_model_id: id })}
          relationKind={field.relation_kind ?? null}
          onRelationKindChange={(kind) => setField(index, { relation_kind: kind })}
          defaultValue={field.default_value}
          onDefaultValueChange={(v) => setField(index, { default_value: v })}
        />
      </div>
    </div>
  );
}

export interface CreateModelModalProps {
  onClose: () => void;
  onSuccess: (modelId: number) => void;
}

export function CreateModelModal({ onClose, onSuccess }: CreateModelModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<DraftField[]>([emptyDraftField(0)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateNameFromDisplay = useCallback(() => {
    if (step === 1 && displayName.trim()) {
      const slug = slugFromDisplayName(displayName);
      setName((prev) => (prev === '' || prev === slugFromDisplayName(displayName.slice(0, -1)) ? slug : prev));
    }
  }, [displayName, step]);

  const setField = (index: number, update: Partial<DraftField>) => {
    setFields((prev) => {
      const next = [...prev];
      const current = next[index] ?? emptyDraftField(index);
      let merged = { ...current, ...update };
      if (update.display_name !== undefined && !update.name) {
        merged.name = slugFromDisplayName(merged.display_name) || merged.name || 'field';
      }
      next[index] = merged;
      return next;
    });
  };

  const addField = () => {
    setFields((prev) => [...prev, emptyDraftField(prev.length)]);
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index).map((f, i) => ({ ...f, order_index: i })));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over == null || active.id === over.id) return;
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return;
    setFields((prev) => arrayMove(prev, oldIndex, newIndex));
  }, []);

  const handleSubmitStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const slug = name.trim() ? name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : slugFromDisplayName(displayName);
    if (!slug) return;
    setName(slug);
    setStep(2);
  };

  const handleSubmitFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const slug = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!slug) {
      setError('Internal name is required.');
      return;
    }
    const validFields = fields.filter((f) => (f.display_name ?? '').trim().length > 0);
    if (validFields.length === 0) {
      setError('Add at least one field.');
      return;
    }
    setSubmitting(true);
    try {
      const model = await createModel({
        name: slug,
        display_name: displayName.trim(),
        description: description.trim() || null,
      });
      const payloads: DynamicFieldCreate[] = validFields.map((f, i) => ({
        name: (f.name || slugFromDisplayName(f.display_name || '')).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `field_${i}`,
        display_name: (f.display_name || f.name || '').trim(),
        field_type: f.field_type,
        is_required: f.is_required ?? false,
        is_unique: f.is_unique ?? false,
        is_editable: f.is_editable ?? true,
        is_searchable: f.is_searchable ?? true,
        order_index: i,
        default_value: f.default_value,
        config: (() => {
          const c = f.config ?? {};
          if (Array.isArray(c.options)) {
            return { ...c, options: c.options.filter((x: string) => x != null && String(x).trim() !== '') };
          }
          return c;
        })(),
        relation_model_id: f.relation_model_id ?? null,
        relation_kind: f.relation_kind ?? null,
      }));
      await createFieldsBatch(model.id, payloads);
      onSuccess(model.id);
      onClose();
    } catch (e) {
      setError(normalizeApiError(e).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border-color bg-card-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-border-color bg-card-bg px-6 py-4">
          <h2 className="text-xl font-semibold text-text-primary">Create model</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            {step === 1 ? 'Step 1: Model info' : 'Step 2: Define fields'}
          </p>
        </div>
        <div className="p-6">
          {step === 1 ? (
            <form onSubmit={handleSubmitStep1} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="modal-displayName" className="block text-sm font-medium text-text-primary">
                  Display name
                </label>
                <input
                  id="modal-displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={updateNameFromDisplay}
                  placeholder="e.g. Products"
                  required
                  maxLength={128}
                  className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label htmlFor="modal-name" className="block text-sm font-medium text-text-primary">
                  Internal name
                </label>
                <input
                  id="modal-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. products"
                  required
                  maxLength={128}
                  className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <p className="mt-0.5 text-xs text-text-secondary">
                  Lowercase, no spaces. Used in URLs and APIs.
                </p>
              </div>
              <div>
                <label htmlFor="modal-description" className="block text-sm font-medium text-text-primary">
                  Description (optional)
                </label>
                <textarea
                  id="modal-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this model"
                  rows={2}
                  maxLength={500}
                  className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!name.trim() || !displayName.trim()}
                  className="rounded-lg border border-border-color bg-bg-secondary px-4 py-2.5 text-base font-medium text-text-primary hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next: Add fields
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-border-color bg-card-bg px-4 py-2.5 text-base font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitFinal} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                  {error}
                </div>
              )}
              <div className="rounded-lg border border-border-color bg-bg-secondary/50 p-3 text-sm text-text-secondary">
                <strong className="text-text-primary">{displayName || name}</strong> ({name}) — Add at least one field, then create.
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((_, i) => String(i))}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {fields.map((f, index) => (
                      <SortableFieldCard
                        key={index}
                        field={f}
                        index={index}
                        setField={setField}
                        removeField={removeField}
                        fieldsLength={fields.length}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <button
                type="button"
                onClick={addField}
                className="w-full rounded-lg border border-dashed border-border-color py-2.5 text-sm font-medium text-text-secondary hover:border-accent hover:text-text-primary"
              >
                + Add field
              </button>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-border-color bg-card-bg px-4 py-2.5 text-base font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting || fields.every((f) => !f.display_name?.trim())}
                  className="rounded-lg border border-border-color bg-bg-secondary px-4 py-2.5 text-base font-medium text-text-primary hover:bg-bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Create model'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-border-color bg-card-bg px-4 py-2.5 text-base font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
