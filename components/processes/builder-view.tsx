'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  type BusinessProcess, type ProcessStage, type ProcessStageWork, type AutomationRule,
  type AutomationTrigger, type AutomationCondition,
} from '@/services/processes';
import { listWorkTemplates, type WorkTemplate } from '@/services/work';
import { listEmployees, type Employee } from '@/services/employees';
import {
  listVerifiedWhatsAppChannels, whatsAppChannelLabel, type Channel,
} from '@/services/channels';
import {
  listMessageTemplates, type MessageTemplate,
} from '@/services/message-templates';
import {
  listTemplates as listWaTemplatesService, type WaTemplate,
} from '@/services/waTemplates';
import {
  listEmployees as listWaEmployees, listGroups as listWaGroups,
  type WaEmployee, type WaEmployeeGroup,
} from '@/services/waEmployees';
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
  // Shared "messaging pickers" — fetched once at the parent so every
  // StageCard automation editor + the process-wide panel reuse the same data.
  const [waChannels, setWaChannels] = useState<Channel[]>([]);
  const [waTemplates, setWaTemplates] = useState<MessageTemplate[]>([]);
  // WA-Work dispatch pickers — separate from the message-templates above
  // (those are Meta-approved HSMs for sending to contacts; these are
  // employee-facing task templates).
  const [waWorkTemplates, setWaWorkTemplates] = useState<WaTemplate[]>([]);
  const [waEmployees, setWaEmployees] = useState<WaEmployee[]>([]);
  const [waGroups, setWaGroups] = useState<WaEmployeeGroup[]>([]);
  const [pickersLoaded, setPickersLoaded] = useState(false);
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
        listVerifiedWhatsAppChannels().catch(() => [] as Channel[]),
        listMessageTemplates({ channel: 'whatsapp', meta_status: 'approved', is_active: true })
          .catch(() => [] as MessageTemplate[]),
        // WA-Work pickers — active templates (we filter lead_list out at
        // render time so the user can see if they ONLY have lead_list ones)
        listWaTemplatesService().catch(() => [] as WaTemplate[]),
        listWaEmployees({ status: 'active' }).catch(() => [] as WaEmployee[]),
        listWaGroups().catch(() => [] as WaEmployeeGroup[]),
      ])
        .then(([t, e, a, chs, tpls, waTpls, waEmps, waGrps]) => {
          setTemplates(t.filter(tpl => tpl.is_active));
          setEmployees(e.filter(emp => emp.is_active));
          setAutomations(a);
          setWaChannels(chs);
          setWaTemplates(tpls);
          setWaWorkTemplates(waTpls.filter(tpl => tpl.is_active));
          setWaEmployees(waEmps.filter(emp => emp.is_active));
          setWaGroups(waGrps);
          setPickersLoaded(true);
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
                  waChannels={waChannels}
                  waTemplates={waTemplates}
                  waWorkTemplates={waWorkTemplates}
                  waEmployees={waEmployees}
                  waGroups={waGroups}
                  pickersLoaded={pickersLoaded}
                  // Only this stage's rules — `on_enter | on_exit | on_stuck`
                  // attached to this exact stage_id.
                  stageRules={automations.filter(r => r.stage_id === stage.id)}
                  onReloadAutomations={reloadAutomations}
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

      {/* Process-wide automation rules — stage-scoped rules now live INSIDE
          each stage card above (less ambiguity, single source of truth). */}
      <section>
        <AutomationsPanel
          process={process}
          stages={stages}
          // Only process-wide rules (stage_id IS NULL) belong here.
          rules={automations.filter(r => r.stage_id == null)}
          waChannels={waChannels}
          waTemplates={waTemplates}
          employees={employees}
          pickersLoaded={pickersLoaded}
          onReload={reloadAutomations}
        />
      </section>
    </div>
  );
}

// ─── Stage Card (sortable) ────────────────────────────────────────────────────

function StageCard({
  process, stage, templates, employees,
  waChannels, waTemplates, waWorkTemplates, waEmployees, waGroups,
  pickersLoaded, stageRules,
  onReloadAutomations, onReload,
}: {
  process: BusinessProcess;
  stage: ProcessStage;
  templates: WorkTemplate[];          // legacy WorkTemplate (still imported for type completeness)
  employees: Employee[];              // platform Users — used by automation rules' reassign action
  waChannels: Channel[];
  waTemplates: MessageTemplate[];     // approved Meta HSMs — used by WhatsApp message action
  waWorkTemplates: WaTemplate[];      // WaTemplate (simple_task / whatsapp_form / checklist)
  waEmployees: WaEmployee[];          // verified WA employees
  waGroups: WaEmployeeGroup[];        // WA employee groups
  pickersLoaded: boolean;
  stageRules: AutomationRule[];
  onReloadAutomations: () => void;
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

  // ── Add WA-Work draft ────────────────────────────────────────────────────
  // The form is WA-Work only — no Internal Task path. Legacy internal_work
  // rows still render in the list (read-only chip) but nothing creates new
  // ones from this UI.
  const [waWorkTemplateId, setWaWorkTemplateId] = useState<number | null>(null);
  const [waWorkTitle, setWaWorkTitle] = useState('');
  const [waWorkAssigneeMode, setWaWorkAssigneeMode] = useState<'group' | 'employees'>('group');
  const [waWorkGroupId, setWaWorkGroupId] = useState<number | null>(null);
  const [waWorkEmployeeIds, setWaWorkEmployeeIds] = useState<number[]>([]);
  const [waWorkDispatchMode, setWaWorkDispatchMode] = useState<'individual' | 'broadcast'>('individual');
  const [waWorkDueIn, setWaWorkDueIn] = useState<string>('');
  const [waWorkAutoDispatch, setWaWorkAutoDispatch] = useState(true);

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

  function resetWaWorkDraft() {
    setWaWorkTemplateId(null); setWaWorkTitle('');
    setWaWorkAssigneeMode('group');
    setWaWorkGroupId(null); setWaWorkEmployeeIds([]);
    setWaWorkDispatchMode('individual');
    setWaWorkDueIn(''); setWaWorkAutoDispatch(true);
  }

  async function handleAddWork() {
    // Validation: must pick a template + at least one assignee path.
    if (!waWorkTemplateId) {
      alert('Pick a WhatsApp task template.');
      return;
    }
    const hasGroup = waWorkAssigneeMode === 'group' && waWorkGroupId != null;
    const hasEmployees = waWorkAssigneeMode === 'employees' && waWorkEmployeeIds.length > 0;
    if (!hasGroup && !hasEmployees) {
      alert('Assign to a group or pick at least one employee.');
      return;
    }
    await addStageWork(process.id, stage.id, {
      dispatch_kind: 'wa_work',
      wa_template_id: waWorkTemplateId,
      wa_assigned_group_id: hasGroup ? waWorkGroupId : null,
      wa_assigned_employee_ids: hasEmployees ? waWorkEmployeeIds : null,
      wa_dispatch_mode: waWorkDispatchMode,
      wa_auto_dispatch: waWorkAutoDispatch,
      title: waWorkTitle.trim() || undefined,
      due_in_days: waWorkDueIn.trim() === '' ? undefined : Number(waWorkDueIn),
    });
    setShowAddWork(false);
    resetWaWorkDraft();
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
                <StageWorkRow
                  key={w.id}
                  work={w}
                  onDelete={async () => { await deleteStageWork(process.id, stage.id, w.id); onReload(); }}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary mb-3">No tasks attached to this stage.</p>
          )}

          {showAddWork ? (
            <WaWorkForm
              templates={waWorkTemplates}
              employees={waEmployees}
              groups={waGroups}
              templateId={waWorkTemplateId}
              onTemplateIdChange={setWaWorkTemplateId}
              title={waWorkTitle}
              onTitleChange={setWaWorkTitle}
              assigneeMode={waWorkAssigneeMode}
              onAssigneeModeChange={setWaWorkAssigneeMode}
              groupId={waWorkGroupId}
              onGroupIdChange={setWaWorkGroupId}
              employeeIds={waWorkEmployeeIds}
              onEmployeeIdsChange={setWaWorkEmployeeIds}
              dispatchMode={waWorkDispatchMode}
              onDispatchModeChange={setWaWorkDispatchMode}
              dueIn={waWorkDueIn}
              onDueInChange={setWaWorkDueIn}
              autoDispatch={waWorkAutoDispatch}
              onAutoDispatchChange={setWaWorkAutoDispatch}
              loaded={pickersLoaded}
              onCancel={() => { setShowAddWork(false); resetWaWorkDraft(); }}
              onSubmit={handleAddWork}
            />
          ) : (
            <button onClick={() => setShowAddWork(true)} className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium">
              <span aria-hidden>📱</span> + Add WhatsApp task
            </button>
          )}

          {/* Stage-scoped automation rules — everything that reacts to
              "entry enters/leaves/is stuck in THIS stage" lives right here.
              No separate panel to hunt down. */}
          <StageAutomationsSection
            process={process}
            stage={stage}
            rules={stageRules}
            employees={employees}
            waChannels={waChannels}
            waTemplates={waTemplates}
            pickersLoaded={pickersLoaded}
            onReload={onReloadAutomations}
          />
        </div>
      )}
    </div>
  );
}

