'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PermissionGuard from '@/components/permission-guard';
import { listAgents } from '@/services/agents';
import { useDatasheetSources } from '@/lib/use-datasheet-sources';
import {
  listMessageTemplates,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  submitTemplateToMeta,
  syncMetaTemplateStatus,
  sendTemplateMessage,
  generateTemplateWithAI,
  listMetaAvailableTemplates,
  importFromMeta,
  uploadTemplateHeaderMedia,
  type MessageTemplate,
  type MessageTemplateCreate,
  type SendTemplateRequest,
  type TemplateButton,
  type ParameterMapping,
  type MetaStatus,
  type HeaderType,
  type MetaCategory,
  type ButtonType,
  type TemplateAIGenerateResult,
  type MetaAvailableTemplate,
} from '@/services/message-templates';
import { listChannels, type Channel } from '@/services/channels';
import { useNotificationStore } from '@/lib/notification-store';
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
  Sparkles,
  Wand2,
  RotateCcw,
  ChevronRight,
  Download,
  Globe,
  Search,
  Upload,
} from 'lucide-react';

// ─── Source options for parameter mapping ──

const SOURCE_OPTIONS: { value: string; label: string; group: string; modelId?: number; hasLeadRelation?: boolean }[] = [
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
  language: 'en_US',
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
  { value: 'af',    label: 'Afrikaans' },
  { value: 'sq',    label: 'Albanian' },
  { value: 'ar',    label: 'Arabic' },
  { value: 'az',    label: 'Azerbaijani' },
  { value: 'bn',    label: 'Bengali' },
  { value: 'bg',    label: 'Bulgarian' },
  { value: 'ca',    label: 'Catalan' },
  { value: 'zh_CN', label: 'Chinese (Simplified)' },
  { value: 'zh_HK', label: 'Chinese (Hong Kong)' },
  { value: 'zh_TW', label: 'Chinese (Traditional)' },
  { value: 'hr',    label: 'Croatian' },
  { value: 'cs',    label: 'Czech' },
  { value: 'da',    label: 'Danish' },
  { value: 'nl',    label: 'Dutch' },
  { value: 'en',    label: 'English' },
  { value: 'en_GB', label: 'English (UK)' },
  { value: 'en_US', label: 'English (US)' },
  { value: 'et',    label: 'Estonian' },
  { value: 'fil',   label: 'Filipino' },
  { value: 'fi',    label: 'Finnish' },
  { value: 'fr',    label: 'French' },
  { value: 'ka',    label: 'Georgian' },
  { value: 'de',    label: 'German' },
  { value: 'el',    label: 'Greek' },
  { value: 'gu',    label: 'Gujarati' },
  { value: 'ha',    label: 'Hausa' },
  { value: 'he',    label: 'Hebrew' },
  { value: 'hi',    label: 'Hindi' },
  { value: 'hu',    label: 'Hungarian' },
  { value: 'id',    label: 'Indonesian' },
  { value: 'ga',    label: 'Irish' },
  { value: 'it',    label: 'Italian' },
  { value: 'ja',    label: 'Japanese' },
  { value: 'kn',    label: 'Kannada' },
  { value: 'kk',    label: 'Kazakh' },
  { value: 'ko',    label: 'Korean' },
  { value: 'ky',    label: 'Kyrgyz' },
  { value: 'lo',    label: 'Lao' },
  { value: 'lv',    label: 'Latvian' },
  { value: 'lt',    label: 'Lithuanian' },
  { value: 'mk',    label: 'Macedonian' },
  { value: 'ms',    label: 'Malay' },
  { value: 'ml',    label: 'Malayalam' },
  { value: 'mr',    label: 'Marathi' },
  { value: 'nb',    label: 'Norwegian' },
  { value: 'fa',    label: 'Persian' },
  { value: 'pl',    label: 'Polish' },
  { value: 'pt_BR', label: 'Portuguese (Brazil)' },
  { value: 'pt_PT', label: 'Portuguese (Portugal)' },
  { value: 'pa',    label: 'Punjabi' },
  { value: 'ro',    label: 'Romanian' },
  { value: 'ru',    label: 'Russian' },
  { value: 'sr',    label: 'Serbian' },
  { value: 'sk',    label: 'Slovak' },
  { value: 'sl',    label: 'Slovenian' },
  { value: 'es',    label: 'Spanish' },
  { value: 'es_AR', label: 'Spanish (Argentina)' },
  { value: 'es_ES', label: 'Spanish (Spain)' },
  { value: 'es_MX', label: 'Spanish (Mexico)' },
  { value: 'sw',    label: 'Swahili' },
  { value: 'sv',    label: 'Swedish' },
  { value: 'ta',    label: 'Tamil' },
  { value: 'te',    label: 'Telugu' },
  { value: 'th',    label: 'Thai' },
  { value: 'tr',    label: 'Turkish' },
  { value: 'uk',    label: 'Ukrainian' },
  { value: 'ur',    label: 'Urdu' },
  { value: 'uz',    label: 'Uzbek' },
  { value: 'vi',    label: 'Vietnamese' },
];

// E.164 phone number pattern required by Meta for phone_number buttons
const E164_RE = /^\+[1-9]\d{6,14}$/;

// Header media constraints (mirror backend / Meta limits)
const HEADER_MEDIA_ACCEPT: Record<string, string> = {
  image: 'image/jpeg,image/png',
  video: 'video/mp4,video/3gpp',
  document: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx',
};
const HEADER_MEDIA_MAX_MB: Record<string, number> = { image: 5, video: 16, document: 100 };
const HEADER_MEDIA_HINT: Record<string, string> = {
  image: 'JPEG or PNG, up to 5 MB',
  video: 'MP4 or 3GPP, up to 16 MB',
  document: 'PDF or Office document, up to 100 MB',
};

