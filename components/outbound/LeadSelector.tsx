'use client';

/**
 * ContactSelector for campaign audience — search contacts from the CRM and
 * pick them via checkboxes. Supports search, pagination (100 per page), and
 * shows phone for easy identification.
 *
 * Internally uses the Contacts V2 API (/contacts-v2). The prop names retain
 * "lead" terminology only for backwards-compatibility with the campaign wizard.
 */

import { useCallback, useEffect, useState } from 'react';
import { contactsV2Service, type Contact } from '@/services/contacts-v2';

interface Props {
  selectedLeadIds: number[];
  onChange: (ids: number[]) => void;
}

export function LeadSelector({ selectedLeadIds, onChange }: Props) {
  const [search,   setSearch]   = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await contactsV2Service.list({
        search: search || undefined,
        limit: 100,
        offset: 0,
      });
      setContacts(res.contacts ?? []);
      setSearched(true);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Initial load
  useEffect(() => {
    void doSearch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: number) => {
    const set = new Set(selectedLeadIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange(Array.from(set));
  };

  const selectAll = () => {
    const withPhone = contacts.filter((c) => c.phone);
    const allIds = new Set([...selectedLeadIds, ...withPhone.map((c) => c.id)]);
    onChange(Array.from(allIds));
  };

  const deselectAll = () => {
    const currentIds = new Set(contacts.map((c) => c.id));
    onChange(selectedLeadIds.filter((id) => !currentIds.has(id)));
  };

  const contactsWithPhone = contacts.filter((c) => c.phone);

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void doSearch();
            }
          }}
          placeholder="Search by name, phone, or email…"
          className="flex-1 px-3 py-2 border border-border-color rounded-lg bg-bg-primary text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent text-sm"
        />
        <button
          type="button"
          onClick={doSearch}
          disabled={loading}
          className="px-4 py-2 border border-border-color rounded-lg hover:bg-bg-secondary text-text-secondary transition-colors text-sm"
        >
          {loading ? '…' : '🔍'}
        </button>
      </div>

      {/* Bulk actions */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">
          {selectedLeadIds.length} contact{selectedLeadIds.length !== 1 ? 's' : ''} selected
          {contactsWithPhone.length > 0 && (
            <> · {contactsWithPhone.length} shown with phone</>
          )}
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={selectAll}
            className="text-accent text-xs hover:underline"
          >
            Select all shown
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="text-red-500 text-xs hover:underline"
          >
            Deselect shown
          </button>
        </div>
      </div>

      {/* Contact list */}
      <div className="border border-border-color rounded-xl max-h-64 overflow-y-auto divide-y divide-border-color">
        {!searched ? (
          <div className="p-6 text-center text-text-secondary text-sm animate-pulse">
            Loading contacts…
          </div>
        ) : contactsWithPhone.length === 0 ? (
          <div className="p-6 text-center text-text-secondary text-sm">
            {search
              ? 'No contacts with a phone number match your search.'
              : 'No contacts with phone numbers found.'}
          </div>
        ) : (
          contactsWithPhone.map((contact) => {
            const checked = selectedLeadIds.includes(contact.id);
            return (
              <label
                key={contact.id}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-bg-secondary transition-colors ${
                  checked ? 'bg-accent/5' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(contact.id)}
                  className="rounded accent-accent"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {contact.name || 'Unnamed'}
                  </div>
                  <div className="text-xs text-text-secondary font-mono">
                    {contact.phone}
                  </div>
                </div>
                {contact.email && (
                  <div className="text-xs text-text-secondary truncate max-w-[140px]">
                    {contact.email}
                  </div>
                )}
              </label>
            );
          })
        )}
      </div>

      {contacts.length > 0 && contacts.length - contactsWithPhone.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {contacts.length - contactsWithPhone.length} contact(s) hidden — no phone number on file
        </p>
      )}
    </div>
  );
}