// ─── Stage Work Row (kind-aware) ─────────────────────────────────────────────
// Renders one stage-bound task. Today rows can be wa_work (new default) or
// internal_work (legacy, can no longer be created from this UI but rendered
// read-only with a Legacy badge so the owner can still see + delete them).

const WA_TYPE_LABEL: Record<string, { icon: string; label: string }> = {
  simple_task:   { icon: '✅', label: 'Quick task' },
  whatsapp_form: { icon: '📝', label: 'Form' },
  checklist:     { icon: '☑️', label: 'Checklist' },
  lead_list:     { icon: '📋', label: 'Lead list (not supported)' },
};

function StageWorkRow({ work, onDelete }: {
  work: ProcessStageWork;
  onDelete: () => void;
}) {
  const isWa = work.dispatch_kind === 'wa_work';

  // Build a one-line summary derived from the chosen template + assignees.
  let primary: string;
  let assignee: string | null = null;
  let kindBadge: { icon: string; label: string };

  if (isWa) {
    const typ = work.wa_template_type || 'simple_task';
    kindBadge = WA_TYPE_LABEL[typ] || { icon: '📱', label: typ };
    primary = work.title || work.wa_template_name || 'WhatsApp task';
    if (work.wa_assigned_group_name) {
      assignee = `${work.wa_assigned_group_name} group`;
    } else if (work.wa_assigned_employee_names && work.wa_assigned_employee_names.length > 0) {
      const names = work.wa_assigned_employee_names;
      assignee = names.length === 1
        ? names[0]
        : `${names[0]} +${names.length - 1}`;
    }
  } else {
    kindBadge = { icon: '🗄', label: 'Legacy task' };
    primary = work.work_template_name || work.title || 'Internal task';
    assignee = work.default_assigned_to_name || null;
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-bg-secondary px-3 py-1.5 group">
      <span className="text-[13px]" title={kindBadge.label} aria-hidden>{kindBadge.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs text-text-primary truncate">{primary}</span>
          {!isWa && (
            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 flex-shrink-0">
              Legacy
            </span>
          )}
          {isWa && work.wa_dispatch_mode === 'broadcast' && (
            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 flex-shrink-0">
              Broadcast
            </span>
          )}
          {isWa && !work.wa_auto_dispatch && (
            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-bg-primary text-text-secondary border border-border-color flex-shrink-0">
              Draft
            </span>
          )}
        </div>
      </div>
      {work.due_in_days != null && (
        <span className="text-[10px] text-text-secondary">+{work.due_in_days}d</span>
      )}
      {assignee && (
        <span className="text-[10px] text-text-secondary">→ {assignee}</span>
      )}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-0.5 text-text-secondary hover:text-red-500"
        title="Remove"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

// ─── WA-Work Add Form ────────────────────────────────────────────────────────
// Configures a single wa_work stage-work row: WaTemplate + assignees +
// dispatch mode + due + auto_dispatch. The runtime behavior (creating a
// WaWorkItem on stage-enter, dispatching to each WaEmployee) is handled by
// the backend's `_spawn_wa_work_for_stage` helper.

function WaWorkForm({
  templates, employees, groups,
  templateId, onTemplateIdChange,
  title, onTitleChange,
  assigneeMode, onAssigneeModeChange,
  groupId, onGroupIdChange,
  employeeIds, onEmployeeIdsChange,
  dispatchMode, onDispatchModeChange,
  dueIn, onDueInChange,
  autoDispatch, onAutoDispatchChange,
  loaded, onCancel, onSubmit,
}: {
  templates: WaTemplate[];
  employees: WaEmployee[];
  groups: WaEmployeeGroup[];
  templateId: number | null;
  onTemplateIdChange: (v: number | null) => void;
  title: string;
  onTitleChange: (v: string) => void;
  assigneeMode: 'group' | 'employees';
  onAssigneeModeChange: (v: 'group' | 'employees') => void;
  groupId: number | null;
  onGroupIdChange: (v: number | null) => void;
  employeeIds: number[];
  onEmployeeIdsChange: (v: number[]) => void;
  dispatchMode: 'individual' | 'broadcast';
  onDispatchModeChange: (v: 'individual' | 'broadcast') => void;
  dueIn: string;
  onDueInChange: (v: string) => void;
  autoDispatch: boolean;
  onAutoDispatchChange: (v: boolean) => void;
  loaded: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  // Filter out lead_list — it's not meaningful for per-entry dispatch and
  // the backend skips it. We hide it entirely so users can't choose it.
  const usableTemplates = useMemo(
    () => templates.filter(t => t.type !== 'lead_list'),
    [templates],
  );

  const selectedTemplate = templates.find(t => t.id === templateId) || null;
  const isWhatsappForm = selectedTemplate?.type === 'whatsapp_form';
  const formNotPublished = isWhatsappForm && !selectedTemplate?.meta_flow_id;

  function toggleEmployee(id: number) {
    if (employeeIds.includes(id)) {
      onEmployeeIdsChange(employeeIds.filter(x => x !== id));
    } else {
      onEmployeeIdsChange([...employeeIds, id]);
    }
  }

  return (
    <div className="rounded-md border border-border-color bg-bg-primary p-3 space-y-3">
      {!loaded && <p className="text-[11px] text-text-secondary">Loading WhatsApp templates &amp; employees…</p>}

      {/* Template */}
      <div>
        <label className="text-[10px] uppercase tracking-wide text-text-secondary">WhatsApp task template</label>
        <select
          value={templateId ?? ''}
          onChange={(e) => onTemplateIdChange(e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
        >
          <option value="">— Pick a template —</option>
          {usableTemplates.map(t => {
            const meta = WA_TYPE_LABEL[t.type] || { icon: '📱', label: t.type };
            return (
              <option key={t.id} value={t.id}>
                {meta.icon} {t.name} · {meta.label}
              </option>
            );
          })}
        </select>
        {loaded && usableTemplates.length === 0 && (
          <p className="mt-1 text-[10px] text-amber-600">
            No WhatsApp task templates found. Create one under WA Templates first.
          </p>
        )}
        {formNotPublished && (
          <p className="mt-1 text-[10px] text-amber-600">
            ⚠ This Flow isn’t published to Meta yet. Publish it from WA Templates before dispatch will work.
          </p>
        )}
        {selectedTemplate?.type === 'whatsapp_form' && selectedTemplate?.datasheet_write_enabled && (
          <p className="mt-1 text-[10px] text-text-secondary">
            ✓ Form responses will write to the linked datasheet.
          </p>
        )}
      </div>

      {/* Title override */}
      <div>
        <label className="text-[10px] uppercase tracking-wide text-text-secondary">Task title (sent inside the message)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={selectedTemplate?.name || 'e.g. Visit site, take photo, confirm KYC'}
          className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
        />
        <p className="mt-1 text-[10px] text-text-secondary/70">
          The contact’s name is appended automatically — leave blank to use the template name.
        </p>
      </div>

      {/* Assign to */}
      <div>
        <label className="text-[10px] uppercase tracking-wide text-text-secondary">Assign to</label>
        <div className="mt-1 inline-flex rounded-md border border-border-color overflow-hidden">
          <button
            onClick={() => onAssigneeModeChange('group')}
            className={`px-3 py-1.5 text-xs font-medium ${assigneeMode === 'group' ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}
          >
            Group
          </button>
          <button
            onClick={() => onAssigneeModeChange('employees')}
            className={`px-3 py-1.5 text-xs font-medium ${assigneeMode === 'employees' ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'}`}
          >
            Individual employees
          </button>
        </div>

        {assigneeMode === 'group' ? (
          <div className="mt-2">
            <select
              value={groupId ?? ''}
              onChange={(e) => onGroupIdChange(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
            >
              <option value="">— Pick a group —</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name} ({g.employee_count})</option>
              ))}
            </select>
            {loaded && groups.length === 0 && (
              <p className="mt-1 text-[10px] text-amber-600">No groups yet. Create one under WA Employees.</p>
            )}
          </div>
        ) : (
          <div className="mt-2 max-h-32 overflow-auto rounded border border-border-color bg-bg-secondary p-1.5 space-y-1">
            {employees.length === 0 ? (
              <p className="text-[10px] text-text-secondary px-1">
                No verified WhatsApp employees. Add some under WA Employees.
              </p>
            ) : employees.map(emp => (
              <label key={emp.id} className="flex items-center gap-2 text-xs px-1 py-0.5 hover:bg-bg-primary rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={employeeIds.includes(emp.id)}
                  onChange={() => toggleEmployee(emp.id)}
                  className="rounded border-border-color text-accent focus:ring-accent"
                />
                <span className="flex-1 text-text-primary truncate">{emp.name}</span>
                <span className="text-[10px] text-text-secondary">{emp.whatsapp_number}</span>
              </label>
            ))}
            {employeeIds.length > 0 && (
              <p className="text-[10px] text-text-secondary/70 px-1">
                {employeeIds.length} selected
              </p>
            )}
          </div>
        )}
      </div>

      {/* Dispatch mode */}
      <div>
        <label className="text-[10px] uppercase tracking-wide text-text-secondary">Dispatch mode</label>
        <div className="mt-1 space-y-1 text-xs">
          <label className="flex items-start gap-2">
            <input
              type="radio"
              checked={dispatchMode === 'individual'}
              onChange={() => onDispatchModeChange('individual')}
              className="mt-0.5"
            />
            <span>
              <span className="text-text-primary font-medium">Individual</span>
              <span className="block text-[10px] text-text-secondary">Each employee gets their own message + own done/not-done status.</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              checked={dispatchMode === 'broadcast'}
              onChange={() => onDispatchModeChange('broadcast')}
              className="mt-0.5"
            />
            <span>
              <span className="text-text-primary font-medium">Broadcast</span>
              <span className="block text-[10px] text-text-secondary">One message to the group, group-level accountability.</span>
            </span>
          </label>
        </div>
      </div>

      {/* Timing */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-text-secondary">Due in (days)</label>
          <input
            type="number"
            min={0}
            value={dueIn}
            onChange={(e) => onDueInChange(e.target.value)}
            placeholder="e.g. 2"
            className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-xs pb-1">
            <input
              type="checkbox"
              checked={autoDispatch}
              onChange={(e) => onAutoDispatchChange(e.target.checked)}
              className="rounded border-border-color text-accent focus:ring-accent"
            />
            <span className="text-text-secondary">Send on stage entry</span>
          </label>
        </div>
      </div>
      {!autoDispatch && (
        <p className="text-[10px] text-amber-600 -mt-1">
          Task will be created as a draft — you’ll need to dispatch it manually from WA Work.
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1 text-xs rounded border border-border-color bg-bg-primary">Cancel</button>
        <button onClick={onSubmit} className="px-3 py-1 text-xs rounded bg-accent text-white">Add task</button>
      </div>
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

// ─── Stage Automations Section (inside StageCard) ─────────────────────────────
//
// Renders rules attached to ONE stage, grouped by trigger. Scope is implicit
// (the stage card you're inside) — no scope picker needed. The "+ Add action"
// row inline-creates a new rule with stage_id pre-bound to this stage.
//
// Triggers supported here: on_enter | on_exit | on_stuck.
// Actions: same 4 kinds as the process-wide panel (send_whatsapp, notify_user,
// reassign, add_tag) — the editors are shared.

const STAGE_TRIGGERS: { key: 'on_enter' | 'on_exit' | 'on_stuck'; label: string; hint: string }[] = [
  { key: 'on_enter', label: 'When entry enters this stage',  hint: 'Fires as soon as a contact lands here' },
  { key: 'on_exit',  label: 'When entry leaves this stage',  hint: 'Fires on the way out — last chance to react' },
  { key: 'on_stuck', label: 'When entry is stuck (SLA breach)', hint: 'Fires once an entry crosses the stage SLA' },
];

function StageAutomationsSection({
  process, stage, rules, employees,
  waChannels, waTemplates, pickersLoaded, onReload,
}: {
  process: BusinessProcess;
  stage: ProcessStage;
  rules: AutomationRule[];
  employees: Employee[];
  waChannels: Channel[];
  waTemplates: MessageTemplate[];
  pickersLoaded: boolean;
  onReload: () => void;
}) {
  const [adding, setAdding] = useState<null | 'on_enter' | 'on_exit' | 'on_stuck'>(null);
  const [actionKind, setActionKind] = useState<ActionKind>('send_whatsapp');
  const [waDraft, setWaDraft] = useState<SendWhatsAppDraft>(DEFAULT_SEND_WA);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [reassignUserId, setReassignUserId] = useState<number | null>(null);
  const [tagName, setTagName] = useState('');
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);

  function resetDrafts() {
    setWaDraft(DEFAULT_SEND_WA);
    setNotifyMessage(''); setReassignUserId(null); setTagName('');
    setActionKind('send_whatsapp');
    setConditions([]);
  }

  async function handleSave() {
    if (!adding) return;
    const action = buildActionFromDrafts({
      kind: actionKind,
      wa: waDraft,
      notify: notifyMessage,
      reassignUserId,
      tag: tagName,
      ruleName: `Process #${process.id} stage "${stage.name}" ${adding}`,
    });
    if (!action) return;
    const cleanConds = sanitizeConditions(conditions);
    if (cleanConds === null) {
      alert('One or more conditions is missing a value.');
      return;
    }
    await createAutomation(process.id, {
      trigger: adding,
      stage_id: stage.id,
      action,
      conditions: cleanConds.length ? cleanConds : undefined,
    });
    setAdding(null);
    resetDrafts();
    onReload();
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this rule?')) return;
    await deleteAutomation(process.id, id);
    onReload();
  }

  // Group rules by trigger for the per-stage display.
  const byTrigger = useMemo(() => {
    const map = new Map<string, AutomationRule[]>();
    for (const r of rules) {
      const k = r.trigger as string;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return map;
  }, [rules]);

  const selectedTemplate = waTemplates.find(t => t.id === waDraft.template_id) || null;

  return (
    <div className="mt-4 pt-3 border-t border-border-color">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-xs font-semibold text-text-primary">Stage rules</h4>
          <p className="text-[10px] text-text-secondary">Send WhatsApp, notify, reassign or tag — whenever an entry enters / leaves / is stuck in this stage.</p>
        </div>
      </div>

      {STAGE_TRIGGERS.map(t => {
        const list = byTrigger.get(t.key) || [];
        return (
          <div key={t.key} className="mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-wide font-semibold text-text-secondary">{t.label}</span>
                <span className="text-[10px] text-text-secondary/70">{t.hint}</span>
              </div>
              <button
                onClick={() => { setAdding(adding === t.key ? null : t.key); resetDrafts(); }}
                className="text-[11px] text-accent hover:underline font-medium"
              >
                {adding === t.key ? 'Cancel' : '+ Add action'}
              </button>
            </div>

            {list.length === 0 && adding !== t.key ? (
              <p className="text-[10px] text-text-secondary/70 mt-1">No actions configured.</p>
            ) : (
              <div className="space-y-1 mt-1">
                {list.map(r => (
                  <div key={r.id} className="rounded-md bg-bg-secondary px-2.5 py-1.5 text-[11px] group">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-text-primary">{actionSummary(r.action)}</span>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-text-secondary hover:text-red-500 flex-shrink-0"
                        title="Delete rule"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    {r.conditions && r.conditions.length > 0 && (
                      <p className="text-[10px] text-text-secondary mt-0.5">
                        if {r.conditions.map(c => conditionSummary(c)).join(' AND ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {adding === t.key && (
              <div className="mt-2 rounded-md border border-border-color bg-bg-primary p-2.5 space-y-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-text-secondary">Action</label>
                  <select
                    value={actionKind}
                    onChange={(e) => setActionKind(e.target.value as ActionKind)}
                    className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
                  >
                    <option value="send_whatsapp">📱 Send WhatsApp message (to linked contact)</option>
                    <option value="notify_user">🔔 Notify entry owner</option>
                    <option value="reassign">👤 Reassign entry to user</option>
                    <option value="add_tag">🏷  Add tag / note on contact</option>
                  </select>
                </div>

                {actionKind === 'send_whatsapp' && (
                  <SendWhatsAppEditor
                    draft={waDraft}
                    onChange={setWaDraft}
                    channels={waChannels}
                    templates={waTemplates}
                    loaded={pickersLoaded}
                    error=""
                    selectedTemplate={selectedTemplate}
                  />
                )}
                {actionKind === 'notify_user' && (
                  <SmallTextarea label="Message" value={notifyMessage} onChange={setNotifyMessage}
                    placeholder="e.g. Heads-up — entry just entered Documents Verified" />
                )}
                {actionKind === 'reassign' && (
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-text-secondary">Reassign to</label>
                    <select
                      value={reassignUserId ?? ''}
                      onChange={(e) => setReassignUserId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
                    >
                      <option value="">Pick a user…</option>
                      {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                  </div>
                )}
                {actionKind === 'add_tag' && (
                  <SmallField label="Tag name" value={tagName} onChange={setTagName} />
                )}

                {/* Condition filter — empty means fire for every entry. */}
                <ConditionBuilder conditions={conditions} onChange={setConditions} />

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => { setAdding(null); resetDrafts(); }}
                    className="px-2.5 py-1 text-[11px] rounded border border-border-color bg-bg-primary"
                  >Cancel</button>
                  <button
                    onClick={handleSave}
                    className="px-2.5 py-1 text-[11px] rounded bg-accent text-white"
                  >Save action</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Shared builder so both the per-stage section and the process-wide panel
 *  produce the same action JSON shape with the same validation. */
function buildActionFromDrafts(opts: {
  kind: ActionKind;
  wa: SendWhatsAppDraft;
  notify: string;
  reassignUserId: number | null;
  tag: string;
  ruleName: string;
}): { type: string; params: Record<string, any> } | null {
  const { kind, wa, notify, reassignUserId, tag, ruleName } = opts;
  if (kind === 'send_whatsapp') {
    if (!wa.template_id && !wa.free_form_text.trim()) {
      alert('Pick an approved template OR enter free-form text.');
      return null;
    }
    return {
      type: 'schedule_followup',
      params: {
        delay_minutes: delayToMinutes(wa.delay_value, wa.delay_unit),
        template_id: wa.template_id || undefined,
        free_form_text: wa.free_form_text.trim() || undefined,
        channel_id: wa.channel_id || undefined,
        variables: Object.keys(wa.variables).length ? wa.variables : undefined,
        max_per_contact: wa.max_per_contact,
        cooldown_hours: wa.cooldown_hours,
        name: ruleName,
      },
    };
  }
  if (kind === 'notify_user') {
    if (!notify.trim()) { alert('Enter a notification message.'); return null; }
    return { type: 'notify', params: { message: notify.trim() } };
  }
  if (kind === 'reassign') {
    if (!reassignUserId) { alert('Pick a user to reassign to.'); return null; }
    return { type: 'assign_lead', params: { user_id: reassignUserId } };
  }
  if (kind === 'add_tag') {
    if (!tag.trim()) { alert('Enter a tag name.'); return null; }
    return { type: 'add_note', params: { note: `[tag] ${tag.trim()}`, tag: tag.trim() } };
  }
  return null;
}

// ─── Automations Panel (rebuilt) ──────────────────────────────────────────────
//
// Scope-aware editor:
//   • Process-wide rules     → trigger ∈ {on_added, on_complete, on_drop, on_stuck}, stage_id = null
//   • Stage-specific rules   → trigger ∈ {on_enter, on_exit, on_stuck},             stage_id = required
//
// Actions exposed (mapped to backend ECA handlers):
//   • send_whatsapp     → schedule_followup w/ template + channel + delay + variables
//   • notify_user       → notify
//   • reassign          → assign_lead
//   • add_tag           → add_note (tag note for now; future: structured tag op)
//
// The "send_whatsapp" action requires picking a verified WhatsApp business
// number AND an approved Meta template — both are filtered server-side via
// existing endpoints (`/channels`, `/message-templates?meta_status=approved`).

type Scope = 'process' | 'stage';

type ActionKind = 'send_whatsapp' | 'notify_user' | 'reassign' | 'add_tag';

interface SendWhatsAppDraft {
  channel_id: number | null;       // verified WA business number to send FROM
  template_id: number | null;      // approved MessageTemplate
  delay_value: number;             // amount paired with delay_unit
  delay_unit: 'minutes' | 'hours' | 'days';
  free_form_text: string;          // fallback when no template — only valid within 24h window
  max_per_contact: number;
  cooldown_hours: number;
  variables: Record<string, string>;  // position ("1","2",…) → token or literal
}

const DEFAULT_SEND_WA: SendWhatsAppDraft = {
  channel_id: null,
  template_id: null,
  delay_value: 0,
  delay_unit: 'minutes',
  free_form_text: '',
  max_per_contact: 3,
  cooldown_hours: 24,
  variables: {},
};

function delayToMinutes(value: number, unit: SendWhatsAppDraft['delay_unit']): number {
  if (unit === 'days') return value * 1440;
  if (unit === 'hours') return value * 60;
  return value;
}

function triggerLabel(t: AutomationTrigger): string {
  switch (t) {
    case 'on_added':    return 'added to process';
    case 'on_enter':    return 'enters stage';
    case 'on_exit':     return 'leaves stage';
    case 'on_stuck':    return 'stuck (SLA breach)';
    case 'on_complete': return 'completed';
    case 'on_drop':     return 'dropped';
  }
}

function actionSummary(action: Record<string, any>): string {
  const t = action?.type;
  const p = action?.params || {};
  if (t === 'schedule_followup') {
    const parts: string[] = ['📱 Send WhatsApp'];
    if (p.template_id) parts.push(`template #${p.template_id}`);
    else if (p.free_form_text) parts.push('free-form text');
    if (p.delay_minutes) {
      const m = Number(p.delay_minutes);
      if (m >= 1440 && m % 1440 === 0) parts.push(`after ${m / 1440}d`);
      else if (m >= 60 && m % 60 === 0) parts.push(`after ${m / 60}h`);
      else parts.push(`after ${m}m`);
    } else parts.push('immediately');
    if (p.channel_id) parts.push(`from ch#${p.channel_id}`);
    return parts.join(' · ');
  }
  if (t === 'notify') return `🔔 Notify: ${p.message || ''}`;
  if (t === 'assign_lead') return `👤 Reassign → user #${p.user_id ?? '?'}`;
  if (t === 'add_note') return `🏷  Add tag: ${p.tag || p.note || ''}`;
  // Fallback
  return `${t || 'action'} ${Object.entries(p).map(([k, v]) => `${k}=${v}`).join(' ')}`;
}

// Process-wide AutomationsPanel — narrow scope. Stage-specific rules now live
// inside each StageCard above. This panel only handles cross-stage events.
function AutomationsPanel({
  process, stages, rules,
  waChannels, waTemplates, employees, pickersLoaded,
  onReload,
}: {
  process: BusinessProcess;
  stages: ProcessStage[];           // kept for label resolution on legacy rows
  rules: AutomationRule[];          // already filtered to stage_id == null by parent
  waChannels: Channel[];
  waTemplates: MessageTemplate[];
  employees: Employee[];
  pickersLoaded: boolean;
  onReload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [trigger, setTrigger] = useState<AutomationTrigger>('on_added');
  const [actionKind, setActionKind] = useState<ActionKind>('send_whatsapp');

  const [waDraft, setWaDraft] = useState<SendWhatsAppDraft>(DEFAULT_SEND_WA);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [reassignUserId, setReassignUserId] = useState<number | null>(null);
  const [tagName, setTagName] = useState('');
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);

  // Process-wide triggers only. Stage-scoped triggers live in StageCard.
  const processWideTriggers: AutomationTrigger[] = ['on_added', 'on_complete', 'on_drop', 'on_stuck'];

  function resetDrafts() {
    setWaDraft(DEFAULT_SEND_WA);
    setNotifyMessage(''); setReassignUserId(null); setTagName('');
    setActionKind('send_whatsapp');
    setConditions([]);
  }

  async function handleSave() {
    const action = buildActionFromDrafts({
      kind: actionKind,
      wa: waDraft,
      notify: notifyMessage,
      reassignUserId,
      tag: tagName,
      ruleName: `Process #${process.id} ${trigger}`,
    });
    if (!action) return;
    const cleanConds = sanitizeConditions(conditions);
    if (cleanConds === null) {
      alert('One or more conditions is missing a value.');
      return;
    }
    await createAutomation(process.id, {
      trigger,
      stage_id: null,    // hard-locked here — this panel is process-wide only
      action,
      conditions: cleanConds.length ? cleanConds : undefined,
    });
    setAdding(false);
    resetDrafts();
    onReload();
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this automation?')) return;
    await deleteAutomation(process.id, id);
    onReload();
  }

  const selectedTemplate = waTemplates.find(t => t.id === waDraft.template_id) || null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Process-wide automation</h3>
          <p className="text-[11px] text-text-secondary mt-0.5">
            Rules that fire across the whole pipeline — entry added, completed, dropped, or stuck (any stage).
            <span className="ml-1 italic">Stage-specific rules now live inside each stage card above.</span>
          </p>
        </div>
        <button onClick={() => { setAdding(s => !s); if (adding) resetDrafts(); }} className="text-xs text-accent hover:underline font-medium">
          {adding ? 'Cancel' : '+ Add rule'}
        </button>
      </div>

      {adding && (
        <div className="rounded-lg border border-border-color bg-bg-secondary p-3 mb-3 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-text-secondary">When</label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}
              className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
            >
              {processWideTriggers.map(t => (
                <option key={t} value={t}>Entry {triggerLabel(t)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-text-secondary">Action</label>
            <select
              value={actionKind}
              onChange={(e) => setActionKind(e.target.value as ActionKind)}
              className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
            >
              <option value="send_whatsapp">📱 Send WhatsApp message (to linked contact)</option>
              <option value="notify_user">🔔 Notify entry owner</option>
              <option value="reassign">👤 Reassign entry to user</option>
              <option value="add_tag">🏷  Add tag / note on contact</option>
            </select>
          </div>

          {actionKind === 'send_whatsapp' && (
            <SendWhatsAppEditor
              draft={waDraft}
              onChange={setWaDraft}
              channels={waChannels}
              templates={waTemplates}
              loaded={pickersLoaded}
              error=""
              selectedTemplate={selectedTemplate}
            />
          )}
          {actionKind === 'notify_user' && (
            <SmallTextarea
              label="Message"
              value={notifyMessage}
              onChange={setNotifyMessage}
              placeholder="e.g. New high-value lead entered the pipeline"
            />
          )}
          {actionKind === 'reassign' && (
            <div>
              <label className="text-[10px] uppercase tracking-wide text-text-secondary">Reassign to</label>
              <select
                value={reassignUserId ?? ''}
                onChange={(e) => setReassignUserId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
              >
                <option value="">Pick a user…</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </div>
          )}
          {actionKind === 'add_tag' && (
            <SmallField label="Tag name" value={tagName} onChange={setTagName} />
          )}

          {/* Condition filter — empty means fire for every entry. */}
          <ConditionBuilder conditions={conditions} onChange={setConditions} />

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setAdding(false); resetDrafts(); }} className="px-3 py-1 text-xs rounded border border-border-color bg-bg-primary">Cancel</button>
            <button onClick={handleSave} className="px-3 py-1 text-xs rounded bg-accent text-white">Save rule</button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="text-xs text-text-secondary">No process-wide rules. Most users only need stage-specific rules — set those inside each stage card above.</p>
      ) : (
        <RuleGroup
          label="Process-wide"
          hint="Fire across the whole pipeline"
          rules={rules}
          stages={stages}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function RuleGroup({ label, hint, rules, stages, onDelete }: {
  label: string; hint: string;
  rules: AutomationRule[]; stages: ProcessStage[]; onDelete: (id: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <h4 className="text-[11px] uppercase tracking-wide font-semibold text-text-secondary">{label}</h4>
        <span className="text-[10px] text-text-secondary/70">{hint}</span>
      </div>
      <div className="space-y-2">
        {rules.map(r => {
          const stageName = r.stage_id ? stages.find(s => s.id === r.stage_id)?.name ?? 'Unknown stage' : null;
          return (
            <div key={r.id} className="flex items-start justify-between gap-2 rounded-md border border-border-color bg-card-bg px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-text-primary truncate">
                  When entry <span className="text-accent">{triggerLabel(r.trigger as AutomationTrigger)}</span>
                  {stageName && <> in <span className="text-accent">{stageName}</span></>}
                </p>
                {r.conditions && r.conditions.length > 0 && (
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    if {r.conditions.map(c => conditionSummary(c)).join(' AND ')}
                  </p>
                )}
                <p className="text-text-secondary truncate mt-0.5">→ {actionSummary(r.action)}</p>
              </div>
              <button onClick={() => onDelete(r.id)} className="p-1 text-text-secondary hover:text-red-500 flex-shrink-0" title="Delete rule">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Send WhatsApp Editor ────────────────────────────────────────────────────

const VARIABLE_TOKENS: { label: string; token: string }[] = [
  { label: 'Contact name', token: '{{contact.name}}' },
  { label: 'Contact phone', token: '{{contact.phone}}' },
  { label: 'Entry title', token: '{{entry.title}}' },
  { label: 'Stage name', token: '{{entry.stage}}' },
  { label: 'Expected value', token: '{{entry.value}}' },
  { label: 'Process name', token: '{{process.name}}' },
];

function SendWhatsAppEditor({
  draft, onChange, channels, templates, loaded, error, selectedTemplate,
}: {
  draft: SendWhatsAppDraft;
  onChange: (d: SendWhatsAppDraft) => void;
  channels: Channel[];
  templates: MessageTemplate[];
  loaded: boolean;
  error: string;
  selectedTemplate: MessageTemplate | null;
}) {
  // Derive variable slots from the selected template's body (count {{N}}).
  const variableSlots = useMemo(() => {
    if (!selectedTemplate) return [] as number[];
    const body = selectedTemplate.body || '';
    const re = /\{\{(\d+)\}\}/g;
    const seen = new Set<number>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) seen.add(Number(m[1]));
    return Array.from(seen).sort((a, b) => a - b);
  }, [selectedTemplate]);

  function setVariable(pos: number, value: string) {
    const next = { ...draft.variables, [String(pos)]: value };
    if (!value) delete next[String(pos)];
    onChange({ ...draft, variables: next });
  }

  return (
    <div className="rounded-md border border-border-color bg-bg-primary p-3 space-y-3">
      {!loaded && <p className="text-[11px] text-text-secondary">Loading channels &amp; templates…</p>}
      {error && <p className="text-[11px] text-red-500">{error}</p>}

      {/* Recipient — fixed, with explanation */}
      <div className="rounded-md bg-bg-secondary px-3 py-2 text-[11px] text-text-secondary">
        <strong className="text-text-primary">Who receives it:</strong> The contact linked to the pipeline entry — resolved automatically when the rule fires.
      </div>

      {/* Send-from channel */}
      <div>
        <label className="text-[10px] uppercase tracking-wide text-text-secondary">Send from (verified WhatsApp number)</label>
        <select
          value={draft.channel_id ?? ''}
          onChange={(e) => onChange({ ...draft, channel_id: e.target.value ? Number(e.target.value) : null })}
          className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
        >
          <option value="">Auto — contact’s last-used WhatsApp number</option>
          {channels.map(c => (
            <option key={c.id} value={c.id}>{whatsAppChannelLabel(c)} ✅</option>
          ))}
        </select>
        {loaded && channels.length === 0 && (
          <p className="mt-1 text-[10px] text-amber-600">No verified WhatsApp channels found. Connect one under Settings → Channels first.</p>
        )}
      </div>

      {/* Delay */}
      <div>
        <label className="text-[10px] uppercase tracking-wide text-text-secondary">When (after the trigger fires)</label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="number" min={0}
            value={draft.delay_value}
            onChange={(e) => onChange({ ...draft, delay_value: Math.max(0, Number(e.target.value || 0)) })}
            className="w-20 rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
          />
          <select
            value={draft.delay_unit}
            onChange={(e) => onChange({ ...draft, delay_unit: e.target.value as SendWhatsAppDraft['delay_unit'] })}
            className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
          >
            <option value="minutes">minutes</option>
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>
          <span className="text-[11px] text-text-secondary">later  (use 0 for immediate)</span>
        </div>
      </div>

      {/* Template */}
      <div>
        <label className="text-[10px] uppercase tracking-wide text-text-secondary">Approved template</label>
        <select
          value={draft.template_id ?? ''}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null;
            onChange({ ...draft, template_id: id, free_form_text: id ? '' : draft.free_form_text });
          }}
          className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
        >
          <option value="">— None (use free-form text below) —</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.name} · {t.meta_category || 'UTILITY'} · {t.language || 'en'}</option>
          ))}
        </select>
        {selectedTemplate && (
          <div className="mt-2 rounded bg-bg-secondary px-2 py-1.5 text-[11px] text-text-secondary whitespace-pre-wrap">
            {selectedTemplate.body}
          </div>
        )}
      </div>

      {/* Variable bindings */}
      {variableSlots.length > 0 && (
        <div>
          <label className="text-[10px] uppercase tracking-wide text-text-secondary">Variables</label>
          <div className="space-y-1.5 mt-1">
            {variableSlots.map(pos => (
              <div key={pos} className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-text-secondary w-12">{`{{${pos}}}`}</span>
                <select
                  value={draft.variables[String(pos)] ?? ''}
                  onChange={(e) => setVariable(pos, e.target.value)}
                  className="flex-1 rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
                >
                  <option value="">— Pick a value —</option>
                  {VARIABLE_TOKENS.map(v => <option key={v.token} value={v.token}>{v.label} ({v.token})</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Free-form text (only valid if no template chosen) */}
      {!draft.template_id && (
        <div>
          <label className="text-[10px] uppercase tracking-wide text-text-secondary">Free-form text</label>
          <textarea
            rows={2}
            value={draft.free_form_text}
            onChange={(e) => onChange({ ...draft, free_form_text: e.target.value })}
            placeholder="Only delivered within the 24h customer-service window. Supports {{contact.name}} etc."
            className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
          />
        </div>
      )}

      {/* Guardrails */}
      <div className="grid grid-cols-2 gap-2">
        <SmallField
          label="Max per contact"
          value={String(draft.max_per_contact)}
          onChange={(v) => onChange({ ...draft, max_per_contact: Math.max(0, Number(v) || 0) })}
          type="number"
        />
        <SmallField
          label="Cooldown (hours)"
          value={String(draft.cooldown_hours)}
          onChange={(v) => onChange({ ...draft, cooldown_hours: Math.max(0, Number(v) || 0) })}
          type="number"
        />
      </div>
    </div>
  );
}

function SmallTextarea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-text-secondary uppercase tracking-wide mb-0.5">{label}</label>
      <textarea
        rows={2} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}

// ─── Condition Builder ───────────────────────────────────────────────────────
//
// Typed AND-conditions filter that gates a rule's action on entry-level
// attributes. The field whitelist + per-field operator/widget mapping keep
// the JSON payload tight and the UI legible.
//
// Field paths are evaluated against the event context's nested `entry` dict
// on the backend (`_resolve_field` walks dotted paths), so paths here must
// match the keys produced by `_entry_event_payload` in processes.py.

type FieldType = 'enum' | 'number' | 'text' | 'days';

interface ConditionFieldDef {
  /** Backend dotted path (must match _entry_event_payload keys). */
  path: string;
  /** Display label. */
  label: string;
  /** Drives operator list + value widget. */
  type: FieldType;
  /** For enum fields: option list (value, label). */
  options?: { value: string; label: string }[];
  /** Helper hint shown under the value input. */
  hint?: string;
}

const CONDITION_FIELDS: ConditionFieldDef[] = [
  {
    path: 'entry.priority', label: 'Priority', type: 'enum',
    options: [
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
  },
  {
    path: 'entry.expected_value', label: 'Expected value', type: 'number',
    hint: 'Numeric — operators compare as numbers.',
  },
  {
    path: 'entry.source', label: 'Source', type: 'text',
    hint: 'Exact match (eq/neq) or comma-separated list (in / not in).',
  },
  {
    path: 'entry.days_in_stage', label: 'Days in current stage', type: 'number',
  },
  {
    path: 'entry.expected_close_date', label: 'Expected close date', type: 'days',
    hint: 'Number of days until the expected close.',
  },
];

interface OperatorDef { op: string; label: string; }

const OPS_BY_TYPE: Record<FieldType, OperatorDef[]> = {
  enum: [
    { op: 'eq',  label: 'is' },
    { op: 'neq', label: 'is not' },
    { op: 'in',  label: 'is one of' },
    { op: 'not_in', label: 'is none of' },
    { op: 'is_empty', label: 'is empty' },
    { op: 'is_not_empty', label: 'is set' },
  ],
  number: [
    { op: 'gte', label: '≥' },
    { op: 'gt',  label: '>' },
    { op: 'lte', label: '≤' },
    { op: 'lt',  label: '<' },
    { op: 'eq',  label: '=' },
    { op: 'neq', label: '≠' },
    { op: 'is_empty', label: 'is empty' },
    { op: 'is_not_empty', label: 'is set' },
  ],
  text: [
    { op: 'eq',  label: 'is' },
    { op: 'neq', label: 'is not' },
    { op: 'contains', label: 'contains' },
    { op: 'in',  label: 'is one of' },
    { op: 'not_in', label: 'is none of' },
    { op: 'is_empty', label: 'is empty' },
    { op: 'is_not_empty', label: 'is set' },
  ],
  days: [
    { op: 'days_until_lt', label: 'is less than (days from now)' },
    { op: 'days_until_gt', label: 'is more than (days from now)' },
    { op: 'is_empty', label: 'has no date' },
    { op: 'is_not_empty', label: 'has a date' },
  ],
};

const NO_VALUE_OPS = new Set(['is_empty', 'is_not_empty']);
const LIST_OPS = new Set(['in', 'not_in']);

/** Render a one-line summary of a condition, e.g. "Priority is high". */
function conditionSummary(c: AutomationCondition): string {
  const f = CONDITION_FIELDS.find(x => x.path === c.field);
  const fieldLabel = f?.label || c.field;
  const opLabel = (OPS_BY_TYPE[f?.type || 'text'].find(o => o.op === c.op)?.label) || c.op;
  if (NO_VALUE_OPS.has(c.op)) return `${fieldLabel} ${opLabel}`;
  if (LIST_OPS.has(c.op)) {
    const arr = Array.isArray(c.value) ? c.value : [];
    return `${fieldLabel} ${opLabel} [${arr.join(', ')}]`;
  }
  // Enum: prefer the label over the raw value.
  if (f?.type === 'enum' && f.options) {
    const o = f.options.find(o => o.value === c.value);
    return `${fieldLabel} ${opLabel} ${o?.label ?? c.value}`;
  }
  return `${fieldLabel} ${opLabel} ${c.value ?? ''}`;
}

function ConditionBuilder({
  conditions, onChange,
}: {
  conditions: AutomationCondition[];
  onChange: (next: AutomationCondition[]) => void;
}) {
  function update(idx: number, patch: Partial<AutomationCondition>) {
    const next = conditions.map((c, i) => i === idx ? { ...c, ...patch } : c);
    onChange(next);
  }
  function remove(idx: number) {
    onChange(conditions.filter((_, i) => i !== idx));
  }
  function add() {
    // Default to the first field + first op + empty value.
    const f = CONDITION_FIELDS[0];
    const op = OPS_BY_TYPE[f.type][0].op;
    onChange([...conditions, { field: f.path, op, value: '' }]);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-wide text-text-secondary">
          Conditions {conditions.length > 0 && <span className="text-text-secondary/70 normal-case ml-1">(all must match)</span>}
        </label>
        <button onClick={add} className="text-[11px] text-accent hover:underline font-medium">
          + Add condition
        </button>
      </div>

      {conditions.length === 0 ? (
        <p className="text-[10px] text-text-secondary/70 mt-1">
          No conditions — rule fires for every entry matching the trigger.
        </p>
      ) : (
        <div className="space-y-1.5 mt-1">
          {conditions.map((c, idx) => {
            const fdef = CONDITION_FIELDS.find(f => f.path === c.field) || CONDITION_FIELDS[0];
            const ops = OPS_BY_TYPE[fdef.type];
            const opOk = ops.some(o => o.op === c.op);
            const safeOp = opOk ? c.op : ops[0].op;
            const showValue = !NO_VALUE_OPS.has(safeOp);
            return (
              <div key={idx} className="rounded-md border border-border-color bg-bg-primary p-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Field */}
                  <select
                    value={c.field}
                    onChange={(e) => {
                      const newField = CONDITION_FIELDS.find(f => f.path === e.target.value);
                      if (!newField) return;
                      // Reset op + value to safe defaults for the new type.
                      update(idx, {
                        field: newField.path,
                        op: OPS_BY_TYPE[newField.type][0].op,
                        value: '',
                      });
                    }}
                    className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs flex-1 min-w-[140px]"
                  >
                    {CONDITION_FIELDS.map(f => (
                      <option key={f.path} value={f.path}>{f.label}</option>
                    ))}
                  </select>

                  {/* Operator */}
                  <select
                    value={safeOp}
                    onChange={(e) => update(idx, { op: e.target.value, value: NO_VALUE_OPS.has(e.target.value) ? null : c.value })}
                    className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
                  >
                    {ops.map(o => <option key={o.op} value={o.op}>{o.label}</option>)}
                  </select>

                  {/* Value widget */}
                  {showValue && <ConditionValueInput fdef={fdef} op={safeOp} value={c.value} onChange={(v) => update(idx, { value: v })} />}

                  <button
                    onClick={() => remove(idx)}
                    className="p-1 text-text-secondary hover:text-red-500"
                    title="Remove condition"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                {fdef.hint && <p className="text-[10px] text-text-secondary/70">{fdef.hint}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConditionValueInput({
  fdef, op, value, onChange,
}: {
  fdef: ConditionFieldDef;
  op: string;
  value: any;
  onChange: (v: any) => void;
}) {
  const isList = LIST_OPS.has(op);

  // List operators always render as a comma-separated text field.
  if (isList) {
    const text = Array.isArray(value) ? value.join(', ') : String(value ?? '');
    return (
      <input
        type="text"
        value={text}
        onChange={(e) => {
          const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
          onChange(arr);
        }}
        placeholder="e.g. instagram, facebook, referral"
        className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs flex-1 min-w-[160px]"
      />
    );
  }

  if (fdef.type === 'enum' && fdef.options) {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
      >
        <option value="">— Pick —</option>
        {fdef.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  if (fdef.type === 'number' || fdef.type === 'days') {
    return (
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="w-28 rounded border border-border-color bg-bg-primary px-2 py-1 text-xs"
      />
    );
  }

  // Text default.
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-border-color bg-bg-primary px-2 py-1 text-xs flex-1 min-w-[140px]"
    />
  );
}

/** Normalise & validate a draft condition list before send. Drops rows
 *  with empty value when the operator requires one. Returns null if any
 *  enum/text/number condition was left blank (so we can show an alert). */
function sanitizeConditions(draft: AutomationCondition[]): AutomationCondition[] | null {
  const out: AutomationCondition[] = [];
  for (const c of draft) {
    if (NO_VALUE_OPS.has(c.op)) {
      out.push({ field: c.field, op: c.op, value: null });
      continue;
    }
    if (LIST_OPS.has(c.op)) {
      const arr = Array.isArray(c.value) ? c.value : String(c.value || '')
        .split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length === 0) return null;
      out.push({ field: c.field, op: c.op, value: arr });
      continue;
    }
    if (c.value === '' || c.value === null || c.value === undefined) return null;
    out.push({ field: c.field, op: c.op, value: c.value });
  }
  return out;
}
