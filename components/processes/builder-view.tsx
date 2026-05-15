'use client';

import React, { useEffect, useState } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  addStage, updateStage, deleteStage, addStageWork, deleteStageWork, reorderStages,
  reorderStageWorks, listAutomations, createAutomation, deleteAutomation,
  type BusinessProcess, type ProcessStage, type AutomationRule,
} from '@/services/processes';
import { listWorkTemplates, type WorkTemplate } from '@/services/work';
import { listEmployees, type Employee } from '@/services/employees';
import { randomStageColor } from './shared';

interface Props {
  process: BusinessProcess;
  stages: ProcessStage[];
  onReload: () => void;
}

export default function BuilderView({ process, stages, onReload }: Props) {
  const [templates, setTemplates] = useState<WorkTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState(randomStageColor());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    if (!loaded) {
      Promise.all([
        listWorkTemplates(),
        listEmployees(),
        listAutomations(process.id),
      ])
        .then(([t, e, a]) => {
          setTemplates(t.filter(tpl => tpl.is_active));
          setEmployees(e.filter(emp => emp.is_active));
          setAutomations(a);
        })
        .catch(() => {})
        .finally(() => setLoaded(true));
    }
  }, [loaded, process.id]);

  async function handleAddStage() {
    if (!newStageName.trim()) return;
    await addStage(process.id, {
      name: newStageName.trim(),
      color: newStageColor,
      stage_type: 'active',
      sort_order: stages.length,
    });
    setNewStageName(''); setNewStageColor(randomStageColor());
    onReload();
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = stages.findIndex(s => `stage:${s.id}` === active.id);
    const newIndex = stages.findIndex(s => `stage:${s.id}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...stages];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    try {
      await reorderStages(process.id, reordered.map(s => s.id));
      onReload();
    } catch {
      onReload();
    }
  }

  async function reloadAutomations() {
    const a = await listAutomations(process.id);
    setAutomations(a);
  }

  return (
    <div className="space-y-6">
      {/* Stages */}
      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-2">Stages <span className="text-text-secondary font-normal">(drag to reorder)</span></h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stages.map(s => `stage:${s.id}`)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {[...stages].sort((a, b) => a.sort_order - b.sort_order).map(stage => (
                <StageCard
                  key={stage.id}
                  process={process}
                  stage={stage}
                  templates={templates}
                  employees={employees}
                  onReload={onReload}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add stage */}
        <div className="mt-3 rounded-lg border border-dashed border-border-color bg-card-bg p-3 flex items-center gap-2">
          <input
            type="color"
            value={newStageColor}
            onChange={(e) => setNewStageColor(e.target.value)}
            className="h-8 w-8 rounded border border-border-color cursor-pointer"
          />
          <input
            type="text"
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
            placeholder="New stage name…"
            className="flex-1 rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={handleAddStage}
            disabled={!newStageName.trim()}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            Add stage
          </button>
        </div>
      </section>

      {/* Automation rules */}
      <section>
        <AutomationsPanel
          process={process}
          stages={stages}
          rules={automations}
          onReload={reloadAutomations}
        />
      </section>
    </div>
  );
}

// ─── Stage Card (sortable) ────────────────────────────────────────────────────

function StageCard({
  process, stage, templates, employees, onReload,
}: {
  process: BusinessProcess;
  stage: ProcessStage;
  templates: WorkTemplate[];
  employees: Employee[];
  onReload: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `stage:${stage.id}`, data: { type: 'stage', stage },
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddWork, setShowAddWork] = useState(false);

  const [editName, setEditName] = useState(stage.name);
  const [editType, setEditType] = useState(stage.stage_type);

  // Settings draft
  const [slaDays, setSlaDays] = useState<string>(stage.sla_days?.toString() || '');
  const [warnDays, setWarnDays] = useState<string>(stage.warn_days?.toString() || '');
  const [wipLimit, setWipLimit] = useState<string>(stage.wip_limit?.toString() || '');
  const [winProb, setWinProb] = useState<string>(stage.win_probability?.toString() || '');
  const [autoAdv, setAutoAdv] = useState(stage.auto_advance_on_complete);

  // Add work draft
  const [workTemplateId, setWorkTemplateId] = useState<number | null>(null);
  const [workTitle, setWorkTitle] = useState('');
  const [workAssigneeId, setWorkAssigneeId] = useState<number | null>(null);
  const [workDueIn, setWorkDueIn] = useState<string>('');

  async function saveName() {
    if (editName.trim() === stage.name || !editName.trim()) return;
    await updateStage(process.id, stage.id, { name: editName.trim() });
    onReload();
  }

  async function saveType(t: 'active' | 'completed' | 'failed') {
    setEditType(t);
    await updateStage(process.id, stage.id, { stage_type: t });
    onReload();
  }

  async function saveSettings() {
    await updateStage(process.id, stage.id, {
      sla_days: slaDays.trim() === '' ? null : Number(slaDays),
      warn_days: warnDays.trim() === '' ? null : Number(warnDays),
      wip_limit: wipLimit.trim() === '' ? null : Number(wipLimit),
      win_probability: winProb.trim() === '' ? null : Number(winProb),
      auto_advance_on_complete: autoAdv,
    });
    setShowSettings(false);
    onReload();
  }

  async function handleDelete() {
    if (!confirm(`Delete stage "${stage.name}"? Entries will be moved to the first remaining stage.`)) return;
    await deleteStage(process.id, stage.id);
    onReload();
  }

  async function handleAddWork() {
    if (!workTemplateId && !workTitle.trim()) return;
    await addStageWork(process.id, stage.id, {
      work_template_id: workTemplateId || undefined,
      title: workTitle.trim() || undefined,
      default_assigned_to_id: workAssigneeId || undefined,
      due_in_days: workDueIn.trim() === '' ? undefined : Number(workDueIn),
    });
    setShowAddWork(false);
    setWorkTemplateId(null); setWorkTitle(''); setWorkAssigneeId(null); setWorkDueIn('');
    onReload();
  }

  const typeBadgeClass =
    editType === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : editType === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border-color bg-card-bg overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2.5"
           style={{ borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: stage.color || '#6B7280' }}>
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-text-secondary hover:text-text-primary"
          title="Drag to reorder"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
        </button>

        <button onClick={() => setExpanded(s => !s)} className="text-text-secondary hover:text-text-primary">
          <svg className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="flex-1 bg-transparent text-sm font-semibold text-text-primary focus:outline-none focus:bg-bg-primary focus:px-2 focus:rounded min-w-0"
        />

        <select
          value={editType}
          onChange={(e) => saveType(e.target.value as any)}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium border-0 cursor-pointer focus:outline-none ${typeBadgeClass}`}
        >
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>

        {stage.win_probability !== null && (
          <span className="text-[10px] text-text-secondary">{stage.win_probability}% win</span>
        )}
        {stage.sla_days !== null && (
          <span className="text-[10px] text-text-secondary">SLA {stage.sla_days}d</span>
        )}
        <span className="text-[10px] text-text-secondary">{stage.entry_count} entries</span>

        <button
          onClick={() => setShowSettings(s => !s)}
          className="p-1 rounded text-text-secondary hover:text-accent hover:bg-bg-secondary"
          title="Stage settings"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <button
          onClick={handleDelete}
          className="p-1 rounded text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          title="Delete stage"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="border-t border-border-color px-4 py-3 bg-bg-secondary space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SmallField label="SLA days" value={slaDays} onChange={setSlaDays} type="number" />
            <SmallField label="Warn after" value={warnDays} onChange={setWarnDays} type="number" />
            <SmallField label="WIP limit" value={wipLimit} onChange={setWipLimit} type="number" />
            <SmallField label="Win probability %" value={winProb} onChange={setWinProb} type="number" />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={autoAdv} onChange={(e) => setAutoAdv(e.target.checked)} className="rounded border-border-color text-accent focus:ring-accent" />
            <span className="text-text-secondary">Auto-advance to next stage when all stage work completes</span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowSettings(false)} className="px-3 py-1 text-xs rounded border border-border-color bg-bg-primary">Cancel</button>
            <button onClick={saveSettings} className="px-3 py-1 text-xs rounded bg-accent text-white">Save</button>
          </div>
        </div>
      )}

      {/* Expanded: stage works */}
      {expanded && (
        <div className="border-t border-border-color px-4 py-3">
          {stage.stage_works.length > 0 ? (
            <div className="space-y-1.5 mb-3">
              {[...stage.stage_works].sort((a,b) => a.sort_order - b.sort_order).map(w => (
                <div key={w.id} className="flex items-center gap-2 rounded-md bg-bg-secondary px-3 py-1.5 group">
                  <svg className="h-3 w-3 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M9 12h6M9 16h6M9 8h6" strokeLinecap="round" />
                  </svg>
                  <span className="text-xs text-text-primary flex-1 truncate">{w.work_template_name || w.title}</span>
                  {w.due_in_days !== null && <span className="text-[10px] text-text-secondary">+{w.due_in_days}d</span>}
                  {w.default_assigned_to_name && <span className="text-[10px] text-text-secondary">→ {w.default_assigned_to_name}</span>}
                  <button
                    onClick={async () => { await deleteStageWork(process.id, stage.id, w.id); onReload(); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-text-secondary hover:text-red-500"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary mb-3">No work templates attached to this stage.</p>
          )}

          {showAddWork ? (
            <div className="rounded-md border border-border-color bg-bg-primary p-2 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={workTemplateId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    setWorkTemplateId(id);
                    if (id) {
                      const tpl = templates.find(t => t.id === id);
                      if (tpl) setWorkTitle(tpl.default_title || tpl.name);
                    }
                  }}
                  className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="">Custom (no template)</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input
                  type="text" value={workTitle} onChange={(e) => setWorkTitle(e.target.value)}
                  placeholder={workTemplateId ? 'Title override…' : 'Task title…'}
                  className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs focus:outline-none"
                />
                <select
                  value={workAssigneeId ?? ''} onChange={(e) => setWorkAssigneeId(e.target.value ? Number(e.target.value) : null)}
                  className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="">Auto-assign to owner</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
                <input
                  type="number" placeholder="Due in N days" value={workDueIn}
                  onChange={(e) => setWorkDueIn(e.target.value)}
                  className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddWork} className="px-3 py-1 text-xs rounded bg-accent text-white">Add</button>
                <button onClick={() => setShowAddWork(false)} className="px-3 py-1 text-xs rounded border border-border-color bg-bg-secondary">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddWork(true)} className="text-xs text-accent hover:underline font-medium">
              + Add Work
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SmallField({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-text-secondary uppercase tracking-wide mb-0.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}

// ─── Automations Panel ────────────────────────────────────────────────────────

function AutomationsPanel({
  process, stages, rules, onReload,
}: {
  process: BusinessProcess; stages: ProcessStage[]; rules: AutomationRule[]; onReload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [trigger, setTrigger] = useState<'on_enter' | 'on_stuck' | 'on_complete' | 'on_drop'>('on_enter');
  const [stageId, setStageId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<'notify_user' | 'reassign' | 'add_tag'>('notify_user');
  const [actionValue, setActionValue] = useState('');

  async function handleSave() {
    if (!actionValue.trim()) return;
    const action: any = { type: actionType, params: {} };
    if (actionType === 'notify_user') action.params.message = actionValue.trim();
    if (actionType === 'reassign') action.params.user_id = Number(actionValue);
    if (actionType === 'add_tag') action.params.tag = actionValue.trim();
    await createAutomation(process.id, { trigger, stage_id: stageId, action });
    setAdding(false); setActionValue('');
    onReload();
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this automation?')) return;
    await deleteAutomation(process.id, id);
    onReload();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-text-primary">Automation Rules</h3>
        <button onClick={() => setAdding(s => !s)} className="text-xs text-accent hover:underline font-medium">
          {adding ? 'Cancel' : '+ Add rule'}
        </button>
      </div>

      {adding && (
        <div className="rounded-lg border border-border-color bg-bg-secondary p-3 mb-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-text-secondary">When</label>
              <select value={trigger} onChange={(e) => setTrigger(e.target.value as any)} className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs">
                <option value="on_enter">Entry enters stage</option>
                <option value="on_stuck">Entry stuck (SLA breach)</option>
                <option value="on_complete">Entry completes</option>
                <option value="on_drop">Entry dropped</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-text-secondary">Stage (optional)</label>
              <select value={stageId ?? ''} onChange={(e) => setStageId(e.target.value ? Number(e.target.value) : null)} className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs">
                <option value="">Any stage</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-text-secondary">Action</label>
              <select value={actionType} onChange={(e) => setActionType(e.target.value as any)} className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs">
                <option value="notify_user">Notify owner</option>
                <option value="reassign">Reassign to user…</option>
                <option value="add_tag">Add tag…</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-text-secondary">
                {actionType === 'notify_user' ? 'Message' : actionType === 'reassign' ? 'User ID' : 'Tag name'}
              </label>
              <input
                type="text" value={actionValue} onChange={(e) => setActionValue(e.target.value)}
                className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleSave} className="px-3 py-1 text-xs rounded bg-accent text-white">Save rule</button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="text-xs text-text-secondary">No automation rules. Add one to react to stage events.</p>
      ) : (
        <div className="space-y-2">
          {rules.map(r => {
            const stageName = r.stage_id ? stages.find(s => s.id === r.stage_id)?.name ?? 'Unknown stage' : 'Any stage';
            return (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border-color bg-card-bg px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-text-primary truncate">
                    When <span className="text-accent">{r.trigger.replace('on_', '')}</span> in <span className="text-accent">{stageName}</span>
                  </p>
                  <p className="text-text-secondary truncate">
                    → {r.action.type} {r.action.params ? Object.entries(r.action.params).map(([k,v]) => `${k}=${v}`).join(' ') : ''}
                  </p>
                </div>
                <button onClick={() => handleDelete(r.id)} className="p-1 text-text-secondary hover:text-red-500" title="Delete rule">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
