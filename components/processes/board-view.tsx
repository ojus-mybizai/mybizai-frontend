'use client';

import React, { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, useDroppable, closestCenter,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { BusinessProcess, ProcessEntry, ProcessStage } from '@/services/processes';
import ProcessCard, { type CardDensity } from './process-card';
import { Money, Icon, Pill, EmptyState } from './design-system';

interface Props {
  process: BusinessProcess;
  stages: ProcessStage[];
  entries: ProcessEntry[];
  density: CardDensity;
  selectionMode: boolean;
  selectedIds: Set<number>;
  fit?: boolean;                    // fit-to-screen: stages share width; otherwise horizontal scroll
  onToggleSelect: (id: number) => void;
  onSelectAllInStage?: (stageId: number, entryIds: number[]) => void;
  onMoveEntry: (entryId: number, stageId: number) => void;
  onOpenEntry: (entry: ProcessEntry) => void;
  onQuickWhatsApp?: (entry: ProcessEntry) => void;
  onQuickCall?: (entry: ProcessEntry) => void;
  onRemoveEntry: (id: number) => void;
  onAddEntry: (stageId: number) => void;
}

// 75th-percentile value used to flag "high value" cards
function p75(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.75)] || 0;
}

/** Tiny ring chart for stage win-probability — clearer than bare "60%" text */
function ProbabilityRing({ value, size = 22, color }: { value: number; size?: number; color?: string }) {
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (c * Math.max(0, Math.min(100, value))) / 100;
  return (
    <span
      className="inline-flex items-center justify-center relative flex-shrink-0"
      style={{ width: size, height: size }}
      title={`Win probability: ${value}%`}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" className="text-border-color" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color || 'currentColor'}
          strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <span className="relative text-[9px] font-bold tabular-nums text-text-primary">{value}</span>
    </span>
  );
}

