'use client';

/**
 * QuestionInput — the rich interview widget for the System Builder (Phase 1).
 *
 * Renders one Conductor question as the right input:
 *   single_select → single-choice chips
 *   multi_select  → tag-picker chips (real vs AI-suggested styled differently)
 *   list_builder  → add / remove / reorder rows
 *   toggle        → on/off switch
 *   text | number → a single inline field
 *
 * Every widget has an "add your own" affordance when allow_custom, and emits
 * onAnswer({ id, message, value }) on submit. The parent merges `value` into its
 * client-held answers map (keyed by question.id) and echoes `message` into chat.
 *
 * Mount this with key={question.id} so its local draft resets per question.
 */

import { useMemo, useState } from 'react';
import { Check, Plus, X, ChevronUp, ChevronDown, CornerDownLeft } from 'lucide-react';
import type { Question, QuestionOption, OptionSource } from '@/services/system-builder';

export interface AnswerPayload {
  id: string;
  /** Human-readable summary echoed into chat + history. */
  message: string;
  /** Structured value stored under answers[id]. */
  value: unknown;
}

interface Props {
  question: Question;
  disabled?: boolean;
  onAnswer: (a: AnswerPayload) => void;
}

/** Sources that describe something that ALREADY exists in the business. */
const REAL_SOURCES: OptionSource[] = [
  'existing_tag',
  'existing_group',
  'datasheet',
  'field',
  'staff',
  'channel',
];

function isReal(source?: OptionSource): boolean {
  return !!source && REAL_SOURCES.includes(source);
}

const SOURCE_LABEL: Record<OptionSource, string> = {
  existing_tag: 'current tag',
  existing_group: 'current group',
  datasheet: 'existing sheet',
  field: 'existing field',
  staff: 'staff',
  channel: 'channel',
  ai: 'suggested',
};

export default function QuestionInput({ question, disabled, onAnswer }: Props) {
  switch (question.type) {
    case 'single_select':
      return <SingleSelect question={question} disabled={disabled} onAnswer={onAnswer} />;
    case 'multi_select':
      return <MultiSelect question={question} disabled={disabled} onAnswer={onAnswer} />;
    case 'list_builder':
      return <ListBuilder question={question} disabled={disabled} onAnswer={onAnswer} />;
    case 'toggle':
      return <Toggle question={question} disabled={disabled} onAnswer={onAnswer} />;
    case 'text':
    case 'number':
      return <SingleValue question={question} disabled={disabled} onAnswer={onAnswer} />;
    default:
      return null;
  }
}

/* ── shared bits ──────────────────────────────────────────────────────── */

function SubmitButton({
  label = 'Continue',
  disabled,
  onClick,
}: {
  label?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
      <CornerDownLeft className="h-3.5 w-3.5" />
    </button>
  );
}

/** The little "current" / "suggested" legend dot on option chips. */
function SourceDot({ source }: { source?: OptionSource }) {
  const real = isReal(source);
  return (
    <span
      title={source ? SOURCE_LABEL[source] : undefined}
      className={
        real
          ? 'h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500'
          : 'h-1.5 w-1.5 shrink-0 rounded-full border border-current opacity-50'
      }
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-xl border border-border-color bg-bg-primary p-3">{children}</div>
  );
}

function CustomAdd({
  placeholder,
  onAdd,
  disabled,
}: {
  placeholder?: string;
  onAdd: (v: string) => void;
  disabled?: boolean;
}) {
  const [v, setV] = useState('');
  const commit = () => {
    const clean = v.trim();
    if (!clean) return;
    onAdd(clean);
    setV('');
  };
  return (
    <div className="flex items-center gap-1.5">
      <input
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        placeholder={placeholder || 'Add your own…'}
        className="min-w-0 flex-1 rounded-lg border border-dashed border-border-color bg-transparent px-2.5 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent"
      />
      <button
        type="button"
        disabled={disabled || !v.trim()}
        onClick={commit}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border-color text-text-secondary transition hover:border-accent hover:text-accent disabled:opacity-40"
        aria-label="Add"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ── single select ────────────────────────────────────────────────────── */

function SingleSelect({ question, disabled, onAnswer }: Props) {
  const [options, setOptions] = useState<QuestionOption[]>(question.options ?? []);
  const [selected, setSelected] = useState<string | null>(null);

  const submit = () => {
    if (!selected) return;
    const opt = options.find((o) => o.value === selected);
    onAnswer({ id: question.id, message: opt?.label ?? selected, value: selected });
  };

  const addCustom = (label: string) => {
    const value = slug(label);
    if (!options.some((o) => o.value === value)) {
      setOptions((p) => [...p, { label, value, source: 'ai' }]);
    }
    setSelected(value);
  };

  return (
    <Shell>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected === o.value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              onClick={() => setSelected(o.value)}
              className={chipClass(on)}
            >
              <SourceDot source={o.source} />
              {o.label}
            </button>
          );
        })}
      </div>
      {question.allow_custom && (
        <div className="mt-2.5">
          <CustomAdd placeholder={question.placeholder} onAdd={addCustom} disabled={disabled} />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <Legend options={options} />
        <SubmitButton disabled={disabled || !selected} onClick={submit} />
      </div>
    </Shell>
  );
}

/* ── multi select (tag picker) ────────────────────────────────────────── */

