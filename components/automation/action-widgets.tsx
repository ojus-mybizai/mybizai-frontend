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
import {
  listModels,
  listFields,
  type DynamicModel,
  type DynamicField,
} from '@/services/dynamic-data';
import { listMembers, type Member } from '@/services/members';
import { listRoles, type Role } from '@/services/roles';
import { DatasheetFieldInput } from '@/components/data-sheet/datasheet-field-input';

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

/* ── Datasheet picker (feeds create_record / trigger "which datasheet") ─────── */

/**
 * Fetches the business's datasheets once. Value stored is the model's
 * internal `name` (not `display_name`) — the ECA engine matches trigger
 * filters and the create_record handler against DynamicModel.name, so the
 * picker must submit the same key it always expected, just no longer typed
 * by hand.
 */
export function DatasheetPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [datasheets, setDatasheets] = useState<DynamicModel[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listModels()
      .then(setDatasheets)
      .catch(() => setDatasheets([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none`}>
      <option value="">{loaded && datasheets.length === 0 ? 'No datasheets yet' : 'Select a datasheet…'}</option>
      {datasheets.map((m) => (
        <option key={m.id} value={m.name}>{m.display_name}</option>
      ))}
    </select>
  );
}

/** Loads a datasheet's fields by its (internal) name — same lookup key the engine uses. */
export function useDatasheetFieldsByName(datasheetName: string): { fields: DynamicField[]; loading: boolean } {
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!datasheetName) { setFields([]); return; }
    let cancelled = false;
    setLoading(true);
    listModels()
      .then((models) => {
        const model = models.find((m) => m.name.toLowerCase() === datasheetName.toLowerCase());
        if (!model) return [] as DynamicField[];
        return listFields(model.id);
      })
      .then((fs) => { if (!cancelled) setFields(fs || []); })
      .catch(() => { if (!cancelled) setFields([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [datasheetName]);

  return { fields, loading };
}

/** Select a field belonging to a known datasheet schema (falls back to free text when the schema isn't known yet). */
export function RecordFieldPicker({
  value, onChange, fields,
}: { value: string; onChange: (v: string) => void; fields: DynamicField[] }) {
  if (fields.length === 0) {
    return (
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Field name"
        className={INPUT} />
    );
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none`}>
      <option value="">Select field…</option>
      {fields.filter((f) => f.field_type !== 'computed').map((f) => (
        <option key={f.id} value={f.name}>{f.display_name}</option>
      ))}
    </select>
  );
}

/** Type-aware value input for a field picked via RecordFieldPicker. */
export function RecordValuePicker({
  value, onChange, fields, fieldName,
}: { value: string; onChange: (v: string) => void; fields: DynamicField[]; fieldName: string }) {
  const targetField = fields.find((f) => f.name === fieldName);
  if (!targetField) {
    return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="New value" className={INPUT} />;
  }
  return <DatasheetFieldInput field={targetField} value={value} onChange={(v) => onChange(v == null ? '' : String(v))} />;
}

/* ── Member / role pickers (create_task assignment) ─────────────────────────── */

export function MemberPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listMembers({ assignable_only: true })
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none`}>
      <option value="">{loaded && members.length === 0 ? 'No members yet' : 'Select a member…'}</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>{m.name}{m.role_name ? ` · ${m.role_name}` : ''}</option>
      ))}
    </select>
  );
}

export function RolePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listRoles()
      .then(setRoles)
      .catch(() => setRoles([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none`}>
      <option value="">{loaded && roles.length === 0 ? 'No roles yet' : 'Select a role…'}</option>
      {roles.map((r) => (
        <option key={r.id} value={r.name}>{r.name}</option>
      ))}
    </select>
  );
}

/* ── Task assignee-source picker ─────────────────────────────────────────────── */

const ASSIGNEE_SOURCE_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'linked_contact_member', label: "Linked contact's owner (Member)", hint: 'Follows the contact’s assigned Member. Best for CRM/sales tasks.' },
  { value: 'specific', label: 'A specific Member', hint: 'Pick one Member below.' },
  { value: 'role', label: 'Round-robin within a role', hint: 'Least-loaded Member with that role.' },
  { value: 'any_active', label: 'Round-robin across all active Members', hint: 'Fallback when no other assignee is set.' },
];

