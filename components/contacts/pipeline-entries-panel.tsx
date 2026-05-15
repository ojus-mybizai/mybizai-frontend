'use client';

import { useEffect, useState } from 'react';
import {
  GitBranch, ChevronDown, Check, Loader2, Plus, X,
  Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import {
  getContactPipelineEntries,
  getLeadPipelineEntries,
  moveEntry,
  updateEntry,
  type ProcessEntryWithProcess,
} from '@/services/processes';

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysSince(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86_400_000);
  return d === 0 ? 'today' : d === 1 ? '1 day' : `${d} days`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
  if (status === 'dropped')   return <XCircle      className="w-3.5 h-3.5 text-red-400"   />;
  return                              <Clock        className="w-3.5 h-3.5 text-blue-400"  />;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  entityType: 'contact' | 'lead';
  entityId: number;
  onAddClick: () => void;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PipelineEntriesPanel({ entityType, entityId, onAddClick }: Props) {
  const [entries,  setEntries]  = useState<ProcessEntryWithProcess[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showDone, setShowDone] = useState(false);

  const load = () => {
    setLoading(true);
    const fn = entityType === 'contact'
      ? getContactPipelineEntries(entityId)
      : getLeadPipelineEntries(entityId);
    fn.then(setEntries).catch(() => setEntries([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [entityId, entityType]); // eslint-disable-line react-hooks/exhaustive-deps

  const active   = entries.filter(e => e.status === 'active');
  const finished = entries.filter(e => e.status !== 'active');

  const handleStageMove = async (entry: ProcessEntryWithProcess, stageId: number) => {
    try {
      const updated = await moveEntry(entry.process_id, entry.id, stageId);
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, ...updated } : e));
    } catch { /* noop */ }
  };

  const handleDrop = async (entry: ProcessEntryWithProcess) => {
    try {
      await updateEntry(entry.id, { status: 'dropped' });
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'dropped' } : e));
    } catch { /* noop */ }
  };

  return (
    <div className="border border-border-color rounded-xl overflow-hidden bg-bg-secondary/30">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border-color">
        <div className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-secondary-text" />
          <p className="text-xs font-semibold text-secondary-text uppercase tracking-wide flex-1">
            Pipelines
          </p>
          <button
            onClick={onAddClick}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-accent border border-accent/30 rounded-full hover:bg-accent/10 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        <p className="text-xs text-secondary-text mt-1 ml-5">
          Pipelines this {entityType} is currently tracked in.
        </p>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        {loading ? (
          <div className="flex items-center justify-center py-5">
            <Loader2 className="w-4 h-4 animate-spin text-secondary-text" />
          </div>
        ) : active.length === 0 && finished.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-5 text-center">
            <GitBranch className="w-6 h-6 text-secondary-text/30" />
            <p className="text-xs text-secondary-text">Not in any pipeline yet.</p>
            <button
              onClick={onAddClick}
              className="text-xs text-accent font-medium hover:underline"
            >
              Add to pipeline →
            </button>
          </div>
        ) : (
          <>
            {active.map(entry => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onStageMove={handleStageMove}
                onDrop={handleDrop}
              />
            ))}

            {finished.length > 0 && (
              <button
                onClick={() => setShowDone(s => !s)}
                className="text-xs text-secondary-text hover:text-primary-text flex items-center gap-1 mt-1"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDone ? 'rotate-180' : ''}`} />
                {showDone ? 'Hide' : `Show ${finished.length} finished`}
              </button>
            )}

            {showDone && finished.map(entry => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onStageMove={handleStageMove}
                onDrop={handleDrop}
                readonly
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Single entry card ──────────────────────────────────────────────────────────

function EntryCard({
  entry, onStageMove, onDrop, readonly = false,
}: {
  entry: ProcessEntryWithProcess;
  onStageMove: (e: ProcessEntryWithProcess, stageId: number) => void;
  onDrop: (e: ProcessEntryWithProcess) => void;
  readonly?: boolean;
}) {
  const [stageOpen, setStageOpen] = useState(false);
  const [dropping,  setDropping]  = useState(false);

  const stageColor = entry.current_stage_color ?? '#6B7280';

  const handleDrop = async () => {
    setDropping(true);
    await onDrop(entry);
    setDropping(false);
  };

  return (
    <div className="rounded-lg border border-border-color bg-bg-secondary/40 p-2.5 space-y-2">
      {/* Process name + status */}
      <div className="flex items-center gap-2">
        {entry.process_color && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: entry.process_color }}
          />
        )}
        <p className="text-xs font-medium text-primary-text flex-1 truncate">{entry.process_name}</p>
        <StatusIcon status={entry.status} />
      </div>

      {/* Current stage pill + move dropdown */}
      <div className="relative">
        <button
          disabled={readonly || !entry.current_stage_id}
          onClick={() => setStageOpen(o => !o)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors"
          style={{
            background: `${stageColor}15`,
            borderColor: `${stageColor}40`,
            color: stageColor,
          }}
        >
          {entry.current_stage_name ?? '—'}
          {!readonly && <ChevronDown className="w-3 h-3 opacity-60" />}
        </button>

        <span className="ml-2 text-xs text-secondary-text">
          {daysSince(entry.stage_entered_at)}
        </span>

        {stageOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setStageOpen(false)} />
            <div className="absolute left-0 top-full mt-1 z-30 bg-bg-primary border border-border-color rounded-xl shadow-lg py-1.5 min-w-44">
              {entry.process_stages.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setStageOpen(false); onStageMove(entry, s.id); }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left hover:bg-bg-secondary transition-colors ${s.id === entry.current_stage_id ? 'font-semibold text-accent' : 'text-primary-text'}`}
                >
                  {s.color && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  )}
                  {s.name}
                  {s.id === entry.current_stage_id && <Check className="w-3 h-3 ml-auto" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Drop button — only for active entries */}
      {!readonly && entry.status === 'active' && (
        <div className="flex justify-end">
          <button
            onClick={handleDrop}
            disabled={dropping}
            className="text-xs text-secondary-text hover:text-red-500 transition-colors flex items-center gap-1"
          >
            {dropping
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <X className="w-3 h-3" />
            }
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
