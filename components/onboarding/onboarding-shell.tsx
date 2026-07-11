'use client';

import {
  FormEvent, KeyboardEvent, useCallback, useEffect,
  useMemo, useRef, useState,
} from 'react';
import {
  CheckCircle2, CircleDashed, Loader2, Send, SkipForward,
  Users, Table, Workflow, Bot, Sparkles, ArrowRightCircle, ArrowRight,
  PartyPopper, Scissors, Upload, MessageCircle, ChevronDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Callback } from '@/lib/agent-blocks';
import type { OnboardingStatus } from '@/services/onboarding';
import Markdown from '@/components/agent-surface/Markdown';
import { BlockList } from '@/components/agent-surface/blocks';
import CanvasPreview from '@/components/agent-surface/CanvasPreview';
import { useOnboardingTranscript, type AgentRef } from './use-onboarding-transcript';

const SPECIALIST_LABEL: Record<string, string> = {
  contacts:           'Contacts',
  datasheet_designer: 'Datasheets',
  process_designer:   'Automations',
  agent_builder:      'Agents',
};

const SPECIALIST_FULL_LABEL: Record<string, string> = {
  contacts:           'Contact Manager',
  datasheet_designer: 'Datasheet Designer',
  process_designer:   'Process & Automation Designer',
  agent_builder:      'Agent Builder',
};

// Icon per agent KIND — includes the conductor ('onboarding') for the merged
// transcript's agent-labeled turns + the picker.
const AGENT_ICON: Record<string, LucideIcon> = {
  onboarding:         Sparkles,
  contacts:           Users,
  datasheet_designer: Table,
  process_designer:   Workflow,
  agent_builder:      Bot,
};

const SPECIALIST_BLURB: Record<string, string> = {
  contacts:           'organizing and grouping your contacts',
  datasheet_designer: 'designing your data sheets',
  process_designer:   'setting up your pipelines and automations',
  agent_builder:      'building your AI agents',
};

const STARTER_CHIPS = [
  { icon: Scissors,       text: 'I run a salon' },
  { icon: Upload,         text: 'Import my contacts' },
  { icon: MessageCircle,  text: 'Set up WhatsApp' },
];

// ─── Sidebar progress strip ──────────────────────────────────────────────────

function StepIcon({ status }: { status: string }) {
  if (status === 'applied')     return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />;
  if (status === 'skipped')     return <SkipForward  className="h-4 w-4 shrink-0 text-text-secondary" />;
  if (status === 'in_progress') return <Loader2      className="h-4 w-4 shrink-0 animate-spin text-accent" />;
  return <CircleDashed className="h-4 w-4 shrink-0 text-text-secondary/40" />;
}