export function TaskAssigneeSourcePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none`}>
        <option value="">Select…</option>
        {ASSIGNEE_SOURCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {value && (
        <p className="text-[10px] text-text-secondary/70">
          {ASSIGNEE_SOURCE_OPTIONS.find((o) => o.value === value)?.hint}
        </p>
      )}
    </div>
  );
}

/* ── Variable-picker inputs (title / instructions) ───────────────────────────── */

/**
 * Text input (or textarea) with a chip row of insertable variables that
 * resolve at fire time via eca_engine._resolve_templates. We show:
 *  - the current sheet's own fields as `{record.<field_name>}`
 *  - a fixed set of `{contact.*}` keys populated by context_enricher
 *
 * Inserting a chip pastes the token at the caret. Users can still type free
 * text — chips are strictly additive.
 */
export function TextWithVarsInput({
  value, onChange, fields, multiline = false, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  fields: DynamicField[];
  multiline?: boolean;
  placeholder?: string;
}) {
  const [ref, setRef] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const insertToken = (token: string) => {
    const el = ref;
    const cur = value ?? '';
    if (!el || typeof el.selectionStart !== 'number') {
      onChange(cur + token);
      return;
    }
    const start = el.selectionStart ?? cur.length;
    const end = el.selectionEnd ?? cur.length;
    const next = cur.slice(0, start) + token + cur.slice(end);
    onChange(next);
    // Restore caret after React re-renders.
    queueMicrotask(() => {
      try {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      } catch { /* no-op */ }
    });
  };

  const recordChips = fields
    .filter((f) => f.field_type !== 'computed' && f.field_type !== 'image' && f.field_type !== 'file')
    .map((f) => ({ token: `{record.${f.name}}`, label: f.display_name || f.name }));

  const contactChips = [
    { token: '{contact.name}', label: 'Contact name' },
    { token: '{contact.phone}', label: 'Contact phone' },
    { token: '{contact.email}', label: 'Contact email' },
  ];

  const chipClass = 'rounded-full border border-border-color bg-bg-primary/60 px-2 py-0.5 text-[10px] text-text-secondary hover:border-accent/50 hover:bg-accent/10 hover:text-text-primary transition-colors';

  return (
    <div className="space-y-1.5">
      {multiline ? (
        <textarea
          ref={(el) => setRef(el)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className={`${INPUT} resize-y min-h-[92px] font-normal`}
        />
      ) : (
        <input
          ref={(el) => setRef(el)}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={INPUT}
        />
      )}
      {(recordChips.length > 0 || contactChips.length > 0) && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-secondary/70">Insert:</span>
          {contactChips.map((c) => (
            <button key={c.token} type="button" onClick={() => insertToken(c.token)} className={chipClass} title={c.token}>
              {c.label}
            </button>
          ))}
          {recordChips.length > 0 && <span className="px-1 text-[10px] text-text-secondary/40">·</span>}
          {recordChips.map((c) => (
            <button key={c.token} type="button" onClick={() => insertToken(c.token)} className={chipClass} title={c.token}>
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Create-record field-value editor (replaces the raw JSON textarea) ──────── */

/**
 * Renders one type-correct input per field of the chosen target datasheet,
 * serializing the result into the same `field_values` JSON string the
 * create_record handler already expects — the wire format doesn't change,
 * only how it gets authored.
 */
export function RecordFieldValuesEditor({
  datasheetName, value, onChange,
}: { datasheetName: string; value: string; onChange: (json: string) => void }) {
  const { fields, loading } = useDatasheetFieldsByName(datasheetName);

  if (!datasheetName) {
    return (
      <p className="rounded-lg border border-dashed border-border-color px-3 py-2 text-xs text-text-secondary">
        Pick a datasheet above first.
      </p>
    );
  }
  if (loading) {
    return <p className="text-xs text-text-secondary">Loading fields…</p>;
  }

  const editableFields = fields.filter((f) => !['relation', 'image', 'file', 'computed'].includes(f.field_type));
  if (editableFields.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border-color px-3 py-2 text-xs text-text-secondary">
        This datasheet has no directly editable fields.
      </p>
    );
  }

  let obj: Record<string, unknown> = {};
  try { obj = value ? JSON.parse(value) : {}; } catch { obj = {}; }

  const setField = (name: string, v: unknown) => {
    const next = { ...obj, [name]: v };
    onChange(JSON.stringify(next));
  };

  return (
    <div className="space-y-2.5">
      {editableFields.map((f) => (
        <div key={f.id}>
          <label className="mb-1 block text-[11px] text-text-secondary">{f.display_name}</label>
          <DatasheetFieldInput field={f} value={obj[f.name]} onChange={(v) => setField(f.name, v)} />
        </div>
      ))}
    </div>
  );
}
