'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAgentStore } from '@/lib/agent-store';
import { useShallow } from 'zustand/react/shallow';
import type { ReplyLength } from '@/services/agents';
import {
  Save, Loader2, MessageSquare, Settings, Shield,
  ArrowUpRight, MessagesSquare, Info, ListChecks,
} from 'lucide-react';
import ResponsePlaybook from '@/components/agents/response-playbook';

// ─── Collapsible Section ─────────────────────────────────────

function Section({
  title,
  icon: Icon,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: any;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border-color bg-card-bg">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-text-secondary" />}
          <div>
            <span className="text-sm font-semibold text-text-primary">{title}</span>
            {description && <p className="text-[10px] text-text-secondary mt-0.5">{description}</p>}
          </div>
        </div>
        <span className="text-xs text-text-secondary">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border-color pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── List Field ───────────────────────────────────────────────

function ListField({
  label,
  hint,
  items,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      {hint && <p className="text-[10px] text-text-secondary mb-1">{hint}</p>}
      <div className="mt-1 space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={item}
              onChange={(e) => { const n = [...items]; n[i] = e.target.value; onChange(n); }}
              className="flex-1 rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="px-2 text-text-secondary hover:text-red-500 text-sm"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ''])}
          className="text-xs text-accent hover:underline"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

// ─── Field hint pill ─────────────────────────────────────────

function ActiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> used in prompt
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function ChatSettingsClient() {
  const { current, update } = useAgentStore(useShallow((s) => ({
    current: s.current,
    update: s.update,
  })));

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [instructions, setInstructions] = useState('');
  const [personaName, setPersonaName] = useState('');
  const [tone, setTone] = useState('friendly');
  const [replyLanguage, setReplyLanguage] = useState('auto');
  const [replyLength, setReplyLength] = useState<ReplyLength>('short');
  const [useBullets, setUseBullets] = useState(false);
  const [useEmojis, setUseEmojis] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState('');
  const [businessContextHint, setBusinessContextHint] = useState('');
  const [neverDo, setNeverDo] = useState<string[]>([]);
  const [alwaysDo, setAlwaysDo] = useState<string[]>([]);
  const [prohibited, setProhibited] = useState<string[]>([]);
  const [escalationEnabled, setEscalationEnabled] = useState(false);
  const [escalationTriggers, setEscalationTriggers] = useState<string[]>([]);
  const [escalationMessage, setEscalationMessage] = useState('');

  useEffect(() => {
    if (!current) return;
    setInstructions(current.instructions || '');
    setPersonaName(current.personaName || '');
    setTone(current.tone || 'friendly');
    setReplyLanguage(current.replyLanguage || 'auto');
    setReplyLength((current.replyFormat?.maxLength as ReplyLength) || 'short');
    setUseBullets(current.replyFormat?.useBullets ?? false);
    setUseEmojis(current.replyFormat?.useEmojis ?? false);
    setFallbackMessage(current.fallbackMessage || '');
    setBusinessContextHint(current.businessContextHint || '');
    setNeverDo(current.guardrailRules?.neverDo ?? []);
    setAlwaysDo(current.guardrailRules?.alwaysDo ?? []);
    setProhibited(current.guardrailRules?.prohibitedTopics ?? []);
    setEscalationEnabled(current.escalationPolicy?.enabled ?? false);
    setEscalationTriggers(current.escalationPolicy?.triggers ?? []);
    setEscalationMessage(current.escalationPolicy?.message ?? '');
  }, [current?.id]);

  const handleSave = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await update(String(current.id), {
        instructions,
        personaName,
        tone,
        replyLanguage,
        replyFormat: { maxLength: replyLength, useBullets, useEmojis },
        fallbackMessage,
        businessContextHint,
        guardrailRules: {
          neverDo: neverDo.filter(Boolean),
          alwaysDo: alwaysDo.filter(Boolean),
          prohibitedTopics: prohibited.filter(Boolean),
        },
        escalationPolicy: {
          enabled: escalationEnabled,
          triggers: escalationTriggers.filter(Boolean),
          message: escalationMessage,
        },
      });
      setNotice('Saved!');
      setTimeout(() => setNotice(null), 2500);
    } catch (e) {
      setError((e as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [
    current, instructions, personaName, tone, replyLanguage,
    replyLength, useBullets, useEmojis, fallbackMessage, businessContextHint,
    neverDo, alwaysDo, prohibited, escalationEnabled, escalationTriggers, escalationMessage,
    update,
  ]);

  if (!current) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Chat Settings</h2>
          <p className="text-xs text-text-secondary mt-0.5">Controls how the agent talks to customers on live chat channels.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>

      <div>
        <div className="space-y-4">

          {/* Chat Instructions */}
          <Section title="Chat instructions" icon={MessageSquare}
            description="The agent's core behaviour when talking to customers.">
            <div className="flex items-start gap-2 rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-[11px] text-text-secondary">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              <span>
                This box is for overall behaviour. For how the agent should answer specific kinds of
                questions, use the <strong className="text-text-primary">Responses</strong> section below.
              </span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-text-secondary">Instructions</span>
              <ActiveBadge />
            </div>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={12}
              placeholder={`You are a sales assistant for [business].\nYour job is to help customers find the right product and capture their contact info.\n\nWhen a customer asks about pricing, use search_[your_datasheet] to look up current prices.\nWhen a customer wants to buy, use update_lead_field to save their details.\n\nAlways reply via the send_message skill.`}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary font-mono"
            />
            <p className="text-[11px] text-text-secondary flex items-start gap-1">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              For scheduled or event-triggered runs, set separate instructions in the <strong>Automation</strong> tab.
            </p>
          </Section>

          {/* Responses (per-question-type playbook) */}
          <Section title="Responses" icon={ListChecks}
            description="How the agent should answer each kind of question.">
            <ResponsePlaybook />
          </Section>

          {/* Persona & style */}
          <Section title="Persona & style" icon={Settings}
            description="How the agent identifies itself and formats replies.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs font-medium text-text-secondary">Persona name</label>
                  <ActiveBadge />
                </div>
                <input
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  placeholder="e.g. Aria, Max, MyBiz Assistant"
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
                />
                <p className="text-[10px] text-text-secondary mt-0.5">Name the agent uses to introduce itself.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs font-medium text-text-secondary">Tone</label>
                  <ActiveBadge />
                </div>
                <input
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="friendly, professional, casual…"
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs font-medium text-text-secondary">Reply language</label>
                  <ActiveBadge />
                </div>
                <select
                  value={replyLanguage}
                  onChange={(e) => setReplyLanguage(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
                >
                  <option value="auto">Auto-detect (match customer)</option>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="ar">Arabic</option>
                </select>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs font-medium text-text-secondary">Reply length</label>
                  <ActiveBadge />
                </div>
                <div className="flex gap-2 mt-1">
                  {(['short', 'medium', 'long'] as ReplyLength[]).map((l) => (
                    <button key={l} type="button" onClick={() => setReplyLength(l)}
                      className={`px-3 py-1 rounded-lg text-xs border capitalize ${replyLength === l ? 'border-accent bg-accent/10 text-accent' : 'border-border-color text-text-secondary hover:border-text-secondary'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input type="checkbox" checked={useBullets} onChange={(e) => setUseBullets(e.target.checked)} className="rounded" />
                <span>Use bullet points <ActiveBadge /></span>
              </label>
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input type="checkbox" checked={useEmojis} onChange={(e) => setUseEmojis(e.target.checked)} className="rounded" />
                <span>Use emojis <ActiveBadge /></span>
              </label>
            </div>
          </Section>

          {/* Messages */}
          <Section title="Messages" icon={MessagesSquare}
            description="Canned responses injected into the agent's prompt.">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs font-medium text-text-secondary">Fallback message</label>
                <ActiveBadge />
              </div>
              <textarea
                value={fallbackMessage}
                onChange={(e) => setFallbackMessage(e.target.value)}
                rows={2}
                placeholder="I'm sorry, I'm not able to help with that right now. Please contact us directly."
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
              />
              <p className="text-[10px] text-text-secondary mt-0.5">Agent uses this when it genuinely cannot help.</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs font-medium text-text-secondary">Business context hint</label>
                <ActiveBadge />
              </div>
              <textarea
                value={businessContextHint}
                onChange={(e) => setBusinessContextHint(e.target.value)}
                rows={3}
                placeholder="e.g. We are a Tally software reseller. Our customers are mainly accountants and small business owners. We do not sell hardware."
                className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
              />
              <p className="text-[10px] text-text-secondary mt-0.5">Extra context injected into every prompt — use it to ground the agent in your business specifics.</p>
            </div>
          </Section>

          {/* Guardrails */}
          <Section title="Guardrails" icon={Shield}
            description="Rules injected directly into the agent's prompt.">
            <ListField
              label="Never do"
              hint="Injected as hard rules into the prompt."
              items={neverDo}
              placeholder="e.g. Never share competitor pricing"
              onChange={setNeverDo}
            />
            <ListField
              label="Always do"
              hint="Injected as always-on instructions."
              items={alwaysDo}
              placeholder="e.g. Always greet the customer by name"
              onChange={setAlwaysDo}
            />
            <ListField
              label="Prohibited topics"
              hint="Topics the agent will refuse to discuss."
              items={prohibited}
              placeholder="e.g. Politics, competitor products"
              onChange={setProhibited}
            />
          </Section>

          {/* Escalation */}
          <Section title="Human handoff" icon={ArrowUpRight}
            description="Escalate to a human agent when triggered.">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={escalationEnabled}
                onChange={(e) => setEscalationEnabled(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-text-primary">Enable human handoff <ActiveBadge /></span>
            </label>
            {escalationEnabled && (
              <>
                <ListField
                  label="Trigger phrases"
                  hint="When a customer says any of these, the agent will escalate."
                  items={escalationTriggers}
                  placeholder="e.g. speak to a human, talk to agent"
                  onChange={setEscalationTriggers}
                />
                <div>
                  <label className="text-xs font-medium text-text-secondary">Escalation message</label>
                  <textarea
                    value={escalationMessage}
                    onChange={(e) => setEscalationMessage(e.target.value)}
                    rows={2}
                    placeholder="I'm connecting you with a team member. Please hold on."
                    className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
                  />
                </div>
              </>
            )}
          </Section>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              {notice}
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
