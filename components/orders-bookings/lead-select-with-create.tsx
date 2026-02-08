'use client';

import { useState } from 'react';
import type { LeadOption } from '@/services/customers';
import { listLeadsForSelect, createLead, type LeadCreate } from '@/services/customers';
import { SearchableSelect } from './searchable-select';

export interface LeadSelectWithCreateProps {
  leads: LeadOption[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  value: string;
  onChange: (leadId: string) => void;
  onLeadCreated?: (lead: LeadOption) => void;
  disabled?: boolean;
  label?: string;
}

function leadToOption(l: LeadOption): { value: string | number; label: string } {
  const label = [l.name, l.phone, l.email].filter(Boolean).join(' · ');
  return { value: l.id, label: label || `Lead #${l.id}` };
}

export function LeadSelectWithCreate({
  leads,
  loading,
  loadError,
  onRetry,
  value,
  onChange,
  onLeadCreated,
  disabled = false,
  label = 'Lead',
}: LeadSelectWithCreateProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const options = leads.map(leadToOption);
  const emptyMessage = 'No leads found. Add a new lead below.';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    const phone = newPhone.trim();
    if (!name && !phone) {
      setCreateError('Name or phone is required.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const payload: LeadCreate = {
        name: name?.trim() ?? '',
        phone: phone?.trim() ?? '',
        email: newEmail.trim() || undefined,
      };
      const created = await createLead(payload);
      const leadOption: LeadOption = {
        id: Number(created.id),
        name: created.name ?? null,
        phone: created.phone ?? '',
        email: created.email ?? null,
      };
      onLeadCreated?.(leadOption);
      onChange(String(leadOption.id));
      setShowNewForm(false);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
    } catch (err) {
      setCreateError((err as Error).message ?? 'Failed to create lead');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-text-secondary">{label}</label>
      <SearchableSelect
        options={options}
        value={value}
        onChange={(v) => onChange(String(v))}
        placeholder="Search or select lead"
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
          className="text-sm font-medium text-text-secondary hover:underline"
        >
          + Add new lead
        </button>
      ) : (
        <div className="rounded-lg border border-border-color bg-bg-secondary/40 p-4 space-y-3">
          <p className="text-sm font-medium text-text-secondary">New lead</p>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary placeholder:text-text-secondary"
            />
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary placeholder:text-text-secondary"
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2.5 text-base text-text-primary placeholder:text-text-secondary"
            />
            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-bg-primary hover:opacity-90 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create & use'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewForm(false);
                  setCreateError(null);
                }}
                className="rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
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
