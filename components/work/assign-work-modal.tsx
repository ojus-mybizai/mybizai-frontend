'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import {
  createWork,
  createWorkFromTemplate,
  listWorkTemplates,
  listWorkTypes,
  type WorkTemplate,
  type WorkType,
} from '@/services/work';
import { listEmployees, type Employee } from '@/services/employees';
import { listLeadsForSelect, type LeadOption } from '@/services/customers';
import { listFields, type DynamicField } from '@/services/dynamic-data';
import type { RecordFilterRow } from '@/services/work';

export interface AssignWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (workId: number) => void;
  initialLeadId?: number | null;
  /** When set, modal opens with this template pre-selected; work type and assignee are pre-filled from template. */
  initialTemplateId?: number | null;
}

export function AssignWorkModal({ isOpen, onClose, onCreated, initialLeadId = null, initialTemplateId = null }: AssignWorkModalProps) {
  const router = useRouter();
  const currentUserId = useAuthStore((s) => (s.user as { id?: number } | null)?.id ?? null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [templates, setTemplates] = useState<WorkTemplate[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadQuery, setLeadQuery] = useState('');
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [assignedToId, setAssignedToId] = useState<number | null>(null);
  const [workTypeId, setWorkTypeId] = useState<number | null>(null);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [recordLimit, setRecordLimit] = useState<string>('');
  const [filterRows, setFilterRows] = useState<RecordFilterRow[]>([]);
  const [datasheetFields, setDatasheetFields] = useState<DynamicField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = templateId != null ? templates.find((t) => t.id === templateId) : null;
  const isDatasheetTemplate = selectedTemplate?.template_type === 'datasheet';
  const linkedModelId = selectedTemplate?.linked_dynamic_model_id ?? null;
  const prevLinkedModelId = useRef<number | null>(null);

  const filteredLeads = leads.filter((lead) => {
    const query = leadQuery.trim().toLowerCase();
    if (!query) return true;
    const label = `${lead.name || ''} ${lead.phone || ''} ${lead.id}`.toLowerCase();
    return label.includes(query);
  });

  const applyDueOffset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().slice(0, 10));
  };

  useEffect(() => {
    if (isOpen) {
      listEmployees()
        .then((list) => setEmployees(list.filter((emp) => emp.id === 0 || emp.is_active)))
        .catch(() => setEmployees([]));
      listWorkTypes().then(setWorkTypes).catch(() => setWorkTypes([]));
      listWorkTemplates().then(setTemplates).catch(() => setTemplates([]));
      listLeadsForSelect({ per_page: 100 }).then(setLeads).catch(() => setLeads([]));
      setTemplateId(initialTemplateId ?? null);
      setWorkTypeId(null);
      setAssignedToId(null);
      setLeadId(initialLeadId);
      setLeadQuery('');
      setTitle('');
      setNotes('');
      setPriority('medium');
      setDueDate('');
      setRecordLimit('');
      setFilterRows([]);
      setDatasheetFields([]);
      setError(null);
    }
  }, [initialLeadId, initialTemplateId, isOpen]);

  // When a datasheet template is selected, load its fields for the filter builder
  useEffect(() => {
    if (!isOpen || !isDatasheetTemplate || linkedModelId == null) {
      setDatasheetFields([]);
      prevLinkedModelId.current = null;
      return;
    }
    if (prevLinkedModelId.current !== linkedModelId) {
      setFilterRows([]);
      prevLinkedModelId.current = linkedModelId;
    }
    setFieldsLoading(true);
    listFields(linkedModelId)
      .then(setDatasheetFields)
      .catch(() => setDatasheetFields([]))
      .finally(() => setFieldsLoading(false));
  }, [isOpen, isDatasheetTemplate, linkedModelId]);

  // When template is selected (by user or via initialTemplateId), pre-fill work type and assignee
  useEffect(() => {
    if (!isOpen || templateId == null || templates.length === 0) return;
    const t = templates.find((x) => x.id === templateId);
    if (t) {
      setWorkTypeId(t.work_type_id);
      setAssignedToId((prev) => prev ?? t.default_assigned_to_id ?? null);
    }
  }, [isOpen, templateId, templates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (templateId != null && assignedToId == null) {
      setError('Please select an assignee when creating work from a template.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let created;
      if (templateId != null) {
        const payload: Parameters<typeof createWorkFromTemplate>[1] = {
          assigned_to_id: assignedToId ?? undefined,
          work_type_id: workTypeId ?? undefined,
          lead_id: leadId || undefined,
          title: title.trim() || undefined,
          notes: notes.trim() || undefined,
          priority,
          due_date: dueDate || undefined,
        };
        const selTpl = templates.find((t) => t.id === templateId);
        if (selTpl?.template_type === 'datasheet') {
          if (recordLimit.trim()) {
            const n = parseInt(recordLimit, 10);
            if (!Number.isNaN(n) && n >= 1 && n <= 500) payload.record_limit = n;
          }
          const filters = filterRows.filter((r) => r.field && (r.value !== undefined && r.value !== '' || ['is_null', 'is_not_null'].includes(r.op || 'eq')));
          if (filters.length > 0) {
            payload.record_filters = filters.map((r) => {
              const op = r.op || 'eq';
              let value = r.value;
              if (op === 'in' && typeof value === 'string') {
                value = value.split(',').map((s) => s.trim()).filter(Boolean);
              }
              return { field: r.field, op, value };
            });
          }
        }
        created = await createWorkFromTemplate(templateId, payload);
      } else {
        if (workTypeId == null || assignedToId == null) {
          setError('Please select a work type and an employee.');
          setLoading(false);
          return;
        }
        created = await createWork({
          work_type_id: workTypeId,
          assigned_to_id: assignedToId,
          lead_id: leadId || undefined,
          title: title.trim() || undefined,
          notes: notes.trim() || undefined,
          priority,
          due_date: dueDate || undefined,
        });
      }
      onClose();
      onCreated?.(created.id);
      router.push(`/work/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign work');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border-color bg-card-bg p-6 m-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-primary">Assign work</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-text-secondary">
          Assign work quickly with defaults, priority, and optional customer linking.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Template (optional)</label>
            <select
              value={templateId ?? ''}
              onChange={(e) => setTemplateId(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">No template</option>
              {templates.filter((t) => t.is_active).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.template_type && t.template_type !== 'simple' ? ` (${t.template_type})` : ''}
                </option>
              ))}
            </select>
          </div>
          {isDatasheetTemplate && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Filter records (optional)</label>
                <p className="mb-2 text-xs text-text-secondary">Only assign rows that match these conditions (e.g. payment = pending).</p>
                {fieldsLoading ? (
                  <p className="text-sm text-text-secondary">Loading fields…</p>
                ) : (
                  <div className="space-y-2">
                    {filterRows.map((row, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border border-border-color bg-bg-primary p-2">
                        <select
                          value={row.field}
                          onChange={(e) => {
                            const next = [...filterRows];
                            next[idx] = { ...next[idx], field: e.target.value };
                            setFilterRows(next);
                          }}
                          className="min-w-[100px] rounded border border-border-color bg-bg-secondary px-2 py-1.5 text-sm text-text-primary"
                        >
                          <option value="">Field</option>
                          {datasheetFields.map((f) => (
                            <option key={f.id} value={f.name}>{f.display_name || f.name}</option>
                          ))}
                        </select>
                        <select
                          value={row.op ?? 'eq'}
                          onChange={(e) => {
                            const next = [...filterRows];
                            next[idx] = { ...next[idx], op: e.target.value };
                            setFilterRows(next);
                          }}
                          className="rounded border border-border-color bg-bg-secondary px-2 py-1.5 text-sm text-text-primary"
                        >
                          <option value="eq">equals</option>
                          <option value="ne">not equals</option>
                          <option value="contains">contains</option>
                          <option value="gt">&gt;</option>
                          <option value="gte">≥</option>
                          <option value="lt">&lt;</option>
                          <option value="lte">≤</option>
                          <option value="in">in (comma-separated)</option>
                          <option value="is_null">is empty</option>
                          <option value="is_not_null">is not empty</option>
                        </select>
                        {row.op !== 'is_null' && row.op !== 'is_not_null' && (
                          <input
                            type="text"
                            value={row.value != null ? String(row.value) : ''}
                            onChange={(e) => {
                              const next = [...filterRows];
                              const v = e.target.value;
                              next[idx] = { ...next[idx], value: v };
                              setFilterRows(next);
                            }}
                            placeholder="Value"
                            className="min-w-[80px] flex-1 rounded border border-border-color bg-bg-secondary px-2 py-1.5 text-sm text-text-primary"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setFilterRows((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                          aria-label="Remove filter"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFilterRows((prev) => [...prev, { field: '', op: 'eq', value: '' }])}
                      className="rounded-md border border-dashed border-border-color px-3 py-1.5 text-sm text-text-secondary hover:border-accent hover:text-accent"
                    >
                      + Add filter
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Record limit (optional)</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={recordLimit}
                  onChange={(e) => setRecordLimit(e.target.value)}
                  placeholder="e.g. 20 — leave empty for all matching records"
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p className="mt-1 text-xs text-text-secondary">Max records to assign (after filters). Empty = all matching.</p>
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">
              Work type {templateId != null ? '(from template)' : '*'}
            </label>
            <select
              value={workTypeId ?? ''}
              onChange={(e) => setWorkTypeId(e.target.value === '' ? null : Number(e.target.value))}
              disabled={templateId != null}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <option value="">Select type</option>
              {workTypes.filter((t) => t.is_active).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-secondary">
              {templateId != null ? 'Pre-filled from template.' : 'Required when no template is selected.'}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Assign to *</label>
            <div className="space-y-2">
              <select
                value={assignedToId ?? ''}
                onChange={(e) => setAssignedToId(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.user_id} value={emp.user_id}>
                    {emp.name || emp.email}{emp.id === 0 ? ' (Owner)' : ''}
                  </option>
                ))}
              </select>
              {currentUserId != null && (
                <button
                  type="button"
                  onClick={() => setAssignedToId(currentUserId)}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Assign to me
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-text-secondary">Required when no template default assignee is available.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deliver order #123"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Link to lead (optional)</label>
            <input
              type="text"
              value={leadQuery}
              onChange={(e) => setLeadQuery(e.target.value)}
              placeholder="Search customer by name or phone"
              className="mb-2 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <select
              value={leadId ?? ''}
              onChange={(e) => setLeadId(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">None</option>
              {filteredLeads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name || l.phone || `Lead #${l.id}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Priority</label>
            <div className="flex flex-wrap gap-2">
              {(['low', 'medium', 'high'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    priority === value
                      ? 'bg-accent text-white'
                      : 'border border-border-color bg-bg-primary text-text-secondary hover:border-accent hover:text-text-primary'
                  }`}
                >
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Due date (optional)</label>
            <div className="space-y-2">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => applyDueOffset(0)} className="rounded-md border border-border-color px-2 py-1 text-xs text-text-secondary hover:border-accent">Today</button>
                <button type="button" onClick={() => applyDueOffset(1)} className="rounded-md border border-border-color px-2 py-1 text-xs text-text-secondary hover:border-accent">Tomorrow</button>
                <button type="button" onClick={() => applyDueOffset(3)} className="rounded-md border border-border-color px-2 py-1 text-xs text-text-secondary hover:border-accent">+3 days</button>
                <button type="button" onClick={() => applyDueOffset(7)} className="rounded-md border border-border-color px-2 py-1 text-xs text-text-secondary hover:border-accent">+1 week</button>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Instructions or context"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Assign work'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
