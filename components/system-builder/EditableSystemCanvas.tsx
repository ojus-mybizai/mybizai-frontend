'use client';

/**
 * EditableSystemCanvas — the Phase-2 builder canvas.
 *
 * Renders the working plan (server truth) as editable section cards. Each card:
 *   • a section on/off toggle          → PATCH /session/plan (toggle_section)
 *   • inline rename / remove of items  → PATCH /session/plan (set / remove)
 *   • a "Build now" button             → POST /session/build-section
 *   • a built / pending status pill
 * A footer "Build everything" → POST /session/finalize.
 *
 * Structural edits are BINDING (no AI): the parent calls the service and passes
 * the fresh plan back down. Semantic changes ("make it smarter") go through chat.
 */

import { useState } from 'react';
import { Check, Loader2, Pencil, Trash2, Hammer, Rocket } from 'lucide-react';
import type { WorkingPlan, StepStatus } from '@/services/system-builder';

const STEP_ORDER = ['contacts', 'datasheets', 'process', 'dashboard', 'agent'] as const;
type Step = (typeof STEP_ORDER)[number];

const STEP_META: Record<Step, { icon: string; label: string }> = {
  contacts: { icon: '👥', label: 'Contacts' },
  datasheets: { icon: '📇', label: 'Datasheets' },
  process: { icon: '🧭', label: 'Pipeline' },
  dashboard: { icon: '📊', label: 'Dashboard' },
  agent: { icon: '🤖', label: 'WhatsApp Agent' },
};

/** Per-section editable item lists: which plan keys hold named items. */
const SECTION_LISTS: Record<Step, { key: string; label: string; nameKey: string }[]> = {
  contacts: [
    { key: 'groups', label: 'Groups', nameKey: 'name' },
    { key: 'fields', label: 'Fields', nameKey: 'name' },
    { key: 'tags', label: 'Tags', nameKey: 'name' },
  ],
  datasheets: [{ key: 'datasheets', label: 'Sheets', nameKey: 'display_name' }],
  process: [{ key: 'stages', label: 'Stages', nameKey: 'name' }],
  dashboard: [{ key: 'widgets', label: 'Widgets', nameKey: 'title' }],
  agent: [{ key: 'skills', label: 'Skills', nameKey: 'name' }],
};

type Op = 'set' | 'remove' | 'toggle_section';

interface Props {
  plan: WorkingPlan;
  stepStatuses: Record<string, StepStatus>;
  busy?: boolean;
  onPatch: (op: Op, path: string, value?: unknown) => void | Promise<void>;
  onBuildSection: (step: string) => void | Promise<void>;
  onBuildEverything: () => void | Promise<void>;
  pendingStep?: string | null;
  finalizing?: boolean;
}

/** The display label of a plan item (string OR {name}/{display_name}/{title}). */
function itemLabel(item: unknown, nameKey: string): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    return String(o[nameKey] ?? o.name ?? o.display_name ?? o.title ?? '');
  }
  return String(item ?? '');
}

/** Whether a plan item is a bare string (path targets the index itself vs .name). */
function isStringItem(item: unknown): boolean {
  return typeof item === 'string';
}

