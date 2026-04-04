'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PermissionGuard from '@/components/permission-guard';
import { listAgents } from '@/services/agents';
import { getLeadLinkedModels, type LeadLinkedModel } from '@/services/customers';
import { listFields, type DynamicField } from '@/services/dynamic-data';
import {
  listMessageTemplates,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  submitTemplateToMeta,
  syncMetaTemplateStatus,
  type MessageTemplate,
  type MessageTemplateCreate,
  type TemplateButton,
  type ParameterMapping,
  type MetaStatus,
  type HeaderType,
  type MetaCategory,
  type ButtonType,
} from '@/services/message-templates';
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Send,
  RefreshCw,
  FileText,
  Image,
  Video,
  File,
  Link,
  Phone,
  MessageSquare,
  ChevronDown,
  AlertCircle,
  Check,
  Clock,
  XCircle,
  Loader2,
  Smartphone,
  ArrowLeft,
} from 'lucide-react';

// ─── Source options for parameter mapping ──

const SOURCE_OPTIONS: { value: string; label: string; group: string }[] = [
  // Lead Info
  { value: 'lead.name',       label: 'Lead Name',    group: 'Lead Info' },
  { value: 'lead.email',      label: 'Lead Email',   group: 'Lead Info' },
  { value: 'lead.phone',      label: 'Lead Phone',   group: 'Lead Info' },
  { value: 'lead.source',     label: 'Lead Source',   group: 'Lead Info' },
  { value: 'lead.priority',   label: 'Priority',      group: 'Lead Info' },
  { value: 'lead.notes',      label: 'Notes',         group: 'Lead Info' },
  { value: 'lead.created_at', label: 'Created Date',  group: 'Lead Info' },
  // Business Info
  { value: 'business.name',   label: 'Business Name',  group: 'Business Info' },
  { value: 'business.phone',  label: 'Business Phone', group: 'Business Info' },
  { value: 'business.email',  label: 'Business Email', group: 'Business Info' },
];

const SOURCE_GROUPS = [...new Set(SOURCE_OPTIONS.map((o) => o.group))];

// ─── Types ──

type FilterTab = 'all' | MetaStatus;

interface FormState extends MessageTemplateCreate {
  buttons: TemplateButton[];
  parameter_mapping: ParameterMapping[];
  example_values: Record<string, string[]>;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  channel: 'whatsapp',
  intent_key: '',
  body: '',
  language: 'en',
  is_active: true,
  priority: 0,
  agent_id: undefined,
  header_type: 'none',
  header_content: '',
  footer: '',
  buttons: [],
  meta_template_name: '',
  meta_category: 'MARKETING',
  parameter_mapping: [],
  example_values: { header: [], body: [], button: [] },
};

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'en_US', label: 'English (US)' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt_BR', label: 'Portuguese (BR)' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'id', label: 'Indonesian' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ru', label: 'Russian' },
  { value: 'zh_CN', label: 'Chinese (CN)' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: <FileText className="h-3 w-3" /> },
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Clock className="h-3 w-3" /> },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <Check className="h-3 w-3" /> },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <XCircle className="h-3 w-3" /> },
  paused: { label: 'Paused', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: <Clock className="h-3 w-3" /> },
  disabled: { label: 'Disabled', color: 'bg-gray-500/20 text-gray-500 border-gray-500/30', icon: <XCircle className="h-3 w-3" /> },
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

// ─── Helpers ──

function toMetaTemplateName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function extractPlaceholders(text: string): number[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => parseInt(m.replace(/[{}]/g, ''))))].sort((a, b) => a - b);
}

function replacePlaceholders(text: string, examples: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (match, num) => {
    const idx = parseInt(num) - 1;
    return examples[idx] || match;
  });
}

// ─── Status Badge Component ──

