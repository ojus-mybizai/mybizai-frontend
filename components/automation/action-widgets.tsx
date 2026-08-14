'use client';

/**
 * Smart action-parameter widgets for the automation drawer.
 *
 * Replaces raw "channel ID" / "template ID" / free-text field-name inputs with
 * real pickers, reusing the platform's existing channel + Meta-template
 * infrastructure. Template variables auto-resolve at send time (via the backend
 * resolve_parameter_values); here we only show a read-only preview of where each
 * variable will come from. See AUTOMATION_REDESIGN_SPEC §10 + action-config UX.
 */

import { useEffect, useState } from 'react';
import { Check, MessageSquare, AlertTriangle } from 'lucide-react';
import {
  listVerifiedWhatsAppChannels,
  whatsAppChannelLabel,
  type Channel,
} from '@/services/channels';
import {
  listMessageTemplates,
  type MessageTemplate,
} from '@/services/message-templates';

const INPUT = 'w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30';

/* ── Channel picker (verified WhatsApp business numbers) ───────────────────── */

export function ChannelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listVerifiedWhatsAppChannels()
      .then(setChannels)
      .catch(() => setChannels([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none`}>
      <option value="">{loaded && channels.length === 0 ? 'No connected WhatsApp number' : 'Auto (first connected number)'}</option>
      {channels.map((c) => (
        <option key={c.id} value={c.id}>{whatsAppChannelLabel(c)}</option>
      ))}
    </select>
  );
}

/* ── Approved WhatsApp template picker + variable preview ──────────────────── */

export function WaTemplatePicker({
  value, onChange, onTemplate,
}: {
  value: string;
  onChange: (v: string) => void;
  onTemplate?: (t: MessageTemplate | null) => void;
}) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listMessageTemplates({ channel: 'whatsapp', meta_status: 'approved' })
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!onTemplate) return;
    onTemplate(templates.find((t) => String(t.id) === String(value)) ?? null);
  }, [value, templates, onTemplate]);

  if (loaded && templates.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border-color px-3 py-2 text-xs text-text-secondary">
        No Meta-approved WhatsApp templates yet. Create and approve one in Message Templates first.
      </p>
    );
  }

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none`}>
      <option value="">Select an approved template…</option>
      {templates.map((t) => (
        <option key={t.id} value={t.id}>{t.name}{t.meta_category ? ` · ${t.meta_category}` : ''}</option>
      ))}
    </select>
  );
}

/** Read-only preview of a template's body + where each variable resolves from. */
export function TemplateVariablePreview({ template }: { template: MessageTemplate | null }) {
  if (!template) return null;
  const mapping = template.parameter_mapping ?? [];
  // Placeholders present in the body but with no mapped source → would send blank.
  const bodyPlaceholders = Array.from(
    new Set(Array.from((template.body || '').matchAll(/\{\{(\d+)\}\}/g)).map((m) => Number(m[1]))),
  );
  const mappedPositions = new Set(mapping.filter((p) => p.component === 'body').map((p) => p.position));
  const unmapped = bodyPlaceholders.filter((n) => !mappedPositions.has(n)).sort((a, b) => a - b);
  return (
    <div className="rounded-lg border border-border-color bg-bg-primary/60 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
        <MessageSquare className="h-3 w-3" /> Message preview
      </div>
      <p className="whitespace-pre-wrap text-xs text-text-primary">{template.body}</p>
      {mapping.length > 0 && (
        <div className="space-y-1 border-t border-border-color pt-2">
          <p className="text-[11px] font-medium text-text-secondary">Variables auto-fill from:</p>
          {mapping
            .slice()
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map((p) => (
              <p key={`${p.component}-${p.position}`} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                <Check className="h-3 w-3 text-green-500" />
                <span className="text-text-primary">{`{{${p.position}}}`}</span>
                <span>←</span>
                <span>{sourceLabel(p.source, p.label)}</span>
              </p>
            ))}
        </div>
      )}
      {mapping.length === 0 && unmapped.length === 0 && (
        <p className="text-[11px] text-text-secondary">No variables — sends as-is.</p>
      )}
      {unmapped.length > 0 && (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            {unmapped.map((n) => `{{${n}}}`).join(', ')} {unmapped.length === 1 ? 'has' : 'have'} no source mapped —
            {unmapped.length === 1 ? ' it' : ' they'} will send blank. Map {unmapped.length === 1 ? 'it' : 'them'} in
            the template’s variable settings first.
          </p>
        </div>
      )}
    </div>
  );
}

function sourceLabel(source: string, label: string): string {
  if (label) return label;
  if (source.startsWith('lead.')) return `Contact · ${source.slice(5)}`;
  if (source.startsWith('business.')) return `Business · ${source.slice(9)}`;
  if (source.startsWith('datasheet.')) {
    const field = source.split('.').slice(2).join('.');
    return `Linked sheet · ${field}`;
  }
  return source || '—';
}

/* ── Recipient picker (friendly, datasheet-aware) ─────────────────────────── */

const RECIPIENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'owner', label: 'Business owner' },
  { value: 'assigned_employee', label: "Linked contact's assigned employee" },
  { value: 'all_employees', label: 'All employees' },
];

export function RecipientPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none`}>
      <option value="">Select recipient…</option>
      {RECIPIENT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
