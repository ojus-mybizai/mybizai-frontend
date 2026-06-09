'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FileText, Zap, List, PlusCircle, Edit2, Trash2,
  CheckCircle, Upload, X,
} from 'lucide-react';
import {
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  publishFlow, getButtonPresets, getDailyReportScaffold,
  type WaTemplate, type WaTemplateCreate, type WaTemplateType, type ButtonDef,
  type DatasheetFieldMap, type FlowFieldType,
} from '@/services/waTemplates';
import DatasheetMappingPanel, { type GeneratedFieldWithMapping } from '@/components/wa-templates/DatasheetMappingPanel';

const TYPE_META: Record<WaTemplateType, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  simple_task: {
    label: 'Simple Task',
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800/60',
    desc: 'Text message with Done / Not Done buttons',
  },
  whatsapp_form: {
    label: 'WhatsApp Form',
    icon: <FileText className="w-4 h-4" />,
    color: 'bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-800/60',
    desc: 'Native form UI that opens inside WhatsApp',
  },
  lead_list: {
    label: 'Lead List',
    icon: <List className="w-4 h-4" />,
    color: 'bg-orange-100 dark:bg-orange-950/40 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-800/60',
    desc: 'List of leads/contacts with per-item status buttons',
  },
  checklist: {
    label: 'Checklist',
    icon: <Zap className="w-4 h-4" />,
    color: 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-200 border-green-300 dark:border-green-800/60',
    desc: 'Bullet-point task list sent as a WhatsApp message',
  },
};

