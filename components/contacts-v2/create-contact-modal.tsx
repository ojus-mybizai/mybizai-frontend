'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, User, Mail, Building2, Loader2, Users, LayoutList } from 'lucide-react';
import { useContactV2Store } from '@/lib/contact-v2-store';
import type { Contact, Priority } from '@/services/contacts-v2';
import { PhoneInput, validatePhone } from '@/components/ui/phone-input';
import { listSourceDefs, type ContactSourceDef } from '@/services/contact-source-defs';
import {
  listFieldDefs, setContactCustomFields,
  type ContactFieldDef,
} from '@/services/contact-field-defs';

interface Props {
  open: boolean;
  onClose: () => void;
  editContact?: Contact | null;
}

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'hot',    label: '🔥 Hot',    color: 'text-red-500' },
  { value: 'high',   label: '↑ High',   color: 'text-orange-500' },
  { value: 'medium', label: '— Medium', color: 'text-yellow-500' },
  { value: 'low',    label: '↓ Low',    color: 'text-blue-400' },
];

// Fallback used only until the configurable source registry loads.
const FALLBACK_SOURCES: { key: string; label: string }[] = [
  { key: 'manual', label: 'Manual' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'meta_ads', label: 'Meta Ads' },
  { key: 'csv', label: 'CSV Import' },
  { key: 'api', label: 'API' },
  { key: 'web_form', label: 'Web Form' },
];