const VALID_LANGUAGE_CODES = new Set(LANGUAGES.map((l) => l.value));

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderWhatsAppMarkdown(text: string): string {
  const e = escapeHtml(text);
  return e
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<s>$1</s>')
    .replace(/```([\s\S]*?)```/g, '<code class="wa-code">$1</code>')
    .replace(/\n/g, '<br/>');
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
  headerMediaUrl,
}: {
  form: FormState;
  headerMediaUrl?: string | null;
}) {
  // Show the real image when we have a displayable URL (uploaded preview or pasted public URL)
  const headerImageSrc =
    form.header_type === 'image'
      ? headerMediaUrl || (/^https?:\/\//.test(form.header_content || '') ? form.header_content! : '')
      : '';
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
                      headerImageSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={headerImageSrc} alt="" className="w-full h-32 object-cover" />
                      ) : (
                        <div className="bg-[#004438] h-32 flex items-center justify-center">
                          <Image className="h-8 w-8 text-white/40" />
                        </div>
                      )
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
                  <div
                    className="px-2.5 py-1.5 break-words [&_.wa-code]:font-mono [&_.wa-code]:bg-black/20 [&_.wa-code]:px-1 [&_.wa-code]:rounded"
                    dangerouslySetInnerHTML={{ __html: renderWhatsAppMarkdown(bodyText) }}
                  />
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

// ─── AI Template Generator Modal ──

function AiTemplateModal({
  onClose,
  onApply,
  initialLanguage,
}: {
  onClose: () => void;
  onApply: (result: TemplateAIGenerateResult) => void;
  initialLanguage: string;
}) {
  const [prompt, setPrompt] = useState('');
  const [categoryHint, setCategoryHint] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | ''>('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TemplateAIGenerateResult | null>(null);

  const examplePrompts = [
    'Send a welcome message to a new lead with their name and a link to our website',
    'Order confirmation with order ID and delivery date from our Orders sheet',
    'Appointment reminder 24 hours before with the appointment time and service name',
    'Flash sale announcement with 20% off discount and a shop now button',
    'Payment overdue reminder with invoice number and amount due',
    'Re-engage inactive customers with a personalised special offer',
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await generateTemplateWithAI({
        user_prompt: prompt.trim(),
        category_hint: categoryHint || null,
        language: initialLanguage || 'en_US',
      });
      setResult(res);
    } catch (e) {
      setError((e as Error).message ?? 'Generation failed — please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply(result);
      onClose();
    }
  };

  const categoryColors: Record<string, string> = {
    MARKETING: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
    UTILITY: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    AUTHENTICATION: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border-color bg-bg-primary shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Generate with AI</h3>
              <p className="text-[11px] text-text-secondary">Describe what you need — the AI writes the template</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Prompt input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">What should this template do?</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Send a welcome message to new leads with their name and a link to book a call..."
              className="w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleGenerate();
              }}
            />
            <p className="text-[10px] text-text-secondary">Ctrl+Enter to generate</p>
          </div>

          {/* Example prompts */}
          {!result && !generating && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">Quick examples</p>
              <div className="flex flex-wrap gap-1.5">
                {examplePrompts.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setPrompt(ex)}
                    className="rounded-full border border-border-color bg-bg-secondary px-2.5 py-1 text-[11px] text-text-secondary hover:text-text-primary hover:border-violet-500/40 hover:bg-violet-500/5 transition-colors text-left"
                  >
                    {ex.length > 55 ? ex.slice(0, 55) + '…' : ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category hint */}
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-medium text-text-secondary shrink-0">Category hint</label>
            <div className="flex items-center gap-1.5">
              {(['', 'MARKETING', 'UTILITY', 'AUTHENTICATION'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryHint(c)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    categoryHint === c
                      ? c === '' ? 'border-accent bg-accent text-white' : `border-transparent ${categoryColors[c]}`
                      : 'border-border-color text-text-secondary hover:border-accent/40 hover:text-text-primary'
                  }`}
                >
                  {c === '' ? 'Auto' : c.charAt(0) + c.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {generating && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-violet-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Crafting your template…
              </div>
              {[80, 100, 60, 90].map((w, i) => (
                <div key={i} className="h-3 rounded-full bg-violet-500/10 animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {/* Result preview */}
          {result && (
            <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 space-y-0 overflow-hidden">
              {/* Result header bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-violet-500/15">
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-green-400" />
                  <span className="text-xs font-medium text-text-primary">{result.name}</span>
                  {result.meta_category && (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColors[result.meta_category] ?? ''}`}>
                      {result.meta_category}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setResult(null); }}
                  className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Regenerate
                </button>
              </div>

              <div className="px-4 py-3 space-y-3">
                {/* Header */}
                {result.header_type === 'text' && result.header_content && (
                  <div>
                    <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">Header</span>
                    <p className="text-xs text-text-primary font-semibold mt-0.5">{result.header_content}</p>
                  </div>
                )}

                {/* Body */}
                <div>
                  <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">Body</span>
                  <p className="text-xs text-text-primary mt-0.5 whitespace-pre-wrap leading-relaxed">{result.body}</p>
                </div>

                {/* Footer */}
                {result.footer && (
                  <div>
                    <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">Footer</span>
                    <p className="text-[11px] text-text-secondary mt-0.5">{result.footer}</p>
                  </div>
                )}

                {/* Buttons */}
                {result.buttons && result.buttons.length > 0 && (
                  <div>
                    <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">Buttons</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {result.buttons.map((btn, i) => (
                        <span key={i} className="rounded-full border border-[#25d366]/30 bg-[#25d366]/10 px-2.5 py-0.5 text-[11px] text-[#25d366] font-medium">
                          {btn.type === 'url' ? '🔗' : btn.type === 'phone_number' ? '📞' : '↩'} {btn.text}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parameter mapping preview */}
                {result.parameter_mapping && result.parameter_mapping.length > 0 && (
                  <div>
                    <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">Variables mapped</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {result.parameter_mapping.map((pm, i) => (
                        <span key={i} className="rounded-full border border-border-color bg-bg-secondary px-2 py-0.5 text-[10px] text-text-secondary font-mono">
                          {`{{${pm.position}}}`} → {pm.source}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested use case */}
                {result.suggested_use_case && (
                  <p className="text-[11px] text-text-secondary italic border-t border-violet-500/10 pt-2.5">
                    {result.suggested_use_case}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 border-t border-border-color px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-color px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {!result ? (
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating || !prompt.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                {generating ? 'Generating…' : 'Generate Template'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-secondary px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity shadow-sm"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  Use This Template
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Send Template Modal ──

function SendTemplateModal({
  template,
  onClose,
  onSuccess,
  onError,
}: {
  template: MessageTemplate;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);

  // Extract placeholders from body + header
  const bodyPlaceholders = useMemo(() => extractPlaceholders(template.body || ''), [template.body]);
  const headerPlaceholders = useMemo(
    () => (template.header_type === 'text' ? extractPlaceholders(template.header_content || '') : []),
    [template.header_type, template.header_content],
  );

  // Load WhatsApp channels on mount
  useEffect(() => {
    (async () => {
      try {
        const all = await listChannels();
        const waCh = all.filter((c) => c.type === 'whatsapp' && c.isConnected);
        setChannels(waCh);
        if (waCh.length > 0) setSelectedChannelId(waCh[0].id);
      } catch {
        // ignore
      } finally {
        setLoadingChannels(false);
      }
    })();
  }, []);

  const hasParams = bodyPlaceholders.length > 0 || headerPlaceholders.length > 0;

  const handleSend = async () => {
    if (!phoneNumber.trim()) {
      onError('Please enter a phone number');
      return;
    }
    if (channels.length > 0 && !selectedChannelId) {
      onError('Please select a WhatsApp channel');
      return;
    }

    setSending(true);
    try {
      // Build parameter_values from positional inputs
      const parameterValues: Record<string, string> = {};
      // If template has parameter_mapping, use source keys; otherwise use positional keys
      const mapping = template.parameter_mapping || [];
      if (mapping.length > 0) {
        for (const pm of mapping) {
          const key = pm.source;
          if (paramValues[`${pm.component}_${pm.position}`]) {
            parameterValues[key] = paramValues[`${pm.component}_${pm.position}`];
          }
        }
      } else {
        // Fallback: use body_N keys for simple templates
        for (const n of bodyPlaceholders) {
          if (paramValues[`body_${n}`]) {
            parameterValues[`body_${n}`] = paramValues[`body_${n}`];
          }
        }
        for (const n of headerPlaceholders) {
          if (paramValues[`header_${n}`]) {
            parameterValues[`header_${n}`] = paramValues[`header_${n}`];
          }
        }
      }

      const req: SendTemplateRequest = {
        phone_number: phoneNumber.replace(/[\s\-()]/g, ''),
        channel_id: selectedChannelId ? Number(selectedChannelId) : undefined,
        parameter_values: Object.keys(parameterValues).length > 0 ? parameterValues : undefined,
      };

      const result = await sendTemplateMessage(template.id, req);
      onSuccess(`Template "${template.name}" sent successfully! Message ID: ${result.message_id || 'N/A'}`);
      onClose();
    } catch (e) {
      onError((e as Error).message ?? 'Failed to send template');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border-color bg-bg-primary shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Send Template Message</h3>
            <p className="text-xs text-text-secondary mt-0.5">{template.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Channel selector */}
          {loadingChannels ? (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading channels...
            </div>
          ) : channels.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              No connected WhatsApp channel found. Connect one in Channels settings.
            </div>
          ) : channels.length > 1 ? (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Send from Channel</label>
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
              >
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Phone number */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Recipient Phone Number <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 919876543210"
                className="w-full rounded-lg border border-border-color bg-bg-secondary pl-10 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-text-secondary">International format without + (e.g., 919876543210 for India)</p>
          </div>

          {/* Parameter values */}
          {hasParams && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">Template Parameters</label>
              <div className="space-y-2">
                {headerPlaceholders.map((n) => {
                  const mapping = (template.parameter_mapping || []).find(
                    (p) => p.component === 'header' && p.position === n,
                  );
                  return (
                    <div key={`header_${n}`}>
                      <label className="block text-[11px] text-text-secondary mb-1">
                        Header {`{{${n}}}`} {mapping?.label ? `— ${mapping.label}` : ''}
                      </label>
                      <input
                        type="text"
                        value={paramValues[`header_${n}`] || ''}
                        onChange={(e) => setParamValues((prev) => ({ ...prev, [`header_${n}`]: e.target.value }))}
                        placeholder={mapping?.source || `Value for header {{${n}}}`}
                        className="w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
                      />
                    </div>
                  );
                })}
                {bodyPlaceholders.map((n) => {
                  const mapping = (template.parameter_mapping || []).find(
                    (p) => p.component === 'body' && p.position === n,
                  );
                  return (
                    <div key={`body_${n}`}>
                      <label className="block text-[11px] text-text-secondary mb-1">
                        Body {`{{${n}}}`} {mapping?.label ? `— ${mapping.label}` : ''}
                      </label>
                      <input
                        type="text"
                        value={paramValues[`body_${n}`] || ''}
                        onChange={(e) => setParamValues((prev) => ({ ...prev, [`body_${n}`]: e.target.value }))}
                        placeholder={mapping?.source || `Value for body {{${n}}}`}
                        className="w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Template preview */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Template Preview</label>
            <div className="rounded-lg border border-border-color bg-bg-secondary p-3 text-xs text-text-secondary whitespace-pre-wrap">
              {template.header_type === 'text' && template.header_content && (
                <div className="font-semibold text-text-primary mb-1">{template.header_content}</div>
              )}
              <div>{template.body}</div>
              {template.footer && <div className="mt-1 text-[11px] text-text-secondary/60">{template.footer}</div>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border-color px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-color px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !phoneNumber.trim() || channels.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1da851] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? 'Sending...' : 'Send Message'}
          </button>
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

// ─── Import from WhatsApp Manager Modal ──

const META_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  approved:  { label: 'Approved',  cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  pending:   { label: 'Pending',   cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  rejected:  { label: 'Rejected',  cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  paused:    { label: 'Paused',    cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  disabled:  { label: 'Disabled',  cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

function ImportFromMetaModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MetaAvailableTemplate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // key = meta_template_name
  const [searchQ, setSearchQ] = useState('');
  const [importing, setImporting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const list = await listMetaAvailableTemplates();
        setTemplates(list);
      } catch (e) {
        setError((e as Error).message ?? 'Failed to fetch templates from Meta');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = useMemo(() => {
    let list = templates;
    if (filterStatus !== 'all') list = list.filter((t) => t.meta_status === filterStatus);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(
        (t) =>
          t.meta_template_name.includes(q) ||
          t.display_name.toLowerCase().includes(q) ||
          t.body_preview.toLowerCase().includes(q),
      );
    }
    return list;
  }, [templates, filterStatus, searchQ]);

  const importable = visible.filter((t) => !t.already_imported);
  const allChecked = importable.length > 0 && importable.every((t) => selected.has(t.meta_template_name));

  const toggleAll = () => {
    if (allChecked) {
      setSelected((s) => {
        const n = new Set(s);
        importable.forEach((t) => n.delete(t.meta_template_name));
        return n;
      });
    } else {
      setSelected((s) => {
        const n = new Set(s);
        importable.forEach((t) => n.add(t.meta_template_name));
        return n;
      });
    }
  };

  const toggleOne = (name: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name); else n.add(name);
      return n;
    });
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    const toImport = templates.filter((t) => selected.has(t.meta_template_name));
    setImporting(true);
    try {
      await importFromMeta(
        toImport.map((t) => ({
          meta_template_id: t.meta_template_id,
          meta_template_name: t.meta_template_name,
          meta_status: t.meta_status,
          meta_category: t.meta_category,
          language: t.language,
          components: t.components,
          waba_id: t.waba_id,
          channel_id: t.channel_id,
        })),
      );
      onImported(toImport.length);
    } catch (e) {
      setError((e as Error).message ?? 'Import failed');
      setImporting(false);
    }
  };

  // Group visible templates by channel label
  const grouped = useMemo(() => {
    const map = new Map<string, MetaAvailableTemplate[]>();
    for (const t of visible) {
      const key = t.channel_label || 'Unknown channel';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [visible]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: templates.length };
    for (const t of templates) { c[t.meta_status] = (c[t.meta_status] || 0) + 1; }
    return c;
  }, [templates]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl border border-border-color bg-card-bg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25d366]/15">
              <Download className="h-4.5 w-4.5 text-[#25d366]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Import from WhatsApp Manager</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                {loading ? 'Fetching your templates from Meta…' : `${templates.length} template${templates.length === 1 ? '' : 's'} found`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:bg-hover-bg hover:text-text-primary transition-colors">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Toolbar */}
        {!loading && !error && (
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border-color/60 shrink-0 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search templates…"
                className="w-full rounded-lg border border-border-color bg-input-bg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-accent/50"
              />
            </div>
            {/* Status filter pills */}
            <div className="flex items-center gap-1 flex-wrap">
              {(['all', 'approved', 'pending', 'rejected', 'paused'] as const).map((s) => (
                statusCounts[s] > 0 || s === 'all' ? (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      filterStatus === s
                        ? 'bg-accent text-white border-accent'
                        : 'border-border-color text-text-secondary hover:border-accent/50 hover:text-text-primary'
                    }`}
                  >
                    {s === 'all' ? 'All' : (META_STATUS_BADGE[s]?.label ?? s)}{' '}
                    {statusCounts[s] != null ? `(${s === 'all' ? statusCounts.all : statusCounts[s]})` : ''}
                  </button>
                ) : null
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-accent" />
              <p className="text-sm text-text-secondary">Fetching templates from Meta…</p>
            </div>
          )}

          {error && (
            <div className="m-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && visible.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-text-secondary">
              <Globe className="h-8 w-8 opacity-40" />
              <p className="text-sm">No templates found {searchQ ? 'matching your search' : 'on Meta'}.</p>
            </div>
          )}

          {!loading && !error && visible.length > 0 && (
            <div className="px-6 py-4 space-y-5">
              {/* Select all row */}
              {importable.length > 0 && (
                <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer hover:text-text-primary transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 accent-accent rounded"
                  />
                  Select all importable ({importable.length})
                </label>
              )}

              {Array.from(grouped.entries()).map(([channelLabel, items]) => (
                <div key={channelLabel}>
                  {/* Channel group header */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-5 w-5 rounded-full bg-[#25d366]/15 flex items-center justify-center shrink-0">
                      <MessageSquare className="h-3 w-3 text-[#25d366]" />
                    </div>
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{channelLabel}</span>
                    <div className="flex-1 h-px bg-border-color/60" />
                  </div>

                  <div className="space-y-2">
                    {items.map((t) => {
                      const badge = META_STATUS_BADGE[t.meta_status];
                      const isChecked = selected.has(t.meta_template_name);
                      return (
                        <label
                          key={t.meta_template_name}
                          className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                            t.already_imported
                              ? 'border-border-color/40 bg-card-bg/40 opacity-50 cursor-default'
                              : isChecked
                              ? 'border-accent/50 bg-accent/5'
                              : 'border-border-color hover:border-accent/30 hover:bg-hover-bg'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={t.already_imported}
                            onChange={() => !t.already_imported && toggleOne(t.meta_template_name)}
                            className="mt-0.5 h-3.5 w-3.5 accent-accent rounded shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-text-primary truncate">{t.display_name}</span>
                              <span className="text-[10px] font-mono text-text-secondary opacity-70">{t.meta_template_name}</span>
                              {badge && (
                                <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 rounded-full border border-border-color px-1.5 py-px text-[10px] text-text-secondary">
                                {t.meta_category}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-border-color px-1.5 py-px text-[10px] text-text-secondary">
                                {t.language}
                              </span>
                              {t.has_buttons && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-border-color px-1.5 py-px text-[10px] text-text-secondary">
                                  {t.button_count} btn{t.button_count !== 1 ? 's' : ''}
                                </span>
                              )}
                              {t.already_imported && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-1.5 py-px text-[10px] font-medium text-green-400">
                                  <Check className="h-2.5 w-2.5" /> Already imported
                                </span>
                              )}
                            </div>
                            {t.body_preview && (
                              <p className="mt-1.5 text-xs text-text-secondary line-clamp-2 leading-relaxed">
                                {t.body_preview}
                              </p>
                            )}
                            {t.rejected_reason && (
                              <p className="mt-1 text-[10px] text-red-400 line-clamp-1">
                                ✕ {t.rejected_reason}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border-color shrink-0">
          <p className="text-xs text-text-secondary">
            {selected.size > 0
              ? `${selected.size} template${selected.size !== 1 ? 's' : ''} selected`
              : 'Select templates to import'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border-color px-4 py-2 text-xs font-medium text-text-secondary hover:bg-hover-bg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {importing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  Import {selected.size > 0 ? `(${selected.size})` : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Main Page Component ──

export default function AgentMessageTemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [waChannels, setWaChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [retryTemplate, setRetryTemplate] = useState<MessageTemplate | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sendModalTemplate, setSendModalTemplate] = useState<MessageTemplate | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Header media upload (image / video / document headers)
  const headerFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [headerMedia, setHeaderMedia] = useState<{ filename: string; url: string } | null>(null);

  // ─── Real-time template status via SSE notifications ──
  const latestNotification = useNotificationStore((s) => s.notifications[0] ?? null);
  const lastProcessedNotifIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!latestNotification) return;
    if (latestNotification.id === lastProcessedNotifIdRef.current) return;
    lastProcessedNotifIdRef.current = latestNotification.id;
    if (latestNotification.event_type !== 'template_status_updated') return;
    const d = latestNotification.data;
    if (!d) return;
    const entityId = typeof d.entity_id === 'number' ? d.entity_id : null;
    const newStatus = typeof d.status === 'string' ? (d.status as MetaStatus) : null;
    if (!entityId || !newStatus) return;
    setTemplates((prev) =>
      prev.map((t) => (t.id === entityId ? { ...t, meta_status: newStatus } : t)),
    );
    setSuccess(`${latestNotification.title}${latestNotification.body ? ': ' + latestNotification.body : ''}`);
  }, [latestNotification]);

  // Datasheet sources via hook (single API call, pre-loads rows for non-lead-linked sheets)
  const { sources: dsSources, rowsByModel } = useDatasheetSources();

  // ─── Load data ──

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [tpls, ags, chs] = await Promise.all([
        listMessageTemplates(),
        listAgents(),
        listChannels(),
      ]);
      setTemplates(tpls);
      setAgents(ags.map((a: any) => ({ id: a.id, name: a.name })));
      const waChs = chs.filter((c) => c.type === 'whatsapp' && c.isConnected);
      setWaChannels(waChs);
      // Auto-select the only channel so the field is never silently blank
      if (waChs.length === 1) {
        setForm((f) => ({ ...f, channel_id: f.channel_id ?? Number(waChs[0].id) }));
      }
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);


  // ─── Auto-clear success ──

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // Cleanup retry countdown timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    };
  }, []);

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

  // Build source options: static lead/business fields + all datasheet fields
  const allSourceOptions = useMemo(() => {
    const dsOptions: { value: string; label: string; group: string; modelId?: number; hasLeadRelation?: boolean }[] = [];
    for (const src of dsSources) {
      for (const f of src.fields) {
        dsOptions.push({
          value: `datasheet.${src.model_id}.${f.name}`,
          label: f.display_name,
          group: src.display_name,
          modelId: src.model_id,
          hasLeadRelation: src.has_lead_relation,
        });
      }
    }
    return [...SOURCE_OPTIONS, ...dsOptions];
  }, [dsSources]);
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

  // Button exclusivity: CTA (url/phone_number) cannot mix with quick_reply
  const buttonTypeError = useMemo(() => {
    const types = (form.buttons || []).map((b) => b.type);
    const hasCTA = types.some((t) => t === 'url' || t === 'phone_number');
    const hasQR = types.some((t) => t === 'quick_reply');
    if (hasCTA && hasQR)
      return 'Cannot mix URL/Phone buttons with Quick Reply buttons — Meta will reject this template.';
    return null;
  }, [form.buttons]);

  // ─── Form helpers ──

  const resetForm = () => {
    setEditing(null);
    setShowBuilder(false);
    setForm({ ...EMPTY_FORM });
    setHeaderMedia(null);
  };

  const openNewTemplate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setHeaderMedia(null);
    setShowBuilder(true);
  };

  // ─── Header media upload ──

  const handleHeaderFileSelected = async (file: File) => {
    const ht = form.header_type;
    if (ht !== 'image' && ht !== 'video' && ht !== 'document') return;
    const maxMb = HEADER_MEDIA_MAX_MB[ht];
    if (file.size > maxMb * 1024 * 1024) {
      setError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Meta allows up to ${maxMb} MB for ${ht} headers.`);
      return;
    }
    setUploadingHeader(true);
    setError(null);
    try {
      const res = await uploadTemplateHeaderMedia(file, ht);
      setForm((f) => ({ ...f, header_content: res.header_content }));
      setHeaderMedia({ filename: res.filename, url: res.url });
    } catch (e) {
      setError((e as Error).message ?? 'Failed to upload header media');
    } finally {
      setUploadingHeader(false);
      if (headerFileInputRef.current) headerFileInputRef.current.value = '';
    }
  };

  const clearHeaderMedia = () => {
    setForm((f) => ({ ...f, header_content: '' }));
    setHeaderMedia(null);
  };

  const applyAiResult = (result: TemplateAIGenerateResult) => {
    setForm((prev) => ({
      ...prev,
      name: result.name,
      meta_template_name: result.meta_template_name,
      meta_category: (result.meta_category as MetaCategory) ?? 'MARKETING',
      language: VALID_LANGUAGE_CODES.has(result.language ?? '') ? result.language! : 'en_US',
      intent_key: result.intent_key ?? '',
      header_type: (result.header_type as any) ?? 'none',
      header_content: result.header_content ?? '',
      body: result.body ?? '',
      footer: result.footer ?? '',
      buttons: result.buttons ? [...result.buttons] : [],
      parameter_mapping: result.parameter_mapping ? [...result.parameter_mapping] : [],
      example_values: result.example_values
        ? { header: [], body: [], button: [], ...result.example_values }
        : { header: [], body: [], button: [] },
    }));
    setHeaderMedia(null);
    // Make sure the builder is open
    setShowBuilder(true);
  };

  const handleEdit = (tpl: MessageTemplate) => {
    setEditing(tpl);
    setForm({
      name: tpl.name,
      description: tpl.description ?? '',
      channel: tpl.channel,
      channel_id: tpl.channel_id ?? undefined,
      intent_key: tpl.intent_key ?? '',
      body: tpl.body,
      language: tpl.language ?? 'en_US',
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
    setHeaderMedia(null);
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

  // ─── Formatting toolbar ──

  const wrapBodySelection = (open: string, close: string) => {
    const el = bodyTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const body = form.body;
    const selected = body.slice(start, end);
    const newBody = body.slice(0, start) + open + selected + close + body.slice(end);
    setForm((f) => ({ ...f, body: newBody }));
    // restore cursor inside the wrapped text
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + open.length, end + open.length);
    });
  };

  // ─── Parameter mapping ──

  const updateParamMapping = (
    position: number,
    component: 'header' | 'body' | 'button',
    patch: Partial<ParameterMapping>,
  ) => {
    setForm((f) => {
      const mappings = [...(f.parameter_mapping || [])];
      const existingIdx = mappings.findIndex((m) => m.position === position && m.component === component);
      if (existingIdx >= 0) {
        mappings[existingIdx] = { ...mappings[existingIdx], ...patch };
      } else {
        mappings.push({ position, component, source: '', label: '', ...patch });
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

    // ── Client-side pre-flight validation ──────────────────────────────
    // 1. Phone number buttons must be non-empty E.164 format
    const invalidPhoneBtn = (form.buttons || []).find(
      (b) => b.type === 'phone_number' && !E164_RE.test(b.phone_number || ''),
    );
    if (invalidPhoneBtn) {
      setError('Phone number buttons must be in E.164 format (e.g. +12025550123).');
      return;
    }

    // 2. URL buttons must have a non-empty url
    const missingUrlBtn = (form.buttons || []).find(
      (b) => b.type === 'url' && !b.url?.trim(),
    );
    if (missingUrlBtn) {
      setError('URL buttons must have a URL.');
      return;
    }

    // 3. When submitting to Meta, all placeholder example values are required
    if (submitToMeta) {
      const bodyParams = extractPlaceholders(form.body);
      const headerParams = form.header_type === 'text' ? extractPlaceholders(form.header_content || '') : [];
      const missingBody = bodyParams.filter((p) => !(form.example_values?.body || [])[p - 1]?.trim());
      const missingHeader = headerParams.filter((p) => !(form.example_values?.header || [])[p - 1]?.trim());
      if (missingBody.length || missingHeader.length) {
        setError('All example values are required before submitting to Meta.');
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const rawMetaName = form.meta_template_name?.trim() || null;
      const safeMetaName = rawMetaName ? toMetaTemplateName(rawMetaName) || null : null;
      const safeLanguage = VALID_LANGUAGE_CODES.has(form.language || '') ? (form.language || 'en_US') : 'en_US';

      const payload: MessageTemplateCreate = {
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        channel: form.channel,
        channel_id: form.channel_id ?? undefined,
        intent_key: form.intent_key?.trim() || undefined,
        body: form.body,
        language: safeLanguage,
        is_active: form.is_active ?? true,
        priority: form.priority ?? 0,
        agent_id: form.agent_id,
        header_type: form.header_type === 'none' ? null : form.header_type,
        header_content: form.header_content?.trim() || null,
        footer: form.footer?.trim() || null,
        buttons: form.buttons.length > 0 ? form.buttons : null,
        meta_template_name: safeMetaName,
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
          const metaMsg = (e as Error).message ?? 'Unknown error';
          setError(`Template saved, but Meta submission failed: ${metaMsg}`);
          if (isNameDeletionError(metaMsg)) {
            startRetryCountdown(result, 60);
          }
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

  const isNameDeletionError = (msg: string) =>
    msg.includes('still cleaning up') || msg.includes('2388023') || msg.includes('being deleted');

  const startRetryCountdown = (tpl: MessageTemplate, seconds = 60) => {
    setRetryTemplate(tpl);
    setRetryCountdown(seconds);
    if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    retryTimerRef.current = setInterval(() => {
      setRetryCountdown((c) => {
        if (c <= 1) {
          clearInterval(retryTimerRef.current!);
          retryTimerRef.current = null;
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSubmitMeta = async (tpl: MessageTemplate) => {
    setRetryTemplate(null);
    setRetryCountdown(0);
    if (retryTimerRef.current) { clearInterval(retryTimerRef.current); retryTimerRef.current = null; }
    setSubmitting(tpl.id);
    try {
      const result = await submitTemplateToMeta(tpl.id);
      setTemplates((prev) => prev.map((t) => (t.id === result.id ? result : t)));
      setSuccess('Template submitted to Meta for approval');
    } catch (e) {
      const msg = (e as Error).message ?? 'Failed to submit to Meta';
      setError(msg);
      if (isNameDeletionError(msg)) {
        startRetryCountdown(tpl, 60);
      }
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
      const wabaInfo = result.wabas_checked ? ` across ${result.wabas_checked} WABA(s)` : '';
      setSuccess(`Synced ${result.synced} of ${result.total_checked ?? '?'} template(s)${wabaInfo}`);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to sync with Meta');
    } finally {
      setSyncing(false);
    }
  };

  // ─── Send template ──

  const handleSendTest = (tpl: MessageTemplate) => {
    setSendModalTemplate(tpl);
  };

  // ─── Render ──

  return (
    <>
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
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#25d366]/40 bg-[#25d366]/10 px-4 py-2 text-xs font-semibold text-[#25d366] hover:bg-[#25d366]/20 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Import from WhatsApp
            </button>
            <button
              type="button"
              onClick={() => { if (!showBuilder) openNewTemplate(); setShowAiModal(true); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate with AI
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
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
              <button onClick={() => { setError(null); setRetryTemplate(null); setRetryCountdown(0); if (retryTimerRef.current) { clearInterval(retryTimerRef.current); retryTimerRef.current = null; } }} className="text-red-400 hover:text-red-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Retry banner for name-deletion race */}
            {retryTemplate && (
              <div className="mt-2 flex items-center gap-3 border-t border-red-500/20 pt-2">
                <span className="text-xs text-red-300">
                  {retryCountdown > 0
                    ? `Meta needs a moment to clean up. Auto-retry available in ${retryCountdown}s, or click now:`
                    : 'Ready to retry — click the button:'}
                </span>
                <button
                  type="button"
                  disabled={submitting !== null}
                  onClick={() => { if (retryTemplate) void handleSubmitMeta(retryTemplate); }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-red-500/20 border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Retry Submission
                </button>
              </div>
            )}
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
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-text-primary">
                    {editing ? 'Edit Template' : 'Create New Template'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAiModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600/90 to-indigo-600/90 px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 transition-opacity shadow-sm"
                  >
                    <Sparkles className="h-3 w-3" />
                    AI Generate
                  </button>
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
                    onChange={(e) => setForm((f) => ({ ...f, meta_template_name: toMetaTemplateName(e.target.value) }))}
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
                      value={form.language ?? 'en_US'}
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

                {/* ─── WhatsApp Channel ── */}
                {form.channel === 'whatsapp' && waChannels.length >= 1 && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-secondary">WhatsApp Channel</label>
                    <select
                      value={form.channel_id != null ? String(form.channel_id) : ''}
                      onChange={(e) => setForm((f) => ({ ...f, channel_id: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                    >
                      {waChannels.length > 1 && (
                        <option value="">Any channel (auto-select)</option>
                      )}
                      {waChannels.map((ch) => (
                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-text-secondary">
                      {waChannels.length === 1
                        ? 'This template will be submitted under this WhatsApp number.'
                        : 'Pin to a specific WhatsApp number / WABA, or leave on Any to auto-select.'}
                    </p>
                  </div>
                )}
                {form.channel === 'whatsapp' && waChannels.length === 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                    No connected WhatsApp channel found. Connect one in Settings → Channels before submitting to Meta.
                  </div>
                )}

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
                          onChange={() => { setForm((f) => ({ ...f, header_type: ht, header_content: '' })); setHeaderMedia(null); }}
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
                    <div className="space-y-2">
                      <input
                        ref={headerFileInputRef}
                        type="file"
                        accept={HEADER_MEDIA_ACCEPT[form.header_type]}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleHeaderFileSelected(f);
                        }}
                      />
                      {(form.header_content?.startsWith('s3:') || headerMedia) ? (
                        /* Uploaded file chip */
                        <div className="flex items-center gap-2.5 rounded-lg border border-[#25d366]/30 bg-[#25d366]/5 px-3 py-2.5">
                          {form.header_type === 'image' && headerMedia?.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={headerMedia.url} alt="" className="h-9 w-9 rounded object-cover shrink-0" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded bg-[#25d366]/15 shrink-0">
                              {form.header_type === 'image' && <Image className="h-4 w-4 text-[#25d366]" />}
                              {form.header_type === 'video' && <Video className="h-4 w-4 text-[#25d366]" />}
                              {form.header_type === 'document' && <File className="h-4 w-4 text-[#25d366]" />}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-text-primary truncate">
                              {headerMedia?.filename ?? 'Uploaded media file'}
                            </div>
                            <div className="text-[10px] text-text-secondary">Will be attached as the template header sample</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => headerFileInputRef.current?.click()}
                            disabled={uploadingHeader}
                            className="rounded-md border border-border-color px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors disabled:opacity-50"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={clearHeaderMedia}
                            className="rounded-md p-1 text-text-secondary hover:text-red-400 transition-colors"
                            title="Remove file"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => headerFileInputRef.current?.click()}
                            disabled={uploadingHeader}
                            className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-border-color bg-bg-primary px-3 py-3 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-accent/50 hover:bg-accent/5 transition-colors disabled:opacity-60 disabled:cursor-wait"
                          >
                            {uploadingHeader ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Uploading…
                              </>
                            ) : (
                              <>
                                <Upload className="h-3.5 w-3.5" />
                                Upload {form.header_type} ({HEADER_MEDIA_HINT[form.header_type]})
                              </>
                            )}
                          </button>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-border-color/60" />
                            <span className="text-[10px] text-text-secondary uppercase">or paste a public URL</span>
                            <div className="flex-1 h-px bg-border-color/60" />
                          </div>
                          <input
                            value={form.header_content ?? ''}
                            onChange={(e) => setForm((f) => ({ ...f, header_content: e.target.value }))}
                            placeholder={`https://… ${form.header_type === 'image' ? 'image' : form.header_type === 'video' ? 'video' : 'document'} URL`}
                            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* ─── Body ── */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-text-secondary">Body</label>
                    {/* WhatsApp formatting toolbar */}
                    <div className="flex items-center gap-0.5">
                      {[
                        { title: 'Bold', display: 'B', wrap: ['*', '*'], className: 'font-bold' },
                        { title: 'Italic', display: 'I', wrap: ['_', '_'], className: 'italic' },
                        { title: 'Strikethrough', display: 'S', wrap: ['~', '~'], className: 'line-through' },
                        { title: 'Monospace', display: '<>', wrap: ['```', '```'], className: 'font-mono text-[10px]' },
                      ].map(({ title, display, wrap, className }) => (
                        <button
                          key={title}
                          type="button"
                          title={title}
                          onMouseDown={(e) => { e.preventDefault(); wrapBodySelection(wrap[0], wrap[1]); }}
                          className={`rounded px-1.5 py-0.5 text-[11px] text-text-secondary border border-border-color hover:bg-bg-secondary hover:text-text-primary transition-colors ${className}`}
                        >
                          {display}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    ref={bodyTextareaRef}
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    rows={5}
                    placeholder="Hello {{1}}, your order #{{2}} has been confirmed."
                    className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-y"
                  />
                  <p className="text-[10px] text-text-secondary">
                    Use {'{{1}}'}, {'{{2}}'} etc. for dynamic values. Use *bold*, _italic_, ~strike~, {'```mono```'} for formatting.
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
                  {buttonTypeError && (
                    <div className="flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {buttonTypeError}
                    </div>
                  )}
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
                        <div className="space-y-1">
                          <input
                            value={btn.phone_number ?? ''}
                            onChange={(e) => updateButton(idx, { phone_number: e.target.value })}
                            placeholder="+12025550123"
                            className={`w-full rounded-md border px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 bg-bg-secondary ${
                              btn.phone_number && !E164_RE.test(btn.phone_number)
                                ? 'border-red-500/60 focus:ring-red-500/50'
                                : 'border-border-color'
                            }`}
                          />
                          {btn.phone_number && !E164_RE.test(btn.phone_number) && (
                            <p className="text-[10px] text-red-400 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              Must be E.164 format, e.g. +12025550123
                            </p>
                          )}
                        </div>
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
                      const selOpt = allSourceOptions.find((o) => o.value === mapping?.source);
                      const isStatic = selOpt && !selOpt.hasLeadRelation && selOpt.modelId != null;
                      const rowOpts = isStatic && selOpt?.modelId != null ? (rowsByModel[selOpt.modelId] ?? []) : [];
                      return (
                        <div key={`header-${p}`} className="space-y-1.5">
                          <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                            <span className="text-[11px] font-mono text-accent">{`Header {{${p}}}`}</span>
                            <select
                              value={mapping?.source ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const opt = allSourceOptions.find((o) => o.value === val);
                                updateParamMapping(p, 'header', { source: val, label: opt?.label ?? val, default_record_id: null });
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
                          </div>
                          {mapping?.source && (
                            <div className="ml-[88px] flex items-center gap-2">
                              {selOpt?.hasLeadRelation ? (
                                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400 border border-green-500/25">Auto per lead</span>
                              ) : selOpt?.modelId != null ? (
                                <>
                                  <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/25">Same for all</span>
                                  <select
                                    value={mapping?.default_record_id ?? ''}
                                    onChange={(e) => updateParamMapping(p, 'header', { default_record_id: e.target.value ? Number(e.target.value) : null })}
                                    className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
                                  >
                                    <option value="">Default row (first active)</option>
                                    {rowOpts.map((r) => (
                                      <option key={r.id} value={r.id}>{r.label}</option>
                                    ))}
                                  </select>
                                </>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Body params */}
                    {detectedParams.bodyParams.map((p) => {
                      const mapping = getParamMapping(p, 'body');
                      const selOpt = allSourceOptions.find((o) => o.value === mapping?.source);
                      const isStatic = selOpt && !selOpt.hasLeadRelation && selOpt.modelId != null;
                      const rowOpts = isStatic && selOpt?.modelId != null ? (rowsByModel[selOpt.modelId] ?? []) : [];
                      return (
                        <div key={`body-${p}`} className="space-y-1.5">
                          <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                            <span className="text-[11px] font-mono text-accent">{`Body {{${p}}}`}</span>
                            <select
                              value={mapping?.source ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const opt = allSourceOptions.find((o) => o.value === val);
                                updateParamMapping(p, 'body', { source: val, label: opt?.label ?? val, default_record_id: null });
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
                          </div>
                          {mapping?.source && (
                            <div className="ml-[88px] flex items-center gap-2">
                              {selOpt?.hasLeadRelation ? (
                                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400 border border-green-500/25">Auto per lead</span>
                              ) : selOpt?.modelId != null ? (
                                <>
                                  <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/25">Same for all</span>
                                  <select
                                    value={mapping?.default_record_id ?? ''}
                                    onChange={(e) => updateParamMapping(p, 'body', { default_record_id: e.target.value ? Number(e.target.value) : null })}
                                    className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
                                  >
                                    <option value="">Default row (first active)</option>
                                    {rowOpts.map((r) => (
                                      <option key={r.id} value={r.id}>{r.label}</option>
                                    ))}
                                  </select>
                                </>
                              ) : null}
                            </div>
                          )}
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
                <WhatsAppPreview form={form} headerMediaUrl={headerMedia?.url ?? null} />
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

      {/* Send Template Modal */}
      {sendModalTemplate && (
        <SendTemplateModal
          template={sendModalTemplate}
          onClose={() => setSendModalTemplate(null)}
          onSuccess={(msg) => {
            setSuccess(msg);
            setTimeout(() => setSuccess(null), 5000);
          }}
          onError={(msg) => {
            setError(msg);
            setTimeout(() => setError(null), 5000);
          }}
        />
      )}

      {/* AI Template Generator Modal */}
      {showAiModal && (
        <AiTemplateModal
          onClose={() => setShowAiModal(false)}
          onApply={applyAiResult}
          initialLanguage={form.language ?? 'en_US'}
        />
      )}

      {/* Import from WhatsApp Manager Modal */}
      {showImportModal && (
        <ImportFromMetaModal
          onClose={() => setShowImportModal(false)}
          onImported={(count) => {
            setShowImportModal(false);
            setSuccess(`Successfully imported ${count} template${count !== 1 ? 's' : ''} from WhatsApp Manager. You can now set variable mappings and use them.`);
            void loadTemplates();
          }}
        />
      )}
    </>
  );
}
