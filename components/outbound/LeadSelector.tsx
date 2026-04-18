'use client';

/**
 * Lead selector for campaign audience — search existing CRM leads and
 * pick them via checkboxes. Supports search, pagination, and shows
 * phone + stage for easy identification.
 */

import { useCallback, useEffect, useState } from 'react';
import { listLeadsForSelect, type LeadOption } from '@/services/customers';

interface Props {
  selectedLeadIds: number[];
  onChange: (ids: number[]) => void;
}

export function LeadSelector({ selectedLeadIds, onChange }: Props) {
  const [search, setSearch] = useState('');
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listLeadsForSelect({
        search: search || undefined,
        per_page: 100,
      });
      setLeads(data);
      setSearched(true);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Initial load
  useEffect(() => {
    void doSearch();
  }, []);

  const toggle = (id: number) => {
    const set = new Set(selectedLeadIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange(Array.from(set));
  };

  const selectAll = () => {
    const allIds = new Set([...selectedLeadIds, ...leads.filter((l) => l.phone).map((l) => l.id)]);
    onChange(Array.from(allIds));
  };

  const deselectAll = () => {
    const currentIds = new Set(leads.map((l) => l.id));
    onChange(selectedLeadIds.filter((id) => !currentIds.has(id)));
  };

  const leadsWithPhone = leads.filter((l) => l.phone);

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
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
        />
        <button
          type="button"
          onClick={doSearch}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-md hover:bg-gray-50 dark:hover:bg-neutral-800"
        >
          {loading ? '…' : '🔍'}
        </button>
      </div>

      {/* Bulk actions */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          {selectedLeadIds.length} lead{selectedLeadIds.length !== 1 ? 's' : ''} selected
          {leadsWithPhone.length > 0 && (
            <> · {leadsWithPhone.length} shown with phone</>
          )}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={selectAll} className="text-primary text-xs hover:underline">
            Select all shown
          </button>
          <button type="button" onClick={deselectAll} className="text-red-600 text-xs hover:underline">
            Deselect shown
          </button>
        </div>
      </div>

      {/* Lead list */}
      <div className="border border-gray-200 dark:border-neutral-800 rounded-md max-h-64 overflow-y-auto divide-y divide-gray-200 dark:divide-neutral-800">
        {!searched ? (
          <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>
        ) : leadsWithPhone.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            {search
              ? 'No leads with a phone number match your search.'
              : 'No leads with phone numbers found.'}
          </div>
        ) : (
          leadsWithPhone.map((lead) => {
            const checked = selectedLeadIds.includes(lead.id);
            return (
              <label
                key={lead.id}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 ${
                  checked ? 'bg-primary/5' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(lead.id)}
                  className="rounded"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {lead.name || 'Unnamed'}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">{lead.phone}</div>
                </div>
                {lead.email && (
                  <div className="text-xs text-gray-400 truncate max-w-[140px]">
                    {lead.email}
                  </div>
                )}
              </label>
            );
          })
        )}
      </div>

      {leads.length > 0 && leads.length - leadsWithPhone.length > 0 && (
        <p className="text-xs text-amber-600">
          {leads.length - leadsWithPhone.length} lead(s) hidden (no phone number)
        </p>
      )}
    </div>
  );
}
