'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PermissionGuard from '@/components/permission-guard';
import {
  getProcess,
  listEntries,
  addEntry,
  moveEntry,
  removeEntry,
  addStage,
  updateStage,
  deleteStage,
  addStageWork,
  deleteStageWork,
  type BusinessProcess,
  type ProcessEntry,
  type ProcessStage,
} from '@/services/processes';
import { listLeadsForSelect, type LeadOption } from '@/services/customers';
import { listWorkTemplates, type WorkTemplate } from '@/services/work';
import { listEmployees, type Employee } from '@/services/employees';

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
  '#EC4899', '#06B6D4', '#6366F1', '#14B8A6', '#F97316',
];

function randomColor() {
  return STAGE_COLORS[Math.floor(Math.random() * STAGE_COLORS.length)];
}

function relativeTime(iso?: string | null) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="min-w-[260px] flex-shrink-0 rounded-lg border border-border-color bg-bg-secondary p-3 animate-pulse">
          <div className="h-4 w-28 rounded bg-bg-primary mb-3" />
          <div className="space-y-2">
            <div className="h-20 rounded-lg bg-bg-primary" />
            <div className="h-20 rounded-lg bg-bg-primary" />
          </div>
        </div>
      ))}
    </div>
  );
}

function BuilderSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border-l-4 border-border-color bg-card-bg p-4 animate-pulse">
          <div className="h-4 w-40 rounded bg-bg-secondary mb-3" />
          <div className="h-3 w-60 rounded bg-bg-secondary" />
        </div>
      ))}
    </div>
  );
}

// ─── Add Entry Modal ──────────────────────────────────────────────────────────

