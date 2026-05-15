'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PermissionGuard from '@/components/permission-guard';
import {
  getProcess, listEntries, moveEntry, removeEntry,
  bulkMoveEntries, bulkAssignEntries, bulkUpdateEntries,
  type BusinessProcess, type ProcessEntry, type ProcessStage,
} from '@/services/processes';
import { listEmployees, type Employee } from '@/services/employees';
import BoardView from '@/components/processes/board-view';
import ListView from '@/components/processes/list-view';
import SettingsView from '@/components/processes/settings-view';
import ForecastView from '@/components/processes/forecast-view';
import InsightsView from '@/components/processes/insights-view';
import FilterBar, { DEFAULT_FILTERS, type FilterState } from '@/components/processes/filter-bar';
import BulkActionBar from '@/components/processes/bulk-action-bar';
import AddEntryModal from '@/components/processes/add-entry-modal';
import EntryDetailDrawer from '@/components/processes/entry-detail-drawer';
import type { CardDensity } from '@/components/processes/process-card';
import {
  Money, Pill, Button, Icon, ToastHost, pushToast, formatNumber, formatCurrency,
} from '@/components/processes/design-system';

type Tab = 'pipeline' | 'forecast' | 'insights' | 'settings';
type PipelineLayout = 'board' | 'list';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'pipeline', label: 'Pipeline', icon: <Icon.grid size={13} /> },
  { key: 'forecast', label: 'Forecast', icon: <Icon.funnel size={13} /> },
  { key: 'insights', label: 'Insights', icon: <Icon.trend size={13} /> },
  { key: 'settings', label: 'Settings', icon: <Icon.gear size={13} /> },
];

// ─── Funnel ribbon ───────────────────────────────────────────────────────────
// A horizontal stage-by-stage flow visualization. Widths are proportional to
// entry-count (so a fat stage = lots stuck there). Color from each stage.
// Click a segment to filter the board to that stage.

interface FunnelRibbonProps {
  stages: ProcessStage[];
  entries: ProcessEntry[];
  activeStageId: number | 'all';
  onStageClick: (stageId: number | 'all') => void;
}

