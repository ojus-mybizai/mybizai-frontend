'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAgentStore } from '@/lib/agent-store';
import { useKnowledgeFileStore } from '@/lib/knowledge-file-store';
import { useShallow } from 'zustand/react/shallow';
import {
  MessageSquare, MessagesSquare, Zap, Puzzle, BookOpen, Radio,
  ChevronRight, AlertCircle, CheckCircle2, Play,
  Activity, Calendar, Hash, Clock,
} from 'lucide-react';
import { runAgentManually } from '@/services/agents';
import { useState, useCallback } from 'react';

export default function AgentOverviewClient() {
  const router = useRouter();
  const { current, update } = useAgentStore(useShallow((s) => ({ current: s.current, update: s.update })));
  const [internalChatSaving, setInternalChatSaving] = useState(false);
  const { knowledgeFiles } = useKnowledgeFileStore(useShallow((s) => ({ knowledgeFiles: s.files })));

  const [runningManual, setRunningManual] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const checklist = useMemo(() => {
    if (!current) return { ready: true, missing: [] as string[] };
    const missing: string[] = [];
    if (current.chatEnabled) {
      if (!current.channelIds || current.channelIds.length === 0) missing.push('no_channels');
      if (!(current.skills || []).includes('send_message')) missing.push('no_send_message');
    }
    return { ready: missing.length === 0, missing };
  }, [current]);

  const handleManualRun = useCallback(async () => {
    if (!current) return;
    setRunningManual(true);
    setRunError(null);
    try {
      await runAgentManually(String(current.id));
      setNotice('Run triggered!');
      setTimeout(() => setNotice(null), 3000);
    } catch {
      setRunError('Failed to trigger run');
    } finally {
      setRunningManual(false);
    }
  }, [current]);

  const toggleInternalChat = useCallback(async () => {
    if (!current) return;
    setInternalChatSaving(true);
    try {
      await update(String(current.id), { internalChatEnabled: !current.internalChatEnabled });
    } catch {
      /* surfaced via store error */
    } finally {
      setInternalChatSaving(false);
    }
  }, [current, update]);

  if (!current) return null;

  const chatOn = current.chatEnabled !== false;
  const autoOn = current.automationEnabled === true;

  return (
    <div className="space-y-5">

    {/* ─── Metrics strip — scannable, perfectly gridded ─── */}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard icon={Activity} label="Total runs" value={String(current.totalRuns ?? 0)} />
      <StatCard icon={Radio} label="Channels" value={String(current.channelIds?.length ?? 0)} />
      <StatCard icon={Puzzle} label="Skills" value={String(current.skills?.length ?? 0)} />
      <StatCard icon={Clock} label="Last run" value={current.lastRunAt ? relativeTime(current.lastRunAt) : 'Never'} />
    </div>

    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

      {/* ─── LEFT: Status + Config summary ─────────────── */}
      <div className="space-y-5 lg:col-span-2">

        {/* Setup alert */}
        {chatOn && !checklist.ready && (
          <div className="space-y-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-900/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Setup required before going live</h3>
            </div>
            <ul className="space-y-2 text-sm">
              {checklist.missing.includes('no_channels') && (
                <li>
                  <Link href={`/agents/${current.id}/channels`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-300/60 bg-white px-3 py-2 text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200">
                    <span className="flex items-center gap-2"><Radio className="h-4 w-4" /> No channels linked</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </li>
              )}
              {checklist.missing.includes('no_send_message') && (
                <li>
                  <Link href={`/agents/${current.id}/skills`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-300/60 bg-white px-3 py-2 text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200">
                    <span className="flex items-center gap-2"><Puzzle className="h-4 w-4" /> <code className="text-xs">send_message</code> skill not enabled</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}

        {chatOn && checklist.ready && current.status === 'active' && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/60 bg-emerald-50 p-3.5 text-sm text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Ready to chat — channels and <code className="text-xs">send_message</code> are configured.</span>
          </div>
        )}

        {/* Phase-5 — instructions failed validation at build time. The AI still
            has SOME instructions, but the owner should review them. */}
        {current.instructionsQuality === 'needs_review' && (
          <div className="space-y-2 rounded-2xl border border-orange-300/60 bg-orange-50 p-4 dark:border-orange-800/40 dark:bg-orange-900/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                Instructions need review
              </h3>
            </div>
            <p className="text-sm text-orange-800 dark:text-orange-300">
              The AI Agent Builder generated instructions for this agent, but
              they failed our quality check (missing sections, or one of the
              configured skills wasn't mentioned in the usage rules). Open the
              {chatOn ? ' Chat' : ' Automation'} tab to review and edit.
            </p>
            <Link
              href={`/agents/${current.id}/${chatOn ? 'chat' : 'automation'}`}
              className="inline-flex items-center gap-1 rounded-lg bg-orange-100 px-3 py-1.5 text-sm font-medium text-orange-900 transition-colors hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:hover:bg-orange-900/50"
            >
              Review instructions
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Mode cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeCard
            icon={MessageSquare}
            title="Chat"
            description="Replies to customers on WhatsApp, Instagram, and other channels."
            enabled={chatOn}
            tone="blue"
            href={`/agents/${current.id}/chat`}
            ctaLabel={chatOn ? 'Configure chat settings' : 'Set up chat'}
          />
          <ModeCard
            icon={Zap}
            title="Automation"
            description="Runs on schedules or events — scoring leads, sending reports, and more."
            enabled={autoOn}
            tone="amber"
            href={`/agents/${current.id}/automation`}
            ctaLabel={autoOn ? 'Configure automation' : 'Set up automation'}
          />
        </div>

        {/* Internal chat toggle (P3b) */}
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-border-color bg-card-bg p-4">
          <div className="flex items-start gap-2.5">
            <div className="rounded-lg bg-bg-secondary p-1.5 text-text-secondary">
              <MessagesSquare className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">Internal chat</span>
              </div>
              <p className="mt-0.5 text-sm text-text-secondary">
                Let your staff chat with this agent on the internal <code className="text-xs">Internal Chat</code> panel,
                with rich replies (charts, tables, forms).
              </p>
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                Note: backend persistence for this flag is not yet available — the toggle will reset on reload until the
                agent API exposes <code className="text-[10px]">internal_chat_enabled</code>.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={current.internalChatEnabled}
            disabled={internalChatSaving}
            onClick={() => void toggleInternalChat()}
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
              current.internalChatEnabled ? 'bg-accent' : 'bg-border-color'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                current.internalChatEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Config summary grid */}
        <div className="overflow-hidden rounded-2xl border border-border-color bg-card-bg">
          <div className="border-b border-border-color px-4 py-3">
            <h3 className="text-sm font-semibold text-text-primary">Configuration</h3>
          </div>
          <div className="divide-y divide-border-color">
            <ConfigRow
              icon={Puzzle}
              label="Skills"
              value={`${current.skills?.length ?? 0} enabled`}
              href={`/agents/${current.id}/skills`}
            />
            <ConfigRow
              icon={BookOpen}
              label="Knowledge files"
              value={`${knowledgeFiles.length} uploaded`}
              href={`/agents/${current.id}/knowledge`}
            />
            <ConfigRow
              icon={Radio}
              label="Channels"
              value={`${current.channelIds?.length ?? 0} linked`}
              href={`/agents/${current.id}/channels`}
            />
            {autoOn && current.scheduleCron && (
              <ConfigRow
                icon={Calendar}
                label="Schedule"
                value={current.scheduleCron}
              />
            )}
            {autoOn && (
              <ConfigRow
                icon={Hash}
                label="Max actions/run"
                value={String(current.maxActionsPerRun ?? 10)}
              />
            )}
          </div>
        </div>

        {/* Instructions preview (read-only) */}
        {current.instructions && (
          <div className="space-y-3 rounded-2xl border border-border-color bg-card-bg p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                {chatOn ? 'Chat instructions' : 'Instructions'} preview
              </h3>
              <Link href={`/agents/${current.id}/${chatOn ? 'chat' : 'automation'}`}
                className="text-sm font-medium text-accent hover:underline">
                Edit
              </Link>
            </div>
            <p className="line-clamp-6 whitespace-pre-wrap rounded-lg bg-bg-secondary p-3 font-mono text-xs leading-relaxed text-text-secondary">
              {current.instructions}
            </p>
          </div>
        )}

        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">{notice}</div>}
        {runError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{runError}</div>}
      </div>

      {/* ─── RIGHT: Quick actions ────────────────────────── */}
      <div className="space-y-4">
        <div className="space-y-2 rounded-2xl border border-border-color bg-card-bg p-4">
          <h3 className="mb-1 text-sm font-semibold text-text-primary">Quick actions</h3>

          {chatOn && (
            <QuickAction icon={MessageSquare} label="Configure chat" onClick={() => router.push(`/agents/${current.id}/chat`)} />
          )}
          {chatOn && (
            <QuickAction icon={MessageSquare} label="Test chat" onClick={() => router.push(`/agents/${current.id}/test`)} />
          )}
          {autoOn && (
            <QuickAction
              icon={Play}
              label={runningManual ? 'Running…' : 'Manual run'}
              onClick={handleManualRun}
              disabled={runningManual}
            />
          )}
          {autoOn && (
            <QuickAction icon={Zap} label="Automation settings" onClick={() => router.push(`/agents/${current.id}/automation`)} />
          )}
          <QuickAction icon={Puzzle} label="Manage skills" onClick={() => router.push(`/agents/${current.id}/skills`)} />
          <QuickAction icon={BookOpen} label="Manage knowledge" onClick={() => router.push(`/agents/${current.id}/knowledge`)} />
        </div>

        <div className="px-1 text-xs text-text-secondary">
          Created {current.createdAt ? new Date(current.createdAt).toLocaleDateString() : '—'}
          {current.updatedAt && <> · Updated {new Date(current.updatedAt).toLocaleDateString()}</>}
        </div>
      </div>
    </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1.5 truncate text-2xl font-semibold text-text-primary" title={value}>{value}</div>
    </div>
  );
}

const TONES = {
  blue: {
    on: 'border-blue-200 bg-blue-50/50 dark:border-blue-800/40 dark:bg-blue-900/10',
    iconOn: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
    badgeOn: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  amber: {
    on: 'border-amber-200 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-900/10',
    iconOn: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
    badgeOn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
} as const;

function ModeCard({
  icon: Icon, title, description, enabled, tone, href, ctaLabel,
}: {
  icon: any; title: string; description: string; enabled: boolean;
  tone: keyof typeof TONES; href: string; ctaLabel: string;
}) {
  const t = TONES[tone];
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border p-4 ${enabled ? t.on : 'border-border-color bg-card-bg'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded-lg p-1.5 ${enabled ? t.iconOn : 'bg-bg-secondary text-text-secondary'}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-text-primary">{title}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${enabled ? t.badgeOn : 'bg-bg-secondary text-text-secondary'}`}>
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      <p className="flex-1 text-sm leading-relaxed text-text-secondary">{description}</p>
      <Link href={href}
        className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
        {ctaLabel} <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function ConfigRow({ icon: Icon, label, value, href }: { icon: any; label: string; value: string; href?: string }) {
  const inner = (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="flex items-center gap-2.5 text-text-secondary">
        <Icon className="h-4 w-4 shrink-0" /> {label}
      </span>
      <span className="flex items-center gap-1.5 truncate font-medium text-text-primary">
        <span className="truncate">{value}</span>
        {href && <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" />}
      </span>
    </div>
  );
  if (href) return <Link href={href} className="block transition-colors hover:bg-bg-secondary">{inner}</Link>;
  return <div>{inner}</div>;
}

function QuickAction({ icon: Icon, label, onClick, disabled }: { icon: any; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 rounded-lg border border-border-color px-3 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-accent/40 hover:bg-bg-secondary disabled:opacity-50"
    >
      <Icon className="h-4 w-4 shrink-0 text-text-secondary" /> {label}
    </button>
  );
}
