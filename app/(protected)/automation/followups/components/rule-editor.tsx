'use client';
/**
 * Single-screen follow-up rule editor.
 *
 * Sections, in order:
 *   1. Basics (name, description)
 *   2. Trigger (type + per-type config form)
 *   3. Message (free-form text + template + params)
 *   4. Guardrails (max_per_contact, cooldown, max_daily_cost, mode)
 *   5. Live cost estimate sidebar
 *
 * No multi-step wizard — everything visible, save button always available.
 * Mirrors the existing automation rule-editor pattern in the codebase.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createFollowupRule,
  updateFollowupRule,
  listFollowupTemplates,
  estimateFollowupCost,
  formatMoney,
  TRIGGER_TYPE_META,
  type FollowUpRule,
  type FollowUpRuleCreate,
  type FollowUpRuleUpdate,
  type FollowUpTemplateOption,
  type FollowUpTriggerType,
  type FollowUpEstimateResponse,
  type FollowUpMode,
} from '@/services/followups';

/* User-configurable trigger types (excludes system-only ones) */
const CONFIGURABLE_TRIGGERS: FollowUpTriggerType[] = [
  'no_reply_for',
  'session_end',
  'pipeline_stage_change',
  'contact_created',
  'before_datetime_field',
  'time_after_event',
];

interface Props {
  rule?: FollowUpRule | null;       // null/undefined = creating new
  onSaved?: (rule: FollowUpRule) => void;
}

interface FormState {
  name: string;
  description: string;
  is_active: boolean;
  trigger_type: FollowUpTriggerType;
  trigger_config: Record<string, any>;
  delay_minutes: number;
  free_form_text: string;
  template_id: number | null;
  template_params: string[];
  fallback_template_id: number | null;
  max_per_contact: number;
  cooldown_hours: number;
  priority: number;
  max_daily_cost: string;  // string for form input; converted on save
  mode: FollowUpMode;
}

function buildInitialState(rule?: FollowUpRule | null): FormState {
  return {
    name: rule?.name ?? '',
    description: rule?.description ?? '',
    is_active: rule?.is_active ?? true,
    trigger_type: rule?.trigger_type ?? 'no_reply_for',
    trigger_config: (rule?.trigger_config as Record<string, any>) ?? {},
    delay_minutes: rule?.delay_minutes ?? 60,
    free_form_text: rule?.free_form_text ?? '',
    template_id: rule?.template_id ?? null,
    template_params: [],
    fallback_template_id: rule?.fallback_template_id ?? null,
    max_per_contact: rule?.max_per_contact ?? 3,
    cooldown_hours: rule?.cooldown_hours ?? 24,
    priority: rule?.priority ?? 100,
    max_daily_cost: rule?.max_daily_cost != null ? String(rule.max_daily_cost) : '',
    mode: rule?.mode ?? 'auto',
  };
}

