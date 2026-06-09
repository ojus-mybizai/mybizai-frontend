'use client';

import { useEffect, useMemo, useState } from 'react';
import { Database, AlertTriangle, Sparkles, Wand2 } from 'lucide-react';
import { listModels, listFields, type DynamicModel, type DynamicField } from '@/services/dynamic-data';
import type {
  DatasheetFieldMap,
  DatasheetFieldMappingEntry,
  FlowFieldType,
} from '@/services/waTemplates';

export interface FormBuilderField {
  id: string;
  type: string;
  label: string;
  name: string;
  required: boolean;
}

export interface GeneratedFieldWithMapping {
  field: FormBuilderField;
  options?: string[];   // for Dropdown/Checkbox/Radio — copied from datasheet enum_options
  dynamic_field_id: number;
  dynamic_field_name: string;
}

interface Props {
  flowFields: FormBuilderField[];
  enabled: boolean;
  linkedModelId: number | null;
  mapping: DatasheetFieldMap | null;
  onChange: (next: {
    enabled: boolean;
    linkedModelId: number | null;
    mapping: DatasheetFieldMap | null;
  }) => void;
  onGenerateFromDatasheet?: (generated: GeneratedFieldWithMapping[]) => void;
}

// Mirrors backend wa_datasheet_mapping_service.SUPPORTED_FLOW_TYPES.
const SUPPORTED_FLOW_TYPES = new Set<string>([
  'TextInput', 'TextArea', 'number', 'phone',
  'DatePicker', 'Dropdown', 'RadioButtonsGroup', 'CheckboxGroup', 'OptIn',
]);

const COMPATIBLE: Record<FlowFieldType, string[]> = {
  TextInput: ['text', 'long_text'],
  TextArea: ['text', 'long_text'],
  number: ['number'],
  phone: ['phone', 'text'],
  DatePicker: ['date'],
  Dropdown: ['enum'],
  RadioButtonsGroup: ['enum'],
  CheckboxGroup: ['multi_select'],
  OptIn: ['boolean'],
};

// Reverse of COMPATIBLE — picked when auto-generating the form from datasheet.
function dynTypeToFlowType(ft: string): FlowFieldType | null {
  switch (ft) {
    case 'text':         return 'TextInput';
    case 'long_text':    return 'TextArea';
    case 'number':       return 'number';
    case 'phone':        return 'phone';
    case 'date':         return 'DatePicker';
    case 'enum':         return 'Dropdown';
    case 'multi_select': return 'CheckboxGroup';
    case 'boolean':      return 'OptIn';
    default:             return null;
  }
}

function isFlowType(t: string): t is FlowFieldType {
  return SUPPORTED_FLOW_TYPES.has(t);
}

function sanitizeFlowFieldName(raw: string, used: Set<string>): string {
  const base = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20) || 'field';
  let name = base;
  let i = 2;
  while (used.has(name)) {
    const suffix = `_${i++}`;
    name = base.slice(0, 20 - suffix.length) + suffix;
  }
  used.add(name);
  return name;
}

// Shared input class — uses project design tokens
const inputCls =
  'w-full border border-border-color rounded-lg px-3 py-2 text-sm bg-card-bg text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent';