export default function EditableSystemCanvas({
  plan,
  stepStatuses,
  busy,
  onPatch,
  onBuildSection,
  onBuildEverything,
  pendingStep,
  finalizing,
}: Props) {
  const sections = plan.sections || {};
  const disabled = plan._disabled || {};

  const activeSteps = STEP_ORDER.filter((s) => sections[s] || disabled[s]);
  const anyBuildable = STEP_ORDER.some(
    (s) => sections[s] && stepStatuses[s] !== 'built'
  );
  const allBuilt =
    activeSteps.length > 0 &&
    activeSteps.every((s) => !sections[s] || stepStatuses[s] === 'built');

  if (activeSteps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-text-secondary">
        <div className="max-w-xs space-y-2">
          <p>Your System takes shape here as you answer. Sections, fields and stages become editable cards you can build one at a time — or all at once.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {plan.name && (
        <div className="flex items-center gap-2">
          <span className="text-lg">🧩</span>
          <h2 className="text-base font-semibold text-text-primary">{plan.name}</h2>
        </div>
      )}
      {plan.goal && <p className="text-[13px] text-text-secondary">🎯 {plan.goal}</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {activeSteps.map((step) => (
          <SectionCard
            key={step}
            step={step}
            section={(sections[step] as Record<string, unknown>) || null}
            status={stepStatuses[step] || 'pending'}
            enabled={!!sections[step]}
            busy={busy}
            building={pendingStep === step}
            onPatch={onPatch}
            onBuildSection={onBuildSection}
          />
        ))}
      </div>

      {plan.outcomes && plan.outcomes.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="mb-1.5 text-[13px] font-semibold text-text-primary">✨ What you&apos;ll be able to do</p>
          <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-text-secondary">
            {plan.outcomes.slice(0, 6).map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer build action */}
      <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-xl border border-border-color bg-bg-primary/95 p-3 backdrop-blur">
        <p className="text-[12.5px] text-text-secondary">
          {allBuilt
            ? 'All sections built.'
            : 'Build sections one at a time, or build the whole System now.'}
        </p>
        <button
          type="button"
          disabled={busy || finalizing || !anyBuildable}
          onClick={() => void onBuildEverything()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          Build everything
        </button>
      </div>
    </div>
  );
}

/* ── section card ─────────────────────────────────────────────────────── */

function SectionCard({
  step,
  section,
  status,
  enabled,
  busy,
  building,
  onPatch,
  onBuildSection,
}: {
  step: Step;
  section: Record<string, unknown> | null;
  status: StepStatus;
  enabled: boolean;
  busy?: boolean;
  building?: boolean;
  onPatch: Props['onPatch'];
  onBuildSection: Props['onBuildSection'];
}) {
  const meta = STEP_META[step];
  const built = status === 'built';
  const lists = SECTION_LISTS[step];

  return (
    <div
      className={
        'flex flex-col rounded-xl border p-3 transition ' +
        (enabled ? 'border-border-color bg-card-bg' : 'border-dashed border-border-color bg-transparent opacity-60')
      }
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
          <span aria-hidden>{meta.icon}</span> {meta.label}
        </span>
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          {/* on/off toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? `Turn ${meta.label} off` : `Turn ${meta.label} on`}
            disabled={busy || built}
            onClick={() => void onPatch('toggle_section', step, !enabled)}
            className={
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-40 ' +
              (enabled ? 'bg-accent' : 'bg-border-color')
            }
          >
            <span
              className={
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition ' +
                (enabled ? 'translate-x-4' : 'translate-x-0.5')
              }
            />
          </button>
        </div>
      </div>

      {enabled && (
        <div className="flex-1 space-y-2.5">
          {step === 'agent' && <AgentSummary section={section} />}
          {lists.map(({ key, label, nameKey }) => {
            const items = Array.isArray(section?.[key]) ? (section![key] as unknown[]) : [];
            if (items.length === 0) return null;
            return (
              <ItemList
                key={key}
                label={label}
                items={items}
                nameKey={nameKey}
                basePath={`sections.${step}.${key}`}
                disabled={busy || built}
                onPatch={onPatch}
              />
            );
          })}
          {isEmptySection(step, section) && (
            <p className="text-[12px] italic text-text-secondary">Configured — details in chat.</p>
          )}
        </div>
      )}

      {/* Build now */}
      {enabled && (
        <div className="mt-3 flex justify-end">
          {built ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Built
            </span>
          ) : (
            <button
              type="button"
              disabled={busy || building}
              onClick={() => void onBuildSection(step)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent px-2.5 py-1.5 text-[12.5px] font-medium text-accent transition hover:bg-accent-soft disabled:opacity-40"
            >
              {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hammer className="h-3.5 w-3.5" />}
              Build now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function isEmptySection(step: Step, section: Record<string, unknown> | null): boolean {
  if (!section) return true;
  if (step === 'agent') return false;
  return SECTION_LISTS[step].every((l) => !Array.isArray(section[l.key]) || (section[l.key] as unknown[]).length === 0);
}

function AgentSummary({ section }: { section: Record<string, unknown> | null }) {
  const name = section?.name ? String(section.name) : 'Assistant';
  const goal = section?.goal_text || section?.instructions;
  return (
    <div className="space-y-1">
      <p className="text-[12.5px] font-medium text-text-primary">{name} · runs on WhatsApp</p>
      {goal ? <p className="line-clamp-2 text-[12px] text-text-secondary">{String(goal)}</p> : null}
    </div>
  );
}

/* ── item list (rename / remove) ──────────────────────────────────────── */

function ItemList({
  label,
  items,
  nameKey,
  basePath,
  disabled,
  onPatch,
}: {
  label: string;
  items: unknown[];
  nameKey: string;
  basePath: string;
  disabled?: boolean;
  onPatch: Props['onPatch'];
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <EditableChip
            key={i}
            label={itemLabel(item, nameKey)}
            disabled={disabled}
            onRename={(next) =>
              onPatch('set', isStringItem(item) ? `${basePath}.${i}` : `${basePath}.${i}.${nameKey}`, next)
            }
            onRemove={() => onPatch('remove', `${basePath}.${i}`)}
          />
        ))}
      </div>
    </div>
  );
}

function EditableChip({
  label,
  disabled,
  onRename,
  onRemove,
}: {
  label: string;
  disabled?: boolean;
  onRename: (next: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  const commit = () => {
    const clean = draft.trim();
    setEditing(false);
    if (clean && clean !== label) onRename(clean);
    else setDraft(label);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            setDraft(label);
            setEditing(false);
          }
        }}
        className="w-28 rounded-full border border-accent bg-bg-primary px-2.5 py-1 text-[12px] text-text-primary outline-none"
      />
    );
  }

  return (
    <span className="group inline-flex items-center gap-1 rounded-full border border-border-color bg-bg-primary px-2.5 py-1 text-[12px] text-text-secondary">
      <span className="max-w-[10rem] truncate">{label}</span>
      {!disabled && (
        <>
          <button
            type="button"
            aria-label={`Rename ${label}`}
            onClick={() => {
              setDraft(label);
              setEditing(true);
            }}
            className="opacity-0 transition group-hover:opacity-100 hover:text-accent"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={onRemove}
            className="opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </>
      )}
    </span>
  );
}

/* ── status pill ──────────────────────────────────────────────────────── */

function StatusPill({ status }: { status: StepStatus }) {
  const map: Record<StepStatus, { label: string; cls: string }> = {
    built: { label: 'Built', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    proposed: { label: 'Ready', cls: 'bg-accent-soft text-accent' },
    pending: { label: 'Draft', cls: 'bg-border-color/40 text-text-secondary' },
    skipped: { label: 'Off', cls: 'bg-border-color/40 text-text-secondary' },
  };
  const s = map[status] || map.pending;
  return <span className={'rounded-full px-2 py-0.5 text-[10.5px] font-semibold ' + s.cls}>{s.label}</span>;
}