function FunnelRibbon({ stages, entries, activeStageId, onStageClick }: FunnelRibbonProps) {
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.sort_order - b.sort_order).filter(s => s.stage_type === 'active'),
    [stages]
  );

  const perStage = useMemo(() => {
    const map = new Map<number, { count: number; value: number; stuck: number }>();
    sortedStages.forEach(s => map.set(s.id, { count: 0, value: 0, stuck: 0 }));
    for (const e of entries) {
      if (e.status !== 'active' || !e.current_stage_id) continue;
      const slot = map.get(e.current_stage_id);
      if (!slot) continue;
      slot.count += 1;
      slot.value += e.expected_value || 0;
      if (e.sla_status === 'warn' || e.sla_status === 'breach') slot.stuck += 1;
    }
    return map;
  }, [sortedStages, entries]);

  const totalCount = useMemo(
    () => Array.from(perStage.values()).reduce((s, v) => s + v.count, 0),
    [perStage]
  );

  if (sortedStages.length === 0) return null;

  return (
    <div className="rounded-lg border border-border-color bg-card-bg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-color bg-bg-secondary/40">
        <div className="flex items-center gap-1.5">
          <Icon.funnel size={11} />
          <span className="text-[10px] uppercase tracking-wide font-semibold text-text-secondary">
            Flow
          </span>
          <span className="text-[10px] text-text-secondary/70">· click a stage to focus</span>
        </div>
        {activeStageId !== 'all' && (
          <button
            onClick={() => onStageClick('all')}
            className="text-[10px] font-medium text-accent hover:underline"
          >
            Clear focus
          </button>
        )}
      </div>

      <div className="flex items-stretch p-2 gap-1 overflow-x-auto">
        {sortedStages.map((stage, idx) => {
          const s = perStage.get(stage.id) || { count: 0, value: 0, stuck: 0 };
          const sharePct = totalCount > 0 ? (s.count / totalCount) * 100 : 0;
          const flex = Math.max(0.5, 0.5 + sharePct / 100 * 2); // proportional flex
          const color = stage.color || '#6B7280';
          const isActive = activeStageId === stage.id;
          const isDim = activeStageId !== 'all' && !isActive;

          // Conversion to the *next* stage. Lacking historical data, we proxy with count comparison.
          const nextStage = sortedStages[idx + 1];
          const nextCount = nextStage ? (perStage.get(nextStage.id)?.count || 0) : 0;
          const conversionPct = s.count > 0 ? Math.round((nextCount / s.count) * 100) : null;

          return (
            <div key={stage.id} className="flex items-stretch min-w-0" style={{ flex }}>
              <button
                onClick={() => onStageClick(isActive ? 'all' : stage.id)}
                className={`group relative flex-1 min-w-0 rounded-md border text-left p-2 transition-card
                  ${isActive ? 'border-accent shadow-sm bg-accent/5' : 'border-transparent hover:border-border-color hover:bg-bg-secondary/40'}
                  ${isDim ? 'opacity-50' : ''}
                `}
                title={`${stage.name} · ${s.count} entries · ${formatCurrency(s.value, true)}`}
              >
                <div className="flex items-center gap-1.5 mb-1 min-w-0">
                  <span
                    className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-[11px] font-semibold text-text-primary truncate flex-1">
                    {stage.name}
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-bold tabular-nums text-text-primary leading-none">
                    {s.count}
                  </span>
                  <span className="text-[10px] text-text-secondary">
                    {Math.round(sharePct)}%
                  </span>
                </div>

                {s.value > 0 && (
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5 truncate">
                    {formatCurrency(s.value, true)}
                  </p>
                )}

                {/* Proportional fill bar */}
                <div className="mt-1.5 h-1 rounded-full bg-bg-secondary overflow-hidden">
                  <div
                    className="h-full transition-card"
                    style={{ width: `${Math.min(100, sharePct * 3)}%`, background: color }}
                  />
                </div>

                {s.stuck > 0 && (
                  <span className="absolute top-1 right-1 inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                    <span className="inline-block h-1 w-1 rounded-full bg-amber-500" /> {s.stuck}
                  </span>
                )}
              </button>

              {idx < sortedStages.length - 1 && (
                <div className="flex flex-col items-center justify-center px-0.5 text-text-secondary/40 flex-shrink-0">
                  <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden="true">
                    <path d="M2 2 L7 6 L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {conversionPct != null && nextStage && (
                    <span className="text-[9px] font-medium tabular-nums mt-0.5">
                      {conversionPct}%
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProcessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const processId = Number(params.id);

  const [process, setProcess] = useState<BusinessProcess | null>(null);
  const [entries, setEntries] = useState<ProcessEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tab, setTab] = useState<Tab>('pipeline');
  const [layout, setLayout] = useState<PipelineLayout>('board');
  const [fit, setFit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [focusStageId, setFocusStageId] = useState<number | 'all'>('all');
  const [showFunnel, setShowFunnel] = useState(true);

  // Board / list controls
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [density, setDensity] = useState<CardDensity>('standard');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modals
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [addEntryInitialStage, setAddEntryInitialStage] = useState<number | undefined>(undefined);
  const [detailEntry, setDetailEntry] = useState<ProcessEntry | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [proc, ents, emps] = await Promise.all([
        getProcess(processId),
        listEntries(processId),
        listEmployees().catch(() => []),
      ]);
      setProcess(proc);
      setEntries(ents);
      setEmployees(emps.filter(e => e.is_active));
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to load process');
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '/') {
        e.preventDefault();
        const i = document.querySelector<HTMLInputElement>('input[placeholder="Search…"]');
        i?.focus();
      } else if (e.key === 'a' && (tab === 'pipeline')) {
        e.preventDefault();
        setAddEntryInitialStage(undefined);
        setAddEntryOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab]);

  const stages = useMemo(() => process?.stages || [], [process]);

  const activeEntries = useMemo(() => entries.filter(e => e.status === 'active'), [entries]);
  const activeValue = useMemo(() => activeEntries.reduce((s, e) => s + (e.expected_value || 0), 0), [activeEntries]);
  const stuckCount = useMemo(() => activeEntries.filter(e => e.sla_status === 'warn' || e.sla_status === 'breach').length, [activeEntries]);

  // Filtering — applied in pipeline tab
  const filteredEntries = useMemo(() => activeEntries.filter(e => {
    if (focusStageId !== 'all' && e.current_stage_id !== focusStageId) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${e.title || ''} ${e.entity_name || ''} ${e.entity_phone || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.assigneeId === 'unassigned') {
      if (e.assigned_to_id !== null) return false;
    } else if (filters.assigneeId !== 'all') {
      if (e.assigned_to_id !== filters.assigneeId) return false;
    }
    if (filters.priority !== 'all' && e.priority !== filters.priority) return false;
    if (filters.stuckOnly && e.sla_status !== 'warn' && e.sla_status !== 'breach') return false;
    if (filters.minValue !== null && (e.expected_value ?? 0) < filters.minValue) return false;
    if (filters.maxValue !== null && (e.expected_value ?? Infinity) > filters.maxValue) return false;
    return true;
  }), [activeEntries, filters, focusStageId]);

  const filteredValue = useMemo(() => filteredEntries.reduce((s, e) => s + (e.expected_value || 0), 0), [filteredEntries]);

  async function handleMoveEntry(entryId: number, stageId: number) {
    setEntries(prev => prev.map(e => e.id === entryId
      ? { ...e, current_stage_id: stageId, current_stage_name: stages.find(s => s.id === stageId)?.name || e.current_stage_name, stage_entered_at: new Date().toISOString(), days_in_stage: 0 }
      : e));
    try {
      await moveEntry(processId, entryId, stageId);
      pushToast('success', `Moved to ${stages.find(s => s.id === stageId)?.name}`);
    } catch { pushToast('danger', 'Move failed'); loadData(); }
  }

  async function handleRemoveEntry(entryId: number) {
    setEntries(prev => prev.filter(e => e.id !== entryId));
    try { await removeEntry(processId, entryId); pushToast('success', 'Removed'); }
    catch { pushToast('danger', 'Failed'); loadData(); }
  }

  function handleEntryAdded(entry: ProcessEntry) {
    setEntries(prev => [...prev, entry]);
    pushToast('success', `Added "${entry.title || entry.entity_name}"`);
    loadData();
  }
  function handleEntryUpdated(updated: ProcessEntry) {
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    setDetailEntry(updated);
  }

  function handleQuickWhatsApp(entry: ProcessEntry) {
    if (entry.entity_phone) router.push(`/inbox?contact=${entry.entity_id}`);
  }
  function handleQuickCall(entry: ProcessEntry) {
    if (entry.entity_phone) window.location.href = `tel:${entry.entity_phone}`;
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll(ids: number[]) {
    setSelectedIds(prev => {
      const all = ids.every(i => prev.has(i));
      const n = new Set(prev);
      if (all) ids.forEach(i => n.delete(i)); else ids.forEach(i => n.add(i));
      return n;
    });
  }
  function selectAllInStage(_stageId: number, ids: number[]) { toggleSelectAll(ids); }
  function clearSelection() { setSelectedIds(new Set()); }

  async function handleBulkMove(stageId: number) {
    try { await bulkMoveEntries(processId, Array.from(selectedIds), stageId); pushToast('success', `Moved ${selectedIds.size} entries`); }
    catch { pushToast('danger', 'Bulk move failed'); }
    clearSelection(); loadData();
  }
  async function handleBulkAssign(userId: number | null) {
    try { await bulkAssignEntries(processId, Array.from(selectedIds), userId); pushToast('success', 'Reassigned'); }
    catch { pushToast('danger', 'Failed'); }
    clearSelection(); loadData();
  }
  async function handleBulkPriority(priority: 'high' | 'medium' | 'low') {
    try { await bulkUpdateEntries(processId, Array.from(selectedIds), { priority }); pushToast('success', 'Priority updated'); }
    catch { pushToast('danger', 'Failed'); }
    clearSelection(); loadData();
  }
  async function handleBulkDrop() {
    try { await bulkUpdateEntries(processId, Array.from(selectedIds), { status: 'dropped' }); pushToast('success', 'Marked dropped'); }
    catch { pushToast('danger', 'Failed'); }
    clearSelection(); loadData();
  }

  return (
    <PermissionGuard permission="manage_work" module="lms">
      <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
        {/* Breadcrumb */}
        <Link href="/processes" className="inline-flex items-center gap-1 text-[11px] text-text-secondary hover:text-accent transition-quick mb-2">
          <Icon.back size={11} /> Pipelines
        </Link>

        {/* Compact integrated header — single band, info + tabs */}
        {process && (
          <header className="rounded-xl border border-border-color bg-card-bg overflow-hidden mb-3">
            {/* Title row with inline metrics */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border-color">
              {/* Color dot replaces the full color rail — same identity, less chrome */}
              <span
                className="inline-block h-8 w-1.5 rounded-full flex-shrink-0"
                style={{ background: process.color || '#3B82F6' }}
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-text-primary tracking-tight truncate">{process.name}</h1>
                  <Pill tone="neutral" size="xs">
                    {process.entity_type === 'datasheet_record' ? (process.dynamic_model_name || 'Record') : process.entity_type}
                  </Pill>
                  {process.status === 'archived' && <Pill tone="warn" size="xs">Archived</Pill>}
                </div>
                {process.description && (
                  <p className="text-[11px] text-text-secondary truncate mt-0.5">{process.description}</p>
                )}
              </div>

              {/* Inline hero stats — horizontally aligned with title, no extra row */}
              <div className="hidden md:flex items-center gap-5 flex-shrink-0">
                <Stat label="Open" value={<Money value={activeValue} compact size="lg" tone="success" />} />
                <Stat label="Active" value={<span className="text-base font-semibold tabular-nums">{formatNumber(activeEntries.length)}</span>} />
                <Stat label="Stages" value={<span className="text-base font-semibold tabular-nums">{stages.length}</span>} />
                {stuckCount > 0 && (
                  <Stat label="Stuck" value={
                    <span className="text-base font-semibold tabular-nums text-amber-600 dark:text-amber-400">{stuckCount}</span>
                  } />
                )}
              </div>
            </div>

            {/* Mobile stats row */}
            <div className="md:hidden flex items-center gap-4 px-4 py-2 border-b border-border-color overflow-x-auto">
              <Stat label="Open" value={<Money value={activeValue} compact size="sm" tone="success" />} />
              <Stat label="Active" value={<span className="text-sm font-semibold tabular-nums">{formatNumber(activeEntries.length)}</span>} />
              <Stat label="Stages" value={<span className="text-sm font-semibold tabular-nums">{stages.length}</span>} />
              {stuckCount > 0 && (
                <Stat label="Stuck" value={
                  <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">{stuckCount}</span>
                } />
              )}
            </div>

            {/* Tab bar with view controls — integrated as a single strip */}
            <div className="flex items-center justify-between gap-2 px-2 py-1">
              <nav className="flex overflow-x-auto" role="tablist">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={`relative inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-quick whitespace-nowrap focus-visible:outline-none rounded
                      ${tab === t.key ? 'text-accent bg-accent/5' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'}
                    `}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </nav>

              {tab === 'pipeline' && (
                <div className="flex items-center gap-1.5 pr-1">
                  <button
                    onClick={() => setShowFunnel(s => !s)}
                    className={`inline-flex items-center gap-1 px-2 h-7 text-[11px] font-medium rounded-md border transition-quick
                      ${showFunnel ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-bg-primary border-border-color text-text-secondary hover:bg-bg-secondary'}`}
                    title="Toggle funnel ribbon"
                  >
                    <Icon.funnel size={11} />
                    Funnel
                  </button>
                  <div className="flex items-center rounded-md border border-border-color overflow-hidden h-7">
                    <button
                      onClick={() => setLayout('board')}
                      className={`px-2 h-full inline-flex items-center transition-quick ${layout === 'board' ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}
                      title="Board view"
                      aria-pressed={layout === 'board'}
                    >
                      <Icon.grid size={12} />
                    </button>
                    <button
                      onClick={() => setLayout('list')}
                      className={`px-2 h-full inline-flex items-center transition-quick ${layout === 'list' ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}
                      title="List view"
                      aria-pressed={layout === 'list'}
                    >
                      <Icon.list size={12} />
                    </button>
                    {layout === 'board' && (
                      <button
                        onClick={() => setFit(f => !f)}
                        className={`px-2 h-full inline-flex items-center border-l border-border-color transition-quick text-[10px] font-semibold ${fit ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}
                        title={fit ? 'Fit-to-screen ON — stages share width' : 'Fit-to-screen OFF — horizontal scroll'}
                        aria-pressed={fit}
                      >
                        FIT
                      </button>
                    )}
                  </div>
                  <Button variant="primary" icon={<Icon.plus size={12} />}
                    onClick={() => { setAddEntryInitialStage(undefined); setAddEntryOpen(true); }}>
                    Add
                  </Button>
                </div>
              )}
            </div>
          </header>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            <div className="h-12 rounded-md bg-bg-secondary animate-pulse" />
            <div className="flex gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-72 flex-1 rounded-lg bg-bg-secondary animate-pulse" />)}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="mb-3 rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
            <button onClick={loadData} className="ml-2 underline">Retry</button>
          </div>
        )}

        {/* Tab content */}
        {!loading && process && (
          <div className="animate-in fade-in duration-200">
            {tab === 'pipeline' && (
              <div className="space-y-3">
                {/* Funnel ribbon — flow visualization */}
                {showFunnel && (
                  <FunnelRibbon
                    stages={stages}
                    entries={activeEntries}
                    activeStageId={focusStageId}
                    onStageClick={setFocusStageId}
                  />
                )}

                <FilterBar
                  filters={filters}
                  onChange={setFilters}
                  employees={employees}
                  density={density}
                  onDensityChange={setDensity}
                  selectionMode={selectionMode}
                  onSelectionModeToggle={() => { setSelectionMode(s => !s); if (selectionMode) clearSelection(); }}
                  selectedCount={selectedIds.size}
                  resultCount={filteredEntries.length}
                  totalCount={activeEntries.length}
                  totalValue={filteredValue}
                />
                {layout === 'board' ? (
                  <BoardView
                    process={process}
                    stages={stages}
                    entries={filteredEntries}
                    density={density}
                    fit={fit}
                    selectionMode={selectionMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onSelectAllInStage={selectAllInStage}
                    onMoveEntry={handleMoveEntry}
                    onOpenEntry={(e) => setDetailEntry(e)}
                    onQuickWhatsApp={handleQuickWhatsApp}
                    onQuickCall={handleQuickCall}
                    onRemoveEntry={handleRemoveEntry}
                    onAddEntry={(stageId) => { setAddEntryInitialStage(stageId); setAddEntryOpen(true); }}
                  />
                ) : (
                  <ListView
                    stages={stages}
                    entries={filteredEntries}
                    selectionMode={selectionMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onToggleSelectAll={toggleSelectAll}
                    onOpenEntry={(e) => setDetailEntry(e)}
                    onMoveEntry={handleMoveEntry}
                    onRemoveEntry={handleRemoveEntry}
                  />
                )}
              </div>
            )}

            {tab === 'forecast' && <ForecastView processId={processId} entries={activeEntries} />}
            {tab === 'insights' && <InsightsView processId={processId} />}
            {tab === 'settings' && <SettingsView process={process} stages={stages} onReload={loadData} />}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectionMode && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          stages={stages}
          employees={employees}
          onMove={handleBulkMove}
          onAssign={handleBulkAssign}
          onSetPriority={handleBulkPriority}
          onDrop={handleBulkDrop}
          onClear={clearSelection}
        />
      )}

      {/* Add entry */}
      {process && (
        <AddEntryModal
          open={addEntryOpen}
          onClose={() => setAddEntryOpen(false)}
          process={process}
          stages={stages}
          initialStageId={addEntryInitialStage}
          onAdded={handleEntryAdded}
        />
      )}

      {/* Drawer */}
      {detailEntry && (
        <EntryDetailDrawer
          entry={detailEntry}
          stages={stages}
          employees={employees}
          onClose={() => setDetailEntry(null)}
          onUpdated={handleEntryUpdated}
        />
      )}

      <ToastHost />
    </PermissionGuard>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wide text-text-secondary font-semibold leading-tight">{label}</span>
      <div className="leading-tight">{value}</div>
    </div>
  );
}
