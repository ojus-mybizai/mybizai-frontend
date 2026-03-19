'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  listLeadFields,
  createLeadField,
  updateLeadField,
  deleteLeadField,
  reorderLeadFields,
  getSourceMappingPreview,
  saveSourceMapping,
  type LeadFieldConfig,
  type LeadFieldConfigCreate,
  type FieldType,
  type SourceMappingPreview,
} from '@/services/lead-fields';
import { listModels, type DynamicModel } from '@/services/dynamic-data';

// ─── Field type metadata ──────────────────────────────────────────────────────

const FIELD_TYPES: {
  value: FieldType;
  label: string;
  icon: string;
  color: string;
  desc: string;
}[] = [
  { value: 'text',     label: 'Text',       icon: 'Aa', color: 'bg-blue-500/10 text-blue-500',    desc: 'Single line text' },
  { value: 'number',   label: 'Number',     icon: '#',  color: 'bg-orange-500/10 text-orange-500', desc: 'Numeric value' },
  { value: 'email',    label: 'Email',      icon: '@',  color: 'bg-purple-500/10 text-purple-500', desc: 'Email address' },
  { value: 'phone',    label: 'Phone',      icon: '📞', color: 'bg-green-500/10 text-green-500',   desc: 'Phone number' },
  { value: 'date',     label: 'Date',       icon: '📅', color: 'bg-cyan-500/10 text-cyan-500',     desc: 'Date only' },
  { value: 'datetime', label: 'Date & Time',icon: '⏱', color: 'bg-teal-500/10 text-teal-500',     desc: 'Date + time' },
  { value: 'select',   label: 'Dropdown',   icon: '☰',  color: 'bg-indigo-500/10 text-indigo-500', desc: 'Pick from list' },
  { value: 'boolean',  label: 'Yes / No',   icon: '✓',  color: 'bg-emerald-500/10 text-emerald-500', desc: 'True or false' },
  { value: 'textarea', label: 'Long Text',  icon: '≡',  color: 'bg-slate-500/10 text-slate-500',   desc: 'Multi-line text' },
  { value: 'url',      label: 'URL',        icon: '↗',  color: 'bg-rose-500/10 text-rose-500',     desc: 'Web link' },
  { value: 'relation', label: 'Relation',   icon: '⇢',  color: 'bg-violet-500/10 text-violet-500', desc: 'Link to records' },
];

const FIELD_TYPE_MAP = Object.fromEntries(FIELD_TYPES.map((f) => [f.value, f]));

const RELATION_TARGETS = [
  { value: 'work',        label: 'Work Items',   icon: '🔧' },
  { value: 'order',       label: 'Orders',       icon: '🛒' },
  { value: 'appointment', label: 'Appointments', icon: '📆' },
  { value: 'contact',     label: 'Contacts',     icon: '👤' },
  { value: 'employee',    label: 'Employees',    icon: '👥' },
  { value: 'datasheet',   label: 'Datasheet',    icon: '🗄' },
];

const SOURCES = [
  { key: 'whatsapp',       label: 'WhatsApp',       icon: '📱' },
  { key: 'instagram',      label: 'Instagram',      icon: '📸' },
  { key: 'indiamart',      label: 'IndiaMart',      icon: '🏭' },
  { key: 'sms',            label: 'SMS',            icon: '💬' },
  { key: 'telegram',       label: 'Telegram',       icon: '✈️' },
  { key: 'custom_webhook', label: 'Custom Webhook', icon: '🔗' },
];

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface LeadFieldConfigPanelProps {
  onClose?: () => void;
}

type Tab = 'columns' | 'mapping';

