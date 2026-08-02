'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  getEntityForm, saveEntityForm,
  type EntityForm, type EntityFormFieldDef,
} from '@/services/processes';
import { pushToast } from './design-system';

interface Props {
  processId: number;
  entryId: number;
  /** Fallback title while the form loads (e.g. the entry's entity name). */
  titleHint?: string | null;
  /** Deep-link to the full contact profile / datasheet record page. */
  profileHref?: string | null;
  /** Label for the open-full-page link (e.g. "Open contact profile"). */
  openLabel?: string;
  /** When set, show ONLY fields whose key is in this list (focused "fill
   *  required fields" mode). When absent, show all entity fields but hide the
   *  "Deal" group (those are edited in the drawer). */
  filterKeys?: string[];
  onClose: () => void;
  /** Called after a successful save with the refreshed form (new entity_label etc). */
  onSaved?: (form: EntityForm) => void;
}

/**
 * Dynamic form over a pipeline entry's underlying entity — contact custom
 * fields or datasheet columns. View + edit inline, without leaving the
 * pipeline. Field inputs are driven by the backend-normalized `type`, so this
 * one modal serves both contact and datasheet pipelines.
 */
export default function EntityFormModal({ processId, entryId, titleHint, profileHref, openLabel, filterKeys, onClose, onSaved }: Props) {
  const focused = !!(filterKeys && filterKeys.length);
  const [form, setForm] = useState<EntityForm | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getEntityForm(processId, entryId)
      .then(f => {
        if (cancelled) return;
        setForm(f);
        setValues(Object.fromEntries(f.fields.map(fd => [fd.key, fd.value])));
        setError('');
      })
      .catch(e => { if (!cancelled) setError(e?.message || 'Failed to load fields'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [processId, entryId]);

  // Focused mode → only the requested keys. Full mode → all entity fields but
  // hide the "Deal" group (those are edited directly in the drawer).
  const visibleFields = useMemo(() => {
    const all = form?.fields ?? [];
    if (focused) {
      const set = new Set(filterKeys);
      return all.filter(f => set.has(f.key));
    }
    return all.filter(f => f.group !== 'Deal');
  }, [form, focused, filterKeys]);

  // Group fields by their `group` label, preserving first-seen order.
  const groups = useMemo(() => {
    const out: { name: string; fields: EntityFormFieldDef[] }[] = [];
    for (const f of visibleFields) {
      let g = out.find(x => x.name === f.group);
      if (!g) { g = { name: f.group, fields: [] }; out.push(g); }
      g.fields.push(f);
    }
    return out;
  }, [visibleFields]);

  function setVal(key: string, v: any) {
    setValues(prev => ({ ...prev, [key]: v }));
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true); setError('');
    try {
      // Only send editable, currently-visible fields.
      const editable = new Set(visibleFields.filter(f => !f.readonly).map(f => f.key));
      const payload: Record<string, any> = {};
      for (const [k, v] of Object.entries(values)) if (editable.has(k)) payload[k] = v;
      const updated = await saveEntityForm(processId, entryId, payload);
      pushToast('success', 'Details saved');
      onSaved?.(updated);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
      pushToast('danger', e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const title = form?.entity_label || titleHint || 'Details';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-xl border border-border-color bg-card-bg shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border-color bg-card-bg">
          <div className="min-w-0">
            <p className="text-[11px] text-text-secondary">{focused ? 'Fill required fields' : 'Edit details'}</p>
            <h2 className="text-base font-semibold text-text-primary truncate">{title}</h2>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {profileHref && (
              <Link
                href={profileHref}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent/10 transition-quick"
                title={openLabel || 'Open full page'}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5m0 0v5m0-5L10 14M9 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-3" />
                </svg>
                Open full page
              </Link>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-bg-secondary text-text-secondary" title="Close">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {loading && <p className="text-sm text-text-secondary">Loading fields…</p>}
          {!loading && error && <p className="text-sm text-red-500">{error}</p>}
          {!loading && form && visibleFields.length === 0 && (
            <p className="text-sm text-text-secondary">
              {focused
                ? 'The required field(s) can’t be edited here — open the full page to fill them.'
                : 'This pipeline’s entity has no editable fields.'}
            </p>
          )}
          {!loading && focused && visibleFields.length > 0 && (
            <p className="text-xs text-text-secondary -mt-2">Fill these to move the entry forward.</p>
          )}

          {!loading && groups.map(g => (
            <div key={g.name}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary mb-2">{g.name}</p>
              <div className="space-y-3">
                {g.fields.map(f => (
                  <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => setVal(f.key, v)} />
                ))}
              </div>
            </div>
          ))}

          {!loading && form && visibleFields.length > 0 && (
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} disabled={saving}
                className="rounded-md border border-border-color bg-bg-secondary px-4 py-1.5 text-sm font-medium hover:bg-bg-primary">
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── One field, rendered by normalized type ──────────────────────────────────

function FieldInput({ field, value, onChange }: {
  field: EntityFormFieldDef;
  value: any;
  onChange: (v: any) => void;
}) {
  const base = 'w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60';
  const labelEl = (
    <span className="block text-xs font-medium text-text-secondary mb-1">
      {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
      {field.readonly && <span className="ml-1 text-[10px] text-text-secondary/60">(read-only)</span>}
    </span>
  );

  if (field.readonly) {
    const shown = Array.isArray(value) ? value.join(', ') : (value ?? '—');
    return (
      <label className="block">
        {labelEl}
        <div className="w-full rounded-md border border-border-color bg-bg-secondary px-3 py-1.5 text-sm text-text-secondary truncate">
          {String(shown === '' ? '—' : shown)}
        </div>
      </label>
    );
  }

  switch (field.type) {
    case 'textarea':
      return (
        <label className="block">{labelEl}
          <textarea rows={2} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${base} resize-none`} />
        </label>
      );
    case 'number':
      return (
        <label className="block">{labelEl}
          <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={base} />
        </label>
      );
    case 'date':
      return (
        <label className="block">{labelEl}
          <input type="date" value={(value ?? '').toString().slice(0, 10)} onChange={(e) => onChange(e.target.value || null)} className={base} />
        </label>
      );
    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="rounded border-border-color text-accent focus:ring-accent" />
          {field.label}{field.required && <span className="text-red-500">*</span>}
        </label>
      );
    case 'select':
      return (
        <label className="block">{labelEl}
          <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={base}>
            <option value="">—</option>
            {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      );
    case 'multi_select': {
      const arr: string[] = Array.isArray(value) ? value : [];
      const toggle = (o: string) => onChange(arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o]);
      return (
        <div>{labelEl}
          <div className="flex flex-wrap gap-1.5">
            {(field.options ?? []).map(o => {
              const on = arr.includes(o);
              return (
                <button key={o} type="button" onClick={() => toggle(o)}
                  className={`px-2 py-0.5 text-[11px] rounded-full border transition-quick ${on ? 'border-accent bg-accent/10 text-accent' : 'border-border-color bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}>
                  {o}
                </button>
              );
            })}
            {(field.options ?? []).length === 0 && <span className="text-[11px] text-text-secondary/70">No options defined.</span>}
          </div>
        </div>
      );
    }
    default: {
      const inputType = field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'url' ? 'url' : 'text';
      return (
        <label className="block">{labelEl}
          <input type={inputType} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={base} />
        </label>
      );
    }
  }
}
