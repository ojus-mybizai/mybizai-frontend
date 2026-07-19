'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { Columns3 } from 'lucide-react';
import type { DynamicField } from '@/services/dynamic-data';
import type { QueryResponse } from '@/features/data-sheet/api';
import type { KanbanViewConfig } from '@/features/data-sheet/state/view-state';
import { FieldDisplay } from '@/components/data-sheet/field-display';
import { valueColor, HUES, type ValueColor } from '@/components/data-sheet/value-colors';

type RecordItem = QueryResponse['items'][number];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isEmptyValue(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

const UNCATEGORIZED = '__uncategorized__';

/* ------------------------------------------------------------------ */
/*  Droppable Column                                                   */
/* ------------------------------------------------------------------ */

function KanbanColumn({
  columnId,
  label,
  color,
  children,
  count,
}: {
  columnId: string;
  label: string;
  color: ValueColor;
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-[264px] max-w-[300px] flex-1 flex-col overflow-hidden rounded-2xl border bg-bg-secondary/40
        max-h-[calc(100vh-280px)] transition-colors
        ${isOver ? 'border-accent ring-2 ring-accent/30 bg-accent/[0.04]' : 'border-border-color'}`}
    >
      {/* Coloured identity rail */}
      <div className={`h-1 w-full ${color.dot}`} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${color.dot}`} aria-hidden />
        <span className={`inline-flex min-w-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${color.chip}`}>
          <span className="truncate">{label}</span>
        </span>
        <span className="ml-auto rounded-full bg-bg-primary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-secondary">
          {count}
        </span>
      </div>

      {/* Cards lane */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-3">
        {children}
        {count === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-color/70 py-8 text-center">
            <p className="text-xs text-text-secondary/70">Drop records here</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Draggable Card                                                     */
/* ------------------------------------------------------------------ */

function KanbanCard({
  record,
  cardFieldNames,
  fields,
  accent,
  onClick,
  overlay = false,
}: {
  record: RecordItem;
  cardFieldNames: string[];
  fields: DynamicField[];
  accent: ValueColor;
  onClick: (row: RecordItem) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: Number(record.id),
  });

  const style: React.CSSProperties | undefined = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const fieldMap = useMemo(() => {
    const m = new Map<string, DynamicField>();
    for (const f of fields) m.set(f.name, f);
    return m;
  }, [fields]);

  // Title: first cardField value
  const title: string = (() => {
    const data = (record.data ?? {}) as Record<string, unknown>;
    for (const fn of cardFieldNames) {
      const val = data[fn];
      if (val !== null && val !== undefined && val !== '') return String(val);
    }
    return String(record.record_key || `#${record.id}`);
  })();

  // Detail fields: remaining cardFields with resolved field meta + value
  const data = (record.data ?? {}) as Record<string, unknown>;
  const details = cardFieldNames.slice(1)
    .map((fn) => ({ name: fn, field: fieldMap.get(fn), value: data[fn] }))
    .filter((d): d is { name: string; field: DynamicField; value: unknown } => !!d.field && !isEmptyValue(d.value));

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onClick(record);
        }
      }}
      className={`group relative overflow-hidden rounded-xl border border-border-color bg-card-bg p-3 pl-3.5 shadow-sm transition-all
        hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md
        ${isDragging && !overlay ? 'opacity-30' : ''}
        ${overlay ? 'rotate-2 shadow-lg' : ''}
        cursor-grab active:cursor-grabbing`}
    >
      {/* Left accent tied to the column hue */}
      <span className={`absolute inset-y-0 left-0 w-1 ${accent.dot}`} aria-hidden />

      <p className="truncate text-sm font-semibold text-text-primary group-hover:text-accent">{title}</p>
      {details.length > 0 && (
        <div className="mt-2 space-y-1">
          {details.slice(0, 3).map((d) => (
            <div key={d.name} className="flex min-w-0 items-center gap-1.5 text-xs">
              <span className="shrink-0 text-text-secondary/70">{d.field.display_name}</span>
              <div className="min-w-0 flex-1 truncate text-right">
                <FieldDisplay field={d.field} value={d.value} density="comfortable" />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 truncate text-[10px] font-medium text-text-secondary/60">{String(record.record_key ?? '')}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Kanban View                                                        */
/* ------------------------------------------------------------------ */

interface KanbanViewProps {
  items: RecordItem[];
  fields: DynamicField[];
  config: KanbanViewConfig;
  onViewDetail: (row: { id: number; data: Record<string, unknown>; recordKey: string }) => void;
  onFieldValueChange: (recordId: number, fieldName: string, newValue: unknown) => Promise<void>;
  onConfigChange: (config: KanbanViewConfig) => void;
}

export default function KanbanView({
  items,
  fields,
  config,
  onViewDetail,
  onFieldValueChange,
  onConfigChange,
}: KanbanViewProps) {
  const [activeRecord, setActiveRecord] = useState<RecordItem | null>(null);
  const [optimistic, setOptimistic] = useState<Record<number, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const enumFields = useMemo(() => fields.filter((f) => f.field_type === 'enum'), [fields]);

  const groupByField = useMemo(
    () => fields.find((f) => f.name === config.groupByField),
    [fields, config.groupByField],
  );

  // Derive columns from enum options or from actual data values
  const columns = useMemo(() => {
    if (!groupByField) return [];
    const options = (groupByField.config?.options as string[]) ?? [];
    if (options.length > 0) return options;
    // Fallback: derive from data
    const vals = new Set<string>();
    for (const item of items) {
      const v = ((item.data ?? {}) as Record<string, unknown>)[groupByField.name];
      if (v !== null && v !== undefined && v !== '') vals.add(String(v));
    }
    return Array.from(vals).sort();
  }, [groupByField, items]);

  // Card fields
  const cardFieldNames = useMemo(() => {
    if (config.cardFields && config.cardFields.length > 0) return config.cardFields;
    return fields
      .filter((f) => !['image', 'file', 'relation', 'long_text'].includes(f.field_type))
      .slice(0, 4)
      .map((f) => f.name);
  }, [config.cardFields, fields]);

  // Stable colour per column value (shared with every other view).
  const colorFor = useCallback(
    (col: string): ValueColor => (col === UNCATEGORIZED ? HUES.slate : valueColor(groupByField ?? null, col)),
    [groupByField],
  );

  // Bucket items by groupByField
  const buckets = useMemo(() => {
    const b: Record<string, RecordItem[]> = {};
    for (const col of columns) b[col] = [];
    b[UNCATEGORIZED] = [];
    for (const item of items) {
      const raw = ((item.data ?? {}) as Record<string, unknown>)[config.groupByField ?? ''];
      const val = optimistic[Number(item.id)] ?? (raw !== null && raw !== undefined ? String(raw) : null);
      if (val && b[val]) {
        b[val].push(item);
      } else {
        b[UNCATEGORIZED].push(item);
      }
    }
    return b;
  }, [items, columns, config.groupByField, optimistic]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const record = items.find((r) => Number(r.id) === Number(event.active.id)) ?? null;
      setActiveRecord(record);
    },
    [items],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveRecord(null);
      const { active, over } = event;
      if (!over || !config.groupByField) return;

      const recordId = active.id as number;
      const newValue = over.id as string;
      if (newValue === UNCATEGORIZED) return;

      const record = items.find((r) => Number(r.id) === recordId);
      if (!record) return;
      const currentValue = optimistic[recordId] ?? String(((record.data ?? {}) as Record<string, unknown>)[config.groupByField] ?? '');
      if (currentValue === newValue) return;

      // Optimistic update
      setOptimistic((prev) => ({ ...prev, [recordId]: newValue }));
      try {
        await onFieldValueChange(recordId, config.groupByField, newValue);
        setOptimistic((prev) => { const next = { ...prev }; delete next[recordId]; return next; });
      } catch {
        setOptimistic((prev) => { const next = { ...prev }; delete next[recordId]; return next; });
      }
    },
    [items, optimistic, config.groupByField, onFieldValueChange],
  );

  const handleRecordClick = useCallback(
    (record: RecordItem) => {
      onViewDetail({ id: Number(record.id), data: (record.data ?? {}) as Record<string, unknown>, recordKey: String(record.record_key ?? '') });
    },
    [onViewDetail],
  );

  /* ── No groupBy field selected ── */
  if (!config.groupByField || !groupByField) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border-color bg-card-bg/50 py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-secondary text-text-secondary">
          <Columns3 className="h-6 w-6" />
        </div>
        <div className="text-center">
          <p className="mb-1 text-sm font-semibold text-text-primary">Group into columns</p>
          <p className="mb-4 text-xs text-text-secondary">Pick a dropdown field to organise records into a board</p>
        </div>
        {enumFields.length === 0 ? (
          <p className="text-xs text-text-secondary">No dropdown fields found in this datasheet</p>
        ) : (
          <select
            className="rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            value=""
            onChange={(e) => onConfigChange({ ...config, groupByField: e.target.value || null })}
          >
            <option value="">Choose a dropdown field...</option>
            {enumFields.map((f) => (
              <option key={f.name} value={f.name}>{f.display_name}</option>
            ))}
          </select>
        )}
      </div>
    );
  }

  const allColumns = buckets[UNCATEGORIZED]?.length > 0
    ? [...columns, UNCATEGORIZED]
    : columns;

  return (
    <div className="flex flex-col gap-3">
      {/* Group-by field selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-secondary">Group by</span>
        <select
          className="rounded-lg border border-border-color bg-card-bg px-2.5 py-1 text-xs font-medium text-text-primary transition-colors hover:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent"
          value={config.groupByField}
          onChange={(e) => onConfigChange({ ...config, groupByField: e.target.value || null })}
        >
          {enumFields.map((f) => (
            <option key={f.name} value={f.name}>{f.display_name}</option>
          ))}
        </select>
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-start gap-3 overflow-x-auto pb-2">
          {allColumns.map((col) => {
            const color = colorFor(col);
            return (
              <KanbanColumn
                key={col}
                columnId={col}
                label={col === UNCATEGORIZED ? 'Uncategorized' : col}
                color={color}
                count={buckets[col]?.length ?? 0}
              >
                {(buckets[col] ?? []).map((record) => (
                  <KanbanCard
                    key={String(record.id)}
                    record={record}
                    cardFieldNames={cardFieldNames}
                    fields={fields}
                    accent={color}
                    onClick={handleRecordClick}
                  />
                ))}
              </KanbanColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeRecord ? (
            <KanbanCard
              record={activeRecord}
              cardFieldNames={cardFieldNames}
              fields={fields}
              accent={colorFor(
                String(((activeRecord.data ?? {}) as Record<string, unknown>)[config.groupByField] ?? UNCATEGORIZED) || UNCATEGORIZED,
              )}
              onClick={() => {}}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
