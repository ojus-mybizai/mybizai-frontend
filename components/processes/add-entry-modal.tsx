'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  addEntry, type BusinessProcess, type ProcessEntry, type ProcessStage,
} from '@/services/processes';
import { DateField } from '@/components/ui/date-field';
import { listLeadsForSelect, type LeadOption } from '@/services/customers';
import { contactsService, type Contact } from '@/services/contacts';
import { listFields, queryRecords } from '@/services/dynamic-data';

interface Props {
  open: boolean;
  onClose: () => void;
  process: BusinessProcess;
  stages: ProcessStage[];
  initialStageId?: number;
  onAdded: (entry: ProcessEntry) => void;
}

// Field types (from DynamicField.field_type) we treat as a record's display
// label or phone when picking a datasheet record. Kept permissive so it works
// across the loosely-typed datasheet field catalog.
const TEXT_LIKE = new Set([
  'text', 'string', 'short_text', 'long_text', 'textarea', 'name', 'title', 'email',
]);
const PHONE_LIKE = new Set(['phone', 'tel', 'mobile', 'phone_number', 'whatsapp']);

/** A datasheet record flattened into a pickable option. */
interface RecordOption { id: number; label: string; phone: string; }

export default function AddEntryModal({ open, onClose, process, stages, initialStageId, onAdded }: Props) {
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [records, setRecords] = useState<RecordOption[]>([]);
  const [entitySearch, setEntitySearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // For datasheet_record pipelines: which field to show as the label / phone.
  const [labelField, setLabelField] = useState<string | null>(null);
  const [phoneField, setPhoneField] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [selectedPhone, setSelectedPhone] = useState('');

  const [stageId, setStageId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | ''>('');
  const [expectedValue, setExpectedValue] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isDatasheet = process.entity_type === 'datasheet_record';
  // "lead" pipelines are legacy — Lead is now an alias for Contact, so they
  // pick from the same contacts table. Both use the contact/lead picker.
  const isPerson = process.entity_type === 'lead' || process.entity_type === 'contact';

  const entityNoun = isDatasheet
    ? (process.dynamic_model_name || 'record')
    : process.entity_type === 'contact' ? 'Contact' : 'Lead';

  useEffect(() => {
    if (open) {
      setStageId(initialStageId ?? (stages.find(s => s.stage_type === 'active')?.id ?? stages[0]?.id ?? null));
    } else {
      setSelectedId(null); setSelectedName(''); setSelectedPhone('');
      setTitle(''); setPriority(''); setExpectedValue(''); setExpectedCloseDate('');
      setSource(''); setNotes(''); setError(''); setEntitySearch('');
      setRecords([]); setLabelField(null); setPhoneField(null);
    }
  }, [open, initialStageId, stages]);

  // Resolve the label / phone fields for a datasheet pipeline once on open.
  useEffect(() => {
    if (!open || !isDatasheet || !process.dynamic_model_id) return;
    let cancelled = false;
    listFields(process.dynamic_model_id)
      .then(fields => {
        if (cancelled) return;
        const sorted = [...fields].sort((a, b) => a.order_index - b.order_index);
        const label =
          sorted.find(f => TEXT_LIKE.has(f.field_type)) ||
          sorted.find(f => f.is_searchable) ||
          sorted[0] || null;
        const phone = sorted.find(f => PHONE_LIKE.has(f.field_type)) || null;
        setLabelField(label?.name ?? null);
        setPhoneField(phone?.name ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, isDatasheet, process.dynamic_model_id]);

  // Debounced entity search — leads, contacts, or datasheet records.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setSearchLoading(true);
      if (process.entity_type === 'lead') {
        listLeadsForSelect({ search: entitySearch || undefined, per_page: 50 })
          .then(setLeads).catch(() => {}).finally(() => setSearchLoading(false));
      } else if (process.entity_type === 'contact') {
        contactsService.list({ search: entitySearch || undefined, limit: 50 })
          .then(res => setContacts(res.items)).catch(() => {}).finally(() => setSearchLoading(false));
      } else if (isDatasheet && process.dynamic_model_id) {
        queryRecords(process.dynamic_model_id, { keyword: entitySearch || undefined, per_page: 50 })
          .then(res => setRecords(res.items.map(toRecordOption)))
          .catch(() => {})
          .finally(() => setSearchLoading(false));
      } else {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // labelField / phoneField are read inside toRecordOption via closure below;
    // re-run when they resolve so labels render correctly.
  }, [open, entitySearch, process.entity_type, process.dynamic_model_id, labelField, phoneField]);

  // Flatten a raw query item into a pickable record option. Defensive about
  // the item shape (data may be nested under `data` / `normalized_data`).
  function toRecordOption(item: Record<string, unknown>): RecordOption {
    const anyItem = item as any;
    const id = Number(anyItem.id ?? anyItem.record_id);
    const data = (anyItem.data ?? anyItem.normalized_data ?? anyItem) as Record<string, unknown>;
    let label = '';
    if (labelField && data && data[labelField] != null && String(data[labelField]).trim() !== '') {
      label = String(data[labelField]);
    }
    if (!label) label = anyItem.record_key ? String(anyItem.record_key) : `Record #${id}`;
    let phone = '';
    if (phoneField && data && data[phoneField] != null) phone = String(data[phoneField]);
    return { id, label, phone };
  }

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) { setError(`Please select a ${isDatasheet ? 'record' : 'record'}`); return; }
    setSubmitting(true); setError('');
    try {
      const entry = await addEntry(process.id, {
        entity_id: selectedId,
        entity_name: selectedName || undefined,
        entity_phone: selectedPhone || undefined,
        stage_id: stageId ?? undefined,
        title: title.trim() || undefined,
        priority: priority || undefined,
        expected_value: expectedValue.trim() === '' ? undefined : Number(expectedValue),
        expected_close_date: expectedCloseDate || undefined,
        source: source.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onAdded(entry);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add entry');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border-color bg-card-bg p-6 shadow-xl mx-4">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Add Entry to {process.name}</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Entity picker — person (lead/contact) OR datasheet record */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Select {entityNoun} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={entitySearch}
              onChange={(e) => setEntitySearch(e.target.value)}
              placeholder={isDatasheet ? 'Search records…' : 'Search by name or phone…'}
              className="w-full mb-1.5 rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <div className="max-h-40 overflow-y-auto rounded-md border border-border-color bg-bg-primary">
              {searchLoading && <div className="px-3 py-2 text-xs text-text-secondary">Searching…</div>}

              {process.entity_type === 'lead' && leads.map(l => (
                <button
                  key={l.id} type="button"
                  onClick={() => { setSelectedId(l.id); setSelectedName(l.name || l.phone); setSelectedPhone(l.phone); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg-secondary ${selectedId === l.id ? 'bg-accent/10 text-accent font-medium' : 'text-text-primary'}`}
                >
                  <span className="font-medium">{l.name || 'Unnamed'}</span>
                  <span className="ml-2 text-text-secondary">{l.phone}</span>
                </button>
              ))}

              {process.entity_type === 'contact' && contacts.map(c => (
                <button
                  key={c.id} type="button"
                  onClick={() => { setSelectedId(c.id); setSelectedName(c.name ?? c.phone ?? String(c.id)); setSelectedPhone(c.phone ?? ''); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg-secondary ${selectedId === c.id ? 'bg-accent/10 text-accent font-medium' : 'text-text-primary'}`}
                >
                  <span className="font-medium">{c.name || 'Unnamed'}</span>
                  <span className="ml-2 text-text-secondary">{c.phone}</span>
                </button>
              ))}

              {isDatasheet && records.map(r => (
                <button
                  key={r.id} type="button"
                  onClick={() => { setSelectedId(r.id); setSelectedName(r.label); setSelectedPhone(r.phone); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg-secondary ${selectedId === r.id ? 'bg-accent/10 text-accent font-medium' : 'text-text-primary'}`}
                >
                  <span className="font-medium">{r.label}</span>
                  {r.phone && <span className="ml-2 text-text-secondary">{r.phone}</span>}
                </button>
              ))}

              {!searchLoading && (
                (process.entity_type === 'lead' && leads.length === 0) ||
                (process.entity_type === 'contact' && contacts.length === 0) ||
                (isDatasheet && records.length === 0)
              ) && (
                <div className="px-3 py-2 text-xs text-text-secondary">
                  {isDatasheet ? 'No records found. Add rows to this datasheet first.' : 'No matches.'}
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Deal title</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 expansion deal"
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Value + close */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Expected value (₹)</label>
              <input
                type="number" value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Expected close</label>
              <DateField
                value={expectedCloseDate} onChange={setExpectedCloseDate}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {/* Priority + Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Priority</label>
              <select
                value={priority} onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">—</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Stage</label>
              <select
                value={stageId ?? ''} onChange={(e) => setStageId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Source</label>
            <input
              type="text" value={source} onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. referral, website, ads"
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={submitting}
              className="rounded-md border border-border-color bg-bg-secondary px-4 py-1.5 text-sm font-medium hover:bg-bg-primary">
              Cancel
            </button>
            <button type="submit" disabled={submitting || !selectedId}
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50">
              {submitting ? 'Adding…' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
