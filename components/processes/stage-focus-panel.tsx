'use client';

// A full-width panel for a single stage. Replaces the multi-column board when
// the user focuses on one stage (via funnel ribbon or column header). Lets the
// user pick a view mode (cards / list / calendar) per stage — the pick sticks
// per (processId, stageId) in localStorage.

import { useMemo, useState } from 'react';
import type {
  BusinessProcess, ProcessEntry, ProcessStage,
} from '@/services/processes';
import ProcessCard, { type CardDensity } from './process-card';
import { Icon, Money, Pill, EmptyState, formatNumber } from './design-system';
import { ListView } from '@/features/data-sheet/components/list-view';
import CalendarView from '@/features/data-sheet/components/calendar-view';
import {
  ENTRY_FIELDS, ENTRY_TITLE_FIELD, ENTRY_DEFAULT_DETAIL_FIELDS,
  ENTRY_CALENDAR_DATE_FIELD, ENTRY_CALENDAR_PILL_FIELDS,
  entriesToItems,
} from './entry-view-adapter';

export type StageViewMode = 'cards' | 'list' | 'calendar';

interface Props {
  process: BusinessProcess;
  stage: ProcessStage;
  entries: ProcessEntry[];
  totalActive: number;
  density: CardDensity;
  viewMode: StageViewMode;
  onViewModeChange: (m: StageViewMode) => void;
  selectionMode: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onOpenEntry: (entry: ProcessEntry) => void;
  onQuickWhatsApp?: (entry: ProcessEntry) => void;
  onQuickCall?: (entry: ProcessEntry) => void;
  onRemoveEntry: (id: number) => void;
  onAddEntry: (stageId: number) => void;
  onClearFocus: () => void;
}

const VIEW_TABS: { key: StageViewMode; label: string; icon: React.ReactNode }[] = [
  { key: 'cards',    label: 'Cards',    icon: <Icon.grid size={12} /> },
  { key: 'list',     label: 'List',     icon: <Icon.list size={12} /> },
  { key: 'calendar', label: 'Calendar', icon: <Icon.clock size={12} /> },
];

