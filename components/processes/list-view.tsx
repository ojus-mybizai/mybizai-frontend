'use client';

import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type { ProcessEntry, ProcessStage, EntryPriority } from '@/services/processes';
import { updateEntry } from '@/services/processes';
import {
  Money, Avatar, PriorityDot, Icon, EmptyState, formatDate, pushToast,
} from './design-system';

type SortKey = 'name' | 'stage' | 'value' | 'priority' | 'days_in_stage' | 'expected_close_date' | 'assignee';
type GroupBy = 'none' | 'stage' | 'assignee' | 'priority';

interface Props {
  stages: ProcessStage[];
  entries: ProcessEntry[];
  selectionMode: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: (ids: number[]) => void;
  onOpenEntry: (e: ProcessEntry) => void;
  onMoveEntry: (entryId: number, stageId: number) => void;
  onRemoveEntry: (id: number) => void;
}

const PRIORITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

export default function ListView({
  stages, entries, selectionMode, selectedIds,
  onToggleSelect, onToggleSelectAll, onOpenEntry, onMoveEntry, onRemoveEntry,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'dropped' | 'all'>('active');
  const [stageFilter, setStageFilter] = useState<number | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('days_in_stage');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');

  const filtered = useMemo(() => entries.filter(e => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (stageFilter !== 'all' && e.current_stage_id !== stageFilter) return false;
    return true;
  }), [entries, statusFilter, stageFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'name':    av = (a.title || a.entity_name || '').toLowerCase(); bv = (b.title || b.entity_name || '').toLowerCase(); break;
        case 'stage':   av = a.current_stage_name ?? ''; bv = b.current_stage_name ?? ''; break;
        case 'value':   av = a.expected_value ?? -1; bv = b.expected_value ?? -1; break;
        case 'priority':av = PRIORITY_RANK[a.priority || ''] ?? 0; bv = PRIORITY_RANK[b.priority || ''] ?? 0; break;
        case 'days_in_stage': av = a.days_in_stage ?? -1; bv = b.days_in_stage ?? -1; break;
        case 'expected_close_date': av = a.expected_close_date ?? 'zzzz'; bv = b.expected_close_date ?? 'zzzz'; break;
        case 'assignee':av = a.assigned_wa_employee_name ?? ''; bv = b.assigned_wa_employee_name ?? ''; break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', label: '', items: sorted }];
    const map = new Map<string, { key: string; label: string; items: ProcessEntry[] }>();
    for (const e of sorted) {
      let key = '', label = '';
      if (groupBy === 'stage')    { key = String(e.current_stage_id ?? 'none'); label = e.current_stage_name || 'No stage'; }
      if (groupBy === 'assignee') { key = String(e.assigned_wa_employee_id ?? 'none');   label = e.assigned_wa_employee_name || 'Unassigned'; }
      if (groupBy === 'priority') { key = e.priority || 'none';                  label = e.priority ? e.priority.charAt(0).toUpperCase() + e.priority.slice(1) : 'No priority'; }
      let g = map.get(key);
      if (!g) { g = { key, label, items: [] }; map.set(key, g); }
      g.items.push(e);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [sorted, groupBy]);

  function setSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir(k === 'name' || k === 'stage' || k === 'assignee' ? 'asc' : 'desc'); }
  }
  const arrow = (k: SortKey) => sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : '';

  function handleExport() {
    const rows = sorted.map(e => ({
      Name: e.title || e.entity_name || '',
      Entity: e.entity_name || '',
      Phone: e.entity_phone || '',
      Stage: e.current_stage_name || '',
      Priority: e.priority || '',
      'Expected Value': e.expected_value ?? '',
      'Expected Close': e.expected_close_date || '',
      'Days in Stage': e.days_in_stage ?? '',
      Assignee: e.assigned_wa_employee_name || '',
      Status: e.status,
      Source: e.source || '',
      'Created At': e.created_at || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Entries');
    XLSX.writeFile(wb, `pipeline-entries-${new Date().toISOString().split('T')[0]}.xlsx`);
    pushToast('success', `Exported ${rows.length} entries`);
  }

  const allSelected = sorted.length > 0 && sorted.every(e => selectedIds.has(e.id));

  if (entries.length === 0) {
    return <EmptyState icon="🗂" title="No entries yet" body="Add an entry to start tracking it through the pipeline." />;
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={stageFilter === 'all' ? '' : stageFilter}
          onChange={(e) => setStageFilter(e.target.value ? Number(e.target.value) : 'all')}
          className="px-2.5 py-1.5 text-xs rounded-md border border-border-color bg-card-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All stages</option>
          {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex items-center rounded-md border border-border-color overflow-hidden">
          {(['active','completed','dropped','all'] as const).map(s => (
            <button
              key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-xs font-medium capitalize transition-quick
                ${statusFilter === s ? 'bg-accent text-white' : 'bg-card-bg text-text-secondary hover:bg-bg-secondary'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-[11px] text-text-secondary">Group by</span>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="px-2 py-1.5 text-xs rounded-md border border-border-color bg-card-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent">
            <option value="none">None</option>
            <option value="stage">Stage</option>
            <option value="assignee">Assignee</option>
            <option value="priority">Priority</option>
          </select>
        </div>
        <div className="flex-1" />
        <span className="text-[11px] text-text-secondary">{sorted.length} entries</span>
        <button
          onClick={handleExport}
          className="px-2.5 py-1.5 text-xs rounded-md border border-border-color bg-card-bg hover:bg-bg-secondary text-text-primary transition-quick"
        >
          Export XLSX
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border-color overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary text-text-secondary text-[11px] uppercase tracking-wide">
            <tr>
              {selectionMode && (
                <th className="px-2 py-2 w-8">
                  <input type="checkbox" checked={allSelected}
                    onChange={() => onToggleSelectAll(sorted.map(e => e.id))}
                    className="rounded border-border-color text-accent focus:ring-2 focus:ring-accent" />
                </th>
              )}
              <Th onClick={() => setSort('name')}     label={`Name ${arrow('name')}`} align="left" />
              <Th onClick={() => setSort('stage')}    label={`Stage ${arrow('stage')}`} align="left" />
              <Th onClick={() => setSort('priority')} label={`Priority ${arrow('priority')}`} align="left" />
              <Th onClick={() => setSort('value')}    label={`Value ${arrow('value')}`} align="right" />
              <Th onClick={() => setSort('expected_close_date')} label={`Close ${arrow('expected_close_date')}`} align="left" />
              <Th onClick={() => setSort('days_in_stage')}       label={`In stage ${arrow('days_in_stage')}`} align="right" />
              <Th onClick={() => setSort('assignee')} label={`Assignee ${arrow('assignee')}`} align="left" />
              <th className="px-2 py-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color">
            {groups.map(g => (
              <React.Fragment key={g.key || 'all'}>
                {g.label && (
                  <tr className="bg-bg-secondary/40">
                    <td colSpan={selectionMode ? 9 : 8} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                      {g.label} · <span className="font-normal">{g.items.length}</span>
                    </td>
                  </tr>
                )}
                {g.items.map(e => (
                  <Row
                    key={e.id}
                    e={e}
                    stages={stages}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(e.id)}
                    onToggleSelect={onToggleSelect}
                    onOpen={onOpenEntry}
                    onMove={onMoveEntry}
                    onRemove={onRemoveEntry}
                  />
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ onClick, label, align = 'left' }: { onClick: () => void; label: string; align?: 'left' | 'right' }) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 cursor-pointer hover:text-text-primary select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <span className="font-medium">{label}</span>
    </th>
  );
}

function Row({
  e, stages, selectionMode, selected, onToggleSelect, onOpen, onMove, onRemove,
}: {
  e: ProcessEntry; stages: ProcessStage[]; selectionMode: boolean; selected: boolean;
  onToggleSelect: (id: number) => void; onOpen: (e: ProcessEntry) => void;
  onMove: (id: number, stageId: number) => void; onRemove: (id: number) => void;
}) {
  const [editingPriority, setEditingPriority] = useState(false);

  async function setPriority(p: EntryPriority | null) {
    setEditingPriority(false);
    try { await updateEntry(e.id, { priority: p }); pushToast('success', 'Priority updated'); }
    catch { pushToast('danger', 'Failed to update'); }
  }

  return (
    <tr
      onClick={() => !selectionMode && onOpen(e)}
      className={`hover:bg-bg-secondary/40 transition-quick ${!selectionMode ? 'cursor-pointer' : ''}`}
    >
      {selectionMode && (
        <td className="px-2 py-2" onClick={(ev) => ev.stopPropagation()}>
          <input type="checkbox" checked={selected} onChange={() => onToggleSelect(e.id)}
            className="rounded border-border-color text-accent focus:ring-2 focus:ring-accent" />
        </td>
      )}
      <td className="px-3 py-2">
        <p className="text-text-primary font-medium truncate max-w-[220px]">{e.title || e.entity_name || '—'}</p>
        {(e.title && e.entity_name) && <p className="text-[11px] text-text-secondary truncate">{e.entity_name}</p>}
      </td>
      <td className="px-3 py-2" onClick={(ev) => ev.stopPropagation()}>
        <select
          value={e.current_stage_id ?? ''}
          onChange={(ev) => ev.target.value && onMove(e.id, Number(ev.target.value))}
          className="text-[11px] border rounded-md px-2 py-0.5 bg-card-bg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          style={e.current_stage_color ? { borderColor: e.current_stage_color + '60', color: e.current_stage_color } : undefined}
        >
          {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </td>
      <td className="px-3 py-2" onClick={(ev) => ev.stopPropagation()}>
        <div className="relative">
          <button
            onClick={() => setEditingPriority(s => !s)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-bg-secondary transition-quick"
          >
            <PriorityDot priority={e.priority} />
            <span className="text-xs text-text-secondary capitalize">{e.priority || '—'}</span>
          </button>
          {editingPriority && (
            <div className="absolute left-0 top-full mt-1 z-10 rounded-md border border-border-color bg-card-bg shadow-lg py-1">
              {(['high','medium','low'] as const).map(p => (
                <button key={p} onClick={() => setPriority(p)} className="w-full px-3 py-1 text-xs hover:bg-bg-secondary text-left capitalize flex items-center gap-2">
                  <PriorityDot priority={p} /> {p}
                </button>
              ))}
              <button onClick={() => setPriority(null)} className="w-full px-3 py-1 text-xs hover:bg-bg-secondary text-left text-text-secondary">Clear</button>
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        {e.expected_value != null ? <Money value={e.expected_value} compact size="sm" tone="success" /> : <span className="text-text-secondary">—</span>}
      </td>
      <td className="px-3 py-2 text-text-secondary text-xs">
        {e.expected_close_date ? formatDate(e.expected_close_date) : '—'}
      </td>
      <td className={`px-3 py-2 text-right text-xs tabular-nums
        ${e.sla_status === 'breach' ? 'text-red-600 dark:text-red-400 font-semibold' : e.sla_status === 'warn' ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-text-secondary'}`}>
        {e.days_in_stage != null ? `${e.days_in_stage}d` : '—'}
      </td>
      <td className="px-3 py-2 text-text-secondary text-xs">
        {e.assigned_wa_employee_name ? (
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={e.assigned_wa_employee_name} size="xs" /> <span className="truncate max-w-[100px]">{e.assigned_wa_employee_name}</span>
          </span>
        ) : '—'}
      </td>
      <td className="px-2 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
        <button onClick={() => onRemove(e.id)} className="p-1 text-text-secondary hover:text-red-500 rounded transition-quick" title="Remove">
          <Icon.close size={12} />
        </button>
      </td>
    </tr>
  );
}