export default function DatasheetMappingPanel({
  flowFields,
  enabled,
  linkedModelId,
  mapping,
  onChange,
  onGenerateFromDatasheet,
}: Props) {
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [modelFields, setModelFields] = useState<DynamicField[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mappableFields = useMemo(
    () => flowFields.filter((f) => SUPPORTED_FLOW_TYPES.has(f.type) && f.name),
    [flowFields],
  );
  const unmappableFields = useMemo(
    () => flowFields.filter((f) => !SUPPORTED_FLOW_TYPES.has(f.type) && f.name),
    [flowFields],
  );

  useEffect(() => {
    if (!enabled) return;
    setLoadingModels(true);
    listModels()
      .then(setModels)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingModels(false));
  }, [enabled]);

  useEffect(() => {
    if (!linkedModelId) {
      setModelFields([]);
      return;
    }
    setLoadingFields(true);
    listFields(linkedModelId)
      .then(setModelFields)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingFields(false));
  }, [linkedModelId]);

  const mappingByFlow = useMemo(() => {
    const m = new Map<string, DatasheetFieldMappingEntry>();
    for (const entry of mapping?.mappings ?? []) m.set(entry.flow_field_name, entry);
    return m;
  }, [mapping]);

  const usedDynIds = useMemo(() => {
    const s = new Set<number>();
    for (const e of mapping?.mappings ?? []) s.add(e.dynamic_field_id);
    return s;
  }, [mapping]);

  const dsSupportedFields = useMemo(
    () => modelFields.filter((f) => dynTypeToFlowType(f.field_type) !== null),
    [modelFields],
  );
  const dsUnsupportedFields = useMemo(
    () => modelFields.filter((f) => dynTypeToFlowType(f.field_type) === null),
    [modelFields],
  );

  function emitMappingChange(nextEntries: DatasheetFieldMappingEntry[]) {
    onChange({
      enabled,
      linkedModelId,
      mapping: nextEntries.length ? { version: 1, mappings: nextEntries } : null,
    });
  }

  function handleToggle(next: boolean) {
    onChange({
      enabled: next,
      linkedModelId: next ? linkedModelId : null,
      mapping: next ? mapping : null,
    });
  }

  function handleModelChange(idStr: string) {
    const id = idStr ? Number(idStr) : null;
    onChange({ enabled, linkedModelId: id, mapping: null });
  }

  function handleFieldPick(flowField: FormBuilderField, dynFieldId: string) {
    const id = dynFieldId ? Number(dynFieldId) : 0;
    const next = (mapping?.mappings ?? []).filter(
      (e) => e.flow_field_name !== flowField.name,
    );
    if (id) {
      const df = modelFields.find((f) => f.id === id);
      if (df && isFlowType(flowField.type)) {
        next.push({
          flow_field_name: flowField.name,
          flow_field_type: flowField.type,
          dynamic_field_id: df.id,
          dynamic_field_name: df.name,
        });
      }
    }
    emitMappingChange(next);
  }

  function handleAutoMap() {
    if (!modelFields.length) return;
    const next: DatasheetFieldMappingEntry[] = [];
    const used = new Set<number>();
    for (const ff of mappableFields) {
      if (!isFlowType(ff.type)) continue;
      const compatible = COMPATIBLE[ff.type];
      const df = modelFields.find(
        (f) =>
          !used.has(f.id) &&
          f.name.toLowerCase() === ff.name.toLowerCase() &&
          compatible.includes(f.field_type),
      );
      if (df) {
        next.push({
          flow_field_name: ff.name,
          flow_field_type: ff.type,
          dynamic_field_id: df.id,
          dynamic_field_name: df.name,
        });
        used.add(df.id);
      }
    }
    emitMappingChange(next);
  }

  function handleGenerateFromDatasheet() {
    if (!onGenerateFromDatasheet || !dsSupportedFields.length) return;
    if (flowFields.length > 0) {
      const ok = confirm(
        `This replaces the current ${flowFields.length} form field(s) with ${dsSupportedFields.length} field(s) generated from the datasheet. Continue?`,
      );
      if (!ok) return;
    }
    const usedNames = new Set<string>();
    const fieldsMissingOptions: string[] = [];

    const generated: GeneratedFieldWithMapping[] = [];
    for (const df of dsSupportedFields) {
      const flowType = dynTypeToFlowType(df.field_type)!;
      const safeName = sanitizeFlowFieldName(df.name, usedNames);

      // Pull choice list from the datasheet field's config. Backend stores
      // the canonical list under `config.options` (see
      // dynamic_data_service.normalize_field_value). Support both string[]
      // and [{id|value, label|title}] shapes for forward compatibility.
      let options: string[] | undefined;
      if (flowType === 'Dropdown' || flowType === 'CheckboxGroup' || flowType === 'RadioButtonsGroup') {
        const cfg = (df.config as Record<string, unknown> | null | undefined) ?? {};
        const raw = (cfg.options ?? cfg.choices ?? cfg.enum_options) as unknown;
        if (Array.isArray(raw)) {
          options = raw
            .map((o: unknown) => {
              if (typeof o === 'string') return o.trim();
              if (o && typeof o === 'object') {
                const obj = o as Record<string, unknown>;
                const v = (obj.label ?? obj.title ?? obj.value ?? obj.id ?? '') as string;
                return String(v).trim();
              }
              return '';
            })
            .filter((s: string) => s.length > 0);
        }
        if (!options || options.length === 0) {
          // Skip — emitting "Option 1/2" placeholders would publish a broken
          // Flow that the employee can submit but the datasheet validator will
          // always reject. Surface this to the owner instead.
          fieldsMissingOptions.push(df.display_name || df.name);
          continue;
        }
      }
      generated.push({
        field: {
          id: `gen_${df.id}_${Date.now()}`,
          type: flowType,
          label: df.display_name || df.name,
          name: safeName,
          required: df.is_required,
        },
        options,
        dynamic_field_id: df.id,
        dynamic_field_name: df.name,
      });
    }

    if (fieldsMissingOptions.length > 0) {
      alert(
        `Skipped ${fieldsMissingOptions.length} field(s) with no options configured ` +
        `in the datasheet: ${fieldsMissingOptions.join(', ')}.\n\n` +
        `Open the datasheet and add the allowed options for these columns, ` +
        `then click Generate again.`,
      );
    }
    onGenerateFromDatasheet(generated);
  }

  const canGenerate = Boolean(linkedModelId && dsSupportedFields.length && onGenerateFromDatasheet);

  return (
    <div className="border border-border-color rounded-xl bg-card-bg p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2">
          <Database className="w-5 h-5 text-accent mt-0.5" />
          <div>
            <div className="font-medium text-sm text-text-primary">
              Save submissions to Datasheet
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Every form submission becomes a row in the linked datasheet. v1 supports
              text and number fields only.
            </p>
          </div>
        </div>
        <label className="inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
          />
          <div className="w-10 h-5 bg-bg-secondary border border-border-color rounded-full peer-checked:bg-accent peer-checked:border-accent transition relative">
            <div
              className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-card-bg rounded-full shadow transition-transform ${
                enabled ? 'translate-x-5' : ''
              }`}
            />
          </div>
        </label>
      </div>

      {!enabled && (
        <p className="text-xs text-text-secondary italic">
          Toggle on to map this form&apos;s fields to a datasheet — or generate the form fields directly from a datasheet&apos;s schema.
        </p>
      )}

      {enabled && (
        <div className="space-y-4 mt-3">
          <div>
            <label className="text-xs font-semibold text-text-primary uppercase tracking-wide">
              Step 1 — Target datasheet
            </label>
            <select
              value={linkedModelId ?? ''}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={loadingModels}
              className={`${inputCls} mt-1`}
            >
              <option value="">
                {loadingModels ? 'Loading datasheets…' : '— Select a datasheet —'}
              </option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name || m.name}
                </option>
              ))}
            </select>
          </div>

          {canGenerate && (
            <div className="border border-accent/40 bg-accent-soft rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5 uppercase tracking-wide">
                    <Wand2 className="w-3.5 h-3.5 text-accent" />
                    Step 2 — Generate form fields from this datasheet
                  </div>
                  <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                    <span className="text-text-primary font-medium">{dsSupportedFields.length}</span>{' '}
                    supported column{dsSupportedFields.length !== 1 ? 's' : ''} (text / long text / number) will become form fields, pre-mapped 1-to-1.
                    {dsUnsupportedFields.length > 0 && (
                      <>
                        {' '}<span className="text-text-primary font-medium">{dsUnsupportedFields.length}</span>{' '}
                        unsupported column{dsUnsupportedFields.length !== 1 ? 's' : ''} skipped:{' '}
                        <span className="italic">{dsUnsupportedFields.map((f) => `${f.name} (${f.field_type})`).join(', ')}</span>.
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateFromDatasheet}
                  disabled={loadingFields}
                  className="flex-shrink-0 text-xs px-3 py-1.5 bg-accent text-white rounded font-medium disabled:opacity-40 flex items-center gap-1 hover:opacity-90"
                >
                  <Wand2 className="w-3 h-3" />
                  {flowFields.length > 0 ? 'Regenerate' : 'Generate fields'}
                </button>
              </div>
            </div>
          )}

          {unmappableFields.length > 0 && (
            <div className="flex gap-2 items-start text-xs bg-amber-100/60 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-lg px-3 py-2 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>{unmappableFields.length} form field(s)</strong> use types not yet supported
                (Date, Dropdown, Checkbox, Media…): {unmappableFields.map((f) => f.name).join(', ')}.
                They will be ignored on datasheet write.
              </div>
            </div>
          )}

          {linkedModelId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                  Step 3 — Field mapping
                </label>
                <button
                  type="button"
                  onClick={handleAutoMap}
                  disabled={!modelFields.length || !mappableFields.length}
                  className="text-xs flex items-center gap-1 px-2 py-1 border border-border-color text-text-primary rounded hover:bg-bg-secondary disabled:opacity-40"
                >
                  <Sparkles className="w-3 h-3 text-accent" /> Auto-match by name
                </button>
              </div>

              {loadingFields && (
                <p className="text-xs text-text-secondary">Loading datasheet fields…</p>
              )}

              {!loadingFields && mappableFields.length === 0 && (
                <p className="text-xs text-text-secondary italic">
                  Add at least one text or number field to your form above — or use{' '}
                  <strong className="text-text-primary">Generate fields</strong> to create them from this datasheet.
                </p>
              )}

              {!loadingFields && mappableFields.length > 0 && (
                <div className="border border-border-color rounded-lg overflow-hidden bg-card-bg">
                  <table className="w-full text-xs">
                    <thead className="bg-bg-secondary text-text-secondary">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Form field</th>
                        <th className="text-left px-3 py-2 font-medium">Type</th>
                        <th className="text-left px-3 py-2 font-medium">Datasheet column</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappableFields.map((ff) => {
                        const current = mappingByFlow.get(ff.name);
                        const compatible = isFlowType(ff.type) ? COMPATIBLE[ff.type] : [];
                        return (
                          <tr key={ff.id} className="border-t border-border-color">
                            <td className="px-3 py-2 font-mono text-text-primary">{ff.name}</td>
                            <td className="px-3 py-2 text-text-secondary">{ff.type}</td>
                            <td className="px-3 py-2">
                              <select
                                value={current?.dynamic_field_id ?? ''}
                                onChange={(e) => handleFieldPick(ff, e.target.value)}
                                className="w-full border border-border-color rounded px-2 py-1 text-xs bg-card-bg text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                              >
                                <option value="">— skip —</option>
                                {modelFields.map((df) => {
                                  const compat = compatible.includes(df.field_type);
                                  const usedByOther =
                                    usedDynIds.has(df.id) && current?.dynamic_field_id !== df.id;
                                  return (
                                    <option
                                      key={df.id}
                                      value={df.id}
                                      disabled={!compat || usedByOther}
                                    >
                                      {df.display_name || df.name} ({df.field_type})
                                      {!compat ? ' — type mismatch' : ''}
                                      {usedByOther ? ' — already mapped' : ''}
                                      {df.is_required ? ' *' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {modelFields.some(
                (df) =>
                  df.is_required &&
                  !(df.default_value ?? false) &&
                  !usedDynIds.has(df.id),
              ) && (
                <div className="flex gap-2 items-start text-xs bg-red-100/60 dark:bg-red-900/20 border border-red-300 dark:border-red-800/60 rounded-lg px-3 py-2 text-red-900 dark:text-red-200 mt-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    Required datasheet columns must be mapped:{' '}
                    {modelFields
                      .filter(
                        (df) =>
                          df.is_required &&
                          !(df.default_value ?? false) &&
                          !usedDynIds.has(df.id),
                      )
                      .map((df) => df.name)
                      .join(', ')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
}
