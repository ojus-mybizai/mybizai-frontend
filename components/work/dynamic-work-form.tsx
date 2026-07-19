'use client';

import { useState, useRef } from 'react';
import type { FormField } from '@/services/work';

interface DynamicWorkFormProps {
  fields: FormField[];
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  disabled?: boolean;
}

function LocationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const detect = () => {
    if (!navigator.geolocation) {
      setErr('Geolocation not supported by browser.');
      return;
    }
    setLoading(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        onChange(coords);
        setLoading(false);
      },
      (e) => {
        setErr(`Location error: ${e.message}`);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="lat, lng (e.g. 28.6139, 77.2090)"
          className="flex-1 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          onClick={detect}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-xs font-medium text-text-primary hover:border-accent disabled:opacity-60 transition-colors"
        >
          {loading ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : (
            <span>📍</span>
          )}
          {loading ? 'Detecting…' : 'Use GPS'}
        </button>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      {value && (
        <a
          href={`https://www.google.com/maps?q=${encodeURIComponent(value)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline"
        >
          View on map →
        </a>
      )}
    </div>
  );
}

function ImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>(value);
  const [uploading, setUploading] = useState(false);

  const handleFile = (file: File) => {
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      onChange(dataUrl);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed border-border-color bg-bg-secondary p-4 text-center hover:border-accent transition-colors"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Preview" className="mx-auto max-h-48 rounded-lg object-contain" />
        ) : (
          <div className="py-4">
            <p className="text-2xl">📷</p>
            <p className="mt-1 text-xs text-text-secondary">Click to upload image</p>
          </div>
        )}
        {uploading && <p className="mt-2 text-xs text-accent">Processing…</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {preview && (
        <button
          type="button"
          onClick={() => { setPreview(''); onChange(''); }}
          className="text-xs text-red-500 hover:underline"
        >
          Remove image
        </button>
      )}
    </div>
  );
}

export function DynamicWorkForm({
  fields,
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
  disabled = false,
}: DynamicWorkFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    fields.forEach((f) => {
      init[f.id] = initialValues[f.id] ?? '';
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (id: string, val: unknown) => setValues((prev) => ({ ...prev, [id]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required fields
    for (const f of fields) {
      if (f.required) {
        const v = values[f.id];
        if (v === '' || v == null) {
          setError(`"${f.label}" is required.`);
          return;
        }
      }
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit form');
    } finally {
      setSaving(false);
    }
  };

  if (fields.length === 0) {
    return (
      <p className="text-sm text-text-secondary text-center py-4">
        No form fields configured for this template.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <label className="text-sm font-medium text-text-primary">
            {field.label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </label>

          {field.type === 'text' && (
            <input
              type="text"
              value={String(values[field.id] ?? '')}
              onChange={(e) => set(field.id, e.target.value)}
              placeholder={field.placeholder ?? ''}
              disabled={disabled || saving}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
            />
          )}

          {field.type === 'phone' && (
            <input
              type="tel"
              value={String(values[field.id] ?? '')}
              onChange={(e) => set(field.id, e.target.value)}
              placeholder={field.placeholder ?? '+91 XXXXX XXXXX'}
              disabled={disabled || saving}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
            />
          )}

          {field.type === 'number' && (
            <input
              type="number"
              value={String(values[field.id] ?? '')}
              onChange={(e) => set(field.id, e.target.value)}
              placeholder={field.placeholder ?? ''}
              disabled={disabled || saving}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
            />
          )}

          {field.type === 'textarea' && (
            <textarea
              value={String(values[field.id] ?? '')}
              onChange={(e) => set(field.id, e.target.value)}
              placeholder={field.placeholder ?? 'Enter remarks…'}
              rows={3}
              disabled={disabled || saving}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 resize-none"
            />
          )}

          {field.type === 'datetime' && (
            <input
              type="datetime-local"
              value={String(values[field.id] ?? '')}
              onChange={(e) => set(field.id, e.target.value)}
              disabled={disabled || saving}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
            />
          )}

          {field.type === 'select' && (
            <select
              value={String(values[field.id] ?? '')}
              onChange={(e) => set(field.id, e.target.value)}
              disabled={disabled || saving}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
            >
              <option value="">Select…</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {field.type === 'image' && !disabled && (
            <ImageField
              value={String(values[field.id] ?? '')}
              onChange={(v) => set(field.id, v)}
            />
          )}

          {field.type === 'image' && disabled && !!values[field.id] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={String(values[field.id])}
              alt={field.label}
              className="max-h-48 rounded-lg object-contain border border-border-color"
            />
          )}

          {field.type === 'location' && !disabled && (
            <LocationPicker
              value={String(values[field.id] ?? '')}
              onChange={(v) => set(field.id, v)}
            />
          )}

          {field.type === 'location' && disabled && (
            <p className="text-sm text-text-primary">
              {String(values[field.id] ?? '—')}
              {!!values[field.id] && (
                <a
                  href={`https://www.google.com/maps?q=${encodeURIComponent(String(values[field.id]))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-xs text-accent hover:underline"
                >
                  View on map
                </a>
              )}
            </p>
          )}

          {field.type === 'lead' && (
            <input
              type="text"
              value={String(values[field.id] ?? '')}
              onChange={(e) => set(field.id, e.target.value)}
              placeholder={field.placeholder ?? 'Customer name or phone'}
              disabled={disabled || saving}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
            />
          )}
        </div>
      ))}

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      {!disabled && (
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : submitLabel}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent disabled:opacity-60"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </form>
  );
}