export function CreateContactModal({ open, onClose, editContact }: Props) {
  const { create, update, groups, loadGroups, addToGroup, removeFromGroup } = useContactV2Store();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    priority: 'medium' as Priority,
    notes: '',
    contact_source: 'manual',
    routing_mode: 'ai' as 'ai' | 'manual' | 'blocked',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  // null = not loaded yet (or load failed) → show FALLBACK_SOURCES.
  // [] = loaded and the business intentionally has no sources → show nothing.
  const [sourceDefs, setSourceDefs] = useState<ContactSourceDef[] | null>(null);

  // Group memberships this contact should have. Preselected from the contact
  // when editing; the set of applicable custom fields keys off this.
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  // The group ids the contact had when the modal opened — used to diff on save
  // so we only add/remove memberships that actually changed.
  const [initialGroupIds, setInitialGroupIds] = useState<number[]>([]);
  // All custom field definitions for the business (global + group-scoped).
  const [fieldDefs, setFieldDefs] = useState<ContactFieldDef[]>([]);
  // Working copy of custom field values, keyed by field def id (string).
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});

  // Populate form when editing
  useEffect(() => {
    if (editContact) {
      setForm({
        name: editContact.name ?? '',
        phone: editContact.phone ?? '',
        email: editContact.email ?? '',
        company: editContact.company ?? '',
        priority: editContact.priority ?? 'medium',
        notes: editContact.notes ?? '',
        contact_source: editContact.contact_source ?? 'manual',
        routing_mode: editContact.routing_mode ?? 'ai',
      });
      const gids = editContact.group_ids ?? [];
      setSelectedGroupIds(gids);
      setInitialGroupIds(gids);
      setFieldValues(editContact.custom_fields ?? {});
    } else {
      setForm(f => ({ ...f, name: '', phone: '', email: '', company: '', notes: '' }));
      setSelectedGroupIds([]);
      setInitialGroupIds([]);
      setFieldValues({});
    }
    setError(null);
    setNotice(null);
    setPhoneError(null);
  }, [editContact, open]);

  // Load reference data when the modal opens: source registry, groups, and the
  // custom field definitions used to render dynamic inputs.
  useEffect(() => {
    if (!open) return;
    // On error keep null so the fallback list is used; on success use whatever
    // the business configured — including an empty list if they removed them all.
    listSourceDefs().then(setSourceDefs).catch(() => setSourceDefs(null));
    loadGroups();
    listFieldDefs().then(setFieldDefs).catch(() => setFieldDefs([]));
  }, [open]);

  const sourceOptions = sourceDefs === null
    ? FALLBACK_SOURCES
    : sourceDefs.map(s => ({ key: s.key, label: s.label }));

  // Non-system groups only — system groups (source-based) are managed
  // automatically and shouldn't be hand-assigned here.
  const selectableGroups = useMemo(() => groups.filter(g => !g.is_system), [groups]);

  // Custom fields that apply given the currently selected groups: every global
  // field plus fields scoped to a selected group. Sorted global-first.
  const applicableFields = useMemo(() => {
    const sel = new Set(selectedGroupIds);
    return fieldDefs
      .filter(f => f.group_id === null || sel.has(f.group_id))
      .sort((a, b) =>
        (a.group_id === null ? 0 : 1) - (b.group_id === null ? 0 : 1)
        || a.sort_order - b.sort_order,
      );
  }, [fieldDefs, selectedGroupIds]);

  if (!open) return null;

  const set = (field: string, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  const toggleGroup = (id: number) =>
    setSelectedGroupIds(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id],
    );

  const setFieldValue = (fieldId: number, value: unknown) =>
    setFieldValues(v => ({ ...v, [String(fieldId)]: value }));

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent';

  function renderFieldInput(f: ContactFieldDef) {
    const key = String(f.id);
    const val = fieldValues[key];

    if (f.field_type === 'boolean') {
      return (
        <div className="flex gap-2">
          {[
            { v: true, label: 'Yes' },
            { v: false, label: 'No' },
          ].map(opt => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setFieldValue(f.id, val === opt.v ? undefined : opt.v)}
              className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-all ${
                val === opt.v
                  ? opt.v ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500'
                  : 'border-border-color text-text-secondary hover:border-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      );
    }

    if (f.field_type === 'select') {
      return (
        <select
          value={typeof val === 'string' ? val : ''}
          onChange={e => setFieldValue(f.id, e.target.value)}
          className={inputCls}
        >
          <option value="">— select —</option>
          {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    if (f.field_type === 'multi_select') {
      const arr = Array.isArray(val) ? (val as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {(f.options ?? []).map(o => {
            const selected = arr.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => setFieldValue(
                  f.id,
                  selected ? arr.filter(x => x !== o) : [...arr, o],
                )}
                className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                  selected
                    ? 'bg-accent text-white border-accent'
                    : 'border-border-color text-text-secondary hover:border-accent hover:text-accent'
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }

    if (f.field_type === 'textarea') {
      return (
        <textarea
          value={typeof val === 'string' ? val : ''}
          onChange={e => setFieldValue(f.id, e.target.value)}
          rows={2}
          className={inputCls + ' resize-none'}
        />
      );
    }

    return (
      <input
        type={f.field_type === 'number' ? 'number'
          : f.field_type === 'date' ? 'date'
          : f.field_type === 'email' ? 'email'
          : f.field_type === 'url' ? 'url'
          : 'text'}
        value={val === undefined || val === null ? '' : String(val)}
        onChange={e => setFieldValue(
          f.id,
          f.field_type === 'number'
            ? (e.target.value === '' ? undefined : Number(e.target.value))
            : e.target.value,
        )}
        className={inputCls}
      />
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name && !form.phone) {
      setError('Name or phone is required.');
      return;
    }
    // Validate phone format only when one was entered (phone is optional here).
    if (form.phone) {
      const validation = validatePhone(form.phone);
      if (!validation.valid) {
        setPhoneError(validation.error ?? 'Invalid phone number.');
        return;
      }
    }
    // Required custom fields must have a value.
    const missing = applicableFields.find(f => {
      if (!f.required) return false;
      const raw = fieldValues[String(f.id)];
      return raw === undefined || raw === null || raw === '' ||
        (Array.isArray(raw) && raw.length === 0);
    });
    if (missing) {
      setError(`"${missing.name}" is required.`);
      return;
    }
    setPhoneError(null);
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      let contactId: number;
      if (editContact) {
        await update(editContact.id, {
          name: form.name || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          company: form.company || undefined,
          priority: form.priority,
          notes: form.notes || undefined,
        });
        contactId = editContact.id;
      } else {
        const created = await create({
          name: form.name || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          company: form.company || undefined,
          priority: form.priority,
          notes: form.notes || undefined,
          contact_source: form.contact_source,
          routing_mode: form.routing_mode,
        });
        // Dedup hit — the backend returned an existing contact instead of
        // creating a new one. Tell the user rather than silently closing.
        if (created?.is_duplicate) {
          setNotice(
            `A contact with this phone or email already exists${created.name ? ` (${created.name})` : ''}. No duplicate was created.`,
          );
          setSaving(false);
          return;
        }
        contactId = created.id;
      }

      // Sync group memberships (diff against what the contact had on open).
      const initial = new Set(initialGroupIds);
      const selected = new Set(selectedGroupIds);
      const toAdd = selectedGroupIds.filter(id => !initial.has(id));
      const toRemove = initialGroupIds.filter(id => !selected.has(id));
      await Promise.all([
        ...toAdd.map(id => addToGroup(id, [contactId])),
        ...toRemove.map(id => removeFromGroup(id, [contactId])),
      ]);

      // Persist custom field values, but only for fields that apply to the
      // final group selection. Empty values are sent as null so the backend
      // clears them. Skip the call entirely when nothing applies.
      if (applicableFields.length > 0) {
        const payload: Record<string, unknown> = {};
        for (const f of applicableFields) {
          const raw = fieldValues[String(f.id)];
          const isEmpty =
            raw === undefined || raw === '' ||
            (Array.isArray(raw) && raw.length === 0);
          payload[String(f.id)] = isEmpty ? null : raw;
        }
        await setContactCustomFields(contactId, payload);
      }

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save contact.');
    } finally {
      setSaving(false);
    }
  }

  const isEdit = !!editContact;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-border-color bg-card-bg shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-4 border-b border-border-color">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
              <User className="h-4 w-4 text-accent" />
            </div>
            <h2 className="text-base font-semibold text-text-primary">
              {isEdit ? 'Edit Contact' : 'New Contact'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-bg-secondary text-text-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {notice && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-500">
              {notice}
            </div>
          )}

          {/* Name + Phone row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Full name"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Phone</label>
              <PhoneInput
                value={form.phone}
                onChange={(v) => { set('phone', v); if (phoneError) setPhoneError(null); }}
                defaultCountry="IN"
                error={phoneError ?? undefined}
                className="rounded-lg"
              />
            </div>
          </div>

          {/* Email + Company row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Company</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Company name"
                  value={form.company}
                  onChange={e => set('company', e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={e => set('priority', e.target.value as Priority)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
            >
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Source + Routing (create only) */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Source</label>
                <select
                  value={form.contact_source}
                  onChange={e => set('contact_source', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
                >
                  {/* Keep the contact's current source selectable even if it's not in the registry */}
                  {form.contact_source && !sourceOptions.some(o => o.key === form.contact_source) && (
                    <option value={form.contact_source}>{form.contact_source.replace(/_/g, ' ')}</option>
                  )}
                  {sourceOptions.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">AI Routing</label>
                <select
                  value={form.routing_mode}
                  onChange={e => set('routing_mode', e.target.value as 'ai' | 'manual' | 'blocked')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="ai">AI (auto-reply)</option>
                  <option value="manual">Manual (inbox)</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
          )}

          {/* Groups */}
          {selectableGroups.length > 0 && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-1.5">
                <Users className="h-3.5 w-3.5" />
                Groups
              </label>
              <div className="flex flex-wrap gap-1.5">
                {selectableGroups.map(g => {
                  const selected = selectedGroupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-all ${
                        selected
                          ? 'bg-accent text-white border-accent'
                          : 'border-border-color text-text-secondary hover:border-accent hover:text-accent'
                      }`}
                    >
                      {g.color && (
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: selected ? 'rgba(255,255,255,0.9)' : g.color }}
                        />
                      )}
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom fields (global + fields scoped to selected groups) */}
          {applicableFields.length > 0 && (
            <div className="space-y-3 rounded-xl border border-border-color bg-bg-secondary/40 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <LayoutList className="h-3.5 w-3.5" />
                Custom Fields
              </div>
              {applicableFields.map(f => (
                <div key={f.id}>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    {f.name}
                    {f.required && <span className="text-red-400 ml-0.5">*</span>}
                    {f.group_id !== null && f.group_name && (
                      <span className="ml-1.5 text-[10px] text-text-secondary/60">· {f.group_name}</span>
                    )}
                  </label>
                  {renderFieldInput(f)}
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
            <textarea
              placeholder="Internal notes about this contact..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent resize-none"
            />
          </div>
          </div>

          {/* Actions (fixed footer) */}
          <div className="flex shrink-0 gap-2 border-t border-border-color px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary hover:bg-card-bg text-text-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 text-sm rounded-lg bg-accent hover:bg-accent/90 text-white font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
