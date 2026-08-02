'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Sparkles, Loader2, Rocket } from 'lucide-react';
import QuestionInput, { type AnswerPayload } from '@/components/system-builder/QuestionInput';
import EditableSystemCanvas from '@/components/system-builder/EditableSystemCanvas';
import type { Question } from '@/services/system-builder';
import {
  openSession,
  sessionDraft,
  patchPlan,
  buildSection,
  finalizeSession,
  openApp,
  type WorkingPlan,
  type StepStatus,
} from '@/services/system-builder';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  why?: string | null;
  issues?: string[] | null;
  question?: Question | null;
}

const STARTERS = [
  'I run an electronics shop and want a Complaint System',
  'Build a Sales System for my leads on WhatsApp',
  'I need to handle product returns and warranty issues',
];

const EMPTY_PLAN: WorkingPlan = { sections: {} };

interface Props {
  /** First-run onboarding mode: warm intro + an "Open my app" gate affordance. */
  onboarding?: boolean;
}

/**
 * The stateful System Builder surface (Phase 2 chat + editable canvas). Rendered
 * both at `/systems/builder` (post-onboarding, gated by ModuleGuard) and — in
 * `onboarding` mode — at `/onboarding` as the Phase-4 first-run setup experience.
 */
export default function SystemBuilderSurface({ onboarding = false }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<WorkingPlan>(EMPTY_PLAN);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [pendingStep, setPendingStep] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [openingApp, setOpeningApp] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Resume on load: rehydrate transcript + plan + per-section status ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await openSession();
        if (!alive) return;
        setMessages(
          (s.transcript || []).map((m) => ({
            role: m.role,
            content: m.content,
            why: m.why,
            issues: m.issues,
            question: m.question,
          }))
        );
        setPlan(s.plan || EMPTY_PLAN);
        setStepStatuses(s.step_statuses || {});
      } catch {
        // fresh start on failure
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  // ── Stateful chat: server owns transcript; we send just {message} or {answer} ──
  const runDraft = useCallback(
    async (body: { message?: string; answer?: { question_id: string; value: unknown; labels?: string[] } }) => {
      if (busy) return;
      setBusy(true);
      try {
        const res = await sessionDraft(body);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: res.message, why: res.why, issues: res.issues, question: res.question },
        ]);
        if (res.plan) setPlan(res.plan);
        if (res.step_statuses) setStepStatuses(res.step_statuses);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `⚠️ ${(e as Error).message || 'Something went wrong.'}` },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy]
  );

  const sendText = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean || busy) return;
      setMessages((prev) => [...prev, { role: 'user', content: clean }]);
      setInput('');
      void runDraft({ message: clean });
    },
    [busy, runDraft]
  );

  const onAnswer = useCallback(
    (a: AnswerPayload) => {
      setMessages((prev) => [...prev, { role: 'user', content: a.message }]);
      void runDraft({ answer: { question_id: a.id, value: a.value, labels: labelsFor(a) } });
    },
    [runDraft]
  );

  // ── Structural canvas edits: binding, re-render from server response ──
  const onPatch = useCallback(async (op: 'set' | 'remove' | 'toggle_section', path: string, value?: unknown) => {
    try {
      const res = await patchPlan(op, path, value);
      setPlan(res.plan);
      setStepStatuses(res.step_statuses);
    } catch {
      /* keep prior state on failure */
    }
  }, []);

  const onBuildSection = useCallback(async (step: string) => {
    if (pendingStep) return;
    setPendingStep(step);
    try {
      const res = await buildSection(step);
      setStepStatuses(res.step_statuses);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `✅ Built the ${step} section (${res.components} component${res.components === 1 ? '' : 's'}).` },
      ]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${(e as Error).message || 'Build failed.'}` }]);
    } finally {
      setPendingStep(null);
    }
  }, [pendingStep]);

  const onBuildEverything = useCallback(async () => {
    if (finalizing) return;
    setFinalizing(true);
    setMessages((prev) => [...prev, { role: 'user', content: 'Build everything' }]);
    try {
      const res = await finalizeSession();
      setMessages((prev) => [...prev, { role: 'assistant', content: res.message }]);
      setTimeout(() => router.push(`/systems/${res.result.system_id}`), 1200);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${(e as Error).message || 'Build failed.'}` }]);
    } finally {
      setFinalizing(false);
    }
  }, [finalizing, router]);

  // ── Onboarding: open the hard gate and enter the app (finish setup later). ──
  const onOpenApp = useCallback(async () => {
    if (openingApp) return;
    setOpeningApp(true);
    try {
      const res = await openApp();
      // Full reload so AuthBootstrap re-reads the now-open gate; route on to
      // billing if a plan hasn't been chosen yet (mirrors post-auth redirect).
      const dest = res.plan_selection_required ? '/plan-selection' : '/dashboard';
      window.location.assign(dest);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${(e as Error).message || 'Could not open the app yet.'}` },
      ]);
      setOpeningApp(false);
    }
  }, [openingApp]);

  const hasPlan = Object.keys(plan.sections || {}).length > 0 || Object.keys(plan._disabled || {}).length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {onboarding ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <span className="text-sm font-semibold text-text-primary">Let&apos;s set up your business</span>
          </div>
          <button
            type="button"
            onClick={onOpenApp}
            disabled={openingApp}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {openingApp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Open my app
          </button>
        </div>
      ) : (
        <Link
          href="/systems"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to systems
        </Link>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border-color bg-bg-primary">
        {/* Chat column */}
        <div className="flex w-[320px] shrink-0 flex-col border-r border-border-color md:w-[380px]">
          <div className="flex items-center gap-2 border-b border-border-color px-4 py-3">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-text-primary">
              {onboarding ? 'Setup assistant' : 'System Builder'}
            </span>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" /> Restoring your session…
              </div>
            ) : messages.length === 0 ? (
              <div className="space-y-3">
                {onboarding ? (
                  <p className="text-sm text-text-secondary">
                    Welcome to MyBizAI 👋 Tell me a little about your business and I&apos;ll set
                    up everything you need — contacts, pipelines, data sheets, a dashboard and a
                    WhatsApp AI agent. You can open the app any time with <strong>Open my app</strong>.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-text-secondary">
                      Describe your business and what you want to run. I&apos;ll propose a complete
                      System — contacts, pipeline, datasheets, dashboard and a WhatsApp agent — then
                      build it, one section at a time or all at once.
                    </p>
                    <div className="space-y-2">
                      {STARTERS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => sendText(s)}
                          className="w-full rounded-lg border border-border-color px-3 py-2 text-left text-[13px] text-text-secondary transition hover:border-accent hover:text-text-primary"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              return (
                <div key={i} className={m.role === 'assistant' ? 'space-y-1.5' : undefined}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-[13px] text-white'
                        : 'mr-auto max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-card-bg px-3 py-2 text-[13px] text-text-primary'
                    }
                  >
                    {m.content}
                    {m.why ? <p className="mt-1.5 text-[12px] italic text-text-secondary">{m.why}</p> : null}
                    {m.issues?.length ? (
                      <ul className="mt-1.5 list-disc pl-4 text-[12px] text-rose-500">
                        {m.issues.map((iss, k) => (
                          <li key={k}>{iss}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {m.role === 'assistant' && m.question && isLast ? (
                    <QuestionInput key={m.question.id} question={m.question} disabled={busy} onAnswer={onAnswer} />
                  ) : null}
                </div>
              );
            })}

            {busy && (
              <div className="mr-auto flex items-center gap-2 rounded-2xl bg-card-bg px-3 py-2 text-[13px] text-text-secondary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendText(input);
            }}
            className="border-t border-border-color p-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendText(input);
                  }
                }}
                rows={2}
                placeholder={onboarding ? 'Tell me about your business…' : 'Describe your business…'}
                className="min-h-0 flex-1 resize-none rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Canvas column — the editable working plan */}
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          {hasPlan ? (
            <EditableSystemCanvas
              plan={plan}
              stepStatuses={stepStatuses}
              busy={busy}
              onPatch={onPatch}
              onBuildSection={onBuildSection}
              onBuildEverything={onBuildEverything}
              pendingStep={pendingStep}
              finalizing={finalizing}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-text-secondary">
              <div className="max-w-xs space-y-2">
                <Sparkles className="mx-auto h-6 w-6 text-accent/60" />
                <p>Your System takes shape here — sections, fields and stages you can edit and build.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Selection widgets carry human labels; pass them so the plan stores real names. */
function labelsFor(a: AnswerPayload): string[] | undefined {
  if (Array.isArray(a.value)) {
    // message is "A, B, C" for multi-select — recover the labels for nicer names.
    const parts = a.message.split(',').map((x) => x.trim()).filter(Boolean);
    if (parts.length === a.value.length) return parts;
  }
  return undefined;
}
