'use client';

import { useState } from 'react';
import type { Contact } from '@/services/contacts';
import { createContact, type ContactCreatePayload } from '@/services/contacts';
import { SearchableSelect } from './searchable-select';

export interface ContactSelectWithCreateProps {
  contacts: Contact[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  value: string;
  onChange: (contactId: string) => void;
  onContactCreated?: (contact: Contact) => void;
  disabled?: boolean;
  label?: string;
}

function contactToOption(c: Contact): { value: string | number; label: string } {
  const label = [c.full_name, c.phone, c.email].filter(Boolean).join(' · ');
  return { value: c.id, label: label || `Contact #${c.id}` };
}

export function ContactSelectWithCreate({
  contacts,
  loading,
  loadError,
  onRetry,
  value,
  onChange,
  onContactCreated,
  disabled = false,
  label = 'Contact',
}: ContactSelectWithCreateProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const options = contacts.map(contactToOption);
  const emptyMessage = 'No contacts found. Add a new contact below.';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFullName.trim();
    if (!name) {
      setCreateError('Name is required.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const payload: ContactCreatePayload = {
        full_name: name,
        phone: newPhone.trim() || null,
        email: newEmail.trim() || null,
      };
      const contact = await createContact(payload);
      onContactCreated?.(contact);
      onChange(String(contact.id));
      setShowNewForm(false);
      setNewFullName('');
      setNewPhone('');
      setNewEmail('');
    } catch (err) {
      setCreateError((err as Error).message ?? 'Failed to create contact');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-medium text-text-secondary">{label}</label>
      <SearchableSelect
        options={options}
        value={value}
        onChange={(v) => onChange(String(v))}
        placeholder="Search or select contact"
        loading={loading}
        error={loadError}
        emptyMessage={emptyMessage}
        onRetry={onRetry}
        disabled={disabled}
        aria-label={label}
      />

      {!showNewForm ? (
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="text-xs text-text-secondary hover:underline"
        >
          + Add new contact
        </button>
      ) : (
        <div className="rounded-md border border-border-color bg-bg-secondary/40 p-3 space-y-2">
          <p className="text-[11px] font-medium text-text-secondary">New contact</p>
          <form onSubmit={handleCreate} className="space-y-2">
            <input
              type="text"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="Full name *"
              required
              className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary placeholder:text-text-secondary"
            />
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone"
              className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary placeholder:text-text-secondary"
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-sm text-text-primary placeholder:text-text-secondary"
            />
            {createError && (
              <p className="text-xs text-red-600">{createError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="rounded bg-text-primary px-2 py-1 text-xs text-bg-primary hover:opacity-90 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create & use'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewForm(false);
                  setCreateError(null);
                }}
                className="rounded border border-border-color px-2 py-1 text-xs text-text-primary hover:bg-bg-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