function ProgressStrip({
  status, onJump,
}: { status: OnboardingStatus; onJump?: () => void }) {
  if (!status.plan.length) {
    return (
      <p className="text-[13px] leading-relaxed text-text-secondary">
        Setup steps will appear here once the assistant knows your business.
      </p>
    );
  }
  return (
    <div className="space-y-0.5">
      {status.plan.map((kind) => {
        const step = status.step_statuses[kind];
        const st = step?.status || 'pending';
        const Icon = AGENT_ICON[kind];
        return (
          <button
            key={kind}
            type="button"
            disabled={st === 'pending'}
            onClick={onJump}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition disabled:cursor-default ${
              st === 'in_progress' ? 'bg-accent/10' : st === 'pending' ? '' : 'hover:bg-bg-secondary'
            }`}
          >
            <StepIcon status={st} />
            <span className={`flex flex-1 items-center gap-2 text-[14px] ${st === 'pending' ? 'text-text-secondary/50' : 'text-text-primary'}`}>
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />}
              {SPECIALIST_LABEL[kind] || kind}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Active-agent header + picker ─────────────────────────────────────────────

function AgentPicker({
  agents, activeAgent, onPick,
}: {
  agents: AgentRef[];
  activeAgent: AgentRef;
  onPick: (a: AgentRef) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ActiveIcon = AGENT_ICON[activeAgent.kind] ?? Sparkles;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={agents.length <= 1}
        className="inline-flex items-center gap-2 rounded-full border border-border-color bg-card-bg px-3 py-1.5 text-[13px] font-medium text-text-primary transition hover:border-accent disabled:cursor-default disabled:hover:border-border-color"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10">
          <ActiveIcon className="h-3 w-3 text-accent" />
        </span>
        <span className="text-text-secondary">Talking to</span>
        <span className="font-semibold">{activeAgent.label}</span>
        {agents.length > 1 && <ChevronDown className="h-3.5 w-3.5 text-text-secondary" />}
      </button>

      {open && agents.length > 1 && (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-64 overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-lg">
          {agents.map((a) => {
            const Icon = AGENT_ICON[a.kind] ?? Sparkles;
            const isActive = a.kind === activeAgent.kind;
            return (
              <button
                key={a.kind}
                type="button"
                onClick={() => { onPick(a); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[14px] transition hover:bg-bg-secondary ${
                  isActive ? 'bg-accent/5' : ''
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <Icon className="h-3.5 w-3.5 text-accent" />
                </span>
                <span className="flex-1 text-text-primary">{a.label}</span>
                {isActive && <CheckCircle2 className="h-4 w-4 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Transcript (ONE merged, ordered, agent-labeled stream) ───────────────────

function Transcript({
  messages, activeAgent, sending, onCallback,
}: {
  messages: ReturnType<typeof useOnboardingTranscript>['messages'];
  activeAgent: AgentRef | null;
  sending: boolean;
  onCallback: (cb: Callback) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // The one interactive turn = the active agent's LATEST assistant message.
  const latestActiveId = useMemo(() => {
    if (!activeAgent) return null;
    let id: number | null = null;
    for (const m of messages) {
      if (m.role === 'assistant' && m.agent_kind === activeAgent.kind) id = m.id;
    }
    return id;
  }, [messages, activeAgent]);

  const latestActiveCanvasId = useMemo(() => {
    if (!activeAgent) return null;
    let id: number | null = null;
    for (const m of messages) {
      if (m.role === 'assistant' && m.agent_kind === activeAgent.kind && m.canvas?.length) id = m.id;
    }
    return id;
  }, [messages, activeAgent]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  let prevAssistantKind: string | null = null;

  return (
    <div ref={listRef} className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
      {messages.length === 0 && (
        <div className="pt-6 text-center text-base text-text-secondary">
          Starting your setup assistant…
        </div>
      )}

      {messages.map((m) => {
        if (m.role === 'user') {
          prevAssistantKind = null;
          return (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-accent px-[18px] py-3 text-[17px] leading-relaxed text-white">
                {m.content}
              </div>
            </div>
          );
        }

        // Assistant row — agent-labeled. Specialist turns arrive inline via the
        // merged transcript, so every agent renders through this one path.
        const kind = m.agent_kind ?? 'onboarding';
        const label = m.agent_label ?? 'Business setup';
        const Icon = AGENT_ICON[kind] ?? Sparkles;
        const speakerChanged = prevAssistantKind !== null && prevAssistantKind !== kind;
        prevAssistantKind = kind;

        const blocks = m.blocks || [];
        const isInteractive = m.id === latestActiveId && !sending;

        return (
          <div key={m.id} id={`onboarding-step-${kind}`}>
            {speakerChanged && (
              <div className="mb-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border-color" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary/60">
                  {label}
                </span>
                <span className="h-px flex-1 bg-border-color" />
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
                <Icon className="h-4 w-4 text-accent" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <p className="-mb-1 text-[12px] font-medium text-accent/80">{label}</p>
                {m.content && (
                  <div className="text-[17px] leading-relaxed text-text-primary">
                    <Markdown text={m.content} />
                  </div>
                )}
                <BlockList blocks={blocks} onCallback={onCallback} disabled={!isInteractive} />
                {m.canvas?.length ? (
                  <CanvasPreview
                    canvas={m.canvas}
                    interactive={m.id === latestActiveCanvasId && !sending}
                    onCallback={onCallback}
                  />
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      {sending && (
        <div className="flex items-center gap-3 pl-11">
          <span className="flex gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-text-secondary/50 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-text-secondary/50 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-text-secondary/50" />
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main shell ──────────────────────────────────────────────────────────────

export default function OnboardingShell() {
  const {
    messages, status, agents, activeAgent, setActiveAgent,
    send, sendCallback, conductorCallback, loading, sending,
  } = useOnboardingTranscript();

  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Derive active specialist (in_progress) from status — drives the banners/chips.
  const activeEntry = status
    ? Object.entries(status.step_statuses).find(([, s]) => s.status === 'in_progress')
    : null;
  const activeSpecialist = activeEntry ? { kind: activeEntry[0] } : null;

  // The specialist most recently applied (plan preserves the dynamic handoff order).
  const lastAppliedKind = status
    ? [...status.plan].reverse().find((k) => status.step_statuses[k]?.status === 'applied')
    : undefined;

  // A specialist just finished and nothing is running — the owner drives the next
  // step with "Continue setup" (no auto-advance). Hidden once everything is resolved.
  const awaitingAdvance =
    !!status &&
    status.onboarding_completed &&
    !status.specialists_complete &&
    !activeSpecialist &&
    !!lastAppliedKind;

  // Overall progress
  const total = status?.plan.length ?? 0;
  const done = status
    ? status.plan.filter((k) => {
        const st = status.step_statuses[k]?.status;
        return st === 'applied' || st === 'skipped';
      }).length
    : 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const stepText = status?.onboarding_completed
    ? 'All steps complete'
    : total
      ? `Step ${Math.min(done + 1, total)} of ${total}`
      : 'Getting started';

  const composerLabel = activeAgent
    ? `Message ${activeAgent.label}… (Shift+Enter for new line)`
    : 'Type a message… (Shift+Enter for new line)';

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;
    await send(text);
  }, [sending, send]);

  // "Continue setup" — resume the conductor (it confirms the finished specialist is
  // already_done, then hands off the next one). Always reaches the CONDUCTOR.
  const handleAdvance = useCallback(() => {
    if (sending || !lastAppliedKind) return;
    void conductorCallback({ block_id: 'next-setup', action: 'resume', values: { specialist: lastAppliedKind } });
  }, [sending, lastAppliedKind, conductorCallback]);

  // Skip a specialist — records the gap and lets the CONDUCTOR advance.
  const handleSkipActive = useCallback(() => {
    if (sending || !activeSpecialist) return;
    void conductorCallback({ block_id: 'skip-step', action: 'skip', values: { specialist: activeSpecialist.kind } });
  }, [sending, activeSpecialist, conductorCallback]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    void handleSend(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = input.trim();
      if (!text) return;
      setInput('');
      void handleSend(text);
    }
  };

  // Show starter chips only at the very start of the conversation.
  const showChips = !activeSpecialist
    && !status?.onboarding_completed
    && messages.length <= 1;

  if (loading || !status) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-secondary">
        <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
      </div>
    );
  }

  const ActiveSpecialistIcon = activeSpecialist ? AGENT_ICON[activeSpecialist.kind] : null;

  return (
    /*
      h-screen + overflow-hidden on the root: the page itself never scrolls.
      The only scrollable region is the transcript list (flex-1 overflow-y-auto).
      Every parent in the chain is height-constrained so that propagates down.
    */
    <div className="flex h-screen overflow-hidden bg-bg-secondary text-text-primary">

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-border-color bg-card-bg px-6 py-8 md:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <h1 className="text-[16px] font-semibold text-text-primary">Getting set up</h1>
        </div>
        <p className="mt-2 mb-6 text-[13.5px] leading-relaxed text-text-secondary">
          {status.onboarding_completed
            ? "You're all set — finish these whenever you like."
            : "A few questions, then we'll configure things for you."}
        </p>

        {status.plan.length > 0 && (
          <>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-text-secondary/60">
              <span>Setup steps</span>
              <span>{done}/{total}</span>
            </div>
            <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-bg-secondary">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        )}

        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary/60">
          Roadmap
        </p>
        {/* "Jump to any agent" — opens the same picker surfaced in the header. */}
        <ProgressStrip
          status={status}
          onJump={() => {
            const active = agents.find((a) => a.kind === activeSpecialist?.kind);
            if (active) setActiveAgent(active);
          }}
        />
      </aside>

      {/* ── Thread + composer ────────────────────────────────────────── */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Mobile header with mini progress */}
        <div className="shrink-0 border-b border-border-color bg-card-bg px-5 py-3 md:hidden">
          <div className="flex items-center justify-between">
            <h1 className="text-[16px] font-semibold text-text-primary">Getting set up</h1>
            <span className="text-[12px] text-text-secondary">{stepText}</span>
          </div>
          {total > 0 && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-secondary">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        {/* Active-agent header + top progress */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border-color bg-card-bg px-6 py-3">
          {activeAgent && (
            <AgentPicker agents={agents} activeAgent={activeAgent} onPick={setActiveAgent} />
          )}
          {total > 0 && (
            <>
              <div className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-bg-secondary md:block">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="ml-auto shrink-0 text-[12px] font-medium text-text-secondary md:ml-0">{stepText}</span>
            </>
          )}
        </div>

        {/* Completion celebration — shown once EVERY specialist is applied/skipped. */}
        {status.specialists_complete && (
          <div className="flex shrink-0 items-center gap-3 border-b border-emerald-500/20 bg-emerald-500/5 px-5 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
              <PartyPopper className="h-[18px] w-[18px] text-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-text-primary">You&apos;re all set!</p>
              <p className="truncate text-[12.5px] text-text-secondary">
                Your contacts, data, automations, and agents are ready to go.
              </p>
            </div>
            <a
              href="/"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
            >
              Go to dashboard <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {/* Active specialist handoff banner */}
        {activeSpecialist && (
          <div className="flex shrink-0 items-center gap-2.5 border-b border-accent/20 bg-accent/5 px-5 py-2.5">
            {ActiveSpecialistIcon
              ? <ArrowRightCircle className="h-4 w-4 shrink-0 text-accent" />
              : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />}
            <p className="min-w-0 flex-1 truncate text-[13px] text-accent">
              <span className="font-semibold">{SPECIALIST_FULL_LABEL[activeSpecialist.kind]}</span>
              {SPECIALIST_BLURB[activeSpecialist.kind]
                ? <span className="text-accent/80"> — {SPECIALIST_BLURB[activeSpecialist.kind]}</span>
                : null}
            </p>
            <button
              type="button"
              onClick={handleSkipActive}
              disabled={sending}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border-color bg-card-bg px-2.5 py-1.5 text-[12.5px] font-medium text-text-secondary transition hover:border-accent hover:text-text-primary disabled:opacity-50"
            >
              <SkipForward className="h-3.5 w-3.5" /> Skip this step
            </button>
          </div>
        )}

        {/* Center column */}
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          <Transcript
            messages={messages}
            activeAgent={activeAgent}
            sending={sending}
            onCallback={(cb) => void sendCallback(cb)}
          />

          {/* Subtle "Continue" — a specialist just applied and nothing is running;
              the owner advances to the next planned step when ready (picker still
              lets them roam). One quiet affordance, no loud banner. */}
          {awaitingAdvance && (
            <div className="flex shrink-0 justify-center px-4 pb-1 pt-2">
              <button
                type="button"
                onClick={handleAdvance}
                disabled={sending}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-4 py-1.5 text-[13px] font-medium text-accent transition hover:bg-accent/10 disabled:opacity-50"
              >
                {sending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <>Continue setup <ArrowRight className="h-3.5 w-3.5" /></>}
              </button>
            </div>
          )}

          {/* Starter chips — only at the very start */}
          {showChips && (
            <div className="flex shrink-0 flex-wrap gap-2 px-4 pb-1 pt-2">
              {STARTER_CHIPS.map(({ icon: Icon, text }) => (
                <button
                  key={text}
                  type="button"
                  disabled={sending}
                  onClick={() => void handleSend(text)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-color bg-card-bg px-3 py-1.5 text-[13px] text-text-primary transition hover:border-accent/40 hover:bg-accent/5 disabled:opacity-50"
                >
                  <Icon className="h-3.5 w-3.5 text-text-secondary" />
                  {text}
                </button>
              ))}
            </div>
          )}

          {/* ── Single shared composer ─────────────────────────────── */}
          <form
            onSubmit={onSubmit}
            className="flex shrink-0 items-end gap-3 border-t border-border-color bg-bg-secondary/40 px-4 py-3"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={composerLabel}
              disabled={sending}
              className="flex-1 resize-none overflow-hidden rounded-2xl border border-border-color bg-card-bg px-4 py-3 text-[16px] leading-relaxed text-text-primary outline-none transition placeholder:text-text-secondary/60 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
              style={{ minHeight: '48px', maxHeight: '160px' }}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {sending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </main>

    </div>
  );
}