const FLOW_FIELD_TYPES = [
  { value: 'TextInput', label: 'Short Text' },
  { value: 'TextArea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'phone', label: 'Phone' },
  { value: 'DatePicker', label: 'Date Picker' },
  { value: 'Dropdown', label: 'Dropdown' },
  { value: 'CheckboxGroup', label: 'Checkboxes' },
  { value: 'RadioButtonsGroup', label: 'Radio Buttons' },
  { value: 'OptIn', label: 'Yes / No (Opt-in)' },
];

// Field types that need an options list. Editor shows an options editor for these.
const OPTION_FIELD_TYPES = new Set(['Dropdown', 'CheckboxGroup', 'RadioButtonsGroup']);

interface FlowField {
  id: string;
  type: string;
  label: string;
  name: string;
  required: boolean;
  options?: string[];
}

// Shared design-token utility classes
const inputCls =
  'w-full border border-border-color rounded-lg px-3 py-2 text-sm bg-card-bg text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent';
const smallInputCls =
  'border border-border-color rounded px-2 py-1.5 text-sm bg-card-bg text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent';
const labelCls = 'text-sm font-medium text-text-primary';
const subtleCls = 'text-xs text-text-secondary';

// Fix 1: removed data_api_version — static flows don't need a Data API endpoint.
function generateFlowJson(fields: FlowField[]): Record<string, unknown> {
  const formChildren: unknown[] = fields.map((f) => {
    // Map logical types to Meta Flow component names.
    const componentType =
      f.type === 'number' || f.type === 'phone' ? 'TextInput' : f.type;
    const base: Record<string, unknown> = {
      type: componentType,
      label: f.label,
      name: f.name,
      required: f.required,
    };
    if (f.type === 'number') base['input-type'] = 'number';
    if (f.type === 'phone') base['input-type'] = 'phone';
    if (['Dropdown', 'CheckboxGroup', 'RadioButtonsGroup'].includes(f.type)) {
      const opts = (f.options && f.options.length > 0) ? f.options : ['Option 1', 'Option 2'];
      base['data-source'] = opts.map((o) => ({ id: o, title: o }));
    }
    // OptIn requires the label inside `on-click-action` style copy.
    // Meta's OptIn renders the label as the consent text — no extra config needed.
    return base;
  });

  const payload: Record<string, string> = {};
  fields.forEach((f) => { payload[f.name] = `\${form.${f.name}}`; });

  formChildren.push({
    type: 'Footer',
    label: 'Submit',
    'on-click-action': { name: 'complete', payload },
  });

  return {
    version: '6.3',
    routing_model: { FORM_SCREEN: [] },
    screens: [{
      id: 'FORM_SCREEN',
      title: 'Form',
      terminal: true,
      layout: {
        type: 'SingleColumnLayout',
        children: [{ type: 'Form', name: 'task_form', children: formChildren }],
      },
    }],
  };
}

function extractFlowFields(flowJson: Record<string, unknown> | null | undefined): FlowField[] {
  if (!flowJson) return [];
  try {
    const screens = (flowJson as any)?.screens || [];
    const formChildren = screens[0]?.layout?.children?.[0]?.children || [];
    return formChildren
      .filter((c: any) => c.type !== 'Footer')
      .map((c: any, i: number) => ({
        id: String(i),
        type:
          c['input-type'] === 'number' ? 'number'
            : c['input-type'] === 'phone' ? 'phone'
            : c.type,
        label: c.label || '',
        name: c.name || `field_${i}`,
        required: c.required || false,
        options: c['data-source']?.map((o: any) => o.title || o.id) || undefined,
      }));
  } catch {
    return [];
  }
}

export default function WaTemplatesPage() {
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<WaTemplate | null>(null);
  const [publishing, setPublishing] = useState<number | null>(null);
  const [buttonPresets, setButtonPresets] = useState<Record<string, ButtonDef[]>>({});

  const [formType, setFormType] = useState<WaTemplateType>('simple_task');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formBody, setFormBody] = useState('📋 *Task: {{task_title}}*\n\nDue: {{due_date}}\nEmployee: {{employee_name}}');
  const [formButtons, setFormButtons] = useState<ButtonDef[]>([
    { id: 'done', title: '✅ Done' },
    { id: 'not_done', title: '❌ Not Done' },
  ]);
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);
  const [leadStatusOptions, setLeadStatusOptions] = useState<ButtonDef[]>([
    { id: 'called', title: '📞 Called' },
    { id: 'not_answered', title: '🔇 Not Answered' },
    { id: 'callback', title: '🔁 Callback' },
  ]);
  const [formLanguage, setFormLanguage] = useState('en');
  const [flowFields, setFlowFields] = useState<FlowField[]>([]);
  const [saving, setSaving] = useState(false);
  const [dsEnabled, setDsEnabled] = useState(false);
  const [dsModelId, setDsModelId] = useState<number | null>(null);
  const [dsMapping, setDsMapping] = useState<DatasheetFieldMap | null>(null);
  // Keyword-triggered self-service (whatsapp_form only)
  const [triggerEnabled, setTriggerEnabled] = useState(false);
  const [triggerKeywords, setTriggerKeywords] = useState<string[]>([]);
  const [triggerCooldownSec, setTriggerCooldownSec] = useState(60);
  const [keywordDraft, setKeywordDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tmpl, presets] = await Promise.all([listTemplates(), getButtonPresets()]);
      setTemplates(tmpl);
      setButtonPresets(presets);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setFormType('simple_task');
    setFormName('');
    setFormDesc('');
    setFormBody('📋 *Task: {{task_title}}*\n\nDue: {{due_date}}\nEmployee: {{employee_name}}');
    setFormButtons([{ id: 'done', title: '✅ Done' }, { id: 'not_done', title: '❌ Not Done' }]);
    setChecklistItems(['']);
    setLeadStatusOptions([
      { id: 'called', title: '📞 Called' },
      { id: 'not_answered', title: '🔇 Not Answered' },
      { id: 'callback', title: '🔁 Callback' },
    ]);
    setFlowFields([]);
    setDsEnabled(false);
    setDsModelId(null);
    setDsMapping(null);
    setTriggerEnabled(false);
    setTriggerKeywords([]);
    setTriggerCooldownSec(60);
    setKeywordDraft('');
    setEditTemplate(null);
  }

  function openEdit(tmpl: WaTemplate) {
    setEditTemplate(tmpl);
    setFormType(tmpl.type);
    setFormName(tmpl.name);
    setFormDesc(tmpl.description || '');
    setFormBody(tmpl.message_body || '');

    if (tmpl.type === 'checklist') {
      setChecklistItems(
        tmpl.buttons && tmpl.buttons.length > 0
          ? tmpl.buttons.map((b: ButtonDef) => b.title)
          : ['']
      );
      setFormButtons([]);
    } else if (tmpl.type === 'lead_list') {
      setLeadStatusOptions(tmpl.buttons || []);
      setFormButtons([]);
    } else {
      setFormButtons(tmpl.buttons || []);
    }

    setFlowFields(extractFlowFields(tmpl.flow_json));

    setDsEnabled(Boolean(tmpl.datasheet_write_enabled));
    setDsModelId(tmpl.linked_dynamic_model_id ?? null);
    setDsMapping(tmpl.datasheet_field_map ?? null);

    setTriggerEnabled(Boolean(tmpl.trigger_enabled));
    setTriggerKeywords(tmpl.trigger_keywords ?? []);
    setTriggerCooldownSec(tmpl.trigger_cooldown_sec ?? 60);
    setKeywordDraft('');

    setShowCreate(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      let buttons: ButtonDef[] | undefined;

      if (formType === 'checklist') {
        buttons = checklistItems
          .map((title, i) => ({ id: `item_${i + 1}`, title: title.trim() }))
          .filter((b) => b.title.length > 0);
      } else if (formType === 'lead_list') {
        buttons = leadStatusOptions.filter((b) => b.title.trim());
      } else if (formType === 'simple_task') {
        buttons = formButtons;
      }

      const payload: WaTemplateCreate = {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        type: formType,
        message_body: formType === 'simple_task' || formType === 'checklist' ? formBody : undefined,
        buttons,
        flow_json: formType === 'whatsapp_form' ? generateFlowJson(flowFields) : undefined,
        meta_template_language: formLanguage || 'en',
      };

      if (formType === 'whatsapp_form') {
        payload.datasheet_write_enabled = dsEnabled;
        payload.linked_dynamic_model_id = dsEnabled ? dsModelId : null;
        payload.datasheet_field_map = dsEnabled ? dsMapping : null;
        payload.trigger_enabled = triggerEnabled;
        payload.trigger_keywords = triggerEnabled ? triggerKeywords : [];
        payload.trigger_cooldown_sec = Math.max(0, triggerCooldownSec | 0);
      }

      if (editTemplate) {
        await updateTemplate(editTemplate.id, payload);
      } else {
        await createTemplate(payload);
      }
      resetForm();
      setShowCreate(false);
      load();
    } catch (e: unknown) {
      alert((e as Error).message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tmpl: WaTemplate) {
    if (!confirm(`Delete template "${tmpl.name}"?`)) return;
    try {
      await deleteTemplate(tmpl.id);
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  async function handlePublishFlow(tmpl: WaTemplate) {
    setPublishing(tmpl.id);
    try {
      const result = await publishFlow(tmpl.id);
      alert(`Flow published! Flow ID: ${result.flow_id}`);
      load();
    } catch (e: unknown) {
      alert((e as Error).message || 'Publish failed');
    } finally {
      setPublishing(null);
    }
  }

  function addFlowField() {
    setFlowFields((prev) => [...prev, {
      id: Date.now().toString(),
      type: 'TextInput',
      label: 'New Field',
      name: `field_${Date.now()}`,
      required: false,
    }]);
  }

  function handleGenerateFromDatasheet(generated: GeneratedFieldWithMapping[]) {
    const newFields: FlowField[] = generated.map((g) => ({
      ...g.field,
      options: g.options,
    }));
    setFlowFields(newFields);
    setDsMapping({
      version: 1,
      mappings: generated.map((g) => ({
        flow_field_name: g.field.name,
        flow_field_type: g.field.type as FlowFieldType,
        dynamic_field_id: g.dynamic_field_id,
        dynamic_field_name: g.dynamic_field_name,
      })),
    });
  }

  async function loadDailyReportScaffold() {
    try {
      const scaffold = await getDailyReportScaffold();
      setFlowFields(extractFlowFields(scaffold as Record<string, unknown>));
    } catch {
      alert('Failed to load scaffold');
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto text-text-primary">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
            WhatsApp Templates
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Create templates to send tasks, forms, and lead lists to your team
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-lg shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Template type legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {(Object.entries(TYPE_META) as [WaTemplateType, typeof TYPE_META[WaTemplateType]][]).map(([type, meta]) => (
          <div key={type} className={`border rounded-xl p-3 ${meta.color}`}>
            <div className="flex items-center gap-2 font-medium text-sm mb-1">
              {meta.icon}
              {meta.label}
            </div>
            <p className="text-xs opacity-90">{meta.desc}</p>
          </div>
        ))}
      </div>

      {loading && <div className="text-center py-16 text-text-secondary">Loading...</div>}
      {error && <div className="text-center py-8 text-red-600 dark:text-red-400">{error}</div>}

      {!loading && templates.length === 0 && (
        <div className="text-center py-16 text-text-secondary bg-card-bg border border-border-color rounded-xl">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-text-primary">No templates yet</p>
          <p className="text-sm mt-1">Create your first template to start sending work via WhatsApp</p>
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tmpl) => {
            const meta = TYPE_META[tmpl.type] || TYPE_META.simple_task;
            const checklistCount = tmpl.type === 'checklist' ? (tmpl.buttons?.length || 0) : 0;
            const fieldCount = tmpl.type === 'whatsapp_form'
              ? ((tmpl.flow_json as any)?.screens?.[0]?.layout?.children?.[0]?.children?.filter(
                  (c: any) => c.type !== 'Footer'
                )?.length || 0)
              : 0;

            return (
              <div key={tmpl.id} className="bg-card-bg border border-border-color rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>
                      {meta.icon}
                      {meta.label}
                    </span>
                    {tmpl.meta_flow_status === 'published' && (
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-800/60 text-xs rounded-full">✓ Live</span>
                    )}
                    {tmpl.meta_flow_status === 'draft' && tmpl.type === 'whatsapp_form' && (
                      <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-800/60 text-xs rounded-full">⚠ Not published</span>
                    )}
                    {tmpl.trigger_enabled && (tmpl.trigger_keywords?.length ?? 0) > 0 && (
                      <span
                        className="px-2 py-0.5 bg-accent-soft text-text-primary border border-accent/40 text-xs rounded-full"
                        title={(tmpl.trigger_keywords ?? []).join(', ')}
                      >
                        ⌨ {tmpl.trigger_keywords!.length} keyword{tmpl.trigger_keywords!.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {tmpl.type === 'whatsapp_form' && tmpl.meta_flow_status !== 'published' && (
                      <button
                        onClick={() => handlePublishFlow(tmpl)}
                        disabled={publishing === tmpl.id}
                        className="p-1.5 text-accent hover:bg-accent-soft rounded"
                        title="Publish Flow to Meta"
                      >
                        {publishing === tmpl.id
                          ? <span className="text-xs">...</span>
                          : <Upload className="w-4 h-4" />}
                      </button>
                    )}
                    <button onClick={() => openEdit(tmpl)} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-secondary rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(tmpl)} className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-bg-secondary rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-text-primary mb-1">{tmpl.name}</h3>
                {tmpl.description && <p className="text-sm text-text-secondary mb-2">{tmpl.description}</p>}

                {tmpl.type === 'simple_task' && tmpl.message_body && (
                  <div className="bg-bg-secondary rounded-lg p-3 text-xs text-text-primary whitespace-pre-line mb-2 font-mono">
                    {tmpl.message_body.slice(0, 120)}{tmpl.message_body.length > 120 ? '...' : ''}
                  </div>
                )}

                {tmpl.type === 'checklist' && tmpl.buttons && tmpl.buttons.length > 0 && (
                  <div className="bg-bg-secondary rounded-lg p-3 mb-2">
                    <p className="text-xs text-text-secondary mb-1">{checklistCount} checklist items</p>
                    <ul className="space-y-0.5">
                      {tmpl.buttons.slice(0, 5).map((btn: ButtonDef, i: number) => (
                        <li key={i} className="text-xs text-text-primary flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-text-secondary flex-shrink-0" />
                          {btn.title}
                        </li>
                      ))}
                      {tmpl.buttons.length > 5 && (
                        <li className="text-xs text-text-secondary">+{tmpl.buttons.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}

                {tmpl.type === 'lead_list' && tmpl.buttons && tmpl.buttons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    <span className="text-xs text-text-secondary w-full mb-1">Lead status options:</span>
                    {tmpl.buttons.map((btn: ButtonDef) => (
                      <span key={btn.id} className="px-2 py-0.5 bg-orange-100 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800/60 rounded-full text-xs text-orange-800 dark:text-orange-200">
                        {btn.title}
                      </span>
                    ))}
                  </div>
                )}

                {tmpl.type === 'whatsapp_form' && (
                  <div className="text-xs text-text-secondary">
                    {fieldCount} form field{fieldCount !== 1 ? 's' : ''} defined
                    {tmpl.meta_flow_id && (
                      <span className="ml-2 text-accent font-mono">ID: {tmpl.meta_flow_id}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card-bg border border-border-color rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border-color sticky top-0 bg-card-bg z-10">
              <h2 className="font-semibold text-text-primary text-lg">
                {editTemplate ? `Edit: ${editTemplate.name}` : 'Create Template'}
              </h2>
              <button
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="p-1 rounded hover:bg-bg-secondary"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {!editTemplate && (
                <div>
                  <label className={`${labelCls} block mb-2`}>Template Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(TYPE_META) as [WaTemplateType, typeof TYPE_META[WaTemplateType]][]).map(([type, meta]) => (
                      <button
                        key={type}
                        onClick={() => setFormType(type)}
                        className={`text-left p-3 border rounded-xl transition-all ${
                          formType === type
                            ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-950/30 ring-1 ring-green-500 dark:ring-green-400'
                            : 'border-border-color bg-card-bg hover:bg-bg-secondary'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-medium text-sm mb-1 text-text-primary">
                          {meta.icon}
                          {meta.label}
                        </div>
                        <p className="text-xs text-text-secondary">{meta.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Template Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Daily Sales Report, Lead Follow-up..."
                  className={`${inputCls} mt-1`}
                />
              </div>

              <div>
                <label className={labelCls}>Description (optional)</label>
                <input
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="What this template is used for"
                  className={`${inputCls} mt-1`}
                />
              </div>

              {/* ── Simple Task ── */}
              {formType === 'simple_task' && (
                <>
                  <div>
                    <label className={`${labelCls} flex items-center justify-between`}>
                      Message Body
                      <span className="text-xs font-normal text-text-secondary">
                        Variables: {'{{task_title}}'}, {'{{due_date}}'}, {'{{employee_name}}'}
                      </span>
                    </label>
                    <textarea
                      value={formBody}
                      onChange={(e) => setFormBody(e.target.value)}
                      rows={4}
                      className={`${inputCls} mt-1 font-mono`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <label className={labelCls}>Response Buttons (max 3)</label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(buttonPresets).map(([key, btns]) => (
                          <button
                            key={key}
                            onClick={() => setFormButtons(btns)}
                            className="text-xs px-2 py-1 border border-border-color rounded text-text-primary hover:bg-bg-secondary"
                          >
                            {key.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {formButtons.map((btn, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            value={btn.id}
                            onChange={(e) => setFormButtons((prev) => prev.map((b, j) => j === i ? { ...b, id: e.target.value } : b))}
                            placeholder="id (e.g. done)"
                            className={`${smallInputCls} w-28 font-mono`}
                          />
                          <input
                            value={btn.title}
                            onChange={(e) => setFormButtons((prev) => prev.map((b, j) => j === i ? { ...b, title: e.target.value } : b))}
                            placeholder="Button label"
                            className={`${smallInputCls} flex-1`}
                          />
                          <button
                            onClick={() => setFormButtons((prev) => prev.filter((_, j) => j !== i))}
                            className="p-1 rounded hover:bg-bg-secondary"
                            aria-label="Remove button"
                          >
                            <X className="w-4 h-4 text-text-secondary hover:text-red-500" />
                          </button>
                        </div>
                      ))}
                      {formButtons.length < 3 && (
                        <button
                          onClick={() => setFormButtons((prev) => [...prev, { id: '', title: '' }])}
                          className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center gap-1"
                        >
                          <PlusCircle className="w-4 h-4" /> Add button
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ── Checklist ── */}
              {formType === 'checklist' && (
                <>
                  <div>
                    <label className={`${labelCls} flex items-center justify-between`}>
                      Message Body (optional)
                      <span className="text-xs font-normal text-text-secondary">
                        Variables: {'{{task_title}}'}, {'{{employee_name}}'}
                      </span>
                    </label>
                    <textarea
                      value={formBody}
                      onChange={(e) => setFormBody(e.target.value)}
                      rows={2}
                      placeholder="Optional intro text sent before the checklist items"
                      className={`${inputCls} mt-1 font-mono`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={labelCls}>Checklist Items</label>
                      <button
                        onClick={() => setChecklistItems((prev) => [...prev, ''])}
                        className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded flex items-center gap-1"
                      >
                        <PlusCircle className="w-3 h-3" /> Add item
                      </button>
                    </div>
                    <p className={`${subtleCls} mb-3`}>
                      These appear as a bullet-point list in the WhatsApp message. Employees reply with <strong className="text-text-primary">All Done</strong> or <strong className="text-text-primary">Partially Done</strong>.
                    </p>
                    <div className="space-y-2">
                      {checklistItems.map((item, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <span className="text-text-secondary text-sm w-5 text-right flex-shrink-0">{i + 1}.</span>
                          <input
                            value={item}
                            onChange={(e) => setChecklistItems((prev) => prev.map((v, j) => j === i ? e.target.value : v))}
                            placeholder={`e.g. Check inventory, Submit cash sheet...`}
                            className={`${smallInputCls} flex-1`}
                          />
                          <button
                            onClick={() => setChecklistItems((prev) => prev.filter((_, j) => j !== i))}
                            disabled={checklistItems.length === 1}
                            className="p-1 rounded hover:bg-bg-secondary disabled:hover:bg-transparent"
                            aria-label="Remove item"
                          >
                            <X className={`w-4 h-4 ${checklistItems.length === 1 ? 'text-text-secondary/30' : 'text-text-secondary hover:text-red-500'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {checklistItems.filter((s) => s.trim()).length === 0 && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2">Add at least one checklist item</p>
                    )}
                  </div>
                </>
              )}

              {/* ── Lead List ── */}
              {formType === 'lead_list' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelCls}>Lead Status Options</label>
                    <button
                      onClick={() => setLeadStatusOptions((prev) => [...prev, { id: '', title: '' }])}
                      disabled={leadStatusOptions.length >= 3}
                      className="text-xs px-2 py-1 border border-border-color rounded text-text-primary hover:bg-bg-secondary disabled:opacity-40 flex items-center gap-1"
                    >
                      <PlusCircle className="w-3 h-3" /> Add option
                    </button>
                  </div>
                  <p className={`${subtleCls} mb-3`}>
                    Buttons employees tap for each lead in the list (max 3). E.g. Called, Not Answered, Callback.
                  </p>
                  <div className="space-y-2">
                    {leadStatusOptions.map((opt, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          value={opt.id}
                          onChange={(e) => setLeadStatusOptions((prev) => prev.map((o, j) => j === i ? { ...o, id: e.target.value } : o))}
                          placeholder="id (e.g. called)"
                          className={`${smallInputCls} w-28 font-mono`}
                        />
                        <input
                          value={opt.title}
                          onChange={(e) => setLeadStatusOptions((prev) => prev.map((o, j) => j === i ? { ...o, title: e.target.value } : o))}
                          placeholder="Label (e.g. 📞 Called)"
                          className={`${smallInputCls} flex-1`}
                        />
                        <button
                          onClick={() => setLeadStatusOptions((prev) => prev.filter((_, j) => j !== i))}
                          className="p-1 rounded hover:bg-bg-secondary"
                          aria-label="Remove option"
                        >
                          <X className="w-4 h-4 text-text-secondary hover:text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── WhatsApp Form ── */}
              {formType === 'whatsapp_form' && (
                <div className="space-y-5">
                  <DatasheetMappingPanel
                    flowFields={flowFields.map((f) => ({
                      id: f.id,
                      type: f.type,
                      name: f.name,
                      label: f.label,
                      required: f.required,
                    }))}
                    enabled={dsEnabled}
                    linkedModelId={dsModelId}
                    mapping={dsMapping}
                    onChange={({ enabled, linkedModelId, mapping }) => {
                      setDsEnabled(enabled);
                      setDsModelId(linkedModelId);
                      setDsMapping(mapping);
                    }}
                    onGenerateFromDatasheet={handleGenerateFromDatasheet}
                  />

                  {/* ── Keyword trigger panel ────────────────────────────── */}
                  <div className="border border-border-color rounded-xl bg-card-bg p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="font-medium text-sm text-text-primary">
                          Trigger via WhatsApp keyword
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5">
                          Employees text any of these phrases to receive this form instantly.
                          Reserved phrases (check-in, leaving, …) are blocked.
                        </p>
                      </div>
                      <label className="inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={triggerEnabled}
                          onChange={(e) => setTriggerEnabled(e.target.checked)}
                        />
                        <div className="w-10 h-5 bg-bg-secondary border border-border-color rounded-full peer-checked:bg-accent peer-checked:border-accent transition relative">
                          <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-card-bg rounded-full shadow transition-transform ${triggerEnabled ? 'translate-x-5' : ''}`} />
                        </div>
                      </label>
                    </div>

                    {triggerEnabled && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                            Keywords
                          </label>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {triggerKeywords.map((kw, i) => (
                              <span
                                key={`${kw}-${i}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent-soft text-text-primary text-xs border border-accent/40"
                              >
                                {kw}
                                <button
                                  type="button"
                                  onClick={() => setTriggerKeywords((prev) => prev.filter((_, j) => j !== i))}
                                  className="hover:text-red-500"
                                  aria-label={`Remove ${kw}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                            {triggerKeywords.length === 0 && (
                              <span className="text-xs text-text-secondary italic">No keywords yet</span>
                            )}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <input
                              value={keywordDraft}
                              onChange={(e) => setKeywordDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const s = keywordDraft.trim();
                                  if (s && !triggerKeywords.some((k) => k.toLowerCase() === s.toLowerCase())) {
                                    setTriggerKeywords((prev) => [...prev, s]);
                                  }
                                  setKeywordDraft('');
                                }
                              }}
                              placeholder='e.g. "add new visit"  — press Enter to add'
                              className={smallInputCls + ' flex-1'}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const s = keywordDraft.trim();
                                if (s && !triggerKeywords.some((k) => k.toLowerCase() === s.toLowerCase())) {
                                  setTriggerKeywords((prev) => [...prev, s]);
                                }
                                setKeywordDraft('');
                              }}
                              className="text-xs px-3 py-1.5 border border-border-color rounded text-text-primary hover:bg-bg-secondary"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-text-primary uppercase tracking-wide block mb-1">
                            Cooldown (seconds)
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min={0}
                              max={3600}
                              value={triggerCooldownSec}
                              onChange={(e) => setTriggerCooldownSec(Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className={smallInputCls + ' w-28'}
                            />
                            <span className="text-xs text-text-secondary">
                              Same employee can only re-trigger this template after the cooldown elapses.
                            </span>
                          </div>
                        </div>

                        {!editTemplate?.meta_flow_id && (
                          <div className="text-xs bg-amber-100/60 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-lg px-3 py-2 text-amber-900 dark:text-amber-200">
                            ⚠ Keywords only work after this Flow is published to Meta. Save first, then click <strong>Publish</strong> on the template card.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className={labelCls}>Form Fields</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={loadDailyReportScaffold}
                        className="text-xs px-2 py-1 border border-border-color rounded hover:bg-bg-secondary text-accent"
                      >
                        Load daily report scaffold
                      </button>
                      <button
                        onClick={addFlowField}
                        className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded flex items-center gap-1"
                      >
                        <PlusCircle className="w-3 h-3" /> Add Field
                      </button>
                    </div>
                  </div>

                  {editTemplate && flowFields.length === 0 && (
                    <div className="bg-amber-100/60 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-lg px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                      Fields could not be parsed from the saved JSON. Add fields manually or reload the scaffold.
                    </div>
                  )}

                  {flowFields.length === 0 && !editTemplate && (
                    <div className="text-center py-8 text-text-secondary border-2 border-dashed border-border-color rounded-xl">
                      <p className="text-sm">No fields yet. Pick a datasheet above to auto-generate, or click <strong className="text-text-primary">Add Field</strong> to start from scratch.</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {flowFields.map((field, i) => (
                      <div key={field.id} className="border border-border-color rounded-xl p-3 bg-bg-secondary">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <div className="flex gap-2">
                              <input
                                value={field.label}
                                onChange={(e) => setFlowFields((prev) => prev.map((f, j) => j === i ? { ...f, label: e.target.value } : f))}
                                placeholder="Field label"
                                className={`${smallInputCls} flex-1`}
                              />
                              <select
                                value={field.type}
                                onChange={(e) => setFlowFields((prev) => prev.map((f, j) => j === i ? { ...f, type: e.target.value } : f))}
                                className={smallInputCls}
                              >
                                {FLOW_FIELD_TYPES.map((ft) => (
                                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                value={field.name}
                                onChange={(e) => setFlowFields((prev) => prev.map((f, j) => j === i ? { ...f, name: e.target.value } : f))}
                                placeholder="field_name (no spaces)"
                                className={`${smallInputCls} flex-1 font-mono`}
                              />
                              <label className="flex items-center gap-1 text-sm text-text-primary whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => setFlowFields((prev) => prev.map((f, j) => j === i ? { ...f, required: e.target.checked } : f))}
                                  className="accent-green-600 dark:accent-green-500"
                                />
                                Required
                              </label>
                            </div>
                            {OPTION_FIELD_TYPES.has(field.type) && (
                              <div className="pt-1">
                                <div className="text-[11px] uppercase tracking-wide text-text-secondary mb-1">
                                  Options
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {(field.options ?? []).map((opt, oi) => (
                                    <span key={oi} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-bg-secondary border border-border-color text-xs">
                                      <input
                                        value={opt}
                                        onChange={(e) =>
                                          setFlowFields((prev) => prev.map((f, j) => {
                                            if (j !== i) return f;
                                            const next = [...(f.options ?? [])];
                                            next[oi] = e.target.value;
                                            return { ...f, options: next };
                                          }))
                                        }
                                        className="bg-transparent outline-none w-24"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setFlowFields((prev) => prev.map((f, j) => j === i ? { ...f, options: (f.options ?? []).filter((_, k) => k !== oi) } : f))}
                                        className="hover:text-red-500"
                                        aria-label="Remove option"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => setFlowFields((prev) => prev.map((f, j) => j === i ? { ...f, options: [...(f.options ?? []), `Option ${(f.options?.length ?? 0) + 1}`] } : f))}
                                    className="text-xs px-2 py-1 border border-dashed border-border-color rounded-full text-text-secondary hover:bg-bg-secondary"
                                  >
                                    + Add option
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setFlowFields((prev) => prev.filter((_, j) => j !== i))}
                            className="p-1 rounded hover:bg-card-bg mt-1"
                            aria-label="Remove field"
                          >
                            <X className="w-4 h-4 text-text-secondary hover:text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {flowFields.length > 0 && (
                    <p className={`${subtleCls} mt-3`}>
                      After saving, click <strong className="text-text-primary">Publish</strong> on the template card to make it live on WhatsApp.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 p-6 border-t border-border-color bg-card-bg sticky bottom-0">
              <button
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="flex-1 border border-border-color rounded-lg py-2 text-sm text-text-primary hover:bg-bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim() || (formType === 'checklist' && checklistItems.filter((s) => s.trim()).length === 0)}
                className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 shadow-sm"
              >
                {saving ? 'Saving...' : editTemplate ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
