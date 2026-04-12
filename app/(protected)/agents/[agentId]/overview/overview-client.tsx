'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAgentStore } from '@/lib/agent-store';
import { useKnowledgeFileStore } from '@/lib/knowledge-file-store';
import { useShallow } from 'zustand/react/shallow';
import { runAgentManually } from '@/services/agents';
import type { ReplyLength } from '@/services/agents';
import {
  Save, Loader2, ChevronDown, ChevronUp, Play, MessageSquare, Zap,
  Settings, Shield, ArrowUpRight, MessagesSquare,
  ChevronRight, Puzzle, BookOpen, AlertCircle, CheckCircle2, Radio,
} from 'lucide-react';

// ─── Collapsible Section ─────────────────────────────────────

function Section({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: any;
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
          <span className="text-sm font-semibold text-text-primary">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-border-color pt-3">{children}</div>}
    </div>
  );
}

// ─── List Field Editor ───────────────────────────────────────

function ListField({
  label,
  items,
  placeholder,
  onChange,
}: {
  label: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary">{label}</label>
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
              x
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

// ─── Main Component ──────────────────────────────────────────

export default function AgentOverviewClient() {
  const router = useRouter();
  const { current, update, loading } = useAgentStore(useShallow((s) => ({
    current: s.current,
    update: s.update,
    loading: s.loading,
  })));

  const { knowledgeFiles, listKnowledgeFiles } = useKnowledgeFileStore(useShallow((s) => ({
    knowledgeFiles: s.files,
    listKnowledgeFiles: s.list,
  })));

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load knowledge files for this agent whenever the current agent changes
  useEffect(() => {
    if (current?.id) {
      void listKnowledgeFiles(current.id);
    }
  }, [current?.id, listKnowledgeFiles]);

  // ── Setup checklist state ──
  // Agent is "ready to chat" when: chat_enabled, at least one channel, and
  // the `send_message` skill is in its skill list.
  const checklist = useMemo(() => {
    if (!current) return { ready: true, missing: [] as string[] };
    const missing: string[] = [];
    if (current.chatEnabled) {
      if (!current.channelIds || current.channelIds.length === 0) {
        missing.push('no_channels');
      }
      if (!(current.skills || []).includes('send_message')) {
        missing.push('no_send_message');
      }
    }
    return { ready: missing.length === 0, missing };
  }, [current]);

  // Form state
  const [name, setName] = useState('');
  const [tone, setTone] = useState('friendly');
  const [instructions, setInstructions] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [personaName, setPersonaName] = useState('');
  const [replyLanguage, setReplyLanguage] = useState('auto');
  const [replyLength, setReplyLength] = useState<ReplyLength>('short');
  const [useBullets, setUseBullets] = useState(false);
  const [useEmojis, setUseEmojis] = useState(false);
  const [neverDo, setNeverDo] = useState<string[]>([]);
  const [alwaysDo, setAlwaysDo] = useState<string[]>([]);
  const [prohibited, setProhibited] = useState<string[]>([]);
  const [escalationEnabled, setEscalationEnabled] = useState(false);
  const [escalationTriggers, setEscalationTriggers] = useState<string[]>([]);
  const [escalationMessage, setEscalationMessage] = useState('');
  const [fallbackMessage, setFallbackMessage] = useState('');
  const [businessContextHint, setBusinessContextHint] = useState('');

  // Populate from current agent
  useEffect(() => {
    if (!current) return;
    setName(current.name);
    setTone(current.tone || 'friendly');
    setInstructions(current.instructions || '');
    setChatEnabled(current.chatEnabled !== false);
    setAutomationEnabled(current.automationEnabled === true);
    setPersonaName(current.personaName || '');
    setReplyLanguage(current.replyLanguage || 'auto');
    setReplyLength((current.replyFormat?.maxLength as ReplyLength) || 'short');
    setUseBullets(current.replyFormat?.useBullets ?? false);
    setUseEmojis(current.replyFormat?.useEmojis ?? false);
    setNeverDo(current.guardrailRules?.neverDo ?? []);
    setAlwaysDo(current.guardrailRules?.alwaysDo ?? []);
    setProhibited(current.guardrailRules?.prohibitedTopics ?? []);
    setEscalationEnabled(current.escalationPolicy?.enabled ?? false);
    setEscalationTriggers(current.escalationPolicy?.triggers ?? []);
    setEscalationMessage(current.escalationPolicy?.message ?? '');
    setFallbackMessage(current.fallbackMessage || '');
    setBusinessContextHint(current.businessContextHint || '');
  }, [current]);

  const handleSave = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await update(current.id, {
        name,
        tone,
        instructions,
        chatEnabled,
        automationEnabled,
        personaName,
        replyLanguage,
        replyFormat: { maxLength: replyLength, useBullets, useEmojis },
        guardrailRules: { neverDo: neverDo.filter(Boolean), alwaysDo: alwaysDo.filter(Boolean), prohibitedTopics: prohibited.filter(Boolean) },
        escalationPolicy: { enabled: escalationEnabled, triggers: escalationTriggers.filter(Boolean), message: escalationMessage },
        fallbackMessage,
        businessContextHint,
      });
      setNotice('Saved!');
      setTimeout(() => setNotice(null), 2000);
    } catch (e) {
      setError((e as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [current, name, tone, instructions, chatEnabled, automationEnabled, personaName, replyLanguage, replyLength, useBullets, useEmojis, neverDo, alwaysDo, prohibited, escalationEnabled, escalationTriggers, escalationMessage, fallbackMessage, businessContextHint, update]);

  if (!current) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* ─── LEFT PANEL: Config ─────────────────────────── */}
      <div className="lg:col-span-2 space-y-4">
        {/* Identity */}
        <Section title="Identity" icon={Settings} defaultOpen>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text-secondary">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary">Tone</label>
              <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="friendly" className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary" />
            </div>
          </div>
        </Section>

        {/* Chat Instructions */}
        <Section title="Chat instructions" defaultOpen>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={10}
            placeholder={`You are a sales assistant for [business].\nYour job is to help customers find the right product and capture their contact info.\n\nWhen a customer asks about pricing, use search_[your_datasheet] to look up current prices.\nWhen a customer wants to buy, use update_lead_field to save their details and qualify_lead to mark their interest.\n\nAlways reply via the send_message skill. Never quote prices without checking the data first.`}
            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary font-mono"
          />
          <p className="text-[11px] text-text-secondary">
            Used when the agent is replying to customers on chat channels. For scheduled or
            event-triggered runs, set separate{' '}
            <strong>Automation instructions</strong> in the Automation tab.
          </p>
        </Section>

        {/* Modes */}
        <Section title="Modes" icon={Zap} defaultOpen>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={chatEnabled} onChange={(e) => { setChatEnabled(e.target.checked); update(current.id, { chatEnabled: e.target.checked }).catch(() => {}); }} className="rounded border-border-color" />
              <div>
                <div className="text-sm font-medium text-text-primary flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> Chat mode</div>
                <div className="text-[10px] text-text-secondary">Responds to customer messages on channels</div>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={automationEnabled} onChange={(e) => { setAutomationEnabled(e.target.checked); update(current.id, { automationEnabled: e.target.checked }).catch(() => {}); }} className="rounded border-border-color" />
              <div>
                <div className="text-sm font-medium text-text-primary flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Automation mode</div>
                <div className="text-[10px] text-text-secondary">Runs on events, schedules, and triggers</div>
              </div>
            </label>
          </div>
        </Section>

        {/* Chat Settings (only if chat enabled) */}
        {chatEnabled && (
          <Section title="Chat Settings" icon={MessagesSquare}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary">Persona name</label>
                <input value={personaName} onChange={(e) => setPersonaName(e.target.value)} placeholder="Display name" className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Language</label>
                <select value={replyLanguage} onChange={(e) => setReplyLanguage(e.target.value)} className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary">
                  <option value="auto">Auto-detect</option>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="ar">Arabic</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary">Reply length</label>
                <div className="mt-1.5 flex gap-2">
                  {(['short', 'medium', 'long'] as ReplyLength[]).map((l) => (
                    <button key={l} type="button" onClick={() => setReplyLength(l)}
                      className={`px-3 py-1 rounded-lg text-xs border ${replyLength === l ? 'border-accent bg-accent/10 text-accent' : 'border-border-color text-text-secondary'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input type="checkbox" checked={useBullets} onChange={(e) => setUseBullets(e.target.checked)} className="rounded" /> Use bullets
              </label>
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input type="checkbox" checked={useEmojis} onChange={(e) => setUseEmojis(e.target.checked)} className="rounded" /> Use emojis
              </label>
            </div>
          </Section>
        )}

        {/* Guardrails */}
        <Section title="Guardrails" icon={Shield}>
          <ListField label="Never do" items={neverDo} placeholder="e.g. Never share competitor info" onChange={setNeverDo} />
          <ListField label="Always do" items={alwaysDo} placeholder="e.g. Always greet by name" onChange={setAlwaysDo} />
          <ListField label="Prohibited topics" items={prohibited} placeholder="e.g. Politics" onChange={setProhibited} />
        </Section>

        {/* Messages */}
        {chatEnabled && (
          <Section title="Messages">
            <div>
              <label className="text-xs font-medium text-text-secondary">Fallback message</label>
              <textarea value={fallbackMessage} onChange={(e) => setFallbackMessage(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary" placeholder="When the agent can't answer" />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary">Business context hint</label>
              <textarea value={businessContextHint} onChange={(e) => setBusinessContextHint(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary" placeholder="Extra context about your business" />
            </div>
          </Section>
        )}

        {/* Escalation */}
        <Section title="Escalation" icon={ArrowUpRight}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={escalationEnabled} onChange={(e) => setEscalationEnabled(e.target.checked)} className="rounded" />
            <span className="text-sm text-text-primary">Enable human handoff</span>
          </label>
          {escalationEnabled && (
            <>
              <ListField label="Trigger phrases" items={escalationTriggers} placeholder="e.g. speak to a human" onChange={setEscalationTriggers} />
              <div>
                <label className="text-xs font-medium text-text-secondary">Escalation message</label>
                <textarea value={escalationMessage} onChange={(e) => setEscalationMessage(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary" placeholder="Message shown when escalating" />
              </div>
            </>
          )}
        </Section>

        {/* Save */}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">{notice}</div>}
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

      {/* ─── RIGHT PANEL: Summary ────────────────────────── */}
      <div className="space-y-4">
        {/* Setup Checklist (only shown if something is missing) */}
        {chatEnabled && !checklist.ready && (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 space-y-2 dark:border-amber-800/40 dark:bg-amber-900/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Setup required</h3>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              This chat agent can't reply to customers yet:
            </p>
            <ul className="space-y-1.5 text-xs">
              {checklist.missing.includes('no_channels') && (
                <li>
                  <Link
                    href={`/agents/${current.id}/channels`}
                    className="flex items-center justify-between gap-2 rounded-md border border-amber-300/60 bg-white px-2 py-1.5 text-amber-900 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/30"
                  >
                    <span className="flex items-center gap-1.5"><Radio className="w-3 h-3" /> No channels linked</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </li>
              )}
              {checklist.missing.includes('no_send_message') && (
                <li>
                  <Link
                    href={`/agents/${current.id}/skills`}
                    className="flex items-center justify-between gap-2 rounded-md border border-amber-300/60 bg-white px-2 py-1.5 text-amber-900 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/30"
                  >
                    <span className="flex items-center gap-1.5"><Puzzle className="w-3 h-3" /> <code className="text-[10px]">send_message</code> skill not enabled</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}

        {chatEnabled && checklist.ready && current.status === 'active' && (
          <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 p-3 flex items-center gap-2 text-xs text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Ready to chat — channels and <code className="text-[10px]">send_message</code> are set.</span>
          </div>
        )}

        {/* Summary Card */}
        <div className="rounded-xl border border-border-color bg-card-bg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Agent Summary</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-secondary">Status</span>
              <span className="text-text-primary font-medium capitalize">{current.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Mode</span>
              <div className="flex gap-1">
                {chatEnabled && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Chat</span>}
                {automationEnabled && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Auto</span>}
              </div>
            </div>
            <Link
              href={`/agents/${current.id}/channels`}
              className="group flex items-center justify-between rounded-md -mx-1 px-1 py-0.5 hover:bg-bg-secondary"
            >
              <span className="text-text-secondary">Channels</span>
              <span className="inline-flex items-center gap-1 text-text-primary">
                {current.channelIds?.length ?? 0}
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </Link>
            <Link
              href={`/agents/${current.id}/skills`}
              className="group flex items-center justify-between rounded-md -mx-1 px-1 py-0.5 hover:bg-bg-secondary"
            >
              <span className="text-text-secondary">Skills</span>
              <span className="inline-flex items-center gap-1 text-text-primary">
                {current.skills?.length ?? 0}
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </Link>
            <Link
              href={`/agents/${current.id}/knowledge`}
              className="group flex items-center justify-between rounded-md -mx-1 px-1 py-0.5 hover:bg-bg-secondary"
            >
              <span className="text-text-secondary">Knowledge files</span>
              <span className="inline-flex items-center gap-1 text-text-primary">
                {knowledgeFiles.length}
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </Link>
            <div className="flex justify-between">
              <span className="text-text-secondary">Total runs</span>
              <span className="text-text-primary">{current.totalRuns ?? 0}</span>
            </div>
            {current.lastRunAt && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Last run</span>
                <span className="text-text-primary">{new Date(current.lastRunAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-border-color bg-card-bg p-4 space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Quick Actions</h3>
          {chatEnabled && (
            <button
              type="button"
              onClick={() => router.push(`/agents/${current.id}/test`)}
              className="w-full flex items-center gap-2 rounded-lg border border-border-color px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary"
            >
              <MessageSquare className="w-4 h-4" /> Test Chat
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push(`/agents/${current.id}/skills`)}
            className="w-full flex items-center gap-2 rounded-lg border border-border-color px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary"
          >
            <Puzzle className="w-4 h-4" /> Manage Skills
          </button>
          <button
            type="button"
            onClick={() => router.push(`/agents/${current.id}/knowledge`)}
            className="w-full flex items-center gap-2 rounded-lg border border-border-color px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary"
          >
            <BookOpen className="w-4 h-4" /> Manage Knowledge
          </button>
          {automationEnabled && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await runAgentManually(current.id);
                  setNotice('Agent run triggered!');
                  setTimeout(() => setNotice(null), 2000);
                } catch { setError('Failed to trigger run'); }
              }}
              className="w-full flex items-center gap-2 rounded-lg border border-border-color px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary"
            >
              <Play className="w-4 h-4" /> Manual Run
            </button>
          )}
        </div>

        {/* Created info */}
        <div className="text-[10px] text-text-secondary px-1">
          Created {current.createdAt ? new Date(current.createdAt).toLocaleDateString() : '—'}
          {current.updatedAt && <> - Updated {new Date(current.updatedAt).toLocaleDateString()}</>}
        </div>
      </div>
    </div>
  );
}
