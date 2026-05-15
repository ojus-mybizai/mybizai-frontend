'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAgentStore } from '@/lib/agent-store';
import { useKnowledgeFileStore } from '@/lib/knowledge-file-store';
import { useShallow } from 'zustand/react/shallow';
import {
  MessageSquare, Zap, Puzzle, BookOpen, Radio,
  ChevronRight, AlertCircle, CheckCircle2, Play,
  Activity, Calendar, Hash, Clock,
} from 'lucide-react';
import { runAgentManually } from '@/services/agents';
import { useState, useCallback } from 'react';

export default function AgentOverviewClient() {
  const router = useRouter();
  const { current } = useAgentStore(useShallow((s) => ({ current: s.current })));
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

  if (!current) return null;

  const chatOn = current.chatEnabled !== false;
  const autoOn = current.automationEnabled === true;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

      {/* ─── LEFT: Status + Config summary ─────────────── */}
      <div className="lg:col-span-2 space-y-4">

        {/* Setup alert */}
        {chatOn && !checklist.ready && (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 space-y-2 dark:border-amber-800/40 dark:bg-amber-900/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Setup required before going live</h3>
            </div>
            <ul className="space-y-1.5 text-xs">
              {checklist.missing.includes('no_channels') && (
                <li>
                  <Link href={`/agents/${current.id}/channels`}
                    className="flex items-center justify-between gap-2 rounded-md border border-amber-300/60 bg-white px-2 py-1.5 text-amber-900 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200">
                    <span className="flex items-center gap-1.5"><Radio className="w-3 h-3" /> No channels linked</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </li>
              )}
              {checklist.missing.includes('no_send_message') && (
                <li>
                  <Link href={`/agents/${current.id}/skills`}
                    className="flex items-center justify-between gap-2 rounded-md border border-amber-300/60 bg-white px-2 py-1.5 text-amber-900 hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200">
                    <span className="flex items-center gap-1.5"><Puzzle className="w-3 h-3" /> <code className="text-[10px]">send_message</code> skill not enabled</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}

        {chatOn && checklist.ready && current.status === 'active' && (
          <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 p-3 flex items-center gap-2 text-xs text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Ready to chat — channels and <code className="text-[10px]">send_message</code> are configured.</span>
          </div>
        )}

        {/* Phase-5 — instructions failed validation at build time. The AI still
            has SOME instructions, but the owner should review them. */}
        {current.instructionsQuality === 'needs_review' && (
          <div className="rounded-xl border border-orange-300/60 bg-orange-50 p-4 space-y-2 dark:border-orange-800/40 dark:bg-orange-900/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                Instructions need review
              </h3>
            </div>
            <p className="text-xs text-orange-800 dark:text-orange-300">
              The AI Agent Builder generated instructions for this agent, but
              they failed our quality check (missing sections, or one of the
              configured skills wasn't mentioned in the usage rules). Open
              the Instructions tab to review and edit.
            </p>
            <Link
              href={`/agents/${current.id}/instructions`}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-orange-100 hover:bg-orange-200 text-orange-900 text-xs font-medium dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-200"
            >
              Review instructions
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Mode cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Chat card */}
          <div className={`rounded-xl border p-4 space-y-3 ${chatOn ? 'border-blue-200 bg-blue-50/40 dark:border-blue-800/40 dark:bg-blue-900/10' : 'border-border-color bg-card-bg opacity-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-1.5 ${chatOn ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-bg-secondary'}`}>
                  <MessageSquare className={`w-4 h-4 ${chatOn ? 'text-blue-600 dark:text-blue-300' : 'text-text-secondary'}`} />
                </div>
                <span className="text-sm font-semibold text-text-primary">Chat</span>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${chatOn ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-bg-secondary text-text-secondary'}`}>
                {chatOn ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-text-secondary">Replies to customers on WhatsApp, Instagram, and other channels.</p>
            <Link href={`/agents/${current.id}/chat`}
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium">
              Configure chat settings <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Automation card */}
          <div className={`rounded-xl border p-4 space-y-3 ${autoOn ? 'border-amber-200 bg-amber-50/40 dark:border-amber-800/40 dark:bg-amber-900/10' : 'border-border-color bg-card-bg opacity-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-1.5 ${autoOn ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-bg-secondary'}`}>
                  <Zap className={`w-4 h-4 ${autoOn ? 'text-amber-600 dark:text-amber-300' : 'text-text-secondary'}`} />
                </div>
                <span className="text-sm font-semibold text-text-primary">Automation</span>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${autoOn ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-bg-secondary text-text-secondary'}`}>
                {autoOn ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-text-secondary">Runs on schedules or events — scoring leads, sending reports, and more.</p>
            <Link href={`/agents/${current.id}/automation`}
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium">
              Configure automation <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Config summary grid */}
        <div className="rounded-xl border border-border-color bg-card-bg divide-y divide-border-color">
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold text-text-primary">Configuration</h3>
          </div>
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
          {current.lastRunAt && (
            <ConfigRow
              icon={Clock}
              label="Last run"
              value={new Date(current.lastRunAt).toLocaleString()}
            />
          )}
          <ConfigRow
            icon={Activity}
            label="Total runs"
            value={String(current.totalRuns ?? 0)}
          />
        </div>

        {/* Instructions preview (read-only) */}
        {current.instructions && (
          <div className="rounded-xl border border-border-color bg-card-bg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                {chatOn ? 'Chat instructions' : 'Instructions'} preview
              </h3>
              <Link href={`/agents/${current.id}/${chatOn ? 'chat' : 'automation'}`}
                className="text-xs text-accent hover:underline">
                Edit
              </Link>
            </div>
            <p className="text-xs text-text-secondary bg-bg-secondary rounded-lg p-3 whitespace-pre-wrap line-clamp-6 font-mono">
              {current.instructions}
            </p>
          </div>
        )}

        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">{notice}</div>}
        {runError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{runError}</div>}
      </div>

      {/* ─── RIGHT: Quick actions ────────────────────────── */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border-color bg-card-bg p-4 space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Quick actions</h3>

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

        <div className="text-[10px] text-text-secondary px-1">
          Created {current.createdAt ? new Date(current.createdAt).toLocaleDateString() : '—'}
          {current.updatedAt && <> · Updated {new Date(current.updatedAt).toLocaleDateString()}</>}
        </div>
      </div>
    </div>
  );
}

function ConfigRow({ icon: Icon, label, value, href }: { icon: any; label: string; value: string; href?: string }) {
  const inner = (
    <div className="flex items-center justify-between px-4 py-2.5 text-xs">
      <span className="flex items-center gap-2 text-text-secondary">
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <span className="flex items-center gap-1 text-text-primary font-medium">
        {value}
        {href && <ChevronRight className="w-3 h-3 text-text-secondary" />}
      </span>
    </div>
  );
  if (href) return <Link href={href} className="block hover:bg-bg-secondary transition-colors">{inner}</Link>;
  return <div>{inner}</div>;
}

function QuickAction({ icon: Icon, label, onClick, disabled }: { icon: any; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2 rounded-lg border border-border-color px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary disabled:opacity-50 transition-colors"
    >
      <Icon className="w-4 h-4 text-text-secondary" /> {label}
    </button>
  );
}
