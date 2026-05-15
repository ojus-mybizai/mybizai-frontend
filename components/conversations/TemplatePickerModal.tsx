'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { X, Search, ChevronLeft, Send, Loader2, Plus } from 'lucide-react';
import {
  listMessageTemplates,
  sendConvoTemplate,
  type MessageTemplate,
  type ParameterMapping,
  type SendConvoTemplateData,
} from '@/services/message-templates';
import { contactsV2Service, type Contact } from '@/services/contacts-v2';
import { queryRecords } from '@/services/dynamic-data';
import type { Message } from '@/services/customers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  conversationId: string;
  channelType: string;   // "whatsapp" | "instagram" | "messenger" | "generic"
  leadId: string;
  onClose: () => void;
  onSent: (msg: Message) => void;
}

type Step = 'pick' | 'fill' | 'sending';

interface DatasheetRecord {
  id: number;
  record_key?: string;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Group parameter_mapping entries by unique datasheet model_id. */
function datasheetModels(mapping: ParameterMapping[] | null | undefined): number[] {
  if (!mapping) return [];
  const ids = new Set<number>();
  for (const p of mapping) {
    const m = p.source?.match(/^datasheet\.(\d+)\./);
    if (m) ids.add(Number(m[1]));
  }
  return Array.from(ids);
}

/** Client-side template body preview with filled parameters. */
function renderPreview(
  body: string,
  mapping: ParameterMapping[] | null | undefined,
  values: Record<string, string>,
): string {
  if (!body) return '';
  let out = body;
  // Replace positional {{1}}, {{2}}, ... with values from the position-keyed map
  if (mapping) {
    for (const p of mapping) {
      if (p.component !== 'body') continue;
      const val = values[p.source] || '';
      // Replace {{N}} where N is the position
      out = out.replace(new RegExp(`\\{\\{${p.position}\\}\\}`, 'g'), val || `[${p.label || p.source}]`);
    }
  }
  // Also replace {{source_path}} style placeholders
  for (const [key, val] of Object.entries(values)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${key.replace('.', '\\.')}\\s*\\}\\}`, 'g'), val);
    // Also try just the field name after the dot
    const short = key.includes('.') ? key.split('.').pop()! : key;
    out = out.replace(new RegExp(`\\{\\{\\s*${short}\\s*\\}\\}`, 'g'), val);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplatePickerModal({ conversationId, channelType, leadId, onClose, onSent }: Props) {
  // ── Step state ──
  const [step, setStep] = useState<Step>('pick');

  // ── Template list ──
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Selected template ──
  const [selected, setSelected] = useState<MessageTemplate | null>(null);

  // ── Parameter fill ──
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [recordContext, setRecordContext] = useState<Record<string, number>>({});
  const [lead, setLead] = useState<Contact | null>(null);

  // ── Datasheet record search ──
  const [dsSearches, setDsSearches] = useState<Record<number, string>>({});
  const [dsResults, setDsResults] = useState<Record<number, DatasheetRecord[]>>({});
  const [dsSelected, setDsSelected] = useState<Record<number, DatasheetRecord | null>>({});
  const [dsLoading, setDsLoading] = useState<Record<number, boolean>>({});

  // ── Error / sending ──
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // ── Fetch templates on mount ──
  useEffect(() => {
    let cancelled = false;
    setLoadingTemplates(true);
    const isWa = channelType === 'whatsapp';
    listMessageTemplates({
      channel: isWa ? 'whatsapp' : undefined,
      is_active: true,
      meta_status: isWa ? 'approved' : undefined,
    })
      .then((res) => { if (!cancelled) setTemplates(res); })
      .catch(() => { if (!cancelled) setTemplates([]); })
      .finally(() => { if (!cancelled) setLoadingTemplates(false); });
    return () => { cancelled = true; };
  }, [channelType]);

  // ── Fetch lead data when entering fill step ──
  useEffect(() => {
    if (step !== 'fill' || lead) return;
    contactsV2Service.get(Number(leadId)).then(setLead).catch(() => {});
  }, [step, leadId, lead]);

  // ── Auto-fill lead/business params from lead data ──
  useEffect(() => {
    if (!lead || !selected?.parameter_mapping) return;
    const auto: Record<string, string> = {};
    for (const p of selected.parameter_mapping) {
      const src = p.source || '';
      if (src.startsWith('lead.')) {
        const field = src.split('.').pop()!;
        const val = (lead as any)[field] ?? '';
        if (val) auto[src] = String(val);
      }
      if (src.startsWith('business.')) {
        // Business fields are auto-resolved server-side; show placeholder
        auto[src] = auto[src] || '[auto]';
      }
    }
    setParamValues((prev) => ({ ...auto, ...prev }));
  }, [lead, selected]);

  // ── Filtered template list ──
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.body || '').toLowerCase().includes(q),
    );
  }, [templates, searchQuery]);

  // ── Datasheet model IDs required by the selected template ──
  const requiredModels = useMemo(() => (selected ? datasheetModels(selected.parameter_mapping) : []), [selected]);

  // ── Search datasheet records ──
  const handleDsSearch = useCallback(async (modelId: number, query: string) => {
    setDsSearches((prev) => ({ ...prev, [modelId]: query }));
    setDsLoading((prev) => ({ ...prev, [modelId]: true }));
    try {
      const res = await queryRecords(modelId, { keyword: query, per_page: 10, page: 1 });
      setDsResults((prev) => ({
        ...prev,
        [modelId]: (res.items || []).map((r: any) => ({
          id: r.id,
          record_key: r.record_key,
          data: r.data || {},
        })),
      }));
    } catch {
      setDsResults((prev) => ({ ...prev, [modelId]: [] }));
    } finally {
      setDsLoading((prev) => ({ ...prev, [modelId]: false }));
    }
  }, []);

  // ── When a datasheet record is selected, populate param values ──
  const handleDsSelect = useCallback(
    (modelId: number, record: DatasheetRecord) => {
      setDsSelected((prev) => ({ ...prev, [modelId]: record }));
      setRecordContext((prev) => ({ ...prev, [String(modelId)]: record.id }));
      if (!selected?.parameter_mapping) return;
      const updates: Record<string, string> = {};
      for (const p of selected.parameter_mapping) {
        const m = p.source?.match(/^datasheet\.(\d+)\.(.+)$/);
        if (m && Number(m[1]) === modelId) {
          const field = m[2];
          const val = record.data[field];
          if (val != null) updates[p.source] = String(val);
        }
      }
      setParamValues((prev) => ({ ...prev, ...updates }));
    },
    [selected],
  );

  // ── Select a template → advance to fill step ──
  const handlePickTemplate = (t: MessageTemplate) => {
    setSelected(t);
    setParamValues({});
    setRecordContext({});
    setDsSelected({});
    setDsResults({});
    setDsSearches({});
    setError(null);
    setStep('fill');
  };

  // ── Send ──
  const handleSend = async () => {
    if (!selected || sending) return;
    setSending(true);
    setStep('sending');
    setError(null);
    try {
      const data: SendConvoTemplateData = {
        template_id: selected.id,
        parameter_values: Object.keys(paramValues).length ? paramValues : undefined,
        record_context: Object.keys(recordContext).length ? recordContext : undefined,
      };
      const msg = await sendConvoTemplate(conversationId, data);
      onSent(msg);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to send template');
      setStep('fill');
    } finally {
      setSending(false);
    }
  };

  // ── Preview text ──
  const preview = selected ? renderPreview(selected.body || '', selected.parameter_mapping, paramValues) : '';

  // ── Has unfilled required params? ──
  const hasUnfilled = useMemo(() => {
    if (!selected?.parameter_mapping) return false;
    return selected.parameter_mapping.some(
      (p) => p.component === 'body' && !paramValues[p.source],
    );
  }, [selected, paramValues]);

  // ================================================================
  // RENDER
  // ================================================================

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border-color bg-card-bg shadow-xl"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color px-5 py-3">
          <div className="flex items-center gap-2">
            {step === 'fill' && (
              <button type="button" onClick={() => setStep('pick')} className="text-text-secondary hover:text-text-primary">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <h2 className="text-base font-semibold text-text-primary">
              {step === 'pick' ? 'Choose Template' : step === 'sending' ? 'Sending...' : selected?.name || 'Fill Parameters'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ── STEP: Pick Template ── */}
          {step === 'pick' && (
            <>
              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full rounded-lg border border-border-color bg-bg-primary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                />
              </div>

              {loadingTemplates ? (
                <div className="flex items-center justify-center py-10 text-text-secondary text-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading templates...
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-text-secondary">
                  {templates.length === 0 ? (
                    <>
                      <p>No approved templates for {channelType}.</p>
                      <Link
                        href="/message-templates"
                        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        <Plus className="h-3.5 w-3.5" /> Create Template
                      </Link>
                    </>
                  ) : (
                    'No templates match your search.'
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handlePickTemplate(t)}
                      className="w-full rounded-lg border border-border-color bg-bg-secondary px-4 py-3 text-left hover:border-accent hover:bg-bg-primary transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-text-primary">{t.name}</span>
                        <div className="flex items-center gap-1.5">
                          {t.category && (
                            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent capitalize">
                              {t.category}
                            </span>
                          )}
                          {t.language && (
                            <span className="text-[10px] text-text-secondary uppercase">{t.language}</span>
                          )}
                        </div>
                      </div>
                      {t.body && (
                        <p className="mt-1 text-xs text-text-secondary line-clamp-2">{t.body}</p>
                      )}
                    </button>
                  ))}
                  {/* Manage templates link */}
                  <div className="pt-2 text-center">
                    <Link
                      href="/message-templates"
                      className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      <Plus className="h-3 w-3" /> Create or manage templates
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── STEP: Fill Parameters + Preview ── */}
          {(step === 'fill' || step === 'sending') && selected && (
            <>
              {/* Parameter Inputs */}
              {selected.parameter_mapping && selected.parameter_mapping.length > 0 && (
                <div className="space-y-3 mb-4">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Parameters</h3>

                  {/* Lead / business params */}
                  {selected.parameter_mapping
                    .filter((p) => p.source?.startsWith('lead.') || p.source?.startsWith('business.'))
                    .map((p) => (
                      <div key={p.source}>
                        <label className="mb-0.5 block text-xs text-text-secondary">{p.label || p.source}</label>
                        <input
                          value={paramValues[p.source] || ''}
                          onChange={(e) => setParamValues((prev) => ({ ...prev, [p.source]: e.target.value }))}
                          disabled={p.source.startsWith('business.') || sending}
                          placeholder={p.source}
                          className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                    ))}

                  {/* Datasheet record pickers */}
                  {requiredModels.map((modelId) => (
                    <div key={modelId}>
                      <label className="mb-0.5 block text-xs text-text-secondary">
                        Datasheet #{modelId} record
                      </label>
                      <div className="relative">
                        <input
                          value={dsSearches[modelId] || ''}
                          onChange={(e) => {
                            const q = e.target.value;
                            setDsSearches((prev) => ({ ...prev, [modelId]: q }));
                            void handleDsSearch(modelId, q);
                          }}
                          placeholder="Search records..."
                          className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          disabled={sending}
                        />
                        {dsLoading[modelId] && (
                          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-text-secondary" />
                        )}
                      </div>
                      {/* Results dropdown */}
                      {(dsResults[modelId] || []).length > 0 && !dsSelected[modelId] && (
                        <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-border-color bg-bg-primary">
                          {dsResults[modelId].map((r) => {
                            const label = Object.values(r.data).filter(Boolean).slice(0, 3).join(' — ');
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => handleDsSelect(modelId, r)}
                                className="w-full px-3 py-1.5 text-left text-xs hover:bg-bg-secondary text-text-primary"
                              >
                                <span className="font-mono text-text-secondary mr-1">#{r.id}</span>
                                {label || `Record ${r.id}`}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* Selected record badge */}
                      {dsSelected[modelId] && (
                        <div className="mt-1 flex items-center gap-1 text-xs">
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 font-medium">
                            #{dsSelected[modelId]!.id}
                          </span>
                          <span className="text-text-secondary truncate">
                            {Object.values(dsSelected[modelId]!.data).filter(Boolean).slice(0, 2).join(' — ')}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDsSelected((prev) => ({ ...prev, [modelId]: null }));
                              setRecordContext((prev) => {
                                const copy = { ...prev };
                                delete copy[String(modelId)];
                                return copy;
                              });
                            }}
                            className="ml-auto text-text-secondary hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Preview */}
              <div className="rounded-lg border border-border-color bg-bg-secondary p-3">
                <h3 className="mb-1 text-xs font-semibold text-text-secondary uppercase tracking-wide">Preview</h3>
                <p className="whitespace-pre-wrap text-sm text-text-primary">{preview || '(empty template)'}</p>
                {selected.footer && (
                  <p className="mt-1 text-xs text-text-secondary italic">{selected.footer}</p>
                )}
                {selected.buttons && selected.buttons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.buttons.map((b, i) => (
                      <span key={i} className="rounded-md border border-accent/40 px-2 py-0.5 text-[10px] text-accent">
                        {b.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {(step === 'fill' || step === 'sending') && (
          <div className="flex items-center justify-between border-t border-border-color px-5 py-3">
            <span className="text-xs text-text-secondary">
              {hasUnfilled ? 'Some parameters are empty' : 'Ready to send'}
            </span>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4" /> Send Template</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