export default function RuleEditor({ rule, onSaved }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => buildInitialState(rule));
  const [templates, setTemplates] = useState<FollowUpTemplateOption[]>([]);
  const [estimate, setEstimate] = useState<FollowUpEstimateResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load templates on mount
  useEffect(() => {
    listFollowupTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  // Re-estimate on relevant field changes (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      estimateFollowupCost({
        template_id: form.template_id,
        free_form_text: form.free_form_text || null,
        delay_minutes: form.delay_minutes,
        trigger_type: form.trigger_type,
      })
        .then(setEstimate)
        .catch(() => setEstimate(null));
    }, 300);
    return () => clearTimeout(t);
  }, [form.template_id, form.free_form_text, form.delay_minutes, form.trigger_type]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === form.template_id) || null,
    [templates, form.template_id],
  );

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: FollowUpRuleCreate | FollowUpRuleUpdate = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        is_active: form.is_active,
        trigger_type: form.trigger_type,
        trigger_config: Object.keys(form.trigger_config).length ? form.trigger_config : null,
        delay_minutes: form.delay_minutes,
        free_form_text: form.free_form_text || null,
        template_id: form.template_id ?? null,
        fallback_template_id: form.fallback_template_id ?? null,
        max_per_contact: form.max_per_contact,
        cooldown_hours: form.cooldown_hours,
        priority: form.priority,
        max_daily_cost: form.max_daily_cost ? parseFloat(form.max_daily_cost) : null,
        mode: form.mode,
      };
      if (!payload.name) throw new Error('Name is required');
      if (!form.free_form_text && !form.template_id) {
        throw new Error('Provide either free-form text, a template, or both.');
      }

      let saved: FollowUpRule;
      if (rule?.id) {
        saved = await updateFollowupRule(rule.id, payload as FollowUpRuleUpdate);
      } else {
        saved = await createFollowupRule(payload as FollowUpRuleCreate);
      }
      onSaved?.(saved);
      router.push('/automation/followups');
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  /* ─────────── Render ─────────── */

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {/* Section: Basics */}
        <Section title="1. Basics">
          <Field label="Name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. No reply 1h nudge"
              className={fieldCls}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="What this rule does and why."
              rows={2}
              className={fieldCls}
            />
          </Field>
        </Section>

        {/* Section: Trigger */}
        <Section title="2. When should this fire?">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CONFIGURABLE_TRIGGERS.map((t) => {
              const meta = TRIGGER_TYPE_META[t];
              const selected = form.trigger_type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => update('trigger_type', t)}
                  className={`rounded-lg border p-3 text-left transition ${
                    selected
                      ? 'border-accent bg-accent/5 ring-1 ring-accent'
                      : 'border-border-color bg-bg-primary hover:bg-bg-secondary'
                  }`}
                >
                  <p className="text-sm font-semibold text-text-primary">
                    <span className="mr-1">{meta.icon}</span> {meta.label}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">{meta.description}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-border-color bg-bg-secondary/50 p-3">
            <TriggerConfig
              type={form.trigger_type}
              config={form.trigger_config}
              onChange={(v) => update('trigger_config', v)}
              delayMinutes={form.delay_minutes}
              onDelayChange={(n) => update('delay_minutes', n)}
            />
          </div>
        </Section>

        {/* Section: Message */}
        <Section title="3. What should we send?">
          <Field
            label="Free-form text"
            hint="Sent if the contact is still INSIDE the 24h WhatsApp window. No cost. Use {{name}} for the contact's name."
          >
            <textarea
              value={form.free_form_text}
              onChange={(e) => update('free_form_text', e.target.value)}
              placeholder="Hi {{name}}, just checking in — still need any help?"
              rows={3}
              maxLength={1000}
              className={fieldCls}
            />
            <p className="mt-1 text-xs text-text-secondary">{form.free_form_text.length}/1000</p>
          </Field>

          <Field
            label="Template (used outside the 24h window)"
            hint="Pre-approved WhatsApp template. Required for delays over 6 hours."
          >
            <select
              value={form.template_id ?? ''}
              onChange={(e) => update('template_id', e.target.value ? Number(e.target.value) : null)}
              className={fieldCls}
            >
              <option value="">— No template (free-form only) —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.category} — {formatMoney(t.cost_per_conversation, t.currency)}/send)
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <div className="mt-2 rounded-md border border-border-color bg-bg-secondary p-3 text-xs">
                <p className="font-semibold text-text-primary">Preview:</p>
                <pre className="mt-1 whitespace-pre-wrap text-text-secondary">
                  {selectedTemplate.body_preview}
                </pre>
                <p className="mt-2 text-text-secondary">
                  Placeholders: <span className="font-semibold">{selectedTemplate.placeholder_count}</span>
                  {selectedTemplate.placeholder_count > 0 && (
                    <span className="ml-2 italic">
                      Will be auto-resolved from contact context when sending.
                    </span>
                  )}
                </p>
              </div>
            )}
          </Field>

          {templates.length > 0 && form.template_id && (
            <Field label="Fallback template (if the main template is rejected/disabled)">
              <select
                value={form.fallback_template_id ?? ''}
                onChange={(e) =>
                  update('fallback_template_id', e.target.value ? Number(e.target.value) : null)
                }
                className={fieldCls}
              >
                <option value="">— None —</option>
                {templates
                  .filter((t) => t.id !== form.template_id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </Section>

        {/* Section: Guardrails */}
        <Section title="4. Guardrails">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Max sends per contact"
              hint="Lifetime cap from this rule per contact."
            >
              <input
                type="number"
                min={1}
                value={form.max_per_contact}
                onChange={(e) => update('max_per_contact', Math.max(1, parseInt(e.target.value || '1')))}
                className={fieldCls}
              />
            </Field>
            <Field
              label="Cooldown (hours)"
              hint="Don't fire on the same contact within this many hours."
            >
              <input
                type="number"
                min={0}
                value={form.cooldown_hours}
                onChange={(e) => update('cooldown_hours', Math.max(0, parseInt(e.target.value || '0')))}
                className={fieldCls}
              />
            </Field>
            <Field
              label="Daily spend cap (₹)"
              hint="Optional. Rule auto-pauses after spending this much in a day."
            >
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.max_daily_cost}
                onChange={(e) => update('max_daily_cost', e.target.value)}
                placeholder="leave empty for no cap"
                className={fieldCls}
              />
            </Field>
            <Field label="Delivery mode">
              <select
                value={form.mode}
                onChange={(e) => update('mode', e.target.value as FollowUpMode)}
                className={fieldCls}
              >
                <option value="auto">Auto — send without approval</option>
                <option value="manual">Manual — queue for staff to send</option>
                <option value="both">Both — staff sees + can override</option>
              </select>
            </Field>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <input
              id="is_active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
              className="h-4 w-4 rounded border-border-color"
            />
            <label htmlFor="is_active" className="text-sm text-text-primary">
              Active (rule will fire when triggered)
            </label>
          </div>
        </Section>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push('/automation/followups')}
            className="rounded-lg border border-border-color px-4 py-2 text-sm text-text-primary hover:bg-bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : rule?.id ? 'Save changes' : 'Create rule'}
          </button>
        </div>
      </div>

      {/* Right sidebar: live cost estimate */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-xl border border-border-color bg-bg-primary p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Cost estimate
          </p>
          {estimate ? (
            <div className="mt-2 space-y-2 text-sm">
              <div>
                <p className="text-xs text-text-secondary">If inside 24h window (free):</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  ₹0.00 per send
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">If outside 24h window:</p>
                <p className="text-lg font-bold text-text-primary">
                  {formatMoney(estimate.cost_if_template_send, estimate.currency)} per send
                </p>
                {estimate.template_category && (
                  <p className="text-xs text-text-secondary">
                    Category: {estimate.template_category}
                  </p>
                )}
              </div>
              <div className="border-t border-border-color pt-2">
                <p className="text-xs text-text-secondary">Wallet balance:</p>
                <p className={`text-base font-semibold ${
                  estimate.wallet_low_warning ? 'text-amber-600 dark:text-amber-400' : 'text-text-primary'
                }`}>
                  {formatMoney(estimate.wallet_balance, estimate.currency)}
                </p>
              </div>
              {estimate.notes.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {estimate.notes.map((n, i) => (
                    <li
                      key={i}
                      className="rounded bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-400"
                    >
                      ⚠ {n}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">Calculating...</p>
          )}
          <p className="mt-3 border-t border-border-color pt-2 text-xs text-text-secondary">
            Actual cost is decided at delivery time based on the live window state.
            Multiple sends to the same contact within 24h count as ONE billable
            conversation per category.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ─── Trigger-specific config forms ──────────────────────────────────────── */

function TriggerConfig({
  type, config, onChange, delayMinutes, onDelayChange,
}: {
  type: FollowUpTriggerType;
  config: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
  delayMinutes: number;
  onDelayChange: (n: number) => void;
}) {
  const set = (k: string, v: any) => onChange({ ...config, [k]: v });

  if (type === 'no_reply_for') {
    return (
      <Field
        label="Trigger after silence of (minutes)"
        hint="The customer's last inbound message was N minutes ago AND no agent has replied since."
      >
        <input
          type="number"
          min={5}
          value={config.minutes ?? 60}
          onChange={(e) => set('minutes', parseInt(e.target.value || '60'))}
          className={fieldCls}
        />
      </Field>
    );
  }

  if (type === 'before_datetime_field') {
    return (
      <div className="space-y-3">
        <Field label="Datasheet name" hint="e.g. 'demo_bookings'">
          <input
            type="text"
            value={config.datasheet ?? ''}
            onChange={(e) => set('datasheet', e.target.value)}
            className={fieldCls}
          />
        </Field>
        <Field label="Date field name" hint="e.g. 'scheduled_at'">
          <input
            type="text"
            value={config.field ?? ''}
            onChange={(e) => set('field', e.target.value)}
            className={fieldCls}
          />
        </Field>
        <Field label="Send (minutes before)" hint="e.g. 1440 = 24 hours before. Use 60 = 1 hour before.">
          <input
            type="number"
            min={1}
            value={Math.abs(config.offset_minutes ?? 1440)}
            onChange={(e) => set('offset_minutes', -Math.abs(parseInt(e.target.value || '1440')))}
            className={fieldCls}
          />
        </Field>
        <Field
          label="Contact ID field on the record"
          hint="Which field on the datasheet record references contact.id"
        >
          <input
            type="text"
            value={config.contact_field ?? 'contact_id'}
            onChange={(e) => set('contact_field', e.target.value)}
            className={fieldCls}
          />
        </Field>
      </div>
    );
  }

  if (type === 'pipeline_stage_change') {
    return (
      <div className="space-y-3">
        <Field label="Pipeline stage" hint="Stage name (case-insensitive)">
          <input
            type="text"
            value={config.to_stage ?? ''}
            onChange={(e) => set('to_stage', e.target.value)}
            placeholder="e.g. Demo Booked"
            className={fieldCls}
          />
        </Field>
        <Field label="Delay before sending (minutes)" hint="0 = send immediately">
          <input
            type="number"
            min={0}
            value={delayMinutes}
            onChange={(e) => onDelayChange(parseInt(e.target.value || '0'))}
            className={fieldCls}
          />
        </Field>
        <p className="text-xs text-text-secondary">
          ⚠ Note: this trigger fires via the ECA event system. The rule must also be
          wired in /automation with a `contact.stage_changed` trigger + `schedule_followup`
          action that references this rule's id.
        </p>
      </div>
    );
  }

  if (type === 'contact_created' || type === 'time_after_event') {
    return (
      <Field label="Delay before sending (minutes)" hint="0 = send immediately">
        <input
          type="number"
          min={0}
          value={delayMinutes}
          onChange={(e) => onDelayChange(parseInt(e.target.value || '0'))}
          className={fieldCls}
        />
      </Field>
    );
  }

  if (type === 'session_end') {
    return (
      <Field label="Delay after session end (minutes)">
        <input
          type="number"
          min={1}
          value={delayMinutes}
          onChange={(e) => onDelayChange(parseInt(e.target.value || '1'))}
          className={fieldCls}
        />
      </Field>
    );
  }

  return <p className="text-sm text-text-secondary">No additional configuration needed.</p>;
}

/* ─── Tiny UI primitives ─────────────────────────────────────────────────── */

const fieldCls =
  'w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border-color bg-bg-primary p-5">
      <h2 className="mb-4 text-base font-semibold text-text-primary">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label, hint, required, children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-primary">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
    </div>
  );
}
