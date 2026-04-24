'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  getSequence, updateSequence, addStep, updateStep, deleteStep, previewStep,
  listEnrollments, enrollLeads, pauseEnrollment, resumeEnrollment, cancelEnrollment,
  getSequenceAnalytics,
  type NurtureSequence, type NurtureStep, type NurtureEnrollment, type SequenceAnalytics,
} from '@/services/nurture';
import { listCustomers, type Customer } from '@/services/customers';
import { listMessageTemplates, type MessageTemplate } from '@/services/message-templates';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDelay(days: number, hours: number) {
  if (days === 0 && hours === 0) return 'Immediately';
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  return parts.join(' ');
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    draft:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    archived: 'bg-gray-100 text-gray-400',
    paused:   'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    completed:'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    cancelled:'bg-gray-100 text-gray-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cfg[status] ?? cfg.draft}`}>
      {status}
    </span>
  );
}

// ─── Step Editor (slide-over panel) ───────────────────────────────────────────

interface StepEditorProps {
  step: Partial<NurtureStep> & { step_number: number };
  sequenceId: number;
  isNew: boolean;
  onSave: (step: NurtureStep) => void;
  onClose: () => void;
  previewLeadId?: number;
  leads: Customer[];
}

function StepEditor({ step, sequenceId, isNew, onSave, onClose, leads }: StepEditorProps) {
  const [approvedTemplates, setApprovedTemplates] = useState<MessageTemplate[]>([]);
  const [form, setForm] = useState({
    delay_days: step.delay_days ?? 1,
    delay_hours: step.delay_hours ?? 0,
    message_type: step.message_type ?? 'ai_generated' as 'ai_generated' | 'template',
    template_id: step.template_id ?? null as number | null,
    ai_instructions: step.ai_instructions ?? '',
    send_window_start: step.send_window_start ?? '09:00',
    send_window_end: step.send_window_end ?? '18:00',
    skip_weekends: step.skip_weekends ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewLeadId, setPreviewLeadId] = useState(leads[0]?.id ? Number(leads[0].id) : 0);

  useEffect(() => {
    listMessageTemplates({ channel: 'whatsapp', meta_status: 'approved', is_active: true })
      .then(setApprovedTemplates)
      .catch(() => {});
  }, []);

  const selectedTemplate = approvedTemplates.find(t => t.id === form.template_id) ?? null;

  const set = (key: string, val: unknown) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      let saved: NurtureStep;
      if (isNew) {
        saved = await addStep(sequenceId, { ...form, step_number: step.step_number });
      } else {
        saved = await updateStep(sequenceId, step.id!, form);
      }
      onSave(saved);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!step.id || !previewLeadId) return;
    setPreviewing(true);
    try {
      const text = await previewStep(sequenceId, step.id, previewLeadId);
      setPreviewText(text);
    } catch {
      setPreviewText('Preview failed — check AI agent settings.');
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-[480px] bg-card-bg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4 shrink-0">
          <h2 className="font-semibold text-text-primary">
            {isNew ? `Add Step ${step.step_number}` : `Edit Step ${step.step_number}`}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Delay */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Send after</label>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <span className="text-xs text-text-secondary">Days</span>
                <input type="number" min={0} value={form.delay_days}
                  onChange={e => set('delay_days', Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
              <div className="flex-1 space-y-1">
                <span className="text-xs text-text-secondary">Hours</span>
                <input type="number" min={0} max={23} value={form.delay_hours}
                  onChange={e => set('delay_hours', Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
            </div>
            <p className="text-xs text-text-secondary">
              {step.step_number === 1 ? 'After enrollment' : 'After previous step'}
            </p>
          </div>

          {/* Message type */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Message Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'ai_generated', label: 'AI Generated', desc: 'Personalised using lead context' },
                { val: 'template', label: 'Approved Template', desc: 'Meta-approved WhatsApp HSM template' },
              ].map(opt => (
                <button key={opt.val} type="button"
                  onClick={() => set('message_type', opt.val)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    form.message_type === opt.val
                      ? 'border-accent bg-accent/5'
                      : 'border-border-color hover:border-accent/40'
                  }`}>
                  <div className="text-sm font-semibold text-text-primary">{opt.label}</div>
                  <div className="text-xs text-text-secondary mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* AI Instructions (shown when AI) */}
          {form.message_type === 'ai_generated' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                AI Instructions <span className="text-text-secondary font-normal normal-case">(optional hint)</span>
              </label>
              <textarea
                value={form.ai_instructions}
                onChange={e => set('ai_instructions', e.target.value)}
                rows={3}
                placeholder="e.g. Share a success story relevant to their industry. Keep it under 3 lines and end with a soft question."
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
              />
            </div>
          )}

          {/* Approved template picker (shown when template) */}
          {form.message_type === 'template' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                WhatsApp Template
              </label>
              {approvedTemplates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-color p-4 text-center">
                  <p className="text-sm text-text-secondary">No approved WhatsApp templates found.</p>
                  <Link href="/message-templates" className="mt-1 inline-block text-xs text-accent hover:underline">
                    Create &amp; submit templates for approval →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {approvedTemplates.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set('template_id', t.id)}
                      className={`w-full rounded-xl border p-3 text-left transition-all ${
                        form.template_id === t.id
                          ? 'border-accent bg-accent/5'
                          : 'border-border-color hover:border-accent/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-text-primary truncate">{t.name}</span>
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Approved
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary line-clamp-2 whitespace-pre-line">{t.body}</p>
                      {t.meta_template_name && (
                        <p className="mt-1 text-xs text-text-secondary/60 font-mono">{t.meta_template_name}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {selectedTemplate && (
                <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-1">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Preview</p>
                  <p className="text-sm text-text-primary whitespace-pre-line">{selectedTemplate.body}</p>
                  <p className="text-xs text-text-secondary/60">
                    Variables (<code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>…) will be replaced with lead data at send time.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Send window */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Send Window</label>
            <div className="flex items-center gap-3">
              <input type="time" value={form.send_window_start}
                onChange={e => set('send_window_start', e.target.value)}
                className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <span className="text-text-secondary text-sm">to</span>
              <input type="time" value={form.send_window_end}
                onChange={e => set('send_window_end', e.target.value)}
                className="rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.skip_weekends} onChange={e => set('skip_weekends', e.target.checked)}
                className="rounded border-border-color text-accent focus:ring-accent/40"
              />
              <span className="text-sm text-text-primary">Skip weekends</span>
            </label>
          </div>

          {/* Preview */}
          {!isNew && form.message_type === 'ai_generated' && leads.length > 0 && (
            <div className="space-y-2 rounded-xl border border-dashed border-border-color p-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Preview</label>
                <div className="flex items-center gap-2">
                  <select
                    value={previewLeadId}
                    onChange={e => setPreviewLeadId(Number(e.target.value))}
                    className="rounded-lg border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary"
                  >
                    {leads.slice(0, 20).map(l => (
                      <option key={l.id} value={Number(l.id)}>{l.name || l.phone || `Lead #${l.id}`}</option>
                    ))}
                  </select>
                  <button onClick={handlePreview} disabled={previewing}
                    className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                    {previewing ? 'Generating…' : 'Generate'}
                  </button>
                </div>
              </div>
              {previewText && (
                <div className="rounded-lg bg-bg-secondary p-3 text-sm text-text-primary whitespace-pre-wrap">
                  {previewText}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border-color px-5 py-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? 'Saving…' : isNew ? 'Add Step' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Enroll Modal ─────────────────────────────────────────────────────────────

function EnrollModal({ sequenceId, onClose, onDone }: { sequenceId: number; onClose: () => void; onDone: () => void }) {
  const [leads, setLeads] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [result, setResult] = useState<{ enrolled: number; skipped: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    listCustomers({ search: search || undefined, page: 1, perPage: 50 })
      .then(r => setLeads(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleEnroll = async () => {
    if (selected.size === 0) return;
    setEnrolling(true);
    try {
      const res = await enrollLeads(sequenceId, Array.from(selected));
      setResult(res);
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card-bg shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4 shrink-0">
          <h2 className="font-semibold text-text-primary">Enroll Leads</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {result ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-4">
              <svg className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">Enrolled!</h3>
            <p className="text-sm text-text-secondary mb-6">
              {result.enrolled} lead{result.enrolled !== 1 ? 's' : ''} enrolled
              {result.skipped > 0 ? `, ${result.skipped} skipped (already enrolled)` : ''}
            </p>
            <button onClick={onDone} className="rounded-lg bg-accent px-6 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-border-color shrink-0">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search leads…"
                  className="w-full rounded-lg border border-border-color bg-bg-primary pl-9 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-sm text-text-secondary animate-pulse">Loading leads…</div>
              ) : leads.length === 0 ? (
                <div className="p-6 text-center text-sm text-text-secondary">No leads found</div>
              ) : (
                <div className="divide-y divide-border-color">
                  {leads.map(lead => {
                    const id = Number(lead.id);
                    const checked = selected.has(id);
                    return (
                      <label key={lead.id} className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-bg-secondary transition-colors">
                        <input type="checkbox" checked={checked} onChange={() => toggle(id)}
                          className="rounded border-border-color text-accent focus:ring-accent/40"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-text-primary truncate">{lead.name || '—'}</div>
                          <div className="text-xs text-text-secondary truncate">{lead.phone || lead.email || ''}</div>
                        </div>
                        {lead.pipelineStageName && (
                          <span className="text-xs text-text-secondary bg-bg-secondary px-2 py-0.5 rounded-full shrink-0">{lead.pipelineStageName}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border-color px-5 py-4 flex items-center justify-between gap-3">
              <span className="text-sm text-text-secondary">{selected.size} selected</span>
              <div className="flex gap-2">
                <button onClick={onClose} className="rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors">Cancel</button>
                <button onClick={handleEnroll} disabled={selected.size === 0 || enrolling}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {enrolling ? 'Enrolling…' : `Enroll ${selected.size > 0 ? selected.size : ''} Lead${selected.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Steps Tab ────────────────────────────────────────────────────────────────

function StepsTab({ sequence, onUpdate }: { sequence: NurtureSequence; onUpdate: () => void }) {
  const [editingStep, setEditingStep] = useState<(Partial<NurtureStep> & { step_number: number }) | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [leads, setLeads] = useState<Customer[]>([]);

  useEffect(() => {
    listCustomers({ page: 1, perPage: 20 }).then(r => setLeads(r.items)).catch(() => {});
  }, []);

  const handleDeleteStep = async (step: NurtureStep) => {
    setDeleting(step.id);
    try {
      await deleteStep(sequence.id, step.id);
      onUpdate();
    } finally {
      setDeleting(null);
    }
  };

  const handleAddStep = () => {
    setIsNew(true);
    setEditingStep({ step_number: sequence.steps.length + 1 });
  };

  const steps = sequence.steps;

  return (
    <div className="space-y-3 py-4">
      {steps.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-secondary text-sm mb-4">No steps yet. Add your first message step to get started.</p>
          <button onClick={handleAddStep} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add First Step
          </button>
        </div>
      ) : (
        <>
          {steps.map((step, idx) => (
            <div key={step.id} className="flex gap-3">
              {/* Timeline connector */}
              <div className="flex flex-col items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                  step.message_type === 'ai_generated' ? 'bg-accent' : 'bg-text-secondary'
                }`}>
                  {step.step_number}
                </div>
                {idx < steps.length - 1 && <div className="w-px flex-1 bg-border-color my-1" />}
              </div>

              {/* Card */}
              <div className="flex-1 rounded-xl border border-border-color bg-card-bg p-4 mb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        step.message_type === 'ai_generated'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-bg-secondary text-text-secondary'
                      }`}>
                        {step.message_type === 'ai_generated' ? '✦ AI Generated' : '✎ Template'}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {idx === 0 ? 'Send ' : 'Wait '}
                        <span className="font-semibold text-text-primary">{fmtDelay(step.delay_days, step.delay_hours)}</span>
                        {idx > 0 ? ' after step ' + (step.step_number - 1) : ' after enrollment'}
                      </span>
                      <span className="text-xs text-text-secondary">
                        · {step.send_window_start}–{step.send_window_end}
                        {step.skip_weekends ? ' · No weekends' : ''}
                      </span>
                    </div>
                    {step.ai_instructions && (
                      <p className="mt-2 text-sm text-text-secondary italic truncate">"{step.ai_instructions}"</p>
                    )}
                    {step.message_type === 'template' && step.template_name && (
                      <div className="mt-2 rounded-lg bg-bg-secondary px-3 py-2 space-y-0.5">
                        <p className="text-xs font-medium text-text-secondary">{step.template_name}</p>
                        {step.template_body && (
                          <p className="text-sm text-text-primary line-clamp-2">{step.template_body}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => { setIsNew(false); setEditingStep(step); }}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium border border-border-color text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors">
                      Edit
                    </button>
                    <button onClick={() => handleDeleteStep(step)} disabled={deleting === step.id}
                      className="rounded-lg px-2 py-1.5 text-xs border border-border-color text-text-secondary hover:text-red-500 hover:border-red-300 transition-colors">
                      {deleting === step.id ? '…' : <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Add step button */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-px w-8" />
            </div>
            <button onClick={handleAddStep}
              className="flex items-center gap-2 rounded-xl border border-dashed border-border-color px-4 py-3 text-sm font-medium text-text-secondary hover:text-accent hover:border-accent transition-colors w-full">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Step {steps.length + 1}
            </button>
          </div>
        </>
      )}

      {editingStep && (
        <StepEditor
          step={editingStep}
          sequenceId={sequence.id}
          isNew={isNew}
          leads={leads}
          onSave={() => { setEditingStep(null); onUpdate(); }}
          onClose={() => setEditingStep(null)}
        />
      )}
    </div>
  );
}

// ─── Enrollments Tab ──────────────────────────────────────────────────────────

function EnrollmentsTab({ sequence }: { sequence: NurtureSequence }) {
  const [enrollments, setEnrollments] = useState<NurtureEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [acting, setActing] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listEnrollments({ sequence_id: sequence.id, status: statusFilter || undefined, per_page: 100 })
      .then(setEnrollments).catch(() => {}).finally(() => setLoading(false));
  }, [sequence.id, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handlePause = async (id: number) => {
    setActing(id);
    try { await pauseEnrollment(id); load(); } finally { setActing(null); }
  };
  const handleResume = async (id: number) => {
    setActing(id);
    try { await resumeEnrollment(id); load(); } finally { setActing(null); }
  };
  const handleCancel = async (id: number) => {
    if (!confirm('Cancel this enrollment?')) return;
    setActing(id);
    try { await cancelEnrollment(id); load(); } finally { setActing(null); }
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {['', 'active', 'paused', 'completed', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? 'bg-accent text-white' : 'border border-border-color text-text-secondary hover:bg-bg-secondary'
              }`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        {sequence.status === 'active' && (
          <button onClick={() => setShowEnrollModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Enroll Leads
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-bg-secondary animate-pulse" />)}</div>
      ) : enrollments.length === 0 ? (
        <div className="py-12 text-center text-sm text-text-secondary">No enrollments found</div>
      ) : (
        <div className="rounded-xl border border-border-color overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary border-b border-border-color">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Step</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Next Send</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Enrolled</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {enrollments.map(e => (
                <tr key={e.id} className="hover:bg-bg-secondary transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{e.lead_name || '—'}</div>
                    <div className="text-xs text-text-secondary">{e.lead_phone || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} />
                    {e.paused_reason === 'lead_replied' && (
                      <div className="text-xs text-text-secondary mt-0.5">Replied</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-primary">{e.current_step} / {e.total_steps}</td>
                  <td className="px-4 py-3 text-text-secondary">{fmtDate(e.next_send_at)}</td>
                  <td className="px-4 py-3 text-text-secondary">{fmtDate(e.enrolled_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-end">
                      {e.status === 'active' && (
                        <button onClick={() => handlePause(e.id)} disabled={acting === e.id}
                          className="rounded px-2.5 py-1 text-xs border border-border-color text-text-secondary hover:bg-bg-secondary transition-colors">
                          Pause
                        </button>
                      )}
                      {e.status === 'paused' && (
                        <button onClick={() => handleResume(e.id)} disabled={acting === e.id}
                          className="rounded px-2.5 py-1 text-xs border border-accent/40 text-accent hover:bg-accent/5 transition-colors">
                          Resume
                        </button>
                      )}
                      {(e.status === 'active' || e.status === 'paused') && (
                        <button onClick={() => handleCancel(e.id)} disabled={acting === e.id}
                          className="rounded px-2.5 py-1 text-xs border border-border-color text-text-secondary hover:text-red-500 hover:border-red-300 transition-colors">
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showEnrollModal && (
        <EnrollModal
          sequenceId={sequence.id}
          onClose={() => setShowEnrollModal(false)}
          onDone={() => { setShowEnrollModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ sequence }: { sequence: NurtureSequence }) {
  const [analytics, setAnalytics] = useState<SequenceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSequenceAnalytics(sequence.id).then(setAnalytics).catch(() => {}).finally(() => setLoading(false));
  }, [sequence.id]);

  if (loading) return <div className="py-12 text-center text-sm text-text-secondary animate-pulse">Loading analytics…</div>;
  if (!analytics) return <div className="py-12 text-center text-sm text-text-secondary">No data yet</div>;

  const maxSent = Math.max(...analytics.steps.map(s => s.sent_count), 1);

  return (
    <div className="py-4 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Enrolled', value: analytics.total_enrolled },
          { label: 'Active', value: analytics.active },
          { label: 'Completed', value: analytics.completed, sub: `${analytics.completion_rate}%` },
          { label: 'Overall Reply Rate', value: `${analytics.overall_reply_rate}%` },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-border-color bg-card-bg p-4">
            <div className="text-xs text-text-secondary mb-1">{stat.label}</div>
            <div className="text-2xl font-bold text-text-primary">{stat.value}</div>
            {stat.sub && <div className="text-xs text-text-secondary mt-0.5">{stat.sub} completion</div>}
          </div>
        ))}
      </div>

      {/* Step funnel */}
      {analytics.steps.length > 0 && (
        <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
          <div className="px-5 py-3 border-b border-border-color">
            <h3 className="text-sm font-semibold text-text-primary">Step Funnel</h3>
          </div>
          <div className="p-5 space-y-3">
            {analytics.steps.map(step => (
              <div key={step.step_number} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-text-primary">Step {step.step_number}</span>
                  <span className="text-text-secondary">
                    {step.sent_count} sent · {step.reply_count} replied ({step.reply_rate}%) · {step.failed_count} failed
                  </span>
                </div>
                <div className="h-5 rounded-full bg-bg-secondary overflow-hidden flex">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${(step.sent_count / maxSent) * 100}%` }}
                  />
                </div>
                <div className="flex gap-3 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                    {step.reply_count} replied
                  </span>
                  {step.failed_count > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-400 inline-block" />
                      {step.failed_count} failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export default function SequenceBuilderClient({ sequenceId }: { sequenceId: number }) {
  const [sequence, setSequence] = useState<NurtureSequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'steps' | 'enrollments' | 'analytics'>('steps');
  const [toggling, setToggling] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const load = useCallback(() => {
    getSequence(sequenceId).then(seq => { setSequence(seq); setLoading(false); }).catch(() => setLoading(false));
  }, [sequenceId]);

  useEffect(() => { load(); }, [load]);

  const handleToggleStatus = async () => {
    if (!sequence) return;
    setToggling(true);
    try {
      const newStatus = sequence.status === 'active' ? 'draft' : 'active';
      const updated = await updateSequence(sequence.id, { status: newStatus });
      setSequence(updated);
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <div className="p-8 animate-pulse text-text-secondary">Loading…</div>;
  if (!sequence) return <div className="p-8 text-text-secondary">Sequence not found.</div>;

  const tabs = [
    { key: 'steps' as const, label: `Steps (${sequence.steps.length})` },
    { key: 'enrollments' as const, label: `Enrollments (${sequence.active_enrolled})` },
    { key: 'analytics' as const, label: 'Analytics' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="mx-auto max-w-4xl px-6 py-8">

        {/* Back + Header */}
        <div className="mb-6">
          <Link href="/nurture" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            All Sequences
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-text-primary">{sequence.name}</h1>
                <StatusBadge status={sequence.status} />
              </div>
              {sequence.description && <p className="text-sm text-text-secondary mt-0.5">{sequence.description}</p>}
              <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary flex-wrap">
                <span>On reply: <span className="font-medium text-text-primary capitalize">{sequence.on_reply}</span></span>
                {sequence.agent_name && <span>Agent: <span className="font-medium text-text-primary">{sequence.agent_name}</span></span>}
                <span>{sequence.steps.length} step{sequence.steps.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {sequence.status === 'active' && (
                <button onClick={() => setShowEnrollModal(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Enroll Leads
                </button>
              )}
              <button onClick={handleToggleStatus} disabled={toggling}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  sequence.status === 'active'
                    ? 'border-border-color text-text-secondary hover:border-red-300 hover:text-red-500'
                    : 'border-accent text-accent hover:bg-accent/5'
                }`}>
                {toggling ? '…' : sequence.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border-color mb-2">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'steps' && <StepsTab sequence={sequence} onUpdate={load} />}
        {activeTab === 'enrollments' && <EnrollmentsTab sequence={sequence} />}
        {activeTab === 'analytics' && <AnalyticsTab sequence={sequence} />}
      </div>

      {showEnrollModal && (
        <EnrollModal
          sequenceId={sequence.id}
          onClose={() => setShowEnrollModal(false)}
          onDone={() => { setShowEnrollModal(false); load(); setActiveTab('enrollments'); }}
        />
      )}
    </div>
  );
}