function AddEntryModal({
  open,
  onClose,
  process,
  stages,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  process: BusinessProcess;
  stages: ProcessStage[];
  onAdded: (entry: ProcessEntry) => void;
}) {
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);
  const [selectedEntityName, setSelectedEntityName] = useState('');
  const [selectedEntityPhone, setSelectedEntityPhone] = useState('');
  const [stageId, setStageId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Set default stage
  useEffect(() => {
    if (open && stages.length > 0 && !stageId) {
      const activeStages = stages.filter((s) => s.stage_type === 'active');
      setStageId(activeStages.length > 0 ? activeStages[0].id : stages[0].id);
    }
  }, [open, stages, stageId]);

  // Search leads
  useEffect(() => {
    if (!open || process.entity_type !== 'lead') return;
    const timer = setTimeout(() => {
      setSearchLoading(true);
      listLeadsForSelect({ search: leadSearch || undefined, per_page: 50 })
        .then(setLeads)
        .catch(() => {})
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [open, leadSearch, process.entity_type]);

  useEffect(() => {
    if (!open) {
      setSelectedEntityId(null);
      setSelectedEntityName('');
      setSelectedEntityPhone('');
      setStageId(null);
      setNotes('');
      setError('');
      setLeadSearch('');
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEntityId) {
      setError('Please select an entity');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const entry = await addEntry(process.id, {
        entity_id: selectedEntityId,
        entity_name: selectedEntityName || undefined,
        entity_phone: selectedEntityPhone || undefined,
        stage_id: stageId ?? undefined,
        notes: notes.trim() || undefined,
      });
      onAdded(entry);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add entry');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-border-color bg-card-bg p-6 shadow-xl mx-4">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Add Entry</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lead / Entity selector */}
          {process.entity_type === 'lead' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Select Lead <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                placeholder="Search by name or phone..."
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent mb-2"
              />
              <div className="max-h-40 overflow-y-auto rounded-md border border-border-color bg-bg-primary">
                {searchLoading && (
                  <div className="px-3 py-2 text-xs text-text-secondary">Searching...</div>
                )}
                {!searchLoading && leads.length === 0 && (
                  <div className="px-3 py-2 text-xs text-text-secondary">No leads found</div>
                )}
                {leads.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => {
                      setSelectedEntityId(lead.id);
                      setSelectedEntityName(lead.name || lead.phone);
                      setSelectedEntityPhone(lead.phone);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-secondary transition-colors ${
                      selectedEntityId === lead.id
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-text-primary'
                    }`}
                  >
                    <span className="font-medium">{lead.name || 'Unnamed'}</span>
                    <span className="ml-2 text-text-secondary text-xs">{lead.phone}</span>
                  </button>
                ))}
              </div>
              {selectedEntityId && (
                <p className="mt-1 text-xs text-accent">
                  Selected: {selectedEntityName}
                </p>
              )}
            </div>
          )}

          {/* Stage selector */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Stage
            </label>
            <select
              value={stageId ?? ''}
              onChange={(e) => setStageId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-border-color bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-primary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedEntityId}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Board View ───────────────────────────────────────────────────────────────

function BoardView({
  process,
  stages,
  entries,
  onMoveEntry,
  onRemoveEntry,
  onAddEntry,
}: {
  process: BusinessProcess;
  stages: ProcessStage[];
  entries: ProcessEntry[];
  onMoveEntry: (entryId: number, stageId: number) => void;
  onRemoveEntry: (entryId: number) => void;
  onAddEntry: () => void;
}) {
  const entriesByStage = useMemo(() => {
    const map: Record<number, ProcessEntry[]> = {};
    stages.forEach((s) => {
      map[s.id] = [];
    });
    entries.forEach((e) => {
      if (e.current_stage_id && map[e.current_stage_id]) {
        map[e.current_stage_id].push(e);
      }
    });
    return map;
  }, [stages, entries]);

  function columnBgClass(stage: ProcessStage) {
    if (stage.stage_type === 'completed')
      return 'bg-emerald-50/30 dark:bg-emerald-950/10';
    if (stage.stage_type === 'failed')
      return 'bg-red-50/30 dark:bg-red-950/10';
    return 'bg-bg-secondary';
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6">
      {stages
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((stage) => {
          const stageEntries = entriesByStage[stage.id] || [];
          return (
            <div
              key={stage.id}
              className={`min-w-[260px] max-w-[300px] flex-shrink-0 rounded-lg border border-border-color p-3 ${columnBgClass(stage)}`}
              style={{ borderLeftWidth: '4px', borderLeftColor: stage.color || '#6B7280' }}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-text-primary truncate">
                    {stage.name}
                  </span>
                  <span className="flex-shrink-0 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-bg-primary text-xs font-medium text-text-secondary px-1.5">
                    {stageEntries.length}
                  </span>
                </div>
                {stage.stage_type === 'completed' && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Done</span>
                )}
                {stage.stage_type === 'failed' && (
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">Failed</span>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {stageEntries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    stages={stages}
                    currentStageId={stage.id}
                    onMove={(toStageId) => onMoveEntry(entry.id, toStageId)}
                    onRemove={() => onRemoveEntry(entry.id)}
                  />
                ))}
              </div>

              {/* Add button for first active stage */}
              {stage.stage_type === 'active' && stage.sort_order === Math.min(...stages.filter(s => s.stage_type === 'active').map(s => s.sort_order)) && (
                <button
                  onClick={onAddEntry}
                  className="mt-2 w-full rounded-md border border-dashed border-border-color py-1.5 text-xs text-text-secondary hover:border-accent hover:text-accent transition-colors"
                >
                  + Add Entry
                </button>
              )}
            </div>
          );
        })}
    </div>
  );
}

function EntryCard({
  entry,
  stages,
  currentStageId,
  onMove,
  onRemove,
}: {
  entry: ProcessEntry;
  stages: ProcessStage[];
  currentStageId: number;
  onMove: (stageId: number) => void;
  onRemove: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  const otherStages = stages.filter((s) => s.id !== currentStageId);

  return (
    <div
      className="rounded-lg border border-border-color bg-card-bg p-3 shadow-sm hover:shadow-md transition-shadow group relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {entry.entity_name || `#${entry.entity_id}`}
          </p>
          {entry.entity_phone && (
            <p className="text-xs text-text-secondary mt-0.5 truncate">{entry.entity_phone}</p>
          )}
        </div>
        {/* Remove button */}
        {showActions && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="flex-shrink-0 rounded p-0.5 text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            title="Remove entry"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {entry.assigned_to_name && (
          <span className="inline-flex items-center gap-1 rounded-full bg-bg-secondary px-2 py-0.5 text-[10px] font-medium text-text-secondary">
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
            </svg>
            {entry.assigned_to_name}
          </span>
        )}
        {entry.stage_entered_at && (
          <span className="text-[10px] text-text-secondary">
            {relativeTime(entry.stage_entered_at)}
          </span>
        )}
      </div>

      {/* Move dropdown */}
      {showActions && otherStages.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border-color">
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onMove(Number(e.target.value));
              e.target.value = '';
            }}
            className="w-full rounded border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-secondary focus:outline-none focus:border-accent"
          >
            <option value="" disabled>
              Move to...
            </option>
            {otherStages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ─── Builder View ─────────────────────────────────────────────────────────────

function BuilderView({
  process,
  stages,
  onReload,
}: {
  process: BusinessProcess;
  stages: ProcessStage[];
  onReload: () => void;
}) {
  const [templates, setTemplates] = useState<WorkTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [addingStageName, setAddingStageName] = useState('');
  const [addingStageColor, setAddingStageColor] = useState(randomColor());
  const [addingStage, setAddingStage] = useState(false);

  useEffect(() => {
    if (!loaded) {
      Promise.all([listWorkTemplates(), listEmployees()])
        .then(([t, e]) => {
          setTemplates(t.filter((tpl) => tpl.is_active));
          setEmployees(e.filter((emp) => emp.is_active));
        })
        .catch(() => {})
        .finally(() => setLoaded(true));
    }
  }, [loaded]);

  async function handleAddStage() {
    if (!addingStageName.trim()) return;
    setAddingStage(true);
    try {
      await addStage(process.id, {
        name: addingStageName.trim(),
        color: addingStageColor,
        stage_type: 'active',
        sort_order: stages.length,
      });
      setAddingStageName('');
      setAddingStageColor(randomColor());
      onReload();
    } catch {
    } finally {
      setAddingStage(false);
    }
  }

  return (
    <div className="space-y-4">
      {stages
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((stage) => (
          <StageBuilderCard
            key={stage.id}
            processId={process.id}
            stage={stage}
            templates={templates}
            employees={employees}
            onReload={onReload}
          />
        ))}

      {/* Add Stage */}
      <div className="rounded-lg border border-dashed border-border-color bg-card-bg p-4">
        <p className="text-sm font-medium text-text-secondary mb-3">Add New Stage</p>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={addingStageColor}
            onChange={(e) => setAddingStageColor(e.target.value)}
            className="h-8 w-8 rounded border border-border-color cursor-pointer"
            title="Stage color"
          />
          <input
            type="text"
            value={addingStageName}
            onChange={(e) => setAddingStageName(e.target.value)}
            placeholder="Stage name..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddStage();
            }}
            className="flex-1 rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={handleAddStage}
            disabled={addingStage || !addingStageName.trim()}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {addingStage ? 'Adding...' : 'Add Stage'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StageBuilderCard({
  processId,
  stage,
  templates,
  employees,
  onReload,
}: {
  processId: number;
  stage: ProcessStage;
  templates: WorkTemplate[];
  employees: Employee[];
  onReload: () => void;
}) {
  const [editName, setEditName] = useState(stage.name);
  const [editType, setEditType] = useState(stage.stage_type);
  const [nameChanged, setNameChanged] = useState(false);
  const [typeChanged, setTypeChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Add work state
  const [showAddWork, setShowAddWork] = useState(false);
  const [workTemplateId, setWorkTemplateId] = useState<number | null>(null);
  const [workTitle, setWorkTitle] = useState('');
  const [workAssigneeId, setWorkAssigneeId] = useState<number | null>(null);
  const [addingWork, setAddingWork] = useState(false);

  async function saveName() {
    if (!nameChanged || editName.trim() === stage.name) {
      setNameChanged(false);
      return;
    }
    setSaving(true);
    try {
      await updateStage(processId, stage.id, { name: editName.trim() });
      setNameChanged(false);
      onReload();
    } catch {
    } finally {
      setSaving(false);
    }
  }

  async function saveType(newType: string) {
    setEditType(newType as any);
    setSaving(true);
    try {
      await updateStage(processId, stage.id, { stage_type: newType });
      onReload();
    } catch {
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete stage "${stage.name}"? Entries in this stage will need to be reassigned.`)) return;
    setDeleting(true);
    try {
      await deleteStage(processId, stage.id);
      onReload();
    } catch {
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddWork() {
    if (!workTemplateId && !workTitle.trim()) return;
    setAddingWork(true);
    try {
      await addStageWork(processId, stage.id, {
        work_template_id: workTemplateId || undefined,
        title: workTitle.trim() || undefined,
        default_assigned_to_id: workAssigneeId || undefined,
      });
      setShowAddWork(false);
      setWorkTemplateId(null);
      setWorkTitle('');
      setWorkAssigneeId(null);
      onReload();
    } catch {
    } finally {
      setAddingWork(false);
    }
  }

  async function handleDeleteWork(workId: number) {
    try {
      await deleteStageWork(processId, stage.id, workId);
      onReload();
    } catch {}
  }

  const typeBadgeClass =
    editType === 'completed'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : editType === 'failed'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';

  return (
    <div
      className="rounded-lg border border-border-color bg-card-bg overflow-hidden"
      style={{ borderLeftWidth: '4px', borderLeftColor: stage.color || '#6B7280' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0 text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg
            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <input
          type="text"
          value={editName}
          onChange={(e) => {
            setEditName(e.target.value);
            setNameChanged(true);
          }}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveName();
          }}
          className="flex-1 bg-transparent text-sm font-semibold text-text-primary focus:outline-none focus:bg-bg-primary focus:px-2 focus:rounded transition-all min-w-0"
        />

        <select
          value={editType}
          onChange={(e) => saveType(e.target.value)}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none ${typeBadgeClass}`}
        >
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>

        <label
          className="flex items-center gap-1.5 cursor-pointer"
          title="Auto-advance to next stage when all work in this stage is completed"
        >
          <input
            type="checkbox"
            checked={stage.auto_advance_on_complete}
            onChange={async (e) => {
              setSaving(true);
              try {
                await updateStage(processId, stage.id, { auto_advance_on_complete: e.target.checked });
                onReload();
              } catch {} finally { setSaving(false); }
            }}
            className="rounded border-border-color text-accent focus:ring-accent h-3.5 w-3.5"
          />
          <span className="text-[10px] text-text-secondary whitespace-nowrap">Auto-advance</span>
        </label>

        <span className="text-xs text-text-secondary">
          {stage.entry_count} entr{stage.entry_count !== 1 ? 'ies' : 'y'}
        </span>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-shrink-0 rounded p-1 text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
          title="Delete stage"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>

      {/* Expanded content: works */}
      {expanded && (
        <div className="border-t border-border-color px-4 py-3">
          {/* Work items list */}
          {stage.stage_works.length > 0 ? (
            <div className="space-y-1.5 mb-3">
              {stage.stage_works
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((work) => (
                  <div
                    key={work.id}
                    className="flex items-center gap-2 rounded-md bg-bg-secondary px-3 py-2 group"
                  >
                    <svg className="h-3.5 w-3.5 text-text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                    </svg>
                    <span className="text-sm text-text-primary flex-1 truncate">
                      {work.work_template_name || work.title || 'Untitled'}
                    </span>
                    {work.default_assigned_to_name && (
                      <span className="flex-shrink-0 rounded-full bg-bg-primary px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                        {work.default_assigned_to_name}
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteWork(work.id)}
                      className="flex-shrink-0 rounded p-0.5 text-text-secondary opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                      title="Remove work"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary mb-3">No work templates attached to this stage.</p>
          )}

          {/* Add work inline form */}
          {showAddWork ? (
            <div className="rounded-md border border-border-color bg-bg-primary p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-text-secondary mb-0.5 uppercase tracking-wide">
                    Template
                  </label>
                  <select
                    value={workTemplateId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null;
                      setWorkTemplateId(id);
                      if (id) {
                        const tpl = templates.find((t) => t.id === id);
                        if (tpl) setWorkTitle(tpl.default_title || tpl.name);
                      }
                    }}
                    className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                  >
                    <option value="">Custom task (no template)</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-text-secondary mb-0.5 uppercase tracking-wide">
                    {workTemplateId ? 'Title override' : 'Title'}
                  </label>
                  <input
                    type="text"
                    value={workTitle}
                    onChange={(e) => setWorkTitle(e.target.value)}
                    placeholder={workTemplateId ? 'Optional override...' : 'Task title...'}
                    className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-text-secondary mb-0.5 uppercase tracking-wide">
                  Default Assignee
                </label>
                <select
                  value={workAssigneeId ?? ''}
                  onChange={(e) => setWorkAssigneeId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded border border-border-color bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                >
                  <option value="">None</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleAddWork}
                  disabled={addingWork || (!workTemplateId && !workTitle.trim())}
                  className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {addingWork ? 'Adding...' : 'Add'}
                </button>
                <button
                  onClick={() => {
                    setShowAddWork(false);
                    setWorkTemplateId(null);
                    setWorkTitle('');
                    setWorkAssigneeId(null);
                  }}
                  className="rounded border border-border-color bg-bg-secondary px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddWork(true)}
              className="text-xs text-accent hover:text-accent/80 font-medium transition-colors"
            >
              + Add Work
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProcessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const processId = Number(params.id);

  const [process, setProcess] = useState<BusinessProcess | null>(null);
  const [entries, setEntries] = useState<ProcessEntry[]>([]);
  const [view, setView] = useState<'board' | 'builder'>('board');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addEntryOpen, setAddEntryOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [proc, ents] = await Promise.all([
        getProcess(processId),
        listEntries(processId),
      ]);
      setProcess(proc);
      setEntries(ents);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to load process');
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stages = useMemo(() => process?.stages || [], [process]);

  async function handleMoveEntry(entryId: number, stageId: number) {
    // Optimistic update
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? {
              ...e,
              current_stage_id: stageId,
              current_stage_name: stages.find((s) => s.id === stageId)?.name || e.current_stage_name,
              stage_entered_at: new Date().toISOString(),
            }
          : e,
      ),
    );
    try {
      await moveEntry(processId, entryId, stageId);
    } catch {
      // Revert on error
      loadData();
    }
  }

  async function handleRemoveEntry(entryId: number) {
    if (!confirm('Remove this entry from the process?')) return;
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    try {
      await removeEntry(processId, entryId);
    } catch {
      loadData();
    }
  }

  function handleEntryAdded(entry: ProcessEntry) {
    setEntries((prev) => [...prev, entry]);
    // Also reload to get updated counts
    loadData();
  }

  return (
    <PermissionGuard permission="manage_work" module="lms">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Top bar */}
        <div className="mb-1 flex items-center gap-3">
          <Link
            href="/processes"
            className="text-sm text-text-secondary hover:text-accent transition-colors flex items-center gap-1"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Processes
          </Link>
          {process && (
            <>
              <span className="text-text-secondary">/</span>
              <h1 className="text-lg font-bold text-text-primary truncate">{process.name}</h1>
            </>
          )}
        </div>

        {process && (
          <p className="text-sm text-text-secondary mb-4">
            {process.entity_type === 'lead' ? 'Lead' : process.dynamic_model_name || 'Record'} process
            <span className="mx-1.5 text-border-color">|</span>
            {process.active_entries} active entr{process.active_entries !== 1 ? 'ies' : 'y'}
          </p>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
            <button onClick={loadData} className="ml-2 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-6">
            <BoardSkeleton />
          </div>
        )}

        {/* Loaded content */}
        {!loading && process && (
          <>
            {/* View tabs + actions */}
            <div className="flex items-center justify-between mb-4 border-b border-border-color">
              <div className="flex">
                <button
                  onClick={() => setView('board')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    view === 'board'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Board
                </button>
                <button
                  onClick={() => setView('builder')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    view === 'builder'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Builder
                </button>
              </div>

              {view === 'board' && (
                <button
                  onClick={() => setAddEntryOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors mb-1"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Entry
                </button>
              )}
            </div>

            {/* View content */}
            {view === 'board' ? (
              stages.length > 0 ? (
                <BoardView
                  process={process}
                  stages={stages}
                  entries={entries}
                  onMoveEntry={handleMoveEntry}
                  onRemoveEntry={handleRemoveEntry}
                  onAddEntry={() => setAddEntryOpen(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-color bg-card-bg py-16 text-center">
                  <p className="text-sm text-text-secondary mb-2">No stages configured.</p>
                  <button
                    onClick={() => setView('builder')}
                    className="text-sm text-accent hover:underline font-medium"
                  >
                    Switch to Builder to add stages
                  </button>
                </div>
              )
            ) : (
              <BuilderView process={process} stages={stages} onReload={loadData} />
            )}
          </>
        )}
      </div>

      {/* Add Entry Modal */}
      {process && (
        <AddEntryModal
          open={addEntryOpen}
          onClose={() => setAddEntryOpen(false)}
          process={process}
          stages={stages}
          onAdded={handleEntryAdded}
        />
      )}
    </PermissionGuard>
  );
}