export default function StageFocusPanel({
  process, stage, entries, totalActive, density,
  viewMode, onViewModeChange,
  selectionMode, selectedIds, onToggleSelect,
  onOpenEntry, onQuickWhatsApp, onQuickCall, onRemoveEntry, onAddEntry, onClearFocus,
}: Props) {
  const sumValue = useMemo(
    () => entries.reduce((s, e) => s + (e.expected_value || 0), 0),
    [entries],
  );
  const stuck = useMemo(
    () => entries.filter(e => e.sla_status === 'warn' || e.sla_status === 'breach').length,
    [entries],
  );
  const accent = stage.color
    || (stage.stage_type === 'completed' ? '#10B981'
        : stage.stage_type === 'failed' ? '#EF4444'
        : '#6B7280');
  const wipExceeded = stage.wip_limit != null && entries.length > stage.wip_limit;

  return (
    <div className="rounded-2xl border border-border-color bg-card-bg overflow-hidden shadow-sm">
      {/* Header — identity + metrics + view picker */}
      <div className="border-b border-border-color">
        <div className="h-[3px] w-full" style={{ background: accent }} />
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onClearFocus}
            className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium rounded-lg border border-border-color text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-quick"
            title="Show all stages"
          >
            <Icon.back size={12} /> All stages
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: accent }} />
              <h2 className="text-lg font-semibold text-text-primary truncate leading-tight">{stage.name}</h2>
              {stage.stage_type === 'completed' && <Pill tone="success" size="xs">Completed</Pill>}
              {stage.stage_type === 'failed' && <Pill tone="danger" size="xs">Failed</Pill>}
              {stage.auto_advance_on_complete && (
                <Pill tone="accent" size="xs" icon={<Icon.bolt size={9} />}>Auto-advance</Pill>
              )}
              {wipExceeded && <Pill tone="danger" size="xs" icon={<Icon.alert size={9} />}>WIP exceeded</Pill>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
              <span className="tabular-nums">
                <span className="font-semibold text-text-primary">{formatNumber(entries.length)}</span>
                {stage.wip_limit ? <span> / {stage.wip_limit}</span> : null}
                {' '}{entries.length === 1 ? 'entry' : 'entries'}
              </span>
              {totalActive > 0 && (
                <span className="tabular-nums text-text-secondary/70">
                  · {Math.round((entries.length / totalActive) * 100)}% of pipeline
                </span>
              )}
              {sumValue > 0 && (
                <>
                  <span className="text-text-secondary/40">·</span>
                  <Money value={sumValue} compact size="sm" tone="success" />
                </>
              )}
              {stuck > 0 && (
                <>
                  <span className="text-text-secondary/40">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" /> {stuck} stuck
                  </span>
                </>
              )}
              {stage.sla_days != null && (
                <span className="text-text-secondary/70">· SLA {stage.sla_days}d</span>
              )}
            </div>
          </div>

          {/* View mode picker */}
          <div className="flex items-center rounded-lg border border-border-color overflow-hidden h-8 flex-shrink-0">
            {VIEW_TABS.map((t, i) => (
              <button
                key={t.key}
                onClick={() => onViewModeChange(t.key)}
                aria-pressed={viewMode === t.key}
                className={`inline-flex items-center gap-1 px-2.5 h-full text-xs font-medium transition-quick whitespace-nowrap
                  ${i > 0 ? 'border-l border-border-color' : ''}
                  ${viewMode === t.key ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'}
                `}
                title={`${t.label} view`}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => onAddEntry(stage.id)}
            className="inline-flex items-center gap-1 h-8 px-3 text-xs font-semibold rounded-lg bg-accent text-white hover:opacity-90 transition-quick flex-shrink-0"
          >
            <Icon.plus size={12} /> Add
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        {entries.length === 0 ? (
          <EmptyState
            icon="📭"
            title={`${stage.name} is empty`}
            body="Drop or add an entry to start moving work through this stage."
            action={
              <button
                onClick={() => onAddEntry(stage.id)}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg bg-accent text-white hover:opacity-90 transition-quick"
              >
                <Icon.plus size={12} /> Add to {stage.name}
              </button>
            }
          />
        ) : viewMode === 'cards' ? (
          <CardsView
            entries={entries}
            density={density}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            stageColor={accent}
            slaDays={stage.sla_days}
            onToggleSelect={onToggleSelect}
            onOpen={onOpenEntry}
            onQuickWhatsApp={onQuickWhatsApp}
            onQuickCall={onQuickCall}
            onRemove={onRemoveEntry}
          />
        ) : viewMode === 'list' ? (
          <ListViewShell
            entries={entries}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onOpen={onOpenEntry}
            onRemove={onRemoveEntry}
          />
        ) : (
          <CalendarViewShell
            entries={entries}
            onOpen={onOpenEntry}
          />
        )}
      </div>
    </div>
  );
}

// ─── Cards view — reuse ProcessCard in a responsive grid ────────────────────

function CardsView({
  entries, density, selectionMode, selectedIds, stageColor, slaDays,
  onToggleSelect, onOpen, onQuickWhatsApp, onQuickCall, onRemove,
}: {
  entries: ProcessEntry[];
  density: CardDensity;
  selectionMode: boolean;
  selectedIds: Set<number>;
  stageColor: string;
  slaDays?: number | null;
  onToggleSelect: (id: number) => void;
  onOpen: (e: ProcessEntry) => void;
  onQuickWhatsApp?: (e: ProcessEntry) => void;
  onQuickCall?: (e: ProcessEntry) => void;
  onRemove: (id: number) => void;
}) {
  const values = entries.map(e => e.expected_value || 0).filter(v => v > 0).sort((a, b) => a - b);
  const p75 = values.length ? values[Math.floor(values.length * 0.75)] || 0 : 0;

  return (
    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {entries.map(entry => (
        <ProcessCard
          key={entry.id}
          entry={entry}
          density={density}
          emphasized={p75 > 0 && (entry.expected_value || 0) >= p75}
          slaDays={slaDays ?? undefined}
          stageColor={stageColor}
          selected={selectedIds.has(entry.id)}
          selectionMode={selectionMode}
          onToggleSelect={onToggleSelect}
          onOpen={onOpen}
          onQuickWhatsApp={onQuickWhatsApp}
          onQuickCall={onQuickCall}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

// ─── List view — reuse the datasheet ListView via adapter ───────────────────

function ListViewShell({
  entries, selectedIds, onToggleSelect, onOpen, onRemove,
}: {
  entries: ProcessEntry[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onOpen: (e: ProcessEntry) => void;
  onRemove: (id: number) => void;
}) {
  const items = useMemo(() => entriesToItems(entries), [entries]);
  const byId = useMemo(() => {
    const m = new Map<number, ProcessEntry>();
    entries.forEach(e => m.set(e.id, e));
    return m;
  }, [entries]);
  return (
    <ListView
      items={items as any}
      fields={ENTRY_FIELDS}
      config={{ titleField: ENTRY_TITLE_FIELD, detailFields: ENTRY_DEFAULT_DETAIL_FIELDS }}
      selectedIds={selectedIds}
      onToggleSelect={onToggleSelect}
      onViewDetail={(row) => {
        const e = byId.get(row.id);
        if (e) onOpen(e);
      }}
      onDeleteRow={onRemove}
    />
  );
}

// ─── Calendar view — reuse the datasheet CalendarView via adapter ───────────

function CalendarViewShell({
  entries, onOpen,
}: {
  entries: ProcessEntry[];
  onOpen: (e: ProcessEntry) => void;
}) {
  const items = useMemo(() => entriesToItems(entries), [entries]);
  const byId = useMemo(() => {
    const m = new Map<number, ProcessEntry>();
    entries.forEach(e => m.set(e.id, e));
    return m;
  }, [entries]);
  // Local state — user can override the pill title/secondary from CalendarView's own UI.
  const [config, setConfig] = useState({
    dateField: ENTRY_CALENDAR_DATE_FIELD,
    pillFields: ENTRY_CALENDAR_PILL_FIELDS,
    titleField: 'title',
    secondaryField: 'priority',
  });
  return (
    <CalendarView
      items={items as any}
      fields={ENTRY_FIELDS}
      config={config}
      onConfigChange={setConfig}
      onViewDetail={(row) => {
        const e = byId.get(row.id);
        if (e) onOpen(e);
      }}
    />
  );
}
