'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listModels,
  listFields,
  type DynamicModel,
  type DynamicField,
} from '@/services/dynamic-data';
import { formatApiErrorDetail } from '@/lib/api-client';
import {
  createDataSheetTool,
  type DataSheetToolCreate,
  type DataSheetToolOperation,
  type DataSheetSearchMode,
} from '@/services/datasheet-tools';

// ─── Operation definitions (all 5 ops the backend supports) ──────────────────

interface OpDef {
  value: DataSheetToolOperation;
  label: string;
  icon: string;
  description: string;
  needsWrite: boolean;   // requires allowed_write_fields
  needsFilter: boolean;  // requires allowed_filter_fields
}

const ALL_OPERATIONS: OpDef[] = [
  {
    value: 'search',
    label: 'Search / Query',
    icon: '🔍',
    description: 'AI can look up and filter records',
    needsWrite: false,
    needsFilter: true,
  },
  {
    value: 'create',
    label: 'Create Record',
    icon: '➕',
    description: 'AI can add a single new record',
    needsWrite: true,
    needsFilter: false,
  },
  {
    value: 'bulk_add',
    label: 'Bulk Add Records',
    icon: '📋',
    description: 'AI can add multiple records at once from a table',
    needsWrite: true,
    needsFilter: false,
  },
  {
    value: 'update',
    label: 'Update Record',
    icon: '✏️',
    description: 'AI can edit fields on an existing record',
    needsWrite: true,
    needsFilter: false,
  },
  {
    value: 'delete',
    label: 'Delete Record',
    icon: '🗑️',
    description: 'AI can remove a record permanently',
    needsWrite: false,
    needsFilter: false,
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CreateDataSheetToolModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  agentId: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function FieldCheckboxList({
  label,
  hint,
  fields,
  selected,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: {
  label: string;
  hint?: string;
  fields: DynamicField[];
  selected: string[];
  onToggle: (name: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-text-primary">{label}</span>
          {hint && <span className="ml-1.5 text-xs text-text-secondary">{hint}</span>}
        </div>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={onSelectAll} className="text-accent hover:underline">All</button>
          <span className="text-text-secondary">·</span>
          <button type="button" onClick={onDeselectAll} className="text-accent hover:underline">None</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {fields.map((f) => (
          <label
            key={f.id}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-xs hover:border-accent/50 transition"
          >
            <input
              type="checkbox"
              checked={selected.includes(f.name)}
              onChange={() => onToggle(f.name)}
              className="rounded border-border-color text-accent focus:ring-accent"
            />
            <span className="text-text-primary">{f.display_name || f.name}</span>
            {f.is_required && (
              <span className="text-[10px] text-amber-500">required</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function CreateDataSheetToolModal({
  open,
  onClose,
  onCreated,
  agentId,
}: CreateDataSheetToolModalProps) {
  const [step, setStep] = useState(1);

  // Data
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [fields, setFields] = useState<DynamicField[]>([]);

  // Loading / status
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 selections
  const [dynamicModelId, setDynamicModelId] = useState<number | null>(null);
  const [selectedOps, setSelectedOps] = useState<DataSheetToolOperation[]>([]);

  // Step 2 config
  const [allowedReadFields, setAllowedReadFields] = useState<string[]>([]);
  const [allowedWriteFields, setAllowedWriteFields] = useState<string[]>([]);
  const [allowedFilterFields, setAllowedFilterFields] = useState<string[]>([]);
  const [triggerInstruction, setTriggerInstruction] = useState('');
  const [maxResults, setMaxResults] = useState(25);
  const [searchMode, setSearchMode] = useState<DataSheetSearchMode>('structured');
  const [attachToAgent, setAttachToAgent] = useState(true);

  // Derived
  const selectedModel = models.find((m) => m.id === dynamicModelId);
  const needsFilter = selectedOps.some((o) => ALL_OPERATIONS.find((d) => d.value === o)?.needsFilter);
  const needsWrite  = selectedOps.some((o) => ALL_OPERATIONS.find((d) => d.value === o)?.needsWrite);
  const hasSearch   = selectedOps.includes('search');

  // ── Load datasheets on open ──────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setLoadingModels(true);
      listModels()
        .then(setModels)
        .catch(() => setModels([]))
        .finally(() => setLoadingModels(false));
    }
  }, [open]);

  // ── Load fields when entering step 2 ────────────────────────────────────
  useEffect(() => {
    if (open && dynamicModelId != null && step === 2) {
      setLoadingFields(true);
      listFields(dynamicModelId)
        .then((fs) => {
          setFields(fs);
          // Auto-select all fields as a convenience default
          const allNames = fs.map((f) => f.name);
          setAllowedReadFields(allNames);
          setAllowedFilterFields(allNames);
          setAllowedWriteFields(allNames);
        })
        .catch(() => setFields([]))
        .finally(() => setLoadingFields(false));
    }
  }, [open, dynamicModelId, step]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setStep(1);
    setDynamicModelId(null);
    setSelectedOps([]);
    setFields([]);
    setAllowedReadFields([]);
    setAllowedWriteFields([]);
    setAllowedFilterFields([]);
    setTriggerInstruction('');
    setMaxResults(25);
    setSearchMode('structured');
    setAttachToAgent(true);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  // ── Op toggle ────────────────────────────────────────────────────────────
  const toggleOp = (op: DataSheetToolOperation) => {
    setSelectedOps((prev) =>
      prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op]
    );
  };

  // ── Field toggle helpers ──────────────────────────────────────────────────
  const toggle = (name: string, list: string[], setList: (v: string[]) => void) =>
    setList(list.includes(name) ? list.filter((n) => n !== name) : [...list, name]);

  // ── Validation ───────────────────────────────────────────────────────────
  const canProceedStep1 = dynamicModelId != null && selectedOps.length > 0;
  const canCreate =
    selectedOps.length > 0 &&
    (!needsFilter || allowedFilterFields.length > 0 || allowedReadFields.length > 0) &&
    (!needsWrite  || allowedWriteFields.length > 0);

  // ── Instruction placeholder ───────────────────────────────────────────────
  const instructionPlaceholder = (() => {
    const parts: string[] = [];
    if (selectedOps.includes('search'))   parts.push('search for records');
    if (selectedOps.includes('create'))   parts.push('add a new record');
    if (selectedOps.includes('bulk_add')) parts.push('bulk-import records');
    if (selectedOps.includes('update'))   parts.push('update an existing record');
    if (selectedOps.includes('delete'))   parts.push('delete a record');
    const dsName = selectedModel?.display_name || selectedModel?.name || 'records';
    return parts.length > 0
      ? `e.g. Use when the user wants to ${parts.join(', ')} in ${dsName}.`
      : 'Describe when the AI should use this tool…';
  })();

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (dynamicModelId == null || selectedOps.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: DataSheetToolCreate = {
        dynamic_model_id: dynamicModelId,
        allowed_operations: selectedOps,
        allowed_read_fields: allowedReadFields,
        allowed_write_fields: needsWrite ? allowedWriteFields : [],
        allowed_filter_fields: needsFilter ? allowedFilterFields : [],
        trigger_instruction: triggerInstruction.trim() || undefined,
        max_results: maxResults,
        search_mode: hasSearch ? searchMode : undefined,
        agent_ids: attachToAgent ? [parseInt(agentId, 10)] : undefined,
      };
      await createDataSheetTool(payload);
      onCreated();
      handleClose();
    } catch (err) {
      setError(formatApiErrorDetail(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border-color bg-card-bg shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border-color px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              {step === 1 ? 'New Datasheet Tool' : `Configure — ${selectedModel?.display_name || selectedModel?.name}`}
            </h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              {step === 1
                ? 'Choose a datasheet and the actions the AI can perform'
                : 'Set which fields the AI can access and write an instruction'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex gap-1.5 px-6 pt-4">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step >= s ? 'bg-accent' : 'bg-bg-secondary'
              }`}
            />
          ))}
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            STEP 1 — Select datasheet + pick operations
        ════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-5 px-6 py-5">
            {/* Datasheet picker */}
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">Select datasheet</p>
              {loadingModels ? (
                <p className="text-sm text-text-secondary">Loading…</p>
              ) : models.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border-color px-3 py-4 text-sm text-text-secondary">
                  No datasheets yet — create one from the Data Sheets page first.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setDynamicModelId(m.id);
                        // reset field selections when switching datasheet
                        setAllowedReadFields([]);
                        setAllowedWriteFields([]);
                        setAllowedFilterFields([]);
                        setFields([]);
                      }}
                      className={`rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                        dynamicModelId === m.id
                          ? 'border-accent bg-accent/10 font-semibold text-text-primary'
                          : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent/50'
                      }`}
                    >
                      {m.display_name || m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Operation checkboxes */}
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">
                What can the AI do with this datasheet?
                <span className="ml-1 text-xs font-normal text-text-secondary">(select all that apply)</span>
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ALL_OPERATIONS.map((op) => {
                  const isSelected = selectedOps.includes(op.value);
                  return (
                    <button
                      key={op.value}
                      type="button"
                      onClick={() => toggleOp(op.value)}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? 'border-accent bg-accent/10'
                          : 'border-border-color bg-bg-primary hover:border-accent/40'
                      }`}
                    >
                      {/* custom checkbox indicator */}
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                          isSelected
                            ? 'border-accent bg-accent text-white'
                            : 'border-border-color bg-bg-secondary'
                        }`}
                      >
                        {isSelected && (
                          <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-text-primary">
                          {op.icon} {op.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-text-secondary">{op.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Selection summary pill row */}
              {selectedOps.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedOps.map((op) => {
                    const def = ALL_OPERATIONS.find((d) => d.value === op)!;
                    return (
                      <span
                        key={op}
                        className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent"
                      >
                        {def.icon} {def.label}
                        <button
                          type="button"
                          onClick={() => toggleOp(op)}
                          className="ml-0.5 opacity-60 hover:opacity-100"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            STEP 2 — Field permissions + instruction
        ════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            {loadingFields ? (
              <p className="py-6 text-center text-sm text-text-secondary">Loading fields…</p>
            ) : (
              <div className="space-y-5">

                {/* ── Filterable fields (only if search is selected) ── */}
                {needsFilter && (
                  <FieldCheckboxList
                    label="Filterable fields"
                    hint="Fields the AI can use to search / filter records"
                    fields={fields}
                    selected={allowedFilterFields}
                    onToggle={(n) => toggle(n, allowedFilterFields, setAllowedFilterFields)}
                    onSelectAll={() => setAllowedFilterFields(fields.map((f) => f.name))}
                    onDeselectAll={() => setAllowedFilterFields([])}
                  />
                )}

                {/* ── Writable fields (only if create / update / bulk_add selected) ── */}
                {needsWrite && (
                  <FieldCheckboxList
                    label="Writable fields"
                    hint="Fields the AI can create or update"
                    fields={fields}
                    selected={allowedWriteFields}
                    onToggle={(n) => toggle(n, allowedWriteFields, setAllowedWriteFields)}
                    onSelectAll={() => setAllowedWriteFields(fields.map((f) => f.name))}
                    onDeselectAll={() => setAllowedWriteFields([])}
                  />
                )}

                {/* ── Readable fields (always shown — controls what AI sees in responses) ── */}
                <FieldCheckboxList
                  label="Readable fields"
                  hint="Fields returned in the AI's response"
                  fields={fields}
                  selected={allowedReadFields}
                  onToggle={(n) => toggle(n, allowedReadFields, setAllowedReadFields)}
                  onSelectAll={() => setAllowedReadFields(fields.map((f) => f.name))}
                  onDeselectAll={() => setAllowedReadFields([])}
                />

                {/* ── Search mode (only if search selected) ── */}
                {hasSearch && (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-text-primary">Search mode</p>
                    <div className="flex gap-2">
                      {(['structured', 'semantic'] as DataSheetSearchMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setSearchMode(mode)}
                          className={`flex-1 rounded-xl border p-2.5 text-left text-sm transition ${
                            searchMode === mode
                              ? 'border-accent bg-accent/10 text-text-primary'
                              : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent/50'
                          }`}
                        >
                          <span className="font-semibold capitalize">{mode}</span>
                          <span className="mt-0.5 block text-xs opacity-80">
                            {mode === 'structured' ? 'Keyword + field filters (fast)' : 'Meaning-based AI similarity'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Max results (only if search selected) ── */}
                {hasSearch && (
                  <div className="flex items-center gap-3">
                    <label className="shrink-0 text-sm font-medium text-text-primary">Max results</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={maxResults}
                      onChange={(e) => setMaxResults(Math.min(50, Math.max(1, Number(e.target.value) || 25)))}
                      className="w-20 rounded-md border border-border-color bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <span className="text-xs text-text-secondary">(1–50)</span>
                  </div>
                )}

                {/* ── Trigger instruction ── */}
                <div>
                  <label className="block text-sm font-medium text-text-primary">
                    When should the AI use this tool?
                  </label>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Natural-language instruction for the agent (helps it choose the right tool).
                  </p>
                  <textarea
                    value={triggerInstruction}
                    onChange={(e) => setTriggerInstruction(e.target.value)}
                    rows={3}
                    placeholder={instructionPlaceholder}
                    className="mt-1.5 w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                {/* ── Attach to agent ── */}
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={attachToAgent}
                    onChange={(e) => setAttachToAgent(e.target.checked)}
                    className="rounded border-border-color text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-text-primary">Attach to this agent immediately</span>
                </label>

                {/* ── Summary card ── */}
                <div className="rounded-lg border border-border-color bg-bg-secondary/50 px-3 py-2.5 text-xs text-text-secondary space-y-1">
                  <div>
                    <strong className="text-text-primary">{selectedModel?.display_name || selectedModel?.name}</strong>
                    {' · '}
                    {selectedOps.map((op) => {
                      const def = ALL_OPERATIONS.find((d) => d.value === op)!;
                      return `${def.icon} ${def.label}`;
                    }).join('  ·  ')}
                  </div>
                  {needsFilter && <div>Filterable: {allowedFilterFields.length} field(s)</div>}
                  {needsWrite  && <div>Writable: {allowedWriteFields.length} field(s)</div>}
                  <div>Readable: {allowedReadFields.length} field(s)</div>
                  {hasSearch && <div>Search: {searchMode} · max {maxResults} results</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Footer buttons ── */}
        <div className="flex justify-end gap-2 border-t border-border-color px-6 py-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-secondary"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-secondary"
            >
              Cancel
            </button>
          )}

          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={submitting || !canCreate}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              {submitting ? 'Creating…' : 'Create Tool'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
