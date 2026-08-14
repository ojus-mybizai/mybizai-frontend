'use client';

import { useRef, useState } from 'react';
import { Plus, X, Database, User, Braces, Sparkles } from 'lucide-react';
import type { DynamicField } from '@/services/dynamic-data';
import type { EntityKind } from '@/services/taskTemplates';
import {
  parse,
  serialize,
  insertToken,
  emptyDoc,
  type TokenDoc,
  type TokenSegment,
} from '@/lib/tasks/token-parser';
import { FieldPicker, type FieldChoice } from './shared/field-picker';

export interface TokenEditorProps {
  value: string;
  onChange: (raw: string) => void;
  entityKind: EntityKind;
  entityDatasheetId?: number | null;
  datasheetName?: string | null;
  fields?: DynamicField[];
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  onFreeVarAdded?: (name: string) => void;
}

export function TokenEditor({
  value,
  onChange,
  entityKind,
  entityDatasheetId,
  datasheetName,
  fields,
  placeholder = 'Type your title. Use + Insert field for schema tokens.',
  maxLength = 500,
  multiline = false,
  onFreeVarAdded,
}: TokenEditorProps) {
  const doc = parse(value, { datasheetName: datasheetName ?? undefined, fields });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [freeOpen, setFreeOpen] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const setDoc = (next: TokenDoc) => onChange(serialize(next).slice(0, maxLength));

  const removeSegAt = (idx: number) => {
    const segments = doc.segments.filter((_, i) => i !== idx);
    setDoc({ segments: segments.length ? segments : [{ kind: 'text', text: '' }] });
  };

  const updateTextAt = (idx: number, text: string) => {
    const segments = doc.segments.map((s, i) =>
      i === idx ? ({ ...s, text } as TokenSegment) : s,
    );
    setDoc({ segments });
  };

  const insertPicked = (choice: FieldChoice) => {
    const raw = serialize(doc);
    setDoc(
      insertToken(parse(raw, { datasheetName: datasheetName ?? undefined, fields }), raw.length, {
        source: choice.source,
        path: choice.path,
        fieldType: choice.fieldType,
        removable: true,
      }),
    );
  };

  const insertFree = () => {
    const key = freeText.trim().replace(/[{}]/g, '');
    if (!key) return;
    const raw = serialize(doc);
    setDoc(
      insertToken(parse(raw, { datasheetName: datasheetName ?? undefined, fields }), raw.length, {
        source: 'free',
        path: key,
        removable: true,
      }),
    );
    onFreeVarAdded?.(key);
    setFreeText('');
    setFreeOpen(false);
  };

  const isEmpty = doc.segments.every((s) => s.kind === 'text' && !s.text);
  const hasTokens = doc.segments.some((s) => s.kind === 'token');

  // Simple case: no tokens anywhere. Render a plain textarea/input so the
  // click target is the field itself, the browser's native placeholder shows,
  // and nothing steals focus. The tokenized layout is only needed once at
  // least one token has been inserted.
  if (!hasTokens) {
    const flat = doc.segments.map((s) => (s.kind === 'text' ? s.text : '')).join('');
    return (
      <div className="relative">
        {multiline ? (
          <textarea
            value={flat}
            onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
            placeholder={placeholder}
            className="w-full resize-y rounded-tc-chip border border-tc-rule bg-tc-bg-ground px-3 py-2 text-sm text-tc-ink focus:border-tc-accent focus:outline-none focus:ring-1 focus:ring-tc-accent/40"
            style={{ minHeight: 80 }}
            maxLength={maxLength}
          />
        ) : (
          <input
            type="text"
            value={flat}
            onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
            placeholder={placeholder}
            className="w-full rounded-tc-chip border border-tc-rule bg-tc-bg-ground px-3 py-2 text-sm text-tc-ink focus:border-tc-accent focus:outline-none focus:ring-1 focus:ring-tc-accent/40"
            maxLength={maxLength}
          />
        )}
        {renderButtons()}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        onMouseDown={(e) => {
          // Click on gutters between tokens focuses the nearest input.
          const t = e.target as HTMLElement;
          if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.closest('button')) return;
          e.preventDefault();
          const last = inputRefs.current.filter(Boolean).pop();
          last?.focus();
        }}
        className={`relative flex cursor-text flex-wrap items-center gap-1 rounded-tc-chip border border-tc-rule bg-tc-bg-ground px-2 py-2 focus-within:border-tc-accent focus-within:ring-1 focus-within:ring-tc-accent/40 ${
          multiline ? 'min-h-[80px]' : 'min-h-[38px]'
        }`}
      >
        {isEmpty && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-tc-ink-muted">
            {placeholder}
          </span>
        )}
        {doc.segments.map((seg, i) =>
          seg.kind === 'text' ? (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              value={seg.text}
              onChange={(e) => updateTextAt(i, e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Backspace' &&
                  seg.text === '' &&
                  i > 0 &&
                  doc.segments[i - 1].kind === 'token'
                ) {
                  e.preventDefault();
                  removeSegAt(i - 1);
                }
              }}
              className="max-w-full flex-1 bg-transparent text-sm text-tc-ink focus:outline-none"
              style={{ width: `${Math.max(seg.text.length + 1, 4)}ch`, minWidth: '4ch' }}
            />
          ) : (
            <TokenAtom key={i} seg={seg} onRemove={() => removeSegAt(i)} />
          ),
        )}
      </div>
      {renderButtons()}
    </div>
  );

  function renderButtons() {
    return (
      <>
        <div className="mt-1 flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-tc-chip border border-tc-rule bg-tc-bg-card px-1.5 py-0.5 text-tc-ink-2 hover:border-tc-accent hover:text-tc-accent"
          >
            <Plus className="h-3 w-3" /> Insert field
          </button>
          <button
            type="button"
            onClick={() => setFreeOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-tc-chip border border-tc-rule bg-tc-bg-card px-1.5 py-0.5 text-tc-ink-2 hover:border-tc-accent hover:text-tc-accent"
          >
            <Braces className="h-3 w-3" /> Free
          </button>
          <span className="ml-auto font-mono text-[10px] text-tc-ink-muted">
            {serialize(doc).length}/{maxLength}
          </span>
        </div>
        {freeOpen && (
          <div className="absolute z-40 mt-1 flex items-center gap-1 rounded-tc-panel border border-tc-rule bg-tc-bg-card p-2 shadow-[var(--tc-shadow-soft)]">
            <input
              autoFocus
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  insertFree();
                } else if (e.key === 'Escape') setFreeOpen(false);
              }}
              placeholder="variable_name"
              className="w-40 rounded-tc-chip border border-tc-rule bg-tc-bg-ground px-2 py-1 text-xs text-tc-ink focus:border-tc-accent focus:outline-none"
            />
            <button
              onClick={insertFree}
              className="rounded-tc-chip bg-tc-accent px-2 py-1 text-[11px] text-white hover:opacity-90"
            >
              Insert
            </button>
          </div>
        )}
        {pickerOpen && (
          <FieldPicker
            entityKind={entityKind}
            datasheetId={entityDatasheetId ?? undefined}
            datasheetName={datasheetName ?? undefined}
            onPick={insertPicked}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </>
    );
  }
}

function TokenAtom({
  seg,
  onRemove,
}: {
  seg: Extract<TokenSegment, { kind: 'token' }>;
  onRemove: () => void;
}) {
  const tone =
    seg.source === 'datasheet'
      ? 'bg-tc-accent-soft text-tc-accent'
      : seg.source === 'contact'
        ? 'bg-tc-info-soft text-tc-info'
        : seg.source === 'universal'
          ? 'bg-tc-bg-card-2 text-tc-ink-2'
          : 'bg-tc-warn-soft text-tc-warn';
  const Icon =
    seg.source === 'datasheet'
      ? Database
      : seg.source === 'contact'
        ? User
        : seg.source === 'universal'
          ? Sparkles
          : Braces;
  return (
    <span
      contentEditable={false}
      className={`inline-flex items-center gap-1 rounded-tc-chip px-1.5 py-0.5 font-mono text-[11px] ${tone}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {seg.path}
      {seg.removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${seg.path}`}
          className="ml-0.5 rounded-full hover:bg-black/10"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

export { emptyDoc };
