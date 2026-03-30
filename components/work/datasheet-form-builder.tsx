'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  listModels,
  listFields,
  createRecord,
  type DynamicModel,
  type DynamicField,
} from '@/services/dynamic-data';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DatasheetFormBuilderProps {
  onRecordCreated?: (modelId: number, recordId: number) => void;
}

type Phase = 'select-model' | 'select-fields' | 'form';

const SYSTEM_FIELD_NAMES = new Set([
  'record_key',
  'status',
  'created_at',
  'updated_at',
]);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fieldTypeBadgeColor(ft: string): string {
  switch (ft) {
    case 'text':
    case 'string':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'number':
    case 'integer':
    case 'float':
    case 'decimal':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'date':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'boolean':
    case 'checkbox':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case 'select':
    case 'enum':
      return 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300';
    case 'email':
      return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300';
    case 'phone':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    case 'url':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
    case 'textarea':
    case 'long_text':
    case 'rich_text':
      return 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

function extractOptions(
  config: Record<string, unknown>
): { label: string; value: string }[] {
  const raw = config?.options;
  if (!Array.isArray(raw)) return [];
  return raw.map((opt) => {
    if (typeof opt === 'string') return { label: opt, value: opt };
    if (opt && typeof opt === 'object' && 'value' in opt) {
      return {
        label: String((opt as { label?: string; value: string }).label ?? (opt as { value: string }).value),
        value: String((opt as { value: string }).value),
      };
    }
    return { label: String(opt), value: String(opt) };
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DatasheetFormBuilder({
  onRecordCreated,
}: DatasheetFormBuilderProps) {
  /* ---- state ---- */
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<number>>(
    new Set()
  );
  const [phase, setPhase] = useState<Phase>('select-model');
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);

  /* ---- derived ---- */
  const userFields = fields
    .filter(
      (f) =>
        !SYSTEM_FIELD_NAMES.has(f.name) && f.field_type !== 'auto_increment'
    )
    .sort((a, b) => a.order_index - b.order_index);

  const selectedModel = models.find((m) => m.id === selectedModelId) ?? null;

  const selectedFields = userFields
    .filter((f) => selectedFieldIds.has(f.id))
    .sort((a, b) => a.order_index - b.order_index);

  /* ---- data fetching ---- */
  useEffect(() => {
    let cancelled = false;
    setLoadingModels(true);
    listModels()
      .then((data) => {
        if (!cancelled) setModels(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Failed to load datasheets'
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchFields = useCallback(async (modelId: number) => {
    setLoadingFields(true);
    setError(null);
    try {
      const data = await listFields(modelId);
      setFields(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load fields'
      );
    } finally {
      setLoadingFields(false);
    }
  }, []);

  /* ---- handlers ---- */
  function handleModelSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value ? Number(e.target.value) : null;
    setSelectedModelId(id);
    setSelectedFieldIds(new Set());
    setFormValues({});
    setError(null);
    setSuccess(null);
    if (id) {
      setPhase('select-fields');
      fetchFields(id);
    } else {
      setPhase('select-model');
      setFields([]);
    }
  }

  function toggleField(fieldId: number) {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }

  function toggleAll() {
    if (selectedFieldIds.size === userFields.length) {
      setSelectedFieldIds(new Set());
    } else {
      setSelectedFieldIds(new Set(userFields.map((f) => f.id)));
    }
  }

  function setFieldValue(fieldName: string, value: unknown) {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));
  }

  function goToForm() {
    setError(null);
    setSuccess(null);
    setFormValues({});
    setPhase('form');
  }

  function goBackToFields() {
    setError(null);
    setSuccess(null);
    setPhase('select-fields');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedModelId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const record = await createRecord(selectedModelId, formValues);
      setSuccess('Record created successfully!');
      setFormValues({});
      onRecordCreated?.(selectedModelId, record.id);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create record'
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ---- input styles ---- */
  const inputClass =
    'w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary ' +
    'placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 ' +
    'dark:bg-bg-secondary dark:border-border-color disabled:opacity-50';

  const btnPrimary =
    'inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium ' +
    'text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */

  return (
    <div className="space-y-5">
      {/* ---- error / success banners ---- */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300">
          {success}
        </div>
      )}

      {/* ================= PHASE 1: Select Datasheet ================= */}
      {(phase === 'select-model' || phase === 'select-fields' || phase === 'form') && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">
            Datasheet
          </label>
          {loadingModels ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading datasheets...
            </div>
          ) : (
            <select
              value={selectedModelId ?? ''}
              onChange={handleModelSelect}
              disabled={phase === 'form'}
              className={inputClass}
            >
              <option value="">Select a datasheet...</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name || m.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ================= PHASE 2: Select Fields =================== */}
      {phase === 'select-fields' && selectedModelId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Choose fields to include
            </h3>
            {!loadingFields && userFields.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-medium text-accent hover:text-accent/80 transition-colors"
              >
                {selectedFieldIds.size === userFields.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            )}
          </div>

          {loadingFields ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary py-4">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading fields...
            </div>
          ) : userFields.length === 0 ? (
            <p className="py-4 text-sm text-text-secondary">
              No configurable fields found for this datasheet.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border-color rounded-md border border-border-color overflow-hidden">
                {userFields.map((f) => (
                  <li
                    key={f.id}
                    onClick={() => toggleField(f.id)}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-bg-secondary/60 dark:hover:bg-bg-secondary/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFieldIds.has(f.id)}
                      onChange={() => toggleField(f.id)}
                      className="h-4 w-4 rounded border-border-color text-accent focus:ring-accent/40"
                    />
                    <span className="flex-1 text-sm text-text-primary">
                      {f.display_name || f.name}
                      {f.is_required && (
                        <span className="ml-1 text-red-500">*</span>
                      )}
                    </span>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight ${fieldTypeBadgeColor(f.field_type)}`}
                    >
                      {f.field_type}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={selectedFieldIds.size === 0}
                onClick={goToForm}
                className={btnPrimary}
              >
                Generate Form
              </button>
            </>
          )}
        </div>
      )}

      {/* ================= PHASE 3: Generated Form ================== */}
      {phase === 'form' && selectedModelId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              New record &mdash; {selectedModel?.display_name ?? selectedModel?.name}
            </h3>
            <button
              type="button"
              onClick={goBackToFields}
              className="text-xs font-medium text-accent hover:text-accent/80 transition-colors"
            >
              &larr; Back to field selection
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {selectedFields.map((field) => (
              <FormField
                key={field.id}
                field={field}
                value={formValues[field.name]}
                onChange={(v) => setFieldValue(field.name, v)}
                inputClass={inputClass}
              />
            ))}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className={btnPrimary}
              >
                {submitting ? (
                  <>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating...
                  </>
                ) : (
                  'Create Record'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FormField                                                          */
/* ------------------------------------------------------------------ */

function FormField({
  field,
  value,
  onChange,
  inputClass,
}: {
  field: DynamicField;
  value: unknown;
  onChange: (v: unknown) => void;
  inputClass: string;
}) {
  const id = `field-${field.id}`;
  const label = (
    <label htmlFor={id} className="mb-1 block text-sm font-medium text-text-primary">
      {field.display_name || field.name}
      {field.is_required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );

  const ft = field.field_type;

  /* ---- checkbox / boolean ---- */
  if (ft === 'boolean' || ft === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-border-color text-accent focus:ring-accent/40"
        />
        <label htmlFor={id} className="text-sm text-text-primary">
          {field.display_name || field.name}
          {field.is_required && <span className="ml-1 text-red-500">*</span>}
        </label>
      </div>
    );
  }

  /* ---- select / enum ---- */
  if (ft === 'select' || ft === 'enum') {
    const options = extractOptions(field.config);
    return (
      <div>
        {label}
        <select
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          required={field.is_required}
          className={inputClass}
        >
          <option value="">-- Select --</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  /* ---- textarea / long_text / rich_text ---- */
  if (ft === 'textarea' || ft === 'long_text' || ft === 'rich_text') {
    return (
      <div>
        {label}
        <textarea
          id={id}
          rows={3}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          placeholder={field.display_name || field.name}
          className={inputClass + ' resize-y'}
        />
      </div>
    );
  }

  /* ---- number types ---- */
  if (
    ft === 'number' ||
    ft === 'integer' ||
    ft === 'float' ||
    ft === 'decimal'
  ) {
    return (
      <div>
        {label}
        <input
          id={id}
          type="number"
          step={ft === 'integer' ? '1' : 'any'}
          value={value != null ? String(value) : ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : Number(v));
          }}
          required={field.is_required}
          placeholder={field.display_name || field.name}
          className={inputClass}
        />
      </div>
    );
  }

  /* ---- mapped text-input types ---- */
  let inputType = 'text';
  if (ft === 'date') inputType = 'date';
  else if (ft === 'email') inputType = 'email';
  else if (ft === 'phone') inputType = 'tel';
  else if (ft === 'url') inputType = 'url';

  return (
    <div>
      {label}
      <input
        id={id}
        type={inputType}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        required={field.is_required}
        placeholder={field.display_name || field.name}
        className={inputClass}
      />
    </div>
  );
}