function StageColumn({
  stage, entries, density, selectionMode, selectedIds, valueP75, totalProcessValue, fit,
  onToggleSelect, onSelectAllInStage, onOpen, onQuickWhatsApp, onQuickCall, onRemove, onAdd,
}: {
  stage: ProcessStage;
  entries: ProcessEntry[];
  density: CardDensity;
  selectionMode: boolean;
  selectedIds: Set<number>;
  valueP75: number;
  totalProcessValue: number;
  fit: boolean;
  onToggleSelect: (id: number) => void;
  onSelectAllInStage?: (stageId: number, ids: number[]) => void;
  onOpen: (entry: ProcessEntry) => void;
  onQuickWhatsApp?: (entry: ProcessEntry) => void;
  onQuickCall?: (entry: ProcessEntry) => void;
  onRemove: (id: number) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.id}`, data: { type: 'stage', stage } });

  const sumValue = entries.reduce((s, e) => s + (e.expected_value || 0), 0);
  const wipExceeded = stage.wip_limit != null && entries.length > stage.wip_limit;
  const valueSharePct = totalProcessValue > 0 ? Math.round((sumValue / totalProcessValue) * 100) : 0;

  const isCompleted = stage.stage_type === 'completed';
  const isFailed = stage.stage_type === 'failed';
  const isTerminal = isCompleted || isFailed;

  const accent = stage.color || (isCompleted ? '#10B981' : isFailed ? '#EF4444' : '#6B7280');

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg overflow-hidden transition-card border bg-bg-secondary/40
        ${fit ? 'flex-1 min-w-[240px]' : 'w-[300px] flex-shrink-0'}
        ${isOver ? 'border-accent ring-2 ring-accent/40 bg-accent/5' : 'border-border-color'}
      `}
      data-stage-id={stage.id}
    >
      {/* Stage header */}
      <div className="relative bg-card-bg border-b border-border-color">
        {/* Thicker color rail — was 1px, now 3px and full width */}
        <div className="h-[3px]" style={{ background: accent }} />

        <div className="px-3 pt-2.5 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            {stage.win_probability != null && !isTerminal && (
              <ProbabilityRing value={stage.win_probability} color={accent} />
            )}
            {isTerminal && (
              <span
                className="inline-flex items-center justify-center h-[22px] w-[22px] rounded-full flex-shrink-0"
                style={{ background: `${accent}20`, color: accent }}
                title={isCompleted ? 'Completed stage' : 'Failed stage'}
              >
                <Icon.check size={12} />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] font-semibold text-text-primary truncate leading-tight">{stage.name}</h3>
              <div className="flex items-center gap-1.5 text-[10px] text-text-secondary mt-0.5">
                <span className={`tabular-nums font-medium ${wipExceeded ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {entries.length}{stage.wip_limit ? `/${stage.wip_limit}` : ''} {entries.length === 1 ? 'entry' : 'entries'}
                </span>
                {stage.auto_advance_on_complete && (
                  <span title="Auto-advances when stage work is complete" className="inline-flex items-center text-amber-500">
                    <Icon.bolt size={9} />
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0.5 text-text-secondary flex-shrink-0">
              {selectionMode && entries.length > 0 && onSelectAllInStage && (
                <button
                  onClick={() => onSelectAllInStage(stage.id, entries.map(e => e.id))}
                  className="text-[10px] px-1.5 py-0.5 rounded text-accent hover:bg-accent/10 font-medium"
                >
                  All
                </button>
              )}
              <button
                onClick={onAdd}
                className="p-1 rounded hover:bg-bg-secondary hover:text-text-primary transition-quick"
                title={`Add to ${stage.name}`}
                aria-label={`Add entry to ${stage.name}`}
              >
                <Icon.plus size={13} />
              </button>
            </div>
          </div>

          {/* Value bar — kept but tighter */}
          {sumValue > 0 && (
            <div className="mt-2">
              <div className="flex items-baseline justify-between gap-2">
                <Money value={sumValue} compact size="sm" tone="success" />
                <span className="text-[10px] text-text-secondary tabular-nums flex-shrink-0">{valueSharePct}%</span>
              </div>
              <div className="mt-1 h-[3px] rounded-full bg-bg-secondary overflow-hidden">
                <div
                  className="h-full transition-card"
                  style={{ width: `${Math.min(100, valueSharePct)}%`, background: accent }}
                />
              </div>
            </div>
          )}

          {wipExceeded && (
            <div className="mt-1.5">
              <Pill tone="danger" size="xs" icon={<Icon.alert size={9} />}>WIP exceeded</Pill>
            </div>
          )}
        </div>
      </div>

      {/* Cards lane */}
      <div className={`flex-1 ${isTerminal ? 'bg-bg-secondary/20' : 'bg-bg-secondary/40'} px-1.5 py-1.5 min-h-[100px]`}>
        <SortableContext items={entries.map(e => `entry:${e.id}`)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {entries.map(entry => (
              <ProcessCard
                key={entry.id}
                entry={entry}
                density={density}
                emphasized={valueP75 > 0 && (entry.expected_value || 0) >= valueP75}
                slaDays={stage.sla_days}
                stageColor={accent}
                selected={selectedIds.has(entry.id)}
                selectionMode={selectionMode}
                onToggleSelect={onToggleSelect}
                onOpen={onOpen}
                onQuickWhatsApp={onQuickWhatsApp}
                onQuickCall={onQuickCall}
                onRemove={onRemove}
              />
            ))}
            {entries.length === 0 && (
              <button
                onClick={onAdd}
                className={`w-full rounded-md border border-dashed py-5 text-center transition-card
                  ${isOver
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-border-color/50 text-text-secondary/50 hover:border-accent/40 hover:text-accent hover:bg-accent/5'}
                `}
              >
                <p className="text-[11px] font-medium">
                  {isOver ? `Drop here` : isTerminal ? 'Empty' : '+ Add or drop here'}
                </p>
              </button>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

/** Tiny chevron between stages to imply flow direction */
function FlowArrow() {
  return (
    <div className="flex items-center text-border-color self-stretch px-0.5 pt-12 flex-shrink-0" aria-hidden="true">
      <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
        <path d="M2 2 L8 7 L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function BoardView({
  process, stages, entries, density, fit = false,
  selectionMode, selectedIds, onToggleSelect, onSelectAllInStage,
  onMoveEntry, onOpenEntry, onQuickWhatsApp, onQuickCall, onRemoveEntry, onAddEntry,
}: Props) {
  const [activeEntry, setActiveEntry] = useState<ProcessEntry | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const entriesByStage = useMemo(() => {
    const map: Record<number, ProcessEntry[]> = {};
    stages.forEach(s => { map[s.id] = []; });
    entries.forEach(e => { if (e.current_stage_id && map[e.current_stage_id]) map[e.current_stage_id].push(e); });
    return map;
  }, [stages, entries]);

  const valueP75 = useMemo(() => p75(entries.map(e => e.expected_value || 0).filter(v => v > 0)), [entries]);
  const totalProcessValue = useMemo(() => entries.reduce((s, e) => s + (e.expected_value || 0), 0), [entries]);

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as any;
    if (data?.type === 'entry') setActiveEntry(data.entry);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveEntry(null);
    const overData = e.over?.data.current as any;
    const activeData = e.active.data.current as any;
    if (!overData || !activeData || activeData.type !== 'entry') return;
    let targetStageId: number | null = null;
    if (overData.type === 'stage') targetStageId = overData.stage.id;
    else if (overData.type === 'entry') targetStageId = overData.entry.current_stage_id;
    if (!targetStageId) return;
    const entry: ProcessEntry = activeData.entry;
    if (entry.current_stage_id === targetStageId) return;
    onMoveEntry(entry.id, targetStageId);
  }

  if (stages.length === 0) {
    return (
      <EmptyState
        icon="🪜"
        title="No stages yet"
        body="Switch to Settings to add stages before you can move entries through the pipeline."
      />
    );
  }

  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={`flex items-stretch gap-1 pb-4 ${fit ? '' : 'overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6'}`}>
        {sortedStages.map((stage, idx) => (
          <React.Fragment key={stage.id}>
            <StageColumn
              stage={stage}
              entries={entriesByStage[stage.id] || []}
              density={density}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              valueP75={valueP75}
              totalProcessValue={totalProcessValue}
              fit={fit}
              onToggleSelect={onToggleSelect}
              onSelectAllInStage={onSelectAllInStage}
              onOpen={onOpenEntry}
              onQuickWhatsApp={onQuickWhatsApp}
              onQuickCall={onQuickCall}
              onRemove={onRemoveEntry}
              onAdd={() => onAddEntry(stage.id)}
            />
            {idx < sortedStages.length - 1 && <FlowArrow />}
          </React.Fragment>
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }}>
        {activeEntry && (
          <div className="rounded-md ring-2 ring-accent bg-card-bg p-3 shadow-2xl w-[260px] cursor-grabbing rotate-1">
            <p className="text-[13px] font-semibold text-text-primary truncate">
              {activeEntry.title || activeEntry.entity_name}
            </p>
            {activeEntry.expected_value != null && (
              <div className="mt-1"><Money value={activeEntry.expected_value} compact tone="success" /></div>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