function StatusBadge({ status }: { status: MetaStatus | null }) {
  const s = status || 'draft';
  const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── WhatsApp Preview Component ──

function WhatsAppPreview({
  form,
}: {
  form: FormState;
}) {
  const bodyText = useMemo(() => {
    const examples = form.example_values?.body || [];
    return replacePlaceholders(form.body || '', examples);
  }, [form.body, form.example_values]);

  const headerText = useMemo(() => {
    if (form.header_type === 'text' && form.header_content) {
      const examples = form.example_values?.header || [];
      return replacePlaceholders(form.header_content, examples);
    }
    return form.header_content || '';
  }, [form.header_type, form.header_content, form.example_values]);

  return (
    <div className="sticky top-4">
      <div className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-text-secondary" />
        WhatsApp Preview
      </div>
      <div className="rounded-2xl border border-border-color bg-[#0b141a] p-4 overflow-hidden">
        {/* Phone header bar */}
        <div className="flex items-center gap-2 pb-3 border-b border-white/10 mb-3">
          <div className="h-8 w-8 rounded-full bg-[#25d366] flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-medium text-white">Business Name</div>
            <div className="text-[10px] text-gray-400">Online</div>
          </div>
        </div>

        {/* Chat area */}
        <div className="min-h-[200px] flex flex-col justify-end">
          {(form.body || form.header_content || form.footer) ? (
            <div className="max-w-[85%] ml-auto">
              {/* Message bubble */}
              <div className="rounded-lg bg-[#005c4b] text-white text-[13px] leading-[18px] overflow-hidden shadow-sm">
                {/* Header */}
                {form.header_type && form.header_type !== 'none' && (
                  <div>
                    {form.header_type === 'text' && headerText && (
                      <div className="px-2.5 pt-2 font-semibold text-[13px]">
                        {headerText}
                      </div>
                    )}
                    {form.header_type === 'image' && (
                      <div className="bg-[#004438] h-32 flex items-center justify-center">
                        <Image className="h-8 w-8 text-white/40" />
                      </div>
                    )}
                    {form.header_type === 'video' && (
                      <div className="bg-[#004438] h-32 flex items-center justify-center">
                        <Video className="h-8 w-8 text-white/40" />
                      </div>
                    )}
                    {form.header_type === 'document' && (
                      <div className="bg-[#004438] px-3 py-3 flex items-center gap-2">
                        <File className="h-6 w-6 text-white/60" />
                        <span className="text-[12px] text-white/70">Document</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Body */}
                {bodyText && (
                  <div className="px-2.5 py-1.5 whitespace-pre-wrap break-words">
                    {bodyText}
                  </div>
                )}

                {/* Footer */}
                {form.footer && (
                  <div className="px-2.5 pb-1.5 text-[11px] text-white/50">
                    {form.footer}
                  </div>
                )}

                {/* Timestamp */}
                <div className="px-2.5 pb-1.5 text-right">
                  <span className="text-[10px] text-white/40">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Buttons */}
              {form.buttons && form.buttons.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {form.buttons.map((btn, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full rounded-lg bg-[#005c4b] py-2 text-center text-[13px] font-medium text-[#53bdeb] hover:bg-[#006d5b] transition-colors flex items-center justify-center gap-1.5"
                    >
                      {btn.type === 'url' && <Link className="h-3 w-3" />}
                      {btn.type === 'phone_number' && <Phone className="h-3 w-3" />}
                      {btn.type === 'quick_reply' && <MessageSquare className="h-3 w-3" />}
                      {btn.text || `Button ${idx + 1}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 text-xs py-10">
              Start typing to see a live preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Template Card Component ──

function TemplateCard({
  tpl,
  agents,
  onEdit,
  onDelete,
  onSubmitMeta,
  onSendTest,
  submitting,
}: {
  tpl: MessageTemplate;
  agents: Array<{ id: string; name: string }>;
  onEdit: (tpl: MessageTemplate) => void;
  onDelete: (tpl: MessageTemplate) => void;
  onSubmitMeta: (tpl: MessageTemplate) => void;
  onSendTest: (tpl: MessageTemplate) => void;
  submitting: number | null;
}) {
  const status = tpl.meta_status || 'draft';
  return (
    <div className="group rounded-xl border border-border-color bg-bg-primary p-4 transition-all hover:border-accent/30 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary truncate">
              {tpl.name}
            </span>
            <span className="shrink-0 rounded-full bg-[#25d366]/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#25d366] border border-[#25d366]/20">
              {tpl.channel}
            </span>
            <StatusBadge status={tpl.meta_status} />
            {tpl.meta_category && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                {tpl.meta_category}
              </span>
            )}
          </div>
          {tpl.meta_template_name && (
            <div className="mt-1 text-[11px] text-text-secondary font-mono">
              {tpl.meta_template_name}
            </div>
          )}
          <div className="mt-1.5 text-xs text-text-secondary line-clamp-2">
            {tpl.body || 'No body content'}
          </div>
          {tpl.agent_id != null && (
            <div className="mt-1 text-[11px] text-text-secondary">
              Agent: {agents.find((a) => a.id === String(tpl.agent_id))?.name ?? `#${tpl.agent_id}`}
            </div>
          )}
          {status === 'rejected' && tpl.rejection_reason && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-400">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{tpl.rejection_reason}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onEdit(tpl)}
          className="inline-flex items-center gap-1 rounded-md border border-border-color bg-bg-secondary px-2.5 py-1.5 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
        {(status === 'draft' || status === 'rejected') && (
          <button
            type="button"
            onClick={() => onSubmitMeta(tpl)}
            disabled={submitting === tpl.id}
            className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
          >
            {submitting === tpl.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Submit to Meta
          </button>
        )}
        {status === 'approved' && (
          <button
            type="button"
            onClick={() => onSendTest(tpl)}
            className="inline-flex items-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-2.5 py-1.5 text-[11px] font-medium text-green-400 hover:bg-green-500/20 transition-colors"
          >
            <Send className="h-3 w-3" />
            Send Test
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(tpl)}
          className="inline-flex items-center gap-1 rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/15 hover:border-red-500/30 transition-colors ml-auto"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Main Page Component ──

export default function AgentMessageTemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState<number | null>(null);

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });

  // Datasheet source options for parameter mapping dropdown
  const [dsFieldOptions, setDsFieldOptions] = useState<{ value: string; label: string; group: string }[]>([]);

  // ─── Load data ──

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [tpls, ags] = await Promise.all([
        listMessageTemplates(),
        listAgents(),
      ]);
      setTemplates(tpls);
      setAgents(ags.map((a: any) => ({ id: a.id, name: a.name })));
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  // Load datasheet fields for parameter mapping
  useEffect(() => {
    (async () => {
      try {
        const linkedModels = await getLeadLinkedModels();
        if (!linkedModels.length) return;
        const results = await Promise.all(
          linkedModels.map(async (lm) => {
            const fields = await listFields(lm.model_id);
            return { model: lm, fields };
          }),
        );
        const options: { value: string; label: string; group: string }[] = [];
        for (const { model, fields } of results) {
          const group = model.display_name;
          for (const f of fields) {
            // Skip relation fields and system fields
            if (f.field_type === 'relation' || f.field_type === 'auto_increment') continue;
            options.push({
              value: `datasheet.${model.model_id}.${f.name}`,
              label: f.display_name,
              group,
            });
          }
        }
        setDsFieldOptions(options);
      } catch {
        // silently ignore — datasheet options just won't appear
      }
    })();
  }, []);

  // ─── Auto-clear success ──

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // ─── Filtered templates ──

  const filteredTemplates = useMemo(() => {
    if (filterTab === 'all') return templates;
    return templates.filter((t) => (t.meta_status || 'draft') === filterTab);
  }, [templates, filterTab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: templates.length };
    for (const t of templates) {
      const s = t.meta_status || 'draft';
      c[s] = (c[s] || 0) + 1;
    }
    return c;
  }, [templates]);

  // Combined source options (static + datasheet)
  const allSourceOptions = useMemo(() => [...SOURCE_OPTIONS, ...dsFieldOptions], [dsFieldOptions]);
  const allSourceGroups = useMemo(() => [...new Set(allSourceOptions.map((o) => o.group))], [allSourceOptions]);

  // ─── Extract parameters from form ──

  const detectedParams = useMemo(() => {
    const headerParams = form.header_type === 'text' ? extractPlaceholders(form.header_content || '') : [];
    const bodyParams = extractPlaceholders(form.body || '');
    const buttonParams: { position: number; buttonIndex: number }[] = [];
    (form.buttons || []).forEach((btn, idx) => {
      extractPlaceholders(btn.url || '').forEach((p) => {
        buttonParams.push({ position: p, buttonIndex: idx });
      });
    });
    return { headerParams, bodyParams, buttonParams };
  }, [form.header_type, form.header_content, form.body, form.buttons]);

  // ─── Form helpers ──

  const resetForm = () => {
    setEditing(null);
    setShowBuilder(false);
    setForm({ ...EMPTY_FORM });
  };

  const openNewTemplate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowBuilder(true);
  };

  const handleEdit = (tpl: MessageTemplate) => {
    setEditing(tpl);
    setForm({
      name: tpl.name,
      description: tpl.description ?? '',
      channel: tpl.channel,
      intent_key: tpl.intent_key ?? '',
      body: tpl.body,
      language: tpl.language ?? 'en',
      is_active: tpl.is_active,
      priority: tpl.priority,
      agent_id: tpl.agent_id ?? undefined,
      header_type: tpl.header_type ?? 'none',
      header_content: tpl.header_content ?? '',
      footer: tpl.footer ?? '',
      buttons: tpl.buttons ? [...tpl.buttons] : [],
      meta_template_name: tpl.meta_template_name ?? '',
      meta_category: tpl.meta_category ?? 'MARKETING',
      parameter_mapping: tpl.parameter_mapping ? [...tpl.parameter_mapping] : [],
      example_values: tpl.example_values ? { ...tpl.example_values } : { header: [], body: [], button: [] },
      category: tpl.category,
    });
    setShowBuilder(true);
  };

  // ─── Auto-generate meta template name ──

  const updateName = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      meta_template_name: toMetaTemplateName(name),
    }));
  };

  // ─── Button management ──

  const addButton = () => {
    if ((form.buttons?.length || 0) >= 3) return;
    setForm((f) => ({
      ...f,
      buttons: [...(f.buttons || []), { type: 'quick_reply' as ButtonType, text: '' }],
    }));
  };

  const updateButton = (idx: number, patch: Partial<TemplateButton>) => {
    setForm((f) => {
      const btns = [...(f.buttons || [])];
      btns[idx] = { ...btns[idx], ...patch };
      return { ...f, buttons: btns };
    });
  };

  const removeButton = (idx: number) => {
    setForm((f) => ({
      ...f,
      buttons: (f.buttons || []).filter((_, i) => i !== idx),
    }));
  };

  // ─── Example values ──

  const updateExampleValue = (component: 'header' | 'body' | 'button', idx: number, value: string) => {
    setForm((f) => {
      const ev = { ...(f.example_values || { header: [], body: [], button: [] }) };
      const arr = [...(ev[component] || [])];
      arr[idx] = value;
      ev[component] = arr;
      return { ...f, example_values: ev };
    });
  };

  // ─── Parameter mapping ──

  const updateParamMapping = (position: number, component: 'header' | 'body' | 'button', field: 'source' | 'label', value: string) => {
    setForm((f) => {
      const mappings = [...(f.parameter_mapping || [])];
      const existingIdx = mappings.findIndex((m) => m.position === position && m.component === component);
      if (existingIdx >= 0) {
        mappings[existingIdx] = { ...mappings[existingIdx], [field]: value };
      } else {
        mappings.push({ position, component, source: '', label: '', [field]: value });
      }
      return { ...f, parameter_mapping: mappings };
    });
  };

  const getParamMapping = (position: number, component: 'header' | 'body' | 'button'): ParameterMapping | undefined => {
    return (form.parameter_mapping || []).find((m) => m.position === position && m.component === component);
  };

  // ─── Save ──

  const handleSave = async (submitToMeta: boolean = false) => {
    if (!form.name.trim() || !form.body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload: MessageTemplateCreate = {
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        channel: form.channel,
        intent_key: form.intent_key?.trim() || undefined,
        body: form.body,
        language: form.language || 'en',
        is_active: form.is_active ?? true,
        priority: form.priority ?? 0,
        agent_id: form.agent_id,
        header_type: form.header_type === 'none' ? null : form.header_type,
        header_content: form.header_content?.trim() || null,
        footer: form.footer?.trim() || null,
        buttons: form.buttons.length > 0 ? form.buttons : null,
        meta_template_name: form.meta_template_name?.trim() || null,
        meta_category: form.meta_category || 'MARKETING',
        parameter_mapping: form.parameter_mapping.length > 0 ? form.parameter_mapping : null,
        example_values: form.example_values || null,
        category: form.category || form.meta_category || 'MARKETING',
      };

      let result: MessageTemplate;
      if (editing) {
        result = await updateMessageTemplate(editing.id, payload);
        setTemplates((prev) => prev.map((t) => (t.id === editing.id ? result : t)));
        setSuccess('Template updated successfully');
      } else {
        result = await createMessageTemplate(payload);
        setTemplates((prev) => [result, ...prev]);
        setSuccess('Template created successfully');
      }

      if (submitToMeta) {
        try {
          const submitted = await submitTemplateToMeta(result.id);
          setTemplates((prev) => prev.map((t) => (t.id === submitted.id ? submitted : t)));
          setSuccess('Template saved and submitted to Meta for approval');
        } catch (e) {
          setError(`Template saved, but Meta submission failed: ${(e as Error).message}`);
        }
      }

      resetForm();
    } catch (e) {
      setError((e as Error).message ?? 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ──

  const handleDelete = async (tpl: MessageTemplate) => {
    if (!confirm(`Delete template "${tpl.name}"?`)) return;
    try {
      await deleteMessageTemplate(tpl.id);
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
      if (editing?.id === tpl.id) resetForm();
      setSuccess('Template deleted');
    } catch (e) {
      setError((e as Error).message ?? 'Failed to delete template');
    }
  };

  // ─── Submit to Meta ──

  const handleSubmitMeta = async (tpl: MessageTemplate) => {
    setSubmitting(tpl.id);
    try {
      const result = await submitTemplateToMeta(tpl.id);
      setTemplates((prev) => prev.map((t) => (t.id === result.id ? result : t)));
      setSuccess('Template submitted to Meta for approval');
    } catch (e) {
      setError((e as Error).message ?? 'Failed to submit to Meta');
    } finally {
      setSubmitting(null);
    }
  };

  // ─── Sync Meta status ──

  const handleSyncStatus = async () => {
    setSyncing(true);
    try {
      const result = await syncMetaTemplateStatus();
      await loadTemplates();
      setSuccess(`Synced ${result.synced} template(s) with Meta`);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to sync with Meta');
    } finally {
      setSyncing(false);
    }
  };

  // ─── Send test (placeholder) ──

  const handleSendTest = (tpl: MessageTemplate) => {
    alert(`Send test for template "${tpl.name}" - implement test dialog as needed.`);
  };

  // ─── Render ──

  return (
    <div className="mx-auto max-w-7xl space-y-4">
        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">
              WhatsApp Message Templates
            </h1>
            <p className="text-sm text-text-secondary">
              Build, preview, and submit WhatsApp message templates for Meta approval.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncStatus}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-accent/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync Status
            </button>
            <button
              type="button"
              onClick={openNewTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" />
              New Template
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm text-green-400">
            <Check className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        {/* ─── BUILDER VIEW ── */}
        {showBuilder ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to templates
            </button>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
              {/* Left column: Form */}
              <div className="space-y-5 rounded-2xl border border-border-color bg-card-bg p-5">
                <div className="text-sm font-semibold text-text-primary">
                  {editing ? 'Edit Template' : 'Create New Template'}
                </div>

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Template Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => updateName(e.target.value)}
                    placeholder="e.g. Order Confirmation"
                    className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  />
                </div>

                {/* Meta Template Name */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Meta Template Name</label>
                  <input
                    value={form.meta_template_name ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, meta_template_name: e.target.value }))}
                    placeholder="auto_generated_from_name"
                    className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  />
                  <p className="text-[10px] text-text-secondary">Auto-generated from name. Lowercase letters, numbers, and underscores only.</p>
                </div>

                {/* Row: Channel, Category, Language */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-secondary">Channel</label>
                    <select
                      value={form.channel}
                      onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                    >
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-secondary">Meta Category</label>
                    <select
                      value={form.meta_category ?? 'MARKETING'}
                      onChange={(e) => setForm((f) => ({ ...f, meta_category: e.target.value as MetaCategory }))}
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                    >
                      <option value="MARKETING">Marketing</option>
                      <option value="UTILITY">Utility</option>
                      <option value="AUTHENTICATION">Authentication</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-secondary">Language</label>
                    <select
                      value={form.language ?? 'en'}
                      onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Agent */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Agent (optional)</label>
                  <select
                    value={form.agent_id != null ? String(form.agent_id) : ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, agent_id: e.target.value ? Number(e.target.value) : undefined }))
                    }
                    className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  >
                    <option value="">All agents (business-level)</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                {/* ─── Header ── */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-secondary">Header</label>
                  <div className="flex items-center gap-3">
                    {(['none', 'text', 'image', 'video', 'document'] as HeaderType[]).map((ht) => (
                      <label key={ht} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="header_type"
                          value={ht}
                          checked={form.header_type === ht}
                          onChange={() => setForm((f) => ({ ...f, header_type: ht, header_content: '' }))}
                          className="accent-accent"
                        />
                        <span className="text-xs text-text-primary capitalize flex items-center gap-1">
                          {ht === 'text' && <FileText className="h-3 w-3" />}
                          {ht === 'image' && <Image className="h-3 w-3" />}
                          {ht === 'video' && <Video className="h-3 w-3" />}
                          {ht === 'document' && <File className="h-3 w-3" />}
                          {ht}
                        </span>
                      </label>
                    ))}
                  </div>
                  {form.header_type === 'text' && (
                    <input
                      value={form.header_content ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, header_content: e.target.value }))}
                      placeholder="Header text (supports {{1}} placeholders)"
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                    />
                  )}
                  {(form.header_type === 'image' || form.header_type === 'video' || form.header_type === 'document') && (
                    <input
                      value={form.header_content ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, header_content: e.target.value }))}
                      placeholder={`${form.header_type === 'image' ? 'Image' : form.header_type === 'video' ? 'Video' : 'Document'} URL`}
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                    />
                  )}
                </div>

                {/* ─── Body ── */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Body</label>
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    rows={5}
                    placeholder="Hello {{1}}, your order #{{2}} has been confirmed."
                    className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-y"
                  />
                  <p className="text-[10px] text-text-secondary">
                    Use {'{{1}}'}, {'{{2}}'} etc. for dynamic values that will be replaced at send time.
                  </p>
                </div>

                {/* ─── Footer ── */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-text-secondary">Footer</label>
                    <span className={`text-[10px] ${(form.footer?.length || 0) > 60 ? 'text-red-400' : 'text-text-secondary'}`}>
                      {form.footer?.length || 0}/60
                    </span>
                  </div>
                  <input
                    value={form.footer ?? ''}
                    onChange={(e) => {
                      if (e.target.value.length <= 60) {
                        setForm((f) => ({ ...f, footer: e.target.value }));
                      }
                    }}
                    placeholder="Optional footer text"
                    className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  />
                </div>

                {/* ─── Buttons ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-text-secondary">Buttons (max 3)</label>
                    {(form.buttons?.length || 0) < 3 && (
                      <button
                        type="button"
                        onClick={addButton}
                        className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 font-medium"
                      >
                        <Plus className="h-3 w-3" />
                        Add Button
                      </button>
                    )}
                  </div>
                  {form.buttons.map((btn, idx) => (
                    <div key={idx} className="rounded-lg border border-border-color bg-bg-primary p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-text-secondary">Button {idx + 1}</span>
                        <button type="button" onClick={() => removeButton(idx)} className="text-red-400 hover:text-red-300">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={btn.type}
                          onChange={(e) => updateButton(idx, { type: e.target.value as ButtonType })}
                          className="rounded-md border border-border-color bg-bg-secondary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                        >
                          <option value="url">URL</option>
                          <option value="phone_number">Phone</option>
                          <option value="quick_reply">Quick Reply</option>
                        </select>
                        <input
                          value={btn.text}
                          onChange={(e) => updateButton(idx, { text: e.target.value })}
                          placeholder="Button label"
                          className="rounded-md border border-border-color bg-bg-secondary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                      {btn.type === 'url' && (
                        <input
                          value={btn.url ?? ''}
                          onChange={(e) => updateButton(idx, { url: e.target.value })}
                          placeholder="https://example.com/{{1}}"
                          className="w-full rounded-md border border-border-color bg-bg-secondary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                      )}
                      {btn.type === 'phone_number' && (
                        <input
                          value={btn.phone_number ?? ''}
                          onChange={(e) => updateButton(idx, { phone_number: e.target.value })}
                          placeholder="+1234567890"
                          className="w-full rounded-md border border-border-color bg-bg-secondary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* ─── Parameter Mapping ── */}
                {(detectedParams.headerParams.length > 0 || detectedParams.bodyParams.length > 0 || detectedParams.buttonParams.length > 0) && (
                  <div className="space-y-3 rounded-lg border border-accent/20 bg-accent/5 p-4">
                    <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                      <ChevronDown className="h-3 w-3 text-accent" />
                      Parameter Mapping
                    </div>
                    <p className="text-[10px] text-text-secondary">Map each placeholder to a data source for automatic fill at send time.</p>

                    {/* Header params */}
                    {detectedParams.headerParams.map((p) => {
                      const mapping = getParamMapping(p, 'header');
                      return (
                        <div key={`header-${p}`} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center">
                          <span className="text-[11px] font-mono text-accent">{`Header {{${p}}}`}</span>
                          <select
                            value={mapping?.source ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateParamMapping(p, 'header', 'source', val);
                              const opt = allSourceOptions.find((o) => o.value === val);
                              if (opt) updateParamMapping(p, 'header', 'label', opt.label);
                            }}
                            className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
                          >
                            <option value="">Select source...</option>
                            {allSourceGroups.map((group) => (
                              <optgroup key={group} label={group}>
                                {allSourceOptions.filter((o) => o.group === group).map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <input
                            value={mapping?.label ?? ''}
                            onChange={(e) => updateParamMapping(p, 'header', 'label', e.target.value)}
                            placeholder="Label"
                            className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
                          />
                        </div>
                      );
                    })}

                    {/* Body params */}
                    {detectedParams.bodyParams.map((p) => {
                      const mapping = getParamMapping(p, 'body');
                      return (
                        <div key={`body-${p}`} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center">
                          <span className="text-[11px] font-mono text-accent">{`Body {{${p}}}`}</span>
                          <select
                            value={mapping?.source ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateParamMapping(p, 'body', 'source', val);
                              const opt = allSourceOptions.find((o) => o.value === val);
                              if (opt) updateParamMapping(p, 'body', 'label', opt.label);
                            }}
                            className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
                          >
                            <option value="">Select source...</option>
                            {allSourceGroups.map((group) => (
                              <optgroup key={group} label={group}>
                                {allSourceOptions.filter((o) => o.group === group).map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <input
                            value={mapping?.label ?? ''}
                            onChange={(e) => updateParamMapping(p, 'body', 'label', e.target.value)}
                            placeholder="Label"
                            className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ─── Example Values ── */}
                {(detectedParams.headerParams.length > 0 || detectedParams.bodyParams.length > 0) && (
                  <div className="space-y-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                    <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3 text-yellow-400" />
                      Example Values (required for Meta approval)
                    </div>

                    {detectedParams.headerParams.map((p) => (
                      <div key={`ex-header-${p}`} className="grid grid-cols-[100px_1fr] gap-2 items-center">
                        <span className="text-[11px] font-mono text-text-secondary">{`Header {{${p}}}`}</span>
                        <input
                          value={(form.example_values?.header || [])[p - 1] ?? ''}
                          onChange={(e) => updateExampleValue('header', p - 1, e.target.value)}
                          placeholder="e.g. John"
                          className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
                        />
                      </div>
                    ))}

                    {detectedParams.bodyParams.map((p) => (
                      <div key={`ex-body-${p}`} className="grid grid-cols-[100px_1fr] gap-2 items-center">
                        <span className="text-[11px] font-mono text-text-secondary">{`Body {{${p}}}`}</span>
                        <input
                          value={(form.example_values?.body || [])[p - 1] ?? ''}
                          onChange={(e) => updateExampleValue('body', p - 1, e.target.value)}
                          placeholder="e.g. Sample value"
                          className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent/50"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* ─── Action buttons ── */}
                <div className="flex items-center gap-3 pt-2 border-t border-border-color">
                  <button
                    type="button"
                    disabled={saving || !form.name.trim() || !form.body.trim()}
                    onClick={() => void handleSave(false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary hover:border-accent/30 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    disabled={saving || !form.name.trim() || !form.body.trim()}
                    onClick={() => void handleSave(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Save &amp; Submit to Meta
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors ml-auto"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Right column: Preview */}
              <div>
                <WhatsAppPreview form={form} />
              </div>
            </div>
          </div>
        ) : (
          /* ─── LIST VIEW ── */
          <div className="space-y-4">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 rounded-lg border border-border-color bg-card-bg p-1">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    filterTab === tab.key
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                  }`}
                >
                  {tab.label}
                  {counts[tab.key] != null && (
                    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                      filterTab === tab.key ? 'bg-white/20' : 'bg-bg-secondary'
                    }`}>
                      {counts[tab.key] || 0}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Template list */}
            {loading ? (
              <div className="flex items-center justify-center py-20 text-text-secondary">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading templates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border-color bg-card-bg py-16 text-center">
                <FileText className="h-10 w-10 text-text-secondary/40 mb-3" />
                <p className="text-sm font-medium text-text-primary">
                  {filterTab === 'all' ? 'No templates yet' : `No ${filterTab} templates`}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  {filterTab === 'all'
                    ? 'Create your first WhatsApp message template to get started.'
                    : 'No templates match this filter.'}
                </p>
                {filterTab === 'all' && (
                  <button
                    type="button"
                    onClick={openNewTemplate}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Template
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredTemplates.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    agents={agents}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSubmitMeta={handleSubmitMeta}
                    onSendTest={handleSendTest}
                    submitting={submitting}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
  );
}