function MultiSelect({ question, disabled, onAnswer }: Props) {
  const [options, setOptions] = useState<QuestionOption[]>(question.options ?? []);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (value: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const addCustom = (label: string) => {
    const value = slug(label);
    if (!options.some((o) => o.value === value)) {
      setOptions((p) => [...p, { label, value, source: 'ai' }]);
    }
    setSelected((prev) => new Set(prev).add(value));
  };

  const submit = () => {
    const values = options.filter((o) => selected.has(o.value)).map((o) => o.value);
    const labels = options.filter((o) => selected.has(o.value)).map((o) => o.label);
    onAnswer({
      id: question.id,
      message: labels.length ? labels.join(', ') : 'None',
      value: values,
    });
  };

  const min = question.min ?? 0;
  const canSubmit = !disabled && selected.size >= min;

  return (
    <Shell>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.has(o.value);
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              onClick={() => toggle(o.value)}
              className={chipClass(on)}
            >
              {on ? <Check className="h-3.5 w-3.5" /> : <SourceDot source={o.source} />}
              {o.label}
            </button>
          );
        })}
      </div>
      {question.allow_custom && (
        <div className="mt-2.5">
          <CustomAdd placeholder={question.placeholder} onAdd={addCustom} disabled={disabled} />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-text-secondary">{selected.size} selected</span>
          <Legend options={options} />
        </div>
        <SubmitButton disabled={!canSubmit} onClick={submit} />
      </div>
    </Shell>
  );
}

/* ── list builder ─────────────────────────────────────────────────────── */

function ListBuilder({ question, disabled, onAnswer }: Props) {
  const [rows, setRows] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  const add = () => {
    const clean = draft.trim();
    if (!clean) return;
    setRows((p) => [...p, clean]);
    setDraft('');
  };
  const remove = (i: number) => setRows((p) => p.filter((_, k) => k !== i));
  const move = (i: number, dir: -1 | 1) =>
    setRows((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const submit = () =>
    onAnswer({
      id: question.id,
      message: rows.length ? rows.join(' → ') : 'None',
      value: rows,
    });

  const min = question.min ?? 0;

  return (
    <Shell>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-border-color bg-card-bg px-2.5 py-1.5"
          >
            <span className="w-5 shrink-0 text-center text-[12px] font-medium text-text-secondary">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{r}</span>
            <div className="flex shrink-0 items-center gap-0.5">
              <IconBtn label="Move up" disabled={disabled || i === 0} onClick={() => move(i, -1)}>
                <ChevronUp className="h-4 w-4" />
              </IconBtn>
              <IconBtn
                label="Move down"
                disabled={disabled || i === rows.length - 1}
                onClick={() => move(i, 1)}
              >
                <ChevronDown className="h-4 w-4" />
              </IconBtn>
              <IconBtn label="Remove" disabled={disabled} onClick={() => remove(i)}>
                <X className="h-4 w-4" />
              </IconBtn>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="px-1 py-2 text-[12px] text-text-secondary">
            Nothing added yet — add items below.
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <input
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={question.placeholder || 'Add an item…'}
          className="min-w-0 flex-1 rounded-lg border border-border-color bg-transparent px-2.5 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={disabled || !draft.trim()}
          onClick={add}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border-color text-text-secondary transition hover:border-accent hover:text-accent disabled:opacity-40"
          aria-label="Add item"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-end">
        <SubmitButton disabled={disabled || rows.length < min} onClick={submit} />
      </div>
    </Shell>
  );
}

function IconBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-text-secondary transition hover:bg-bg-primary hover:text-text-primary disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/* ── toggle ───────────────────────────────────────────────────────────── */

function Toggle({ question, disabled, onAnswer }: Props) {
  const [on, setOn] = useState(false);
  return (
    <Shell>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={disabled}
          onClick={() => setOn((v) => !v)}
          className={
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ' +
            (on ? 'bg-accent' : 'bg-border-color')
          }
        >
          <span
            className={
              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition ' +
              (on ? 'translate-x-5' : 'translate-x-0.5')
            }
          />
        </button>
        <span className="flex-1 text-[13px] text-text-primary">{on ? 'Yes' : 'No'}</span>
        <SubmitButton
          disabled={disabled}
          onClick={() => onAnswer({ id: question.id, message: on ? 'Yes' : 'No', value: on })}
        />
      </div>
    </Shell>
  );
}

/* ── single value (text / number) ─────────────────────────────────────── */

function SingleValue({ question, disabled, onAnswer }: Props) {
  const [v, setV] = useState('');
  const isNum = question.type === 'number';

  const submit = () => {
    const clean = v.trim();
    if (!clean) return;
    const value = isNum ? Number(clean) : clean;
    if (isNum && Number.isNaN(value as number)) return;
    onAnswer({ id: question.id, message: clean, value });
  };

  return (
    <Shell>
      <div className="flex items-center gap-1.5">
        <input
          value={v}
          disabled={disabled}
          type={isNum ? 'number' : 'text'}
          min={isNum && question.min != null ? question.min : undefined}
          max={isNum && question.max != null ? question.max : undefined}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={question.placeholder || (isNum ? 'Enter a number…' : 'Type your answer…')}
          className="min-w-0 flex-1 rounded-lg border border-border-color bg-transparent px-2.5 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent"
        />
        <SubmitButton disabled={disabled || !v.trim()} onClick={submit} />
      </div>
    </Shell>
  );
}

/* ── little helpers ───────────────────────────────────────────────────── */

function chipClass(on: boolean): string {
  return (
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition ' +
    (on
      ? 'border-accent bg-accent-soft text-accent font-medium'
      : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent hover:text-text-primary')
  );
}

/** Show the real-vs-suggested legend only when both kinds are present. */
function Legend({ options }: { options: QuestionOption[] }) {
  const hasReal = options.some((o) => isReal(o.source));
  const hasAi = options.some((o) => !isReal(o.source));
  if (!hasReal || !hasAi) return null;
  return (
    <div className="flex items-center gap-3 text-[11px] text-text-secondary">
      <span className="inline-flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> current
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full border border-current opacity-50" /> suggested
      </span>
    </div>
  );
}

function slug(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || label.trim().toLowerCase()
  );
}
