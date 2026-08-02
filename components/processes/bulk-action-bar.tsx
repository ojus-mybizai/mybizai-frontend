'use client';

import React, { useState } from 'react';
import type { ProcessStage } from '@/services/processes';
import type { WaEmployee } from '@/services/waEmployees';
import { Icon, Button } from './design-system';

interface Props {
  selectedCount: number;
  stages: ProcessStage[];
  employees: WaEmployee[];
  onMove: (stageId: number) => void;
  onAssign: (waEmployeeId: number | null) => void;
  onSetPriority: (p: 'high' | 'medium' | 'low') => void;
  onDrop: () => void;
  onClear: () => void;
}

export default function BulkActionBar({
  selectedCount, stages, employees, onMove, onAssign, onSetPriority, onDrop, onClear,
}: Props) {
  const [open, setOpen] = useState<'move' | 'assign' | 'priority' | null>(null);
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 rounded-lg border border-border-color bg-card-bg backdrop-blur shadow-2xl px-3 py-2 animate-in slide-in-from-bottom-4 duration-200">
      <span className="text-sm font-semibold text-text-primary">{selectedCount} selected</span>
      <span className="h-4 w-px bg-border-color mx-1" />

      <Dropdown
        label="Move to…"
        open={open === 'move'}
        onToggle={() => setOpen(open === 'move' ? null : 'move')}
        primary
      >
        {stages.map(s => (
          <button key={s.id} onClick={() => { onMove(s.id); setOpen(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-bg-secondary flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color || '#6B7280' }} />
            {s.name}
          </button>
        ))}
      </Dropdown>

      <Dropdown label="Assign…" open={open === 'assign'} onToggle={() => setOpen(open === 'assign' ? null : 'assign')}>
        <button onClick={() => { onAssign(null); setOpen(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-bg-secondary text-text-secondary">Unassigned</button>
        {/* onAssign sets ProcessEntry.assigned_wa_employee_id — use the WaEmployee id. */}
        {employees.map(e => (
          <button key={e.id} onClick={() => { onAssign(e.id); setOpen(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-bg-secondary">{e.name}</button>
        ))}
      </Dropdown>

      <Dropdown label="Priority…" open={open === 'priority'} onToggle={() => setOpen(open === 'priority' ? null : 'priority')}>
        {(['high','medium','low'] as const).map(p => (
          <button key={p} onClick={() => { onSetPriority(p); setOpen(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-bg-secondary capitalize">{p}</button>
        ))}
      </Dropdown>

      <Button variant="danger" size="sm" onClick={onDrop}>Drop</Button>

      <span className="h-4 w-px bg-border-color mx-1" />

      <button onClick={onClear} className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-quick" title="Clear selection">
        <Icon.close size={14} />
      </button>
    </div>
  );
}

function Dropdown({
  label, open, onToggle, children, primary,
}: {
  label: string; open: boolean; onToggle: () => void; children: React.ReactNode; primary?: boolean;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-quick
          ${primary ? 'bg-accent text-white hover:bg-accent/90' : 'border border-border-color bg-bg-primary text-text-primary hover:bg-bg-secondary'}`}
      >
        {label}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 min-w-[160px] rounded-md border border-border-color bg-card-bg shadow-xl py-1 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
          {children}
        </div>
      )}
    </div>
  );
}
