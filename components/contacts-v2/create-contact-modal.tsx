'use client';

import { useState, useEffect } from 'react';
import { X, User, Mail, Building2, Loader2 } from 'lucide-react';
import { useContactV2Store } from '@/lib/contact-v2-store';
import type { Contact, Priority } from '@/services/contacts-v2';
import { PhoneInput, validatePhone } from '@/components/ui/phone-input';
import { listSourceDefs, type ContactSourceDef } from '@/services/contact-source-defs';

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
  const { create, update } = useContactV2Store();

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
  const [sourceDefs, setSourceDefs] = useState<ContactSourceDef[]>([]);

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
    } else {
      setForm(f => ({ ...f, name: '', phone: '', email: '', company: '', notes: '' }));
    }
    setError(null);
    setPhoneError(null);
  }, [editContact, open]);

  // Load the business-configurable source registry when the modal opens.
  useEffect(() => {
    if (!open) return;
    listSourceDefs().then(setSourceDefs).catch(() => setSourceDefs([]));
  }, [open]);

  const sourceOptions = sourceDefs.length > 0
    ? sourceDefs.map(s => ({ key: s.key, label: s.label }))
    : FALLBACK_SOURCES;

  if (!open) return null;

  const set = (field: string, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

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
    setPhoneError(null);
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (editContact) {
        await update(editContact.id, {
          name: form.name || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          company: form.company || undefined,
          priority: form.priority,
          notes: form.notes || undefined,
        });
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
      <div className="relative w-full max-w-lg rounded-2xl border border-border-color bg-card-bg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-color">
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
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
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

          {/* Actions */}
          <div className="flex gap-2 pt-1">
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
