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
} from '@/services/waTemplates';

const TYPE_META: Record<WaTemplateType, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  simple_task: {
    label: 'Simple Task',
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    desc: 'Text message with Done / Not Done buttons',
  },
  whatsapp_form: {
    label: 'WhatsApp Form',
    icon: <FileText className="w-4 h-4" />,
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    desc: 'Native form UI that opens inside WhatsApp',
  },
  lead_list: {
    label: 'Lead List',
    icon: <List className="w-4 h-4" />,
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    desc: 'List of leads/contacts with per-item status buttons',
  },
  checklist: {
    label: 'Checklist',
    icon: <Zap className="w-4 h-4" />,
    color: 'bg-green-50 text-green-700 border-green-200',
    desc: 'Bullet-point task list sent as a WhatsApp message',
  },
};

const FLOW_FIELD_TYPES = [
  { value: 'TextInput', label: 'Short Text' },
  { value: 'TextArea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'DatePicker', label: 'Date Picker' },
  { value: 'Dropdown', label: 'Dropdown' },
  { value: 'CheckboxGroup', label: 'Checkboxes' },
  { value: 'RadioButtonsGroup', label: 'Radio Buttons' },
  { value: 'MediaUpload', label: 'Image / File Upload' },
];

interface FlowField {
  id: string;
  type: string;
  label: string;
  name: string;
  required: boolean;
  options?: string[];
}

// Fix 1: removed data_api_version — static flows don't need a Data API endpoint.
// Including it causes Meta to block publishing with error 139002 / subcode 4233024.
function generateFlowJson(fields: FlowField[]): Record<string, unknown> {
  const formChildren: unknown[] = fields.map((f) => {
    const base: Record<string, unknown> = {
      type: f.type === 'number' ? 'TextInput' : f.type,
      label: f.label,
      name: f.name,
      required: f.required,
    };
    if (f.type === 'number') base['input-type'] = 'number';
    if (['Dropdown', 'CheckboxGroup', 'RadioButtonsGroup'].includes(f.type) && f.options) {
      base['data-source'] = f.options.map((o) => ({ id: o, title: o }));
    }
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

// Extract FlowField array from a saved flow_json (for edit mode)
function extractFlowFields(flowJson: Record<string, unknown> | null | undefined): FlowField[] {
  if (!flowJson) return [];
  try {
    const screens = (flowJson as any)?.screens || [];
    const formChildren = screens[0]?.layout?.children?.[0]?.children || [];
    return formChildren
      .filter((c: any) => c.type !== 'Footer')
      .map((c: any, i: number) => ({
        id: String(i),
        type: c['input-type'] === 'number' ? 'number' : c.type,
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

  // Form state
  const [formType, setFormType] = useState<WaTemplateType>('simple_task');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formBody, setFormBody] = useState('📋 *Task: {{task_title}}*\n\nDue: {{due_date}}\nEmployee: {{employee_name}}');
  // Fix 2: separate state for response buttons (simple_task) vs checklist items vs lead status options
  const [formButtons, setFormButtons] = useState<ButtonDef[]>([
    { id: 'done', title: '✅ Done' },
    { id: 'not_done', title: '❌ Not Done' },
  ]);
  // Checklist items — titles become the bullet-point list in the WhatsApp message
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);
  // Lead list status options — buttons employees tap per lead
  const [leadStatusOptions, setLeadStatusOptions] = useState<ButtonDef[]>([
    { id: 'called', title: '📞 Called' },
    { id: 'not_answered', title: '🔇 Not Answered' },
    { id: 'callback', title: '🔁 Callback' },
  ]);
  const [formLanguage, setFormLanguage] = useState('en');
  const [flowFields, setFlowFields] = useState<FlowField[]>([]);
  const [saving, setSaving] = useState(false);

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
    setEditTemplate(null);
  }

  // Fix 3: populate all state correctly when editing, including flowFields from flow_json
  function openEdit(tmpl: WaTemplate) {
    setEditTemplate(tmpl);
    setFormType(tmpl.type);
    setFormName(tmpl.name);
    setFormDesc(tmpl.description || '');
    setFormBody(tmpl.message_body || '');

    if (tmpl.type === 'checklist') {
      // Buttons hold checklist item titles
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

    // Fix 3: restore form fields from saved flow_json
    setFlowFields(extractFlowFields(tmpl.flow_json));

    setShowCreate(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      let buttons: ButtonDef[] | undefined;

      if (formType === 'checklist') {
        // Convert checklist item strings into ButtonDef format (id auto-generated from index)
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

  async function loadDailyReportScaffold() {
    try {
      const scaffold = await getDailyReportScaffold();
      setFlowFields(extractFlowFields(scaffold as Record<string, unknown>));
    } catch {
      alert('Failed to load scaffold');
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-green-600" />
            WhatsApp Templates
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create templates to send tasks, forms, and lead lists to your team
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
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
            <p className="text-xs opacity-75">{meta.desc}</p>
          </div>
        ))}
      </div>

      {loading && <div className="text-center py-16 text-gray-400">Loading...</div>}
      {error && <div className="text-center py-8 text-red-500">{error}</div>}

      {!loading && templates.length === 0 && (
        <div className="text-center py-16 text-gray-400 bg-white border rounded-xl">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No templates yet</p>
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
              <div key={tmpl.id} className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>
                      {meta.icon}
                      {meta.label}
                    </span>
                    {tmpl.meta_flow_status === 'published' && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">✓ Live</span>
                    )}
                    {tmpl.meta_flow_status === 'draft' && tmpl.type === 'whatsapp_form' && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">⚠ Not published</span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {tmpl.type === 'whatsapp_form' && tmpl.meta_flow_status !== 'published' && (
                      <button
                        onClick={() => handlePublishFlow(tmpl)}
                        disabled={publishing === tmpl.id}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                        title="Publish Flow to Meta"
                      >
                        {publishing === tmpl.id
                          ? <span className="text-xs">...</span>
                          : <Upload className="w-4 h-4" />}
                      </button>
                    )}
                    <button onClick={() => openEdit(tmpl)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(tmpl)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-gray-900 mb-1">{tmpl.name}</h3>
                {tmpl.description && <p className="text-sm text-gray-500 mb-2">{tmpl.description}</p>}

                {/* Type-specific preview */}
                {tmpl.type === 'simple_task' && tmpl.message_body && (
                  <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-line mb-2 font-mono">
                    {tmpl.message_body.slice(0, 120)}{tmpl.message_body.length > 120 ? '...' : ''}
                  </div>
                )}

                {tmpl.type === 'checklist' && tmpl.buttons && tmpl.buttons.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-2">
                    <p className="text-xs text-gray-400 mb-1">{checklistCount} checklist items</p>
                    <ul className="space-y-0.5">
                      {tmpl.buttons.slice(0, 5).map((btn: ButtonDef, i: number) => (
                        <li key={i} className="text-xs text-gray-700 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                          {btn.title}
                        </li>
                      ))}
                      {tmpl.buttons.length > 5 && (
                        <li className="text-xs text-gray-400">+{tmpl.buttons.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}

                {tmpl.type === 'lead_list' && tmpl.buttons && tmpl.buttons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    <span className="text-xs text-gray-400 w-full mb-1">Lead status options:</span>
                    {tmpl.buttons.map((btn: ButtonDef) => (
                      <span key={btn.id} className="px-2 py-0.5 bg-orange-50 border border-orange-200 rounded-full text-xs text-orange-700">
                        {btn.title}
                      </span>
                    ))}
                  </div>
                )}

                {tmpl.type === 'whatsapp_form' && (
                  <div className="text-xs text-gray-500">
                    {fieldCount} form field{fieldCount !== 1 ? 's' : ''} defined
                    {tmpl.meta_flow_id && (
                      <span className="ml-2 text-purple-600 font-mono">ID: {tmpl.meta_flow_id}</span>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">
                {editTemplate ? `Edit: ${editTemplate.name}` : 'Create Template'}
              </h2>
              <button onClick={() => { setShowCreate(false); resetForm(); }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Type selection — only for new templates */}
              {!editTemplate && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Template Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(TYPE_META) as [WaTemplateType, typeof TYPE_META[WaTemplateType]][]).map(([type, meta]) => (
                      <button
                        key={type}
                        onClick={() => setFormType(type)}
                        className={`text-left p-3 border rounded-xl transition-all ${
                          formType === type
                            ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-medium text-sm mb-1">
                          {meta.icon}
                          {meta.label}
                        </div>
                        <p className="text-xs text-gray-500">{meta.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Template Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Daily Sales Report, Lead Follow-up..."
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Description (optional)</label>
                <input
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="What this template is used for"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* ── Simple Task fields ── */}
              {formType === 'simple_task' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center justify-between">
                      Message Body
                      <span className="text-xs font-normal text-gray-400">
                        Variables: {'{{task_title}}'}, {'{{due_date}}'}, {'{{employee_name}}'}
                      </span>
                    </label>
                    <textarea
                      value={formBody}
                      onChange={(e) => setFormBody(e.target.value)}
                      rows={4}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Response Buttons (max 3)</label>
                      <div className="flex gap-2">
                        {Object.entries(buttonPresets).map(([key, btns]) => (
                          <button
                            key={key}
                            onClick={() => setFormButtons(btns)}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
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
                            className="w-28 border rounded px-2 py-1.5 text-sm font-mono"
                          />
                          <input
                            value={btn.title}
                            onChange={(e) => setFormButtons((prev) => prev.map((b, j) => j === i ? { ...b, title: e.target.value } : b))}
                            placeholder="Button label"
                            className="flex-1 border rounded px-2 py-1.5 text-sm"
                          />
                          <button onClick={() => setFormButtons((prev) => prev.filter((_, j) => j !== i))}>
                            <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                          </button>
                        </div>
                      ))}
                      {formButtons.length < 3 && (
                        <button
                          onClick={() => setFormButtons((prev) => [...prev, { id: '', title: '' }])}
                          className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                        >
                          <PlusCircle className="w-4 h-4" /> Add button
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ── Fix 2: Checklist Items — separate from buttons ── */}
              {formType === 'checklist' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center justify-between">
                      Message Body (optional)
                      <span className="text-xs font-normal text-gray-400">
                        Variables: {'{{task_title}}'}, {'{{employee_name}}'}
                      </span>
                    </label>
                    <textarea
                      value={formBody}
                      onChange={(e) => setFormBody(e.target.value)}
                      rows={2}
                      placeholder="Optional intro text sent before the checklist items"
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Checklist Items</label>
                      <button
                        onClick={() => setChecklistItems((prev) => [...prev, ''])}
                        className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                      >
                        <PlusCircle className="w-3 h-3" /> Add item
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                      These appear as a bullet-point list in the WhatsApp message. Employees reply with <strong>All Done</strong> or <strong>Partially Done</strong>.
                    </p>
                    <div className="space-y-2">
                      {checklistItems.map((item, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <span className="text-gray-400 text-sm w-5 text-right flex-shrink-0">{i + 1}.</span>
                          <input
                            value={item}
                            onChange={(e) => setChecklistItems((prev) => prev.map((v, j) => j === i ? e.target.value : v))}
                            placeholder={`e.g. Check inventory, Submit cash sheet...`}
                            className="flex-1 border rounded px-2 py-1.5 text-sm"
                          />
                          <button
                            onClick={() => setChecklistItems((prev) => prev.filter((_, j) => j !== i))}
                            disabled={checklistItems.length === 1}
                          >
                            <X className={`w-4 h-4 ${checklistItems.length === 1 ? 'text-gray-200' : 'text-gray-400 hover:text-red-500'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {checklistItems.filter((s) => s.trim()).length === 0 && (
                      <p className="text-xs text-red-500 mt-2">Add at least one checklist item</p>
                    )}
                  </div>
                </>
              )}

              {/* ── Fix 5: Lead List — status options config ── */}
              {formType === 'lead_list' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Lead Status Options</label>
                    <button
                      onClick={() => setLeadStatusOptions((prev) => [...prev, { id: '', title: '' }])}
                      disabled={leadStatusOptions.length >= 3}
                      className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1"
                    >
                      <PlusCircle className="w-3 h-3" /> Add option
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    Buttons employees tap for each lead in the list (max 3). E.g. Called, Not Answered, Callback.
                  </p>
                  <div className="space-y-2">
                    {leadStatusOptions.map((opt, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          value={opt.id}
                          onChange={(e) => setLeadStatusOptions((prev) => prev.map((o, j) => j === i ? { ...o, id: e.target.value } : o))}
                          placeholder="id (e.g. called)"
                          className="w-28 border rounded px-2 py-1.5 text-sm font-mono"
                        />
                        <input
                          value={opt.title}
                          onChange={(e) => setLeadStatusOptions((prev) => prev.map((o, j) => j === i ? { ...o, title: e.target.value } : o))}
                          placeholder="Label (e.g. 📞 Called)"
                          className="flex-1 border rounded px-2 py-1.5 text-sm"
                        />
                        <button onClick={() => setLeadStatusOptions((prev) => prev.filter((_, j) => j !== i))}>
                          <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── WhatsApp Form builder ── */}
              {formType === 'whatsapp_form' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Form Fields</label>
                    <div className="flex gap-2">
                      <button
                        onClick={loadDailyReportScaffold}
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50 text-purple-700"
                      >
                        Load daily report scaffold
                      </button>
                      <button
                        onClick={addFlowField}
                        className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                      >
                        <PlusCircle className="w-3 h-3" /> Add Field
                      </button>
                    </div>
                  </div>

                  {editTemplate && flowFields.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-3">
                      Fields could not be parsed from the saved JSON. Add fields manually or reload the scaffold.
                    </div>
                  )}

                  {flowFields.length === 0 && !editTemplate && (
                    <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-xl">
                      <p className="text-sm">No fields yet. Add fields to build your form.</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {flowFields.map((field, i) => (
                      <div key={field.id} className="border rounded-xl p-3 bg-gray-50">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <div className="flex gap-2">
                              <input
                                value={field.label}
                                onChange={(e) => setFlowFields((prev) => prev.map((f, j) => j === i ? { ...f, label: e.target.value } : f))}
                                placeholder="Field label"
                                className="flex-1 border rounded px-2 py-1.5 text-sm"
                              />
                              <select
                                value={field.type}
                                onChange={(e) => setFlowFields((prev) => prev.map((f, j) => j === i ? { ...f, type: e.target.value } : f))}
                                className="border rounded px-2 py-1.5 text-sm"
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
                                className="flex-1 border rounded px-2 py-1.5 text-sm font-mono"
                              />
                              <label className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => setFlowFields((prev) => prev.map((f, j) => j === i ? { ...f, required: e.target.checked } : f))}
                                  className="accent-green-600"
                                />
                                Required
                              </label>
                            </div>
                          </div>
                          <button onClick={() => setFlowFields((prev) => prev.filter((_, j) => j !== i))}>
                            <X className="w-4 h-4 text-gray-400 hover:text-red-500 mt-1" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {flowFields.length > 0 && (
                    <p className="text-xs text-gray-500 mt-3">
                      After saving, click <strong>Publish</strong> on the template card to make it live on WhatsApp.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 p-6 border-t">
              <button
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim() || (formType === 'checklist' && checklistItems.filter((s) => s.trim()).length === 0)}
                className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm hover:bg-green-700 disabled:opacity-50"
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
