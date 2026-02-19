'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DeployButton } from '@/components/agents/deploy-button';
import { useAgentStore } from '@/lib/agent-store';
import type { AgentEscalationPolicy, AgentGuardrailRules, AgentReplyFormat, ReplyLength, ReplyMode } from '@/services/agents';
import {
  getAgentFollowupSettings,
  listAgentFollowupRules,
  type FollowUpMode,
  type FollowUpRule,
} from '@/services/followups';

const MODELS = ['gpt-4o-mini', 'gpt-4o', 'claude-3.5-sonnet'];

const REPLY_MODE_OPTIONS: { value: ReplyMode; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto (template then AI)', description: 'Try message template first; if none match, use AI reply.' },
  { value: 'template_only', label: 'Template only', description: 'Use only message templates. If no match, send a short fallback.' },
  { value: 'ai_only', label: 'AI only', description: 'Always use the AI to generate replies (no templates).' },
];

const REPLY_LENGTH_OPTIONS: ReplyLength[] = ['short', 'medium', 'long'];
const REPLY_LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto-detect user language' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'ar', label: 'Arabic' },
];

function ListFieldEditor({
  label,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-text-primary">{label}</div>
      <div className="space-y-2">
        {value.map((item, idx) => (
          <div key={`${label}-${idx}`} className="flex gap-2">
            <input
              value={item}
              disabled={disabled}
              onChange={(e) => {
                const next = [...value];
                next[idx] = e.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              className="rounded-md border border-border-color px-3 py-2 text-xs text-text-secondary hover:border-red-400 hover:text-red-500 disabled:opacity-60"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...value, ''])}
        className="rounded-md border border-border-color px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-accent hover:text-text-primary disabled:opacity-60"
      >
        Add rule
      </button>
    </div>
  );
}

export default function AgentOverviewPage() {
  const router = useRouter();
  const { current, loading, update, setStatus, remove } = useAgentStore((s) => ({
    current: s.current,
    loading: s.loading,
    update: s.update,
    setStatus: s.setStatus,
    remove: s.remove,
  }));

  const [name, setName] = useState('');
  const [tone, setTone] = useState('');
  const [instructions, setInstructions] = useState('');
  const [model, setModel] = useState(MODELS[0]);
  const [replyMode, setReplyMode] = useState<ReplyMode>('auto');
  const [personaName, setPersonaName] = useState('');
  const [replyLanguage, setReplyLanguage] = useState('auto');
  const [replyFormat, setReplyFormat] = useState<AgentReplyFormat>({ maxLength: 'short', useBullets: false, useEmojis: false });
  const [guardrailRules, setGuardrailRules] = useState<AgentGuardrailRules>({
    neverDo: [],
    alwaysDo: [],
    prohibitedTopics: [],
    offTopicMessage: '',
  });
  const [escalationPolicy, setEscalationPolicy] = useState<AgentEscalationPolicy>({
    enabled: false,
    triggers: [],
    message: '',
  });
  const [openingMessage, setOpeningMessage] = useState('');
  const [fallbackMessage, setFallbackMessage] = useState('');
  const [businessContextHint, setBusinessContextHint] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followupSettings, setFollowupSettings] = useState<{ enabled: boolean; default_mode: FollowUpMode }>({
    enabled: true,
    default_mode: 'auto',
  });
  const [followupRules, setFollowupRules] = useState<FollowUpRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);

  useEffect(() => {
    if (!current) return;
    setName(current.name);
    setTone(current.tone);
    setInstructions(current.instructions);
    setModel(current.model);
    setReplyMode(current.replyMode ?? 'auto');
    setPersonaName(current.personaName ?? '');
    setReplyLanguage(current.replyLanguage ?? 'auto');
    setReplyFormat({
      maxLength: current.replyFormat?.maxLength ?? 'short',
      useBullets: Boolean(current.replyFormat?.useBullets),
      useEmojis: Boolean(current.replyFormat?.useEmojis),
    });
    setGuardrailRules({
      neverDo: current.guardrailRules?.neverDo ?? [],
      alwaysDo: current.guardrailRules?.alwaysDo ?? [],
      prohibitedTopics: current.guardrailRules?.prohibitedTopics ?? [],
      offTopicMessage: current.guardrailRules?.offTopicMessage ?? '',
    });
    setEscalationPolicy({
      enabled: Boolean(current.escalationPolicy?.enabled),
      triggers: current.escalationPolicy?.triggers ?? [],
      message: current.escalationPolicy?.message ?? '',
    });
    setOpeningMessage(current.openingMessage ?? '');
    setFallbackMessage(current.fallbackMessage ?? '');
    setBusinessContextHint(current.businessContextHint ?? '');
  }, [current]);

  useEffect(() => {
    const agentId = current?.id;
    if (!agentId) return;
    let cancelled = false;
    setRulesLoading(true);
    setRulesError(null);
    Promise.all([
      getAgentFollowupSettings(agentId).catch(() => ({ enabled: true, default_mode: 'auto' as FollowUpMode })),
      listAgentFollowupRules(agentId).catch(() => [] as FollowUpRule[]),
    ])
      .then(([settings, rules]) => {
        if (cancelled) return;
        setFollowupSettings({
          enabled: settings.enabled ?? true,
          default_mode: (settings.default_mode as FollowUpMode) ?? 'auto',
        });
        setFollowupRules(rules);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'Failed to load follow-up configuration';
        setRulesError(message);
      })
      .finally(() => {
        if (!cancelled) setRulesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [current?.id]);

  const disabled = useMemo(() => current?.status === 'active', [current?.status]);

  if (!current && !loading) {
    router.replace('/agents');
    return null;
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!current) return;
    setMessage(null);
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!tone.trim()) {
      setError('Tone is required');
      return;
    }
    try {
      await update(current.id, {
        name: name.trim(),
        tone: tone.trim(),
        instructions,
        model,
        reply_mode: replyMode,
        personaName: personaName.trim() || undefined,
        replyLanguage,
        replyFormat: {
          maxLength: replyFormat.maxLength ?? 'short',
          useBullets: Boolean(replyFormat.useBullets),
          useEmojis: Boolean(replyFormat.useEmojis),
        },
        guardrailRules: {
          neverDo: (guardrailRules.neverDo ?? []).map((x) => x.trim()).filter(Boolean),
          alwaysDo: (guardrailRules.alwaysDo ?? []).map((x) => x.trim()).filter(Boolean),
          prohibitedTopics: (guardrailRules.prohibitedTopics ?? []).map((x) => x.trim()).filter(Boolean),
          offTopicMessage: guardrailRules.offTopicMessage?.trim() || '',
        },
        escalationPolicy: {
          enabled: Boolean(escalationPolicy.enabled),
          triggers: (escalationPolicy.triggers ?? []).map((x) => x.trim()).filter(Boolean),
          message: escalationPolicy.message?.trim() || '',
        },
        openingMessage: openingMessage.trim() || undefined,
        fallbackMessage: fallbackMessage.trim() || undefined,
        businessContextHint: businessContextHint.trim() || undefined,
      });
      setMessage('Saved');
    } catch (err) {
      setError((err as Error).message || 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!current) return;
    if (disabled) return;
    const ok = confirm(`Delete agent "${current.name}"?\n\nThis cannot be undone.`);
    if (!ok) return;
    try {
      await remove(current.id);
      router.replace('/agents');
    } catch (err) {
      setError((err as Error).message || 'Failed to delete agent');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Configuration</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Update how this agent behaves. For channels, tools, and knowledge sources, use the tabs above.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-color bg-card-bg px-4 py-3">
        <div className="text-sm text-text-secondary">
          Deploy/pause will affect real traffic. Editing is disabled while Active.
        </div>
        {current && (
          <DeployButton
            status={current.status}
            onChange={async (next) => {
              await setStatus(current.id, next);
            }}
          />
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-border-color bg-card-bg p-5">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            {message}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Agent name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={disabled}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Tone</label>
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              disabled={disabled}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-text-primary">Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={disabled}
            rows={5}
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
          />
          <p className="text-xs text-text-secondary">Describe how this agent should behave and respond.</p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-text-primary">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={disabled}
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-text-primary">Reply source</label>
          <select
            value={replyMode}
            onChange={(e) => setReplyMode(e.target.value as ReplyMode)}
            disabled={disabled}
            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
          >
            {REPLY_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-secondary">
            {REPLY_MODE_OPTIONS.find((o) => o.value === replyMode)?.description}
          </p>
        </div>

        <div className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-xs text-text-secondary">
          Tool behavior is now configured from the <strong>Tools</strong> tab (realtime/background with rules).
        </div>

        <details className="rounded-xl border border-border-color bg-bg-primary p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-text-primary">Reply Format &amp; Language</summary>
          <div className="mt-3 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Persona name</label>
              <input
                value={personaName}
                onChange={(e) => setPersonaName(e.target.value)}
                disabled={disabled}
                placeholder="e.g. Riya from MyBiz"
                className="w-full rounded-md border border-border-color bg-card-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Reply language</label>
              <select
                value={replyLanguage}
                onChange={(e) => setReplyLanguage(e.target.value)}
                disabled={disabled}
                className="w-full rounded-md border border-border-color bg-card-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
              >
                {REPLY_LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-text-primary">Reply length</div>
              <div className="flex flex-wrap gap-2">
                {REPLY_LENGTH_OPTIONS.map((len) => (
                  <button
                    key={len}
                    type="button"
                    disabled={disabled}
                    onClick={() => setReplyFormat((prev) => ({ ...prev, maxLength: len }))}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      (replyFormat.maxLength ?? 'short') === len
                        ? 'bg-accent text-white'
                        : 'border border-border-color bg-card-bg text-text-secondary hover:border-accent hover:text-text-primary'
                    }`}
                  >
                    {len.charAt(0).toUpperCase() + len.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={Boolean(replyFormat.useBullets)}
                  onChange={(e) => setReplyFormat((prev) => ({ ...prev, useBullets: e.target.checked }))}
                  disabled={disabled}
                />
                Use bullets in replies
              </label>
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={Boolean(replyFormat.useEmojis)}
                  onChange={(e) => setReplyFormat((prev) => ({ ...prev, useEmojis: e.target.checked }))}
                  disabled={disabled}
                />
                Allow emojis
              </label>
            </div>
          </div>
        </details>

        <details className="rounded-xl border border-border-color bg-bg-primary p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-text-primary">Guardrails</summary>
          <div className="mt-3 space-y-4">
            <ListFieldEditor
              label="Never do"
              value={guardrailRules.neverDo ?? []}
              placeholder="e.g. Never promise delivery date without checking tools"
              disabled={disabled}
              onChange={(next) => setGuardrailRules((prev) => ({ ...prev, neverDo: next }))}
            />
            <ListFieldEditor
              label="Always do"
              value={guardrailRules.alwaysDo ?? []}
              placeholder="e.g. Confirm customer requirement before recommending"
              disabled={disabled}
              onChange={(next) => setGuardrailRules((prev) => ({ ...prev, alwaysDo: next }))}
            />
            <ListFieldEditor
              label="Prohibited topics"
              value={guardrailRules.prohibitedTopics ?? []}
              placeholder="e.g. Politics, competitor comparison"
              disabled={disabled}
              onChange={(next) => setGuardrailRules((prev) => ({ ...prev, prohibitedTopics: next }))}
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Off-topic reply message</label>
              <textarea
                value={guardrailRules.offTopicMessage ?? ''}
                onChange={(e) => setGuardrailRules((prev) => ({ ...prev, offTopicMessage: e.target.value }))}
                disabled={disabled}
                rows={3}
                placeholder="I can help with this business only. Please share your product/service requirement."
                className="w-full rounded-md border border-border-color bg-card-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
              />
            </div>
          </div>
        </details>

        <details className="rounded-xl border border-border-color bg-bg-primary p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-text-primary">Escalation &amp; Messages</summary>
          <div className="mt-3 space-y-4">
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={Boolean(escalationPolicy.enabled)}
                onChange={(e) => setEscalationPolicy((prev) => ({ ...prev, enabled: e.target.checked }))}
                disabled={disabled}
              />
              Enable escalation to human handoff
            </label>
            <ListFieldEditor
              label="Escalation triggers"
              value={escalationPolicy.triggers ?? []}
              placeholder="e.g. angry, refund, complaint"
              disabled={disabled}
              onChange={(next) => setEscalationPolicy((prev) => ({ ...prev, triggers: next }))}
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Escalation message</label>
              <textarea
                value={escalationPolicy.message ?? ''}
                onChange={(e) => setEscalationPolicy((prev) => ({ ...prev, message: e.target.value }))}
                disabled={disabled}
                rows={3}
                placeholder="I am connecting you with a human team member for better assistance."
                className="w-full rounded-md border border-border-color bg-card-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Opening message</label>
              <textarea
                value={openingMessage}
                onChange={(e) => setOpeningMessage(e.target.value)}
                disabled={disabled}
                rows={2}
                placeholder="Hi! I am Riya from MyBiz. How can I help you today?"
                className="w-full rounded-md border border-border-color bg-card-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Fallback message</label>
              <textarea
                value={fallbackMessage}
                onChange={(e) => setFallbackMessage(e.target.value)}
                disabled={disabled}
                rows={2}
                placeholder="I do not have verified data for that yet. I can check it for you now."
                className="w-full rounded-md border border-border-color bg-card-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Business context hint</label>
              <textarea
                value={businessContextHint}
                onChange={(e) => setBusinessContextHint(e.target.value)}
                disabled={disabled}
                rows={3}
                placeholder="e.g. We offer free installation, 1-year warranty, EMI available"
                className="w-full rounded-md border border-border-color bg-card-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
              />
            </div>
          </div>
        </details>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || disabled}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {disabled ? 'Active - lock' : loading ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/agents')}
            className="rounded-md border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
          >
            Back to list
          </button>
        </div>
      </form>

      {/* Follow-up automation (summary view) */}
      {current && (
        <div className="space-y-3 rounded-2xl border border-border-color bg-card-bg p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-text-primary">Follow-up automation</h3>
              <p className="text-sm text-text-secondary">
                Configure how this agent should schedule follow-up messages after conversations end.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-secondary">Enabled</span>
              <button
                type="button"
                disabled={rulesLoading}
                onClick={async () => {
                  if (!current) return;
                  try {
                    const nextEnabled = !followupSettings.enabled;
                    setFollowupSettings((s) => ({ ...s, enabled: nextEnabled }));
                    await import('@/services/followups').then(({ updateAgentFollowupSettings }) =>
                      updateAgentFollowupSettings(current.id, { enabled: nextEnabled }),
                    );
                  } catch (e: unknown) {
                    const message = e instanceof Error ? e.message : 'Failed to update follow-up settings';
                    setRulesError(message);
                  }
                }}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  followupSettings.enabled
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300'
                }`}
              >
                {followupSettings.enabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-text-primary">Default sending mode</div>
              <p className="text-xs text-text-secondary">
                Controls whether follow-ups are sent automatically or placed into a manual review queue by default.
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {(['auto', 'manual', 'both'] as FollowUpMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={rulesLoading}
                    onClick={async () => {
                      if (!current) return;
                      try {
                        setFollowupSettings((s) => ({ ...s, default_mode: mode }));
                        await import('@/services/followups').then(({ updateAgentFollowupSettings }) =>
                          updateAgentFollowupSettings(current.id, { default_mode: mode }),
                        );
                      } catch (e: unknown) {
                        const message = e instanceof Error ? e.message : 'Failed to update follow-up settings';
                        setRulesError(message);
                      }
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      followupSettings.default_mode === mode
                        ? 'bg-accent text-white'
                        : 'border border-border-color bg-bg-primary text-text-secondary hover:border-accent hover:text-text-primary'
                    }`}
                  >
                    {mode === 'auto' ? 'Automatic' : mode === 'manual' ? 'Manual review' : 'Both'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-text-primary">Rules snapshot</div>
              {rulesLoading ? (
                <p className="text-sm text-text-secondary">Loading rules…</p>
              ) : followupRules.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  No follow-up rules yet.{' '}
                  {current && (
                    <Link
                      href={`/agents/${current.id}/follow-ups`}
                      className="font-semibold text-accent hover:underline"
                    >
                      Add rules in the Follow-ups tab
                    </Link>
                  )}
                </p>
              ) : (
                <ul className="space-y-1 text-xs text-text-secondary">
                  {followupRules.slice(0, 3).map((rule) => (
                    <li key={rule.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-text-primary">{rule.name}</span>
                      <span className="text-[11px] text-text-secondary">
                        +{rule.delay_minutes} min · {rule.mode === 'auto' ? 'Auto' : rule.mode === 'manual' ? 'Manual' : 'Both'}
                      </span>
                    </li>
                  ))}
                  {followupRules.length > 3 && (
                    <li className="text-[11px] text-text-secondary">
                      +{followupRules.length - 3} more rule{followupRules.length - 3 === 1 ? '' : 's'}
                    </li>
                  )}
                </ul>
              )}
              {rulesError && (
                <p className="text-xs text-red-500">
                  {rulesError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border-color bg-card-bg p-5">
        <div className="text-sm font-semibold text-text-primary">Next steps</div>
        <p className="mt-1 text-sm text-text-secondary">
          Finish setup by connecting this agent to your business systems.
        </p>
        {current && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link
              href={`/agents/${current.id}/channels`}
              className="rounded-full border border-border-color bg-bg-primary px-3 py-1.5 font-semibold text-text-secondary hover:border-accent hover:text-text-primary"
            >
              Configure channels
            </Link>
            <Link
              href={`/agents/${current.id}/tools`}
              className="rounded-full border border-border-color bg-bg-primary px-3 py-1.5 font-semibold text-text-secondary hover:border-accent hover:text-text-primary"
            >
              Assign tools
            </Link>
            <Link
              href={`/agents/${current.id}/follow-ups`}
              className="rounded-full border border-border-color bg-bg-primary px-3 py-1.5 font-semibold text-text-secondary hover:border-accent hover:text-text-primary"
            >
              Follow-ups
            </Link>
            <Link
              href={`/agents/${current.id}/knowledge-base`}
              className="rounded-full border border-border-color bg-bg-primary px-3 py-1.5 font-semibold text-text-secondary hover:border-accent hover:text-text-primary"
            >
              Link knowledge base
            </Link>
            <Link
              href={`/agents/${current.id}/test`}
              className="rounded-full border border-border-color bg-bg-primary px-3 py-1.5 font-semibold text-text-secondary hover:border-accent hover:text-text-primary"
            >
              Test agent
            </Link>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">
          Extraction & Lead Templates
        </h4>
        <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
          Structured data from conversations (e.g. name, email, requirements) is stored using lead
          templates. Define templates to guide what the agent captures and where it goes.
        </p>
        <Link
          href="/lead-templates"
          className="inline-flex rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-200 dark:hover:bg-amber-900/30"
        >
          Manage templates
        </Link>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5 dark:border-red-800 dark:bg-red-950/20">
        <div className="text-sm font-semibold text-red-900 dark:text-red-200">Danger zone</div>
        <p className="mt-1 text-sm text-red-800 dark:text-red-300">
          Delete this agent permanently. This action cannot be undone.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={disabled}
            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:bg-slate-900 dark:text-red-200 dark:hover:bg-red-950/30"
          >
            Delete agent
          </button>
          {disabled && (
            <div className="text-xs text-red-700/80 dark:text-red-300/80">
              Pause the agent to delete it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
