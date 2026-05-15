'use client';

import { useEffect, useState } from 'react';
import { X, GitBranch, Loader2, Check } from 'lucide-react';
import {
  listProcesses,
  getProcess,
  addEntry,
  type BusinessProcessListItem,
  type ProcessStage,
} from '@/services/processes';

interface Props {
  entityType: 'contact' | 'lead';
  entityId: number;
  entityName?: string | null;
  entityPhone?: string | null;
  onClose: () => void;
  onAdded: () => void;
}

export function AddToPipelineModal({
  entityType, entityId, entityName, entityPhone, onClose, onAdded,
}: Props) {
  const [processes,      setProcesses]      = useState<BusinessProcessListItem[]>([]);
  const [stages,         setStages]         = useState<ProcessStage[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<number | ''>('');
  const [selectedStage,   setSelectedStage]   = useState<number | ''>('');
  const [notes,          setNotes]          = useState('');
  const [loadingProcesses, setLoadingProcesses] = useState(true);
  const [loadingStages,    setLoadingStages]    = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');

  // Load active processes compatible with this entity type
  useEffect(() => {
    setLoadingProcesses(true);
    listProcesses('active')
      .then(all => setProcesses(all.filter(p => p.entity_type === entityType)))
      .catch(() => setProcesses([]))
      .finally(() => setLoadingProcesses(false));
  }, [entityType]);

  // Load stages when a process is selected
  useEffect(() => {
    if (!selectedProcess) { setStages([]); setSelectedStage(''); return; }
    setLoadingStages(true);
    getProcess(Number(selectedProcess))
      .then(p => { setStages(p.stages); setSelectedStage(p.stages[0]?.id ?? ''); })
      .catch(() => setStages([]))
      .finally(() => setLoadingStages(false));
  }, [selectedProcess]);

  const handleSubmit = async () => {
    if (!selectedProcess) { setError('Please select a pipeline.'); return; }
    setSaving(true);
    setError('');
    try {
      await addEntry(Number(selectedProcess), {
        entity_id: entityId,
        entity_name: entityName ?? undefined,
        entity_phone: entityPhone ?? undefined,
        stage_id: selectedStage ? Number(selectedStage) : undefined,
        notes: notes.trim() || undefined,
      });
      onAdded();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { detail?: string })?.detail ?? 'Failed to add to pipeline.';
      setError(typeof msg === 'string' ? msg : 'Failed to add to pipeline.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-sm bg-bg-primary rounded-2xl shadow-2xl border border-border-color overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-color">
          <GitBranch className="w-4 h-4 text-accent flex-shrink-0" />
          <h2 className="text-sm font-semibold text-primary-text flex-1">Add to Pipeline</h2>
          <button onClick={onClose} className="text-secondary-text hover:text-primary-text">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Pipeline select */}
          <div>
            <label className="block text-xs font-medium text-secondary-text mb-1.5">Pipeline</label>
            {loadingProcesses ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-secondary-text" />
                <span className="text-xs text-secondary-text">Loading pipelines…</span>
              </div>
            ) : processes.length === 0 ? (
              <p className="text-xs text-secondary-text">
                No active pipelines for {entityType}s. Create one in Settings → Pipelines.
              </p>
            ) : (
              <select
                value={selectedProcess}
                onChange={e => setSelectedProcess(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-secondary text-primary-text focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="">Select a pipeline…</option>
                {processes.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Stage select */}
          {selectedProcess !== '' && (
            <div>
              <label className="block text-xs font-medium text-secondary-text mb-1.5">Starting Stage</label>
              {loadingStages ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-secondary-text" />
                </div>
              ) : (
                <div className="space-y-1">
                  {stages.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStage(s.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
                        selectedStage === s.id
                          ? 'border-accent bg-accent/10 text-accent font-medium'
                          : 'border-border-color text-primary-text hover:bg-bg-secondary'
                      }`}
                    >
                      {s.color && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      )}
                      <span className="flex-1">{s.name}</span>
                      {selectedStage === s.id && <Check className="w-3.5 h-3.5 ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {selectedProcess !== '' && (
            <div>
              <label className="block text-xs font-medium text-secondary-text mb-1.5">
                Notes <span className="font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any context for this pipeline entry…"
                className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-secondary text-primary-text placeholder:text-secondary-text/60 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-color flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-border-color rounded-lg text-secondary-text hover:bg-bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !selectedProcess}
            className="flex-1 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 font-medium disabled:opacity-60 transition-colors"
          >
            {saving ? 'Adding…' : 'Add to Pipeline'}
          </button>
        </div>
      </div>
    </>
  );
}