export function LeadFieldConfigPanel({ onClose }: LeadFieldConfigPanelProps) {
  const [fields, setFields] = useState<LeadFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('columns');
  const [selectedSource, setSelectedSource] = useState('whatsapp');
  const [sourcePreview, setSourcePreview] = useState<SourceMappingPreview | null>(null);
  const [sourceMappings, setSourceMappings] = useState<Record<string, string>>({});
  const [sourceLoading, setSourceLoading] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [dragField, setDragField] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listLeadFields();
      setFields(data.sort((a, b) => a.column_order - b.column_order));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (tab !== 'mapping') return;
    loadSourcePreview(selectedSource);
  }, [tab, selectedSource]);

  async function loadSourcePreview(source: string) {
    setSourceLoading(true);
    try {
      const preview = await getSourceMappingPreview(source);
      setSourcePreview(preview);
      setSourceMappings(preview.current_mappings);
    } finally {
      setSourceLoading(false);
    }
  }

  async function handleSaveMapping() {
    await saveSourceMapping(selectedSource, sourceMappings);
    await reload();
  }

  function handleDragStart(id: number) { setDragField(id); }
  function handleDragOver(e: React.DragEvent, id: number) {
    e.preventDefault();
    setDragOver(id);
  }

  async function handleDrop(targetId: number) {
    if (dragField === null || dragField === targetId) { setDragField(null); setDragOver(null); return; }
    const reordered = [...fields];
    const fromIdx = reordered.findIndex((f) => f.id === dragField);
    const toIdx   = reordered.findIndex((f) => f.id === targetId);
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updated = reordered.map((f, i) => ({ ...f, column_order: i + 1 }));
    setFields(updated);
    setDragField(null);
    setDragOver(null);
    await reorderLeadFields(updated.map((f) => ({ id: f.id, column_order: f.column_order })));
  }

  async function handleToggleVisibility(field: LeadFieldConfig) {
    const updated = await updateLeadField(field.id, { is_visible: !field.is_visible });
    setFields((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  }

  async function handleDelete(field: LeadFieldConfig) {
    if (!confirm(`Delete field "${field.display_name}"? This will remove this column from all leads.`)) return;
    await deleteLeadField(field.id);
    setFields((prev) => prev.filter((f) => f.id !== field.id));
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-color px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Lead Table Settings</h2>
          <p className="text-xs text-text-secondary mt-0.5">Configure columns, custom fields & source mapping</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-bg-secondary text-text-secondary transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-color px-5">
        {(['columns', 'mapping'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t === 'columns' ? '⚙ Columns' : '🔗 Source Mapping'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {tab === 'columns' ? (
          <ColumnsTab
            fields={fields}
            loading={loading}
            dragField={dragField}
            dragOver={dragOver}
            showAddField={showAddField}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={() => { setDragField(null); setDragOver(null); }}
            onToggleVisibility={handleToggleVisibility}
            onDelete={handleDelete}
            onShowAddField={setShowAddField}
            onFieldCreated={reload}
          />
        ) : (
          <MappingTab
            sources={SOURCES}
            selectedSource={selectedSource}
            onSelectSource={setSelectedSource}
            preview={sourcePreview}
            loading={sourceLoading}
            mappings={sourceMappings}
            onMappingsChange={setSourceMappings}
            onSave={handleSaveMapping}
          />
        )}
      </div>
    </div>
  );
}

// ─── Columns Tab ──────────────────────────────────────────────────────────────

function ColumnsTab({
  fields, loading, dragField, dragOver, showAddField,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onToggleVisibility, onDelete, onShowAddField, onFieldCreated,
}: {
  fields: LeadFieldConfig[];
  loading: boolean;
  dragField: number | null;
  dragOver: number | null;
  showAddField: boolean;
  onDragStart: (id: number) => void;
  onDragOver: (e: React.DragEvent, id: number) => void;
  onDrop: (id: number) => void;
  onDragEnd: () => void;
  onToggleVisibility: (f: LeadFieldConfig) => void;
  onDelete: (f: LeadFieldConfig) => void;
  onShowAddField: (v: boolean) => void;
  onFieldCreated: () => void;
}) {
  const [datasheets, setDatasheets] = useState<DynamicModel[]>([]);
  useEffect(() => {
    listModels().then(setDatasheets).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-xs text-text-secondary">Loading fields…</span>
        </div>
      </div>
    );
  }

  const visibleCount = fields.filter((f) => f.is_visible).length;
  const systemFields = fields.filter((f) => f.is_system);
  const customFields = fields.filter((f) => !f.is_system);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {visibleCount} visible
          </span>
          <span className="text-[11px] text-text-secondary">{fields.length} total · drag to reorder</span>
        </div>
        <button
          onClick={() => onShowAddField(!showAddField)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            showAddField
              ? 'bg-bg-secondary border border-border-color text-text-secondary'
              : 'bg-accent text-white hover:bg-accent/90'
          }`}
        >
          {showAddField ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Field
            </>
          )}
        </button>
      </div>

      {/* Add field form — shown inline at top when active */}
      {showAddField && (
        <AddFieldForm
          datasheets={datasheets}
          onCreated={() => { onShowAddField(false); onFieldCreated(); }}
          onCancel={() => onShowAddField(false)}
        />
      )}

      {/* System fields section */}
      {systemFields.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary px-0.5">System Fields</p>
          <div className="rounded-xl border border-border-color bg-card-bg divide-y divide-border-color overflow-hidden">
            {systemFields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                isDragging={dragField === field.id}
                isDragOver={dragOver === field.id}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                onToggleVisibility={onToggleVisibility}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom fields section */}
      {customFields.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary px-0.5">Custom Fields</p>
          <div className="rounded-xl border border-border-color bg-card-bg divide-y divide-border-color overflow-hidden">
            {customFields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                isDragging={dragField === field.id}
                isDragOver={dragOver === field.id}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                onToggleVisibility={onToggleVisibility}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}

      {customFields.length === 0 && !showAddField && (
        <div className="rounded-xl border border-dashed border-border-color p-6 text-center">
          <p className="text-xs text-text-secondary">No custom fields yet</p>
          <p className="text-[11px] text-text-secondary mt-1">Click <strong>Add Field</strong> to create your first custom column</p>
        </div>
      )}

      {/* Table column preview */}
      {fields.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary px-0.5">Table Column Preview</p>
          <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-0 divide-y divide-border-color">
              <div className="contents">
                <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-text-secondary bg-bg-secondary">Column</div>
                <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-text-secondary bg-bg-secondary">Type</div>
                <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-text-secondary bg-bg-secondary text-right">In Table</div>
              </div>
              {fields.filter((f) => f.is_visible).map((field) => {
                const typeMeta = FIELD_TYPE_MAP[field.field_type];
                const cfg = field.config as Record<string, unknown> | undefined;
                const isRelation = field.field_type === 'relation';
                const isSystem = field.is_system;
                let tableRole = 'Value cell';
                if (isRelation) {
                  const target = cfg?.target as string | undefined;
                  const rt = RELATION_TARGETS.find((r) => r.value === target);
                  tableRole = rt ? `Count of ${rt.label}` : 'Relation count';
                } else if (field.field_type === 'boolean') {
                  tableRole = 'Yes / No badge';
                } else if (field.field_type === 'select') {
                  tableRole = 'Colored badge';
                } else if (field.field_type === 'date' || field.field_type === 'datetime') {
                  tableRole = 'Formatted date';
                } else if (field.field_type === 'url') {
                  tableRole = 'Clickable link';
                } else if (isSystem) {
                  tableRole = 'System column';
                }
                return (
                  <div key={field.id} className="contents">
                    <div className="px-3 py-2 flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 flex items-center justify-center h-5 w-5 rounded text-[9px] font-bold ${typeMeta?.color ?? 'bg-bg-secondary text-text-secondary'}`}>
                        {typeMeta?.icon ?? '?'}
                      </span>
                      <span className="text-xs text-text-primary truncate">{field.display_name}</span>
                      {isSystem && (
                        <span className="shrink-0 rounded bg-bg-secondary border border-border-color px-1 text-[8px] font-semibold text-text-secondary uppercase">sys</span>
                      )}
                    </div>
                    <div className="px-3 py-2 flex items-center">
                      <span className="text-[10px] text-text-secondary">{typeMeta?.label ?? field.field_type}</span>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-end">
                      <span className={`text-[10px] font-medium ${isRelation ? 'text-violet-500' : 'text-text-secondary'}`}>{tableRole}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {fields.filter((f) => !f.is_visible).length > 0 && (
              <div className="border-t border-border-color px-3 py-2 bg-bg-secondary/30">
                <p className="text-[10px] text-text-secondary">
                  {fields.filter((f) => !f.is_visible).length} hidden field{fields.filter((f) => !f.is_visible).length > 1 ? 's' : ''} — toggle the eye icon above to show them
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({
  field, isDragging, isDragOver,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onToggleVisibility, onDelete,
}: {
  field: LeadFieldConfig;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (id: number) => void;
  onDragOver: (e: React.DragEvent, id: number) => void;
  onDrop: (id: number) => void;
  onDragEnd: () => void;
  onToggleVisibility: (f: LeadFieldConfig) => void;
  onDelete: (f: LeadFieldConfig) => void;
}) {
  const typeMeta = FIELD_TYPE_MAP[field.field_type];
  const cfg = field.config as Record<string, unknown> | undefined;
  const relationTarget = cfg?.target as string | undefined;
  const datasheetName = cfg?.datasheet_name as string | undefined;

  // Build relation target label
  let relationLabel: string | null = null;
  if (field.field_type === 'relation' && relationTarget) {
    if (relationTarget === 'datasheet' && datasheetName) {
      relationLabel = datasheetName;
    } else {
      const rt = RELATION_TARGETS.find((t) => t.value === relationTarget);
      relationLabel = rt ? `${rt.icon} ${rt.label}` : relationTarget;
    }
  }

  const sourceCount = Object.keys(field.source_mappings ?? {}).length;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(field.id)}
      onDragOver={(e) => onDragOver(e, field.id)}
      onDrop={() => onDrop(field.id)}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
        isDragOver ? 'bg-accent/8 border-l-2 border-l-accent' : 'hover:bg-bg-secondary/60'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      {/* Drag handle */}
      <span className="cursor-grab text-text-secondary opacity-30 hover:opacity-70 transition-opacity shrink-0">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </span>

      {/* Type badge */}
      <span className={`shrink-0 flex items-center justify-center h-7 w-7 rounded-lg text-xs font-bold ${typeMeta?.color ?? 'bg-bg-secondary text-text-secondary'}`}>
        {typeMeta?.icon ?? field.field_type[0].toUpperCase()}
      </span>

      {/* Field info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-medium truncate ${field.is_visible ? 'text-text-primary' : 'text-text-secondary'}`}>
            {field.display_name}
          </span>
          {field.is_system && (
            <span className="shrink-0 rounded-md bg-bg-secondary border border-border-color px-1.5 py-px text-[9px] font-semibold text-text-secondary uppercase tracking-wide">
              system
            </span>
          )}
          {field.is_required && (
            <span className="shrink-0 rounded-md bg-red-500/10 px-1.5 py-px text-[9px] font-semibold text-red-500 uppercase tracking-wide">
              req
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px] text-text-secondary font-mono opacity-70">{field.field_key}</span>
          {relationLabel && (
            <>
              <span className="text-[10px] text-text-secondary">→</span>
              <span className="text-[10px] text-violet-500 font-medium">{relationLabel}</span>
            </>
          )}
          {sourceCount > 0 && (
            <span className="text-[10px] text-accent font-medium">
              {sourceCount} source{sourceCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Visibility toggle */}
      <button
        onClick={() => onToggleVisibility(field)}
        title={field.is_visible ? 'Hide column' : 'Show column'}
        className={`shrink-0 transition-colors ${field.is_visible ? 'text-accent' : 'text-text-secondary opacity-30 hover:opacity-60'}`}
      >
        {field.is_visible ? (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        )}
      </button>

      {/* Delete (custom only) */}
      {!field.is_system && (
        <button
          onClick={() => onDelete(field)}
          className="shrink-0 rounded-lg p-1 text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors"
          title="Delete field"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Add Field Form ───────────────────────────────────────────────────────────

function AddFieldForm({
  datasheets,
  onCreated,
  onCancel,
}: {
  datasheets: DynamicModel[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<LeadFieldConfigCreate>>({
    field_type: 'text',
    is_visible: true,
    is_required: false,
  });
  const [selectOptions, setSelectOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedType = FIELD_TYPES.find((t) => t.value === form.field_type) ?? FIELD_TYPES[0];
  const relationTarget = (form.config as Record<string, unknown> | undefined)?.['target'] as string ?? 'work';
  const datasheetId = (form.config as Record<string, unknown> | undefined)?.['datasheet_id'] as number | undefined;

  function handleNameChange(name: string) {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '').slice(0, 79);
    setForm((p) => ({ ...p, display_name: name, field_key: key }));
  }

  function handleTypeSelect(type: FieldType) {
    setForm((p) => ({ ...p, field_type: type, config: undefined }));
  }

  function setRelationTarget(target: string) {
    setForm((p) => ({
      ...p,
      config: { target, datasheet_id: undefined },
    }));
  }

  function setRelationDatasheet(id: number, name: string) {
    setForm((p) => ({
      ...p,
      display_name: p.display_name || name,
      field_key: p.field_key || name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '').slice(0, 79),
      config: { target: 'datasheet', datasheet_id: id, datasheet_name: name },
    }));
  }

  function addOption() {
    const val = optionInput.trim();
    if (!val || selectOptions.includes(val)) return;
    setSelectOptions((prev) => [...prev, val]);
    setOptionInput('');
  }

  function removeOption(opt: string) {
    setSelectOptions((prev) => prev.filter((o) => o !== opt));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.display_name?.trim()) { setError('Display name is required'); return; }
    if (!form.field_key?.match(/^[a-z][a-z0-9_]{0,78}$/)) {
      setError('Field key must start with a letter and only contain lowercase letters, numbers, underscores');
      return;
    }
    if (form.field_type === 'select' && selectOptions.length === 0) {
      setError('Add at least one option for the dropdown');
      return;
    }
    if (form.field_type === 'relation' && relationTarget === 'datasheet' && !datasheetId) {
      setError('Please select which datasheet this field links to');
      return;
    }
    setLoading(true);
    try {
      const config: Record<string, unknown> = {};
      if (form.field_type === 'select') {
        config.options = selectOptions;
      } else if (form.field_type === 'relation') {
        config.target = relationTarget;
        config.display_mode = 'count';
        if (relationTarget === 'datasheet' && datasheetId) {
          config.datasheet_id = datasheetId;
          const ds = datasheets.find((d) => d.id === datasheetId);
          if (ds) config.datasheet_name = ds.name;
        }
      }
      await createLeadField({
        ...form,
        config: Object.keys(config).length ? config : undefined,
      } as LeadFieldConfigCreate);
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create field');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-accent/25 bg-gradient-to-b from-accent/5 to-transparent overflow-hidden">
      {/* Form header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-accent/15">
        <div className="flex items-center gap-2">
          <span className={`flex items-center justify-center h-6 w-6 rounded-md text-xs font-bold ${selectedType.color}`}>
            {selectedType.icon}
          </span>
          <span className="text-xs font-semibold text-text-primary">New Custom Field</span>
        </div>
        <button onClick={onCancel} className="text-text-secondary hover:text-text-primary transition-colors">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-5">

        {/* ── Step 1: Name ── */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
            Field Name <span className="text-red-500">*</span>
          </label>
          <input
            autoFocus
            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-colors"
            placeholder="e.g. Budget, Region, Referral Source…"
            value={form.display_name ?? ''}
            onChange={(e) => handleNameChange(e.target.value)}
          />
          {form.field_key && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-secondary">Key:</span>
              <code className="text-[10px] font-mono bg-bg-secondary border border-border-color rounded px-1.5 py-0.5 text-text-secondary">
                {form.field_key}
              </code>
              <span className="text-[10px] text-text-secondary opacity-60">(auto-generated)</span>
            </div>
          )}
        </div>

        {/* ── Step 2: Field Type ── */}
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
            Field Type
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {FIELD_TYPES.map((ft) => (
              <button
                key={ft.value}
                type="button"
                onClick={() => handleTypeSelect(ft.value)}
                className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 border transition-all text-center ${
                  form.field_type === ft.value
                    ? 'border-accent bg-accent/10 ring-1 ring-accent/30'
                    : 'border-border-color bg-card-bg hover:border-accent/30 hover:bg-accent/5'
                }`}
              >
                <span className={`flex items-center justify-center h-6 w-6 rounded-md text-xs font-bold ${ft.color}`}>
                  {ft.icon}
                </span>
                <span className="text-[10px] font-medium text-text-primary leading-tight">{ft.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-text-secondary pl-0.5">{selectedType.desc}</p>
        </div>

        {/* ── Step 3: Type-specific config ── */}

        {/* Select: tag input */}
        {form.field_type === 'select' && (
          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
              Dropdown Options <span className="text-red-500">*</span>
            </label>
            {selectOptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg border border-border-color bg-bg-primary min-h-[36px]">
                {selectOptions.map((opt) => (
                  <span
                    key={opt}
                    className="inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/20 px-2.5 py-0.5 text-xs font-medium text-accent"
                  >
                    {opt}
                    <button
                      type="button"
                      onClick={() => removeOption(opt)}
                      className="ml-0.5 hover:text-red-500 transition-colors"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-xs text-text-primary placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-colors"
                placeholder="Type option and press Enter or Add…"
                value={optionInput}
                onChange={(e) => setOptionInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
              />
              <button
                type="button"
                onClick={addOption}
                disabled={!optionInput.trim()}
                className="px-3 py-2 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Relation: target picker */}
        {form.field_type === 'relation' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                Link To
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {RELATION_TARGETS.map((rt) => (
                  <button
                    key={rt.value}
                    type="button"
                    onClick={() => setRelationTarget(rt.value)}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 border transition-all text-left ${
                      relationTarget === rt.value
                        ? 'border-violet-400 bg-violet-500/10 ring-1 ring-violet-400/30'
                        : 'border-border-color bg-card-bg hover:border-violet-400/30 hover:bg-violet-500/5'
                    }`}
                  >
                    <span className="text-sm">{rt.icon}</span>
                    <span className="text-[11px] font-medium text-text-primary leading-tight">{rt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Datasheet sub-picker */}
            {relationTarget === 'datasheet' && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                  Select Datasheet <span className="text-red-500">*</span>
                </label>
                {datasheets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border-color p-3 text-center">
                    <p className="text-xs text-text-secondary">No datasheets found</p>
                    <p className="text-[10px] text-text-secondary mt-0.5">Create a datasheet first from the Datasheets section</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {datasheets.map((ds) => (
                      <button
                        key={ds.id}
                        type="button"
                        onClick={() => setRelationDatasheet(ds.id, ds.name)}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-left transition-all ${
                          datasheetId === ds.id
                            ? 'border-violet-400 bg-violet-500/10 ring-1 ring-violet-400/30'
                            : 'border-border-color bg-card-bg hover:border-violet-400/30 hover:bg-violet-500/5'
                        }`}
                      >
                        <span className="text-sm">🗄</span>
                        <span className="text-xs font-medium text-text-primary truncate">{ds.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Settings ── */}
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Settings</label>
          <div className="flex items-center gap-4 rounded-lg border border-border-color bg-card-bg px-3 py-2.5">
            <Toggle
              label="Required"
              description="Must be filled"
              checked={form.is_required ?? false}
              onChange={(v) => setForm((p) => ({ ...p, is_required: v }))}
            />
            <div className="w-px h-8 bg-border-color" />
            <Toggle
              label="Visible"
              description="Show in table"
              checked={form.is_visible ?? true}
              onChange={(v) => setForm((p) => ({ ...p, is_visible: v }))}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
            <svg className="h-3.5 w-3.5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border-color bg-bg-secondary text-xs font-medium text-text-secondary hover:bg-card-bg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating…
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Field
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  label, description, checked, onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 flex-1 text-left"
    >
      <div className={`relative shrink-0 h-5 w-9 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-border-color'}`}>
        <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
      <div>
        <p className="text-xs font-medium text-text-primary">{label}</p>
        <p className="text-[10px] text-text-secondary">{description}</p>
      </div>
    </button>
  );
}

// ─── Source Mapping Tab ───────────────────────────────────────────────────────

function MappingTab({
  sources, selectedSource, onSelectSource,
  preview, loading, mappings, onMappingsChange, onSave,
}: {
  sources: { key: string; label: string; icon: string }[];
  selectedSource: string;
  onSelectSource: (s: string) => void;
  preview: SourceMappingPreview | null;
  loading: boolean;
  mappings: Record<string, string>;
  onMappingsChange: (m: Record<string, string>) => void;
  onSave: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try { await onSave(); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-text-secondary leading-relaxed">
        Map incoming fields from each source to your lead columns. When a new lead arrives, mapped values
        are automatically stored in the correct fields.
      </div>

      {/* Source selector */}
      <div className="flex flex-wrap gap-2">
        {sources.map((s) => (
          <button
            key={s.key}
            onClick={() => onSelectSource(s.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              selectedSource === s.key
                ? 'bg-accent text-white border-accent'
                : 'border-border-color bg-card-bg text-text-secondary hover:border-accent/40 hover:text-text-primary'
            }`}
          >
            <span>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : preview ? (
        <div className="space-y-3">
          <p className="text-[11px] text-text-secondary">
            Map each <strong className="text-text-primary">{sources.find((s) => s.key === selectedSource)?.label}</strong> field to a lead column:
          </p>

          <div className="rounded-xl border border-border-color bg-card-bg divide-y divide-border-color overflow-hidden">
            {preview.available_fields.map((sf) => (
              <div key={sf.key} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary font-mono">{sf.key}</p>
                  <p className="text-[10px] text-text-secondary">e.g. &quot;{sf.sample_value}&quot;</p>
                </div>
                <svg className="h-3.5 w-3.5 shrink-0 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <select
                  className="w-40 rounded-lg border border-border-color bg-bg-secondary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                  value={mappings[sf.key] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onMappingsChange(
                      val
                        ? { ...mappings, [sf.key]: val }
                        : Object.fromEntries(Object.entries(mappings).filter(([k]) => k !== sf.key))
                    );
                  }}
                >
                  <option value="">— not mapped —</option>
                  {preview.lead_fields.map((lf) => (
                    <option key={lf.field_key} value={lf.field_key}>{lf.display_name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : `Save ${sources.find((s) => s.key === selectedSource)?.label ?? selectedSource} Mappings`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
