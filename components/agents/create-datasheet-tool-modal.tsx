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

const OPERATIONS: { value: DataSheetToolOperation; label: string; description: string }[] = [
  { value: 'search', label: 'Search', description: 'AI can search and filter records' },
  { value: 'create', label: 'Create', description: 'AI can add new records' },
  { value: 'update', label: 'Update', description: 'AI can update existing records' },
];

export interface CreateDataSheetToolModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  agentId: string;
}

export function CreateDataSheetToolModal({
  open,
  onClose,
  onCreated,
  agentId,
}: CreateDataSheetToolModalProps) {
  const [step, setStep] = useState(1);
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dynamicModelId, setDynamicModelId] = useState<number | null>(null);
  const [operation, setOperation] = useState<DataSheetToolOperation | null>(null);
  const [allowedReadFields, setAllowedReadFields] = useState<string[]>([]);
  const [allowedWriteFields, setAllowedWriteFields] = useState<string[]>([]);
  const [allowedFilterFields, setAllowedFilterFields] = useState<string[]>([]);
  const [triggerInstruction, setTriggerInstruction] = useState('');
  const [maxResults, setMaxResults] = useState(25);
  const [searchMode, setSearchMode] = useState<DataSheetSearchMode>('structured');
  const [attachToAgent, setAttachToAgent] = useState(true);

  const selectedModel = models.find((m) => m.id === dynamicModelId);

  useEffect(() => {
    if (open) {
      setLoadingModels(true);
      listModels()
        .then(setModels)
        .catch(() => setModels([]))
        .finally(() => setLoadingModels(false));
    }
  }, [open]);

  useEffect(() => {
    if (open && dynamicModelId != null && step >= 3) {
      setLoadingFields(true);
      listFields(dynamicModelId)
        .then(setFields)
        .catch(() => setFields([]))
        .finally(() => setLoadingFields(false));
    }
  }, [open, dynamicModelId, step]);

  const resetForm = useCallback(() => {
    setStep(1);
    setDynamicModelId(null);
    setOperation(null);
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

  const toggleField = (
    fieldName: string,
    list: string[],
    setList: (next: string[]) => void
  ) => {
    if (list.includes(fieldName)) {
      setList(list.filter((f) => f !== fieldName));
    } else {
      setList([...list, fieldName]);
    }
  };

  const selectAllFields = (setList: (next: string[]) => void) => {
    setList(fields.map((f) => f.name));
  };

  const deselectAllFields = (setList: (next: string[]) => void) => {
    setList([]);
  };

  const canNextStep1 = dynamicModelId != null;
  const canNextStep2 = operation != null;
  const canNextStep3 =
    operation === 'search'
      ? allowedFilterFields.length > 0 || allowedReadFields.length > 0
      : allowedWriteFields.length > 0;

  const handleCreate = async () => {
    if (dynamicModelId == null || operation == null) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: DataSheetToolCreate = {
        dynamic_model_id: dynamicModelId,
        operation,
        allowed_read_fields: allowedReadFields,
        allowed_write_fields: allowedWriteFields,
        allowed_filter_fields: allowedFilterFields,
        trigger_instruction: triggerInstruction.trim() || undefined,
        max_results: maxResults,
        search_mode: operation === 'search' ? searchMode : undefined,
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

  const modalWidth = step === 3 ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={handleClose}
    >
      <div
        className={`w-full ${modalWidth} rounded-2xl border border-border-color bg-card-bg p-6 shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Create Data Sheet Tool</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            aria-label="Close"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full ${
                step >= s ? 'bg-accent' : 'bg-bg-secondary'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Select which data sheet this tool will use.
            </p>
            {loadingModels ? (
              <p className="text-sm text-text-secondary">Loading data sheets…</p>
            ) : models.length === 0 ? (
              <p className="rounded-lg border border-border-color bg-bg-secondary/50 px-3 py-4 text-sm text-text-secondary">
                No data sheets yet. Create one from Data Sheet first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setDynamicModelId(m.id);
                      setOperation(null);
                      setAllowedReadFields([]);
                      setAllowedWriteFields([]);
                      setAllowedFilterFields([]);
                    }}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      dynamicModelId === m.id
                        ? 'border-accent bg-accent/10 text-text-primary'
                        : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent/50'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{m.display_name || m.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Choose what the AI can do with this data sheet.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {OPERATIONS.map((op) => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setOperation(op.value)}
                  className={`rounded-xl border p-3 text-left transition ${
                    operation === op.value
                      ? 'border-accent bg-accent/10 text-text-primary'
                      : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent/50'
                  }`}
                >
                  <span className="block text-sm font-semibold">{op.label}</span>
                  <span className="mt-0.5 block text-xs">{op.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-h-[50vh] space-y-4 overflow-y-auto">
            {loadingFields ? (
              <p className="text-sm text-text-secondary">Loading fields…</p>
            ) : (
              <>
                {operation === 'search' && (
                  <>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium text-text-primary">
                          Filterable fields
                        </label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => selectAllFields(setAllowedFilterFields)}
                            className="text-xs text-accent hover:underline"
                          >
                            All
                          </button>
                          <span className="text-text-secondary">|</span>
                          <button
                            type="button"
                            onClick={() => deselectAllFields(setAllowedFilterFields)}
                            className="text-xs text-accent hover:underline"
                          >
                            None
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {fields.map((f) => (
                          <label
                            key={f.id}
                            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={allowedFilterFields.includes(f.name)}
                              onChange={() =>
                                toggleField(f.name, allowedFilterFields, setAllowedFilterFields)
                              }
                              className="rounded border-border-color text-accent focus:ring-accent"
                            />
                            <span>{f.display_name || f.name}</span>
                            {f.is_required && (
                              <span className="text-[10px] text-text-secondary">required</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium text-text-primary">
                          Readable fields
                        </label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => selectAllFields(setAllowedReadFields)}
                            className="text-xs text-accent hover:underline"
                          >
                            All
                          </button>
                          <span className="text-text-secondary">|</span>
                          <button
                            type="button"
                            onClick={() => deselectAllFields(setAllowedReadFields)}
                            className="text-xs text-accent hover:underline"
                          >
                            None
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {fields.map((f) => (
                          <label
                            key={f.id}
                            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={allowedReadFields.includes(f.name)}
                              onChange={() =>
                                toggleField(f.name, allowedReadFields, setAllowedReadFields)
                              }
                              className="rounded border-border-color text-accent focus:ring-accent"
                            />
                            <span>{f.display_name || f.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {(operation === 'create' || operation === 'update') && (
                  <>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium text-text-primary">
                          Writable fields
                        </label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => selectAllFields(setAllowedWriteFields)}
                            className="text-xs text-accent hover:underline"
                          >
                            All
                          </button>
                          <span className="text-text-secondary">|</span>
                          <button
                            type="button"
                            onClick={() => deselectAllFields(setAllowedWriteFields)}
                            className="text-xs text-accent hover:underline"
                          >
                            None
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {fields.map((f) => (
                          <label
                            key={f.id}
                            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={allowedWriteFields.includes(f.name)}
                              onChange={() =>
                                toggleField(f.name, allowedWriteFields, setAllowedWriteFields)
                              }
                              className="rounded border-border-color text-accent focus:ring-accent"
                            />
                            <span>{f.display_name || f.name}</span>
                            {f.is_required && (
                              <span className="text-[10px] text-text-secondary">required</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium text-text-primary">
                          Readable fields (in response)
                        </label>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => selectAllFields(setAllowedReadFields)}
                            className="text-xs text-accent hover:underline"
                          >
                            All
                          </button>
                          <span className="text-text-secondary">|</span>
                          <button
                            type="button"
                            onClick={() => deselectAllFields(setAllowedReadFields)}
                            className="text-xs text-accent hover:underline"
                          >
                            None
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {fields.map((f) => (
                          <label
                            key={f.id}
                            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border-color bg-bg-primary px-2 py-1.5 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={allowedReadFields.includes(f.name)}
                              onChange={() =>
                                toggleField(f.name, allowedReadFields, setAllowedReadFields)
                              }
                              className="rounded border-border-color text-accent focus:ring-accent"
                            />
                            <span>{f.display_name || f.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary">
                Describe the tool
              </label>
              <p className="mt-0.5 text-xs text-text-secondary">
                When should the AI use this tool? (e.g. when the user asks about product availability or to add an order.)
              </p>
              <textarea
                value={triggerInstruction}
                onChange={(e) => setTriggerInstruction(e.target.value)}
                rows={3}
                placeholder={
                  operation === 'search'
                    ? 'e.g. Use when the user asks about product availability or to search products.'
                    : operation === 'create'
                      ? 'e.g. Use when the user wants to add a new order or record.'
                      : 'e.g. Use when the user wants to update an existing record.'
                }
                className="mt-1 w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/70 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            {operation === 'search' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-text-primary">
                    Search mode
                  </label>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSearchMode('structured')}
                      className={`flex-1 rounded-xl border p-3 text-left text-sm transition ${
                        searchMode === 'structured'
                          ? 'border-accent bg-accent/10 text-text-primary'
                          : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent/50'
                      }`}
                    >
                      <span className="font-semibold">Structured</span>
                      <span className="mt-0.5 block text-xs opacity-90">Keyword + filters (exact/text match)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchMode('semantic')}
                      className={`flex-1 rounded-xl border p-3 text-left text-sm transition ${
                        searchMode === 'semantic'
                          ? 'border-accent bg-accent/10 text-text-primary'
                          : 'border-border-color bg-bg-primary text-text-secondary hover:border-accent/50'
                      }`}
                    >
                      <span className="font-semibold">Semantic</span>
                      <span className="mt-0.5 block text-xs opacity-90">Meaning-based (AI similarity)</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary">
                    Max results (1–50)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxResults}
                    onChange={(e) => setMaxResults(Math.min(50, Math.max(1, Number(e.target.value) || 25)))}
                    className="mt-1 w-24 rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </>
            )}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={attachToAgent}
                onChange={(e) => setAttachToAgent(e.target.checked)}
                className="rounded border-border-color text-accent focus:ring-accent"
              />
              <span className="text-sm text-text-primary">Attach to this agent</span>
            </label>
            <div className="rounded-lg border border-border-color bg-bg-secondary/50 px-3 py-2 text-xs text-text-secondary">
              <strong className="text-text-primary">
                {selectedModel?.display_name || selectedModel?.name}
              </strong>{' '}
              · {operation}
              {operation === 'search' && ` · ${searchMode}`}
              {' · '}
              {operation === 'search' &&
                `${allowedFilterFields.length} filterable, ${allowedReadFields.length} readable`}
              {operation !== 'search' &&
                `${allowedWriteFields.length} writable, ${allowedReadFields.length} readable`}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 2) {
                  setOperation(null);
                  setAllowedReadFields([]);
                  setAllowedWriteFields([]);
                  setAllowedFilterFields([]);
                }
                setStep((s) => s - 1);
              }}
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
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 1 && !canNextStep1) ||
                (step === 2 && !canNextStep2) ||
                (step === 3 && !canNextStep3)
              }
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={submitting}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
