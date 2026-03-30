'use client';

import { useState } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Link2,
  Layers,
} from 'lucide-react';
import { createChildModel, type DynamicFieldCreate } from '@/services/dynamic-data';
import { FIELD_TYPES, getFieldTypeLabel } from '@/features/data-sheet/utils/field-registry';

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
  config: Record<string, unknown>;
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
  config: {},
});

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

  // ── Handlers ──────────────────────────────────────────────────

  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    if (autoSlug) {
      setInternalName(slugFromDisplayName(val));
    }
  };

  const updateField = (index: number, updates: Partial<DraftField>) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const updated = { ...f, ...updates };
        // Auto-slug field name from display name
        if ('display_name' in updates && updates.display_name !== undefined) {
          updated.name = slugFromDisplayName(updates.display_name);
        }
        return updated;
      })
    );
  };

  const addField = () => setFields((prev) => [...prev, emptyField()]);
  const removeField = (index: number) =>
    setFields((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const fieldPayloads: DynamicFieldCreate[] = fields
        .filter((f) => f.name && f.display_name)
        .map((f, idx) => ({
          name: f.name,
          display_name: f.display_name,
          field_type: f.field_type,
          is_required: f.is_required,
          is_unique: false,
          is_editable: true,
          is_searchable: true,
          order_index: idx + 1,
          config: f.config,
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
    } catch (err: any) {
      setError(err?.message || 'Failed to create child datasheet');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceedStep1 = displayName.trim().length > 0 && internalName.trim().length > 0;
  const canSubmit = canProceedStep1 && fields.some((f) => f.name && f.display_name);

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 z-[70] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card-bg shadow-2xl border border-border-color overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-border-color bg-bg-secondary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Layers className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  {step === 1 ? 'Create Child Datasheet' : 'Define Fields'}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Link2 className="h-3 w-3 text-text-muted" />
                  <p className="text-xs text-text-muted">
                    Linked to <span className="font-medium text-primary">{parentDisplayName}</span>
                  </p>
                </div>
              </div>
            </div>
            <button
              className="rounded-lg p-1.5 hover:bg-bg-secondary text-text-muted hover:text-text-primary transition-colors"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-3">
            <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-border-color'}`} />
            <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-border-color'}`} />
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="p-6 max-h-[55vh] overflow-y-auto">
          {step === 1 ? (
            /* ── Step 1: Model info ──────────────────────── */
            <div className="space-y-4">
              {/* Auto-link info banner */}
              <div className="flex items-start gap-3 rounded-lg bg-primary/5 border border-primary/10 px-4 py-3">
                <Link2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="text-xs text-text-secondary">
                  <p>
                    A <span className="font-semibold">relation field</span> pointing to{' '}
                    <span className="font-semibold text-primary">{parentDisplayName}</span>{' '}
                    will be auto-created on this datasheet.
                  </p>
                  <p className="mt-1 text-text-muted">
                    Records in this child sheet will appear in the parent&apos;s &ldquo;Related Records&rdquo; section.
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Visit History, Lab Results, Notes"
                  className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
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
                  className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2.5 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                  value={internalName}
                  onChange={(e) => {
                    setAutoSlug(false);
                    setInternalName(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase());
                  }}
                  maxLength={128}
                />
                <p className="mt-1 text-[11px] text-text-muted">
                  Lowercase, no spaces. Used in API and formulas.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Description
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2.5 text-sm resize-none focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
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
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3">
                <Link2 className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary">
                    {parentModelName} <span className="text-text-muted font-normal">→ {parentDisplayName}</span>
                  </p>
                  <p className="text-[11px] text-text-muted">Relation field (auto-created)</p>
                </div>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  AUTO
                </span>
              </div>

              {/* User-defined fields */}
              {fields.map((field, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border-color bg-bg-primary p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-text-muted">
                      Field {idx + 1}
                    </span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        className="rounded p-1 text-text-muted hover:bg-red-50 hover:text-red-500 transition-colors"
                        onClick={() => removeField(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-text-secondary">
                        Display Name
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                        placeholder="e.g., Visit Date"
                        value={field.display_name}
                        onChange={(e) =>
                          updateField(idx, { display_name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-text-secondary">
                        Type
                      </label>
                      <select
                        className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                        value={field.field_type}
                        onChange={(e) =>
                          updateField(idx, { field_type: e.target.value })
                        }
                      >
                        {FIELD_TYPES.filter((t) => t !== 'relation').map((t) => (
                          <option key={t} value={t}>
                            {getFieldTypeLabel?.(t) ?? t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.is_required}
                      onChange={(e) =>
                        updateField(idx, { is_required: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span className="text-xs text-text-secondary">Required</span>
                  </label>

                  {field.field_type === 'enum' && (
                    <div>
                      <label className="mb-1 block text-xs text-text-secondary">
                        Options (comma-separated)
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                        placeholder="Option A, Option B, Option C"
                        value={
                          ((field.config?.options as string[]) || []).join(', ')
                        }
                        onChange={(e) =>
                          updateField(idx, {
                            config: {
                              ...field.config,
                              options: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Add field button */}
              <button
                type="button"
                onClick={addField}
                className="w-full rounded-lg border-2 border-dashed border-border-color py-3 text-sm font-medium text-text-secondary hover:border-primary/30 hover:text-primary transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add field
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="px-6 py-3.5 flex items-center justify-between border-t border-border-color bg-bg-secondary/10">
          <div>
            {step === 2 && (
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-bg-secondary transition-colors"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm text-text-muted hover:bg-bg-secondary transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            {step === 1 ? (
              <button
                type="button"
                disabled={!canProceedStep1}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                onClick={() => setStep(2)}
              >
                Next: Add Fields
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!canSubmit || submitting}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
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
