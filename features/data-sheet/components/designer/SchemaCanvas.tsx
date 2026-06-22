'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Check, ChevronDown, ChevronRight, Plus, Trash2, Loader2, Database, Users, Table2 } from 'lucide-react';
import { useDesignerStore } from '@/lib/datasheet-designer-store';
import {
  DATASHEET_FIELD_TYPES,
  RELATION_KINDS,
  BUILTIN_TARGETS,
  type DatasheetSpec,
  type FieldSpec,
} from '@/services/datasheet-builder';

const keyOf = (s: string) => s.trim().toLowerCase();

interface Line { x1: number; y1: number; x2: number; y2: number }

interface RefNode {
  key: string;       // matches a relation_target, e.g. '@contacts' or an existing sheet name
  title: string;
  subtitle: string;
  fields: string[];
  kind: 'contacts' | 'datasheet';
  slug?: string;     // existing datasheet slug (for the Edit action)
}

export default function SchemaCanvas() {
  const { design, context, applied, applyingSheet, busyAll, updateSheet, removeSheet, editExisting, applyOne, applyEverything } =
    useDesignerStore(
      useShallow((s) => ({
        design: s.design,
        context: s.context,
        applied: s.applied,
        applyingSheet: s.applyingSheet,
        busyAll: s.busyAll,
        updateSheet: s.updateSheet,
        removeSheet: s.removeSheet,
        editExisting: s.editExisting,
        applyOne: s.applyOne,
        applyEverything: s.applyEverything,
      }))
    );

  // slugs of existing datasheets (so a design card knows it's an edit, not new)
  const existingByKey = new Map((context?.existing_datasheets ?? []).map((d) => [keyOf(d.display_name), d.slug]));

  const boardRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  const sheets = design?.datasheets ?? [];
  const sheetKeys = sheets.map((s) => keyOf(s.display_name)).join('|');
  const expandedKeys = Object.entries(expanded).filter(([, v]) => v).map(([k]) => k).join('|');

  // Sheets currently in the design (being created/edited) — don't also show as refs.
  const inDesign = new Set(sheets.map((s) => keyOf(s.display_name)));

  // Prebuilt Contacts + existing datasheets shown as reference nodes (so links draw
  // and existing sheets can be picked for editing).
  const refNodes: RefNode[] = [];
  if (context?.contact_model) {
    refNodes.push({
      key: '@contacts',
      title: 'Contacts',
      subtitle: 'Prebuilt · communication',
      fields: [
        ...context.contact_model.standard_fields,
        ...context.contact_model.custom_fields.map((f) => f.name),
      ],
      kind: 'contacts',
    });
  }
  (context?.existing_datasheets ?? []).forEach((d) => {
    if (inDesign.has(keyOf(d.display_name))) return; // it's being edited below
    refNodes.push({
      key: keyOf(d.display_name),
      title: d.display_name,
      subtitle: 'Existing datasheet',
      fields: d.fields.map((f) => f.display_name),
      kind: 'datasheet',
      slug: d.slug,
    });
  });
  const refKeys = refNodes.map((n) => n.key).join('|');

  const recompute = useCallback(() => {
    const board = boardRef.current;
    if (!board || !design) return;
    const brect = board.getBoundingClientRect();
    const rectOf = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return {
        cx: r.left - brect.left + board.scrollLeft + r.width / 2,
        cy: r.top - brect.top + board.scrollTop + r.height / 2,
      };
    };
    const next: Line[] = [];
    design.datasheets.forEach((sheet) => {
      const src = cardRefs.current.get(keyOf(sheet.display_name));
      if (!src) return;
      const s = rectOf(src);
      sheet.fields.forEach((f) => {
        if (f.field_type !== 'relation' || !f.relation_target) return;
        const tgt = cardRefs.current.get(keyOf(f.relation_target));
        if (!tgt) return; // builtin / external target — no line
        const t = rectOf(tgt);
        next.push({ x1: s.cx, y1: s.cy, x2: t.cx, y2: t.cy });
      });
    });
    setLines(next);
    setSvgSize({ w: board.scrollWidth, h: board.scrollHeight });
  }, [design]);

  useLayoutEffect(() => {
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetKeys, expandedKeys, refKeys, recompute]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(board);
    window.addEventListener('resize', recompute);
    board.addEventListener('scroll', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
      board.removeEventListener('scroll', recompute);
    };
  }, [recompute]);

  const hasDesign = sheets.length > 0;
  if (!hasDesign && refNodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-text-secondary">
        <Database className="h-10 w-10 opacity-40" />
        <p className="max-w-xs text-sm">
          Your database design will appear here. Describe your business in the chat and I&apos;ll design the datasheets and how they connect.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center justify-between gap-3 border-b border-border-color px-5 py-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Proposed database design</h2>
          <p className="text-xs text-text-secondary">
            {hasDesign
              ? `${sheets.length} datasheet${sheets.length === 1 ? '' : 's'} · click a card to edit its fields`
              : 'Describe your business in the chat to design your datasheets'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void applyEverything()}
          disabled={busyAll || !hasDesign}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busyAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Create all
        </button>
      </div>

      {/* board */}
      <div ref={boardRef} className="relative flex-1 overflow-auto p-5">
        {/* relation lines (behind the opaque cards) */}
        <svg
          className="pointer-events-none absolute left-0 top-0 z-0"
          width={svgSize.w}
          height={svgSize.h}
        >
          <defs>
            <marker id="ds-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" className="fill-accent/60" />
            </marker>
          </defs>
          {lines.map((l, i) => (
            <line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              className="stroke-accent/50"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              markerEnd="url(#ds-arrow)"
            />
          ))}
        </svg>

        <div className="relative z-10 space-y-5">
          {/* prebuilt + existing entities the new sheets connect to */}
          {refNodes.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                On your platform
              </div>
              <div className="flex flex-wrap gap-5">
                {refNodes.map((n) => (
                  <ReferenceCard
                    key={n.key}
                    node={n}
                    onEdit={n.kind === 'datasheet' && n.slug ? () => editExisting(n.slug as string) : undefined}
                    registerRef={(el) => {
                      if (el) cardRefs.current.set(n.key, el);
                      else cardRefs.current.delete(n.key);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* proposed datasheets */}
          {hasDesign ? (
            <div className="flex flex-wrap content-start gap-5">
              {sheets.map((sheet) => (
                <SheetCard
                  key={keyOf(sheet.display_name)}
                  sheet={sheet}
                  allSheetNames={sheets.map((s) => s.display_name)}
                  isExisting={existingByKey.has(keyOf(sheet.display_name))}
                  isApplied={keyOf(sheet.display_name) in applied}
                  isApplying={applyingSheet === keyOf(sheet.display_name)}
                  expanded={!!expanded[keyOf(sheet.display_name)]}
                  onToggle={() =>
                    setExpanded((e) => ({ ...e, [keyOf(sheet.display_name)]: !e[keyOf(sheet.display_name)] }))
                  }
                  onApply={() => void applyOne(sheet.display_name)}
                  onRemove={() => removeSheet(sheet.display_name)}
                  onChange={(updater) => updateSheet(sheet.display_name, updater)}
                  registerRef={(el) => {
                    if (el) cardRefs.current.set(keyOf(sheet.display_name), el);
                    else cardRefs.current.delete(keyOf(sheet.display_name));
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="max-w-sm text-sm text-text-secondary">
              Your proposed datasheets will appear here and connect to the items above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── read-only reference card (prebuilt Contacts / existing datasheets) ─

function ReferenceCard({
  node, onEdit, registerRef,
}: {
  node: RefNode;
  onEdit?: () => void;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const Icon = node.kind === 'contacts' ? Users : Table2;
  const shown = node.fields.slice(0, 6);
  return (
    <div
      ref={registerRef}
      className="w-60 shrink-0 overflow-hidden rounded-xl border border-dashed border-accent/40 bg-accent/5"
    >
      <div className="flex items-center gap-2 border-b border-accent/20 px-3 py-2">
        <Icon className="h-4 w-4 text-accent" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold text-text-primary">{node.title}</div>
          <div className="text-[10px] text-text-secondary">{node.subtitle}</div>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-md border border-accent/40 px-2 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/10"
          >
            Edit
          </button>
        )}
      </div>
      <ul className="px-3 py-1.5">
        {shown.map((f, i) => (
          <li key={i} className="truncate py-0.5 text-xs text-text-secondary">{f}</li>
        ))}
        {node.fields.length > shown.length && (
          <li className="py-0.5 text-[11px] text-text-secondary/70">+{node.fields.length - shown.length} more</li>
        )}
      </ul>
    </div>
  );
}

// ── one datasheet card ──────────────────────────────────────────────

interface CardProps {
  sheet: DatasheetSpec;
  allSheetNames: string[];
  isExisting: boolean;
  isApplied: boolean;
  isApplying: boolean;
  expanded: boolean;
  onToggle: () => void;
  onApply: () => void;
  onRemove: () => void;
  onChange: (updater: (s: DatasheetSpec) => DatasheetSpec) => void;
  registerRef: (el: HTMLDivElement | null) => void;
}

function SheetCard({
  sheet, allSheetNames, isExisting, isApplied, isApplying, expanded, onToggle, onApply, onRemove, onChange, registerRef,
}: CardProps) {
  const setField = (i: number, u: Partial<FieldSpec>) =>
    onChange((s) => ({ ...s, fields: s.fields.map((f, idx) => (idx === i ? { ...f, ...u } : f)) }));
  const addField = () =>
    onChange((s) => ({ ...s, fields: [...s.fields, { display_name: '', field_type: 'text', is_required: false }] }));
  const removeField = (i: number) =>
    onChange((s) => ({ ...s, fields: s.fields.filter((_, idx) => idx !== i) }));

  const relationTargets = [...allSheetNames.filter((n) => keyOf(n) !== keyOf(sheet.display_name)), ...BUILTIN_TARGETS];

  return (
    <div
      ref={registerRef}
      className="w-72 shrink-0 overflow-hidden rounded-xl border border-border-color bg-card-bg shadow-sm"
    >
      {/* header */}
      <div className="flex items-center gap-2 border-b border-border-color bg-bg-secondary/50 px-3 py-2">
        <button type="button" onClick={onToggle} className="text-text-secondary hover:text-text-primary">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <input
          value={sheet.display_name}
          onChange={(e) => onChange((s) => ({ ...s, display_name: e.target.value }))}
          readOnly={isExisting}
          title={isExisting ? 'Existing datasheet — name cannot be changed here' : undefined}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text-primary outline-none"
        />
        {isExisting && !isApplied && (
          <span className="shrink-0 rounded-full bg-bg-secondary px-2 py-0.5 text-[10px] font-medium text-text-secondary">
            Existing
          </span>
        )}
        {isApplied ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
            <Check className="h-3 w-3" /> {isExisting ? 'Saved' : 'Created'}
          </span>
        ) : (
          <button
            type="button"
            onClick={onApply}
            disabled={isApplying}
            className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {isApplying && <Loader2 className="h-3 w-3 animate-spin" />} {isExisting ? 'Save changes' : 'Create'}
          </button>
        )}
      </div>

      {/* collapsed: field summary */}
      {!expanded ? (
        <ul className="divide-y divide-border-color/60">
          {sheet.fields.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
              <span className="truncate text-text-primary">
                {f.display_name || <em className="text-text-secondary">unnamed</em>}
                {f.is_required && <span className="ml-1 text-accent">*</span>}
              </span>
              <span className="shrink-0 text-text-secondary">
                {f.field_type === 'relation' ? `→ ${f.relation_target ?? '?'}` : f.field_type}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        // expanded: editable fields
        <div className="space-y-2 p-3">
          {sheet.fields.map((f, i) => (
            <div key={i} className="rounded-lg border border-border-color bg-bg-primary p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  value={f.display_name}
                  onChange={(e) => setField(i, { display_name: e.target.value })}
                  placeholder="Field"
                  className="min-w-0 flex-1 rounded border border-border-color bg-bg-primary px-1.5 py-1 text-xs text-text-primary"
                />
                <select
                  value={f.field_type}
                  onChange={(e) => setField(i, { field_type: e.target.value as FieldSpec['field_type'] })}
                  className="rounded border border-border-color bg-bg-primary px-1 py-1 text-xs text-text-primary"
                >
                  {DATASHEET_FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <label className="flex items-center gap-0.5 text-[10px] text-text-secondary" title="Required">
                  <input
                    type="checkbox"
                    checked={f.is_required ?? false}
                    onChange={(e) => setField(i, { is_required: e.target.checked })}
                  />
                  *
                </label>
                <button type="button" onClick={() => removeField(i)} className="text-text-secondary hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {(f.field_type === 'enum' || f.field_type === 'multi_select') && (
                <input
                  value={(f.options ?? []).join(', ')}
                  onChange={(e) => setField(i, { options: e.target.value.split(',').map((o) => o.trimStart()) })}
                  placeholder="Options, comma separated"
                  className="block w-full rounded border border-border-color bg-bg-primary px-1.5 py-1 text-[11px] text-text-primary"
                />
              )}

              {f.field_type === 'relation' && (
                <div className="flex gap-1.5">
                  <select
                    value={f.relation_target ?? ''}
                    onChange={(e) => setField(i, { relation_target: e.target.value })}
                    className="min-w-0 flex-1 rounded border border-border-color bg-bg-primary px-1 py-1 text-[11px] text-text-primary"
                  >
                    <option value="">— links to —</option>
                    {relationTargets.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    {f.relation_target && !relationTargets.some((t) => keyOf(t) === keyOf(f.relation_target!)) && (
                      <option value={f.relation_target}>{f.relation_target}</option>
                    )}
                  </select>
                  <select
                    value={f.relation_kind ?? 'many_to_one'}
                    onChange={(e) => setField(i, { relation_kind: e.target.value as FieldSpec['relation_kind'] })}
                    className="rounded border border-border-color bg-bg-primary px-1 py-1 text-[11px] text-text-primary"
                  >
                    {RELATION_KINDS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={addField}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80"
            >
              <Plus className="h-3.5 w-3.5" /> Add field
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove sheet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
