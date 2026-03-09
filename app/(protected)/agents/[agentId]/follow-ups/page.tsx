'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/agents/empty-state';
import { LoadingSkeleton } from '@/components/agents/loading-skeleton';
import { useAgentStore } from '@/lib/agent-store';
import {
  listFollowupRules,
  createFollowupRule,
  updateFollowupRule,
  deleteFollowupRule,
  type FollowUpRule,
  type FollowUpRuleCreate,
  type FollowUpMode,
  type TemplateType,
} from '@/services/followups';
import { listMessageTemplates, type MessageTemplate } from '@/services/message-templates';

// Example presets
const EXAMPLE_PRESETS: FollowUpRuleCreate[] = [
  {
    name: 'First follow-up (24h)',
    description: 'Send a follow-up message 24 hours after the conversation ends',
    delay_minutes: 1440,
    mode: 'auto',
    template_type: 'llm',
    is_active: true,
  },
  {
    name: 'Re-engage after 7 days',
    description: 'Re-engage leads who haven\'t responded after a week',
    delay_minutes: 10080,
    mode: 'auto',
    template_type: 'llm',
    conditions: { lead_status_in: ['new'] },
    is_active: true,
  },
];

function formatDelay(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)} day${Math.floor(minutes / 1440) !== 1 ? 's' : ''}`;
}

export default function AgentFollowUpsPage() {
  const { current, loading: agentLoading } = useAgentStore((s) => ({
    current: s.current,
    loading: s.loading,
  }));

  const [rules, setRules] = useState<FollowUpRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [editingRule, setEditingRule] = useState<FollowUpRule | null>(null);
  const [formData, setFormData] = useState<FollowUpRuleCreate>({
    name: '',
    description: '',
    is_active: true,
    mode: 'auto',
    delay_minutes: 1440,
    sequence_index: null,
    conditions: undefined,
    template_type: 'llm',
    template_id: null,
    llm_preset: '',
    generation_config: undefined,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [conditionsExpanded, setConditionsExpanded] = useState(false);
  const [generationConfigExpanded, setGenerationConfigExpanded] = useState(false);
  const [conditionsJson, setConditionsJson] = useState('');
  const [generationConfigJson, setGenerationConfigJson] = useState('');

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      setRulesLoading(true);
      setRulesError(null);
      const data = await listFollowupRules(current ? { agent_id: Number(current.id) } : undefined);
      setRules(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load follow-up rules';
      setRulesError(msg);
    } finally {
      setRulesLoading(false);
    }
  }, [current?.id]);

  const loadTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true);
      const data = await listMessageTemplates({ is_active: true });
      setTemplates(data);
    } catch (err) {
      // Silently fail - templates are optional
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRules();
    void loadTemplates();
  }, [loadRules, loadTemplates]);

  const handleUsePreset = (preset: FollowUpRuleCreate) => {
    setEditingRule(null);
    setFormData({
      ...preset,
      conditions: preset.conditions ?? undefined,
      generation_config: preset.generation_config ?? undefined,
    });
    setConditionsJson(preset.conditions ? JSON.stringify(preset.conditions, null, 2) : '');
    setGenerationConfigJson(preset.generation_config ? JSON.stringify(preset.generation_config, null, 2) : '');
    setConditionsExpanded(!!preset.conditions);
    setGenerationConfigExpanded(!!preset.generation_config);
    setFormErrors({});
    setMessage(null);
  };

  const handleEdit = (rule: FollowUpRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      is_active: rule.is_active,
      mode: rule.mode,
      delay_minutes: rule.delay_minutes,
      sequence_index: rule.sequence_index || null,
      conditions: rule.conditions ?? undefined,
      template_type: rule.template_type,
      template_id: rule.template_id || null,
      llm_preset: rule.llm_preset || '',
      generation_config: rule.generation_config ?? undefined,
    });
    setConditionsJson(rule.conditions ? JSON.stringify(rule.conditions, null, 2) : '');
    setGenerationConfigJson(rule.generation_config ? JSON.stringify(rule.generation_config, null, 2) : '');
    setConditionsExpanded(!!rule.conditions);
    setGenerationConfigExpanded(!!rule.generation_config);
    setFormErrors({});
    setMessage(null);
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      description: '',
      is_active: true,
      mode: 'auto',
      delay_minutes: 1440,
      sequence_index: null,
      conditions: undefined,
      template_type: 'llm',
      template_id: null,
      llm_preset: '',
      generation_config: undefined,
    });
    setConditionsJson('');
    setGenerationConfigJson('');
    setConditionsExpanded(false);
    setGenerationConfigExpanded(false);
    setFormErrors({});
    setMessage(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    if ((formData.delay_minutes ?? 0) < 1) {
      errors.delay_minutes = 'Delay must be at least 1 minute';
    }
    if (conditionsJson.trim()) {
      try {
        JSON.parse(conditionsJson);
      } catch {
        errors.conditions = 'Invalid JSON format';
      }
    }
    if (generationConfigJson.trim()) {
      try {
        JSON.parse(generationConfigJson);
      } catch {
        errors.generation_config = 'Invalid JSON format';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setMessage(null);
    try {
      const payload: FollowUpRuleCreate = {
        ...formData,
        conditions: conditionsJson.trim() ? JSON.parse(conditionsJson) : undefined,
        generation_config: generationConfigJson.trim() ? JSON.parse(generationConfigJson) : undefined,
        agent_id: current ? Number(current.id) : undefined,
      };

      if (editingRule) {
        await updateFollowupRule(editingRule.id, payload);
        setMessage('Rule updated successfully');
      } else {
        await createFollowupRule(payload);
        setMessage('Rule created successfully');
      }

      await loadRules();
      handleCancelEdit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save rule';
      setRulesError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: FollowUpRule) => {
    if (!confirm(`Delete rule "${rule.name}"? This action cannot be undone.`)) return;

    try {
      await deleteFollowupRule(rule.id);
      setMessage('Rule deleted successfully');
      await loadRules();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete rule';
      setRulesError(msg);
    }
  };

  const handleToggleActive = async (rule: FollowUpRule) => {
    try {
      await updateFollowupRule(rule.id, { is_active: !rule.is_active });
      await loadRules();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update rule';
      setRulesError(msg);
    }
  };

  if (!current && agentLoading) {
    return <LoadingSkeleton count={2} />;
  }
  if (!current) {
    return <EmptyState title="Agent not found" description="Return to agents and re-open." />;
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </div>
      )}

      {rulesError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {rulesError}
        </div>
      )}

      <p className="text-base text-text-secondary">
        Add rules to send follow-up messages after conversations. Each rule defines when and how to follow up.
      </p>

      {/* Rules list */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary">Your follow-up rules</h3>
        {rulesLoading && rules.length === 0 ? (
          <LoadingSkeleton count={2} />
        ) : rules.length === 0 ? (
          <p className="rounded-xl border border-border-color bg-card-bg p-4 text-base text-text-secondary">
            No follow-up rules yet. Create one below or use an example.
          </p>
        ) : (
          <ul className="space-y-3">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-start gap-3 rounded-xl border border-border-color bg-card-bg p-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-text-primary">{rule.name}</h4>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            rule.is_active
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300'
                          }`}
                        >
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-border-color bg-bg-primary px-2 py-0.5 text-xs font-semibold text-text-secondary">
                          {rule.mode === 'auto' ? 'Auto' : rule.mode === 'manual' ? 'Manual' : 'Both'}
                        </span>
                      </div>
                      {rule.description && (
                        <p className="mt-1 text-sm text-text-secondary">{rule.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                    <span>Delay: {formatDelay(rule.delay_minutes)}</span>
                    {rule.sequence_index != null && <span>Sequence: {rule.sequence_index}</span>}
                    <span>Type: {rule.template_type}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(rule)}
                    className="rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-accent hover:text-text-primary"
                  >
                    {rule.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(rule)}
                    className="rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-accent hover:text-text-primary"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(rule)}
                    className="rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-red-300 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Examples */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary">Quick examples</h3>
        <p className="text-sm text-text-secondary">
          Click an example to prefill the form below. You can adjust the values before saving.
        </p>
        <div className="flex flex-wrap gap-3">
          {EXAMPLE_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleUsePreset(preset)}
              className="rounded-xl border border-border-color bg-card-bg p-4 text-left transition hover:border-accent"
            >
              <div className="text-sm font-semibold text-text-primary">{preset.name}</div>
              {preset.description && (
                <div className="mt-1 text-xs text-text-secondary">{preset.description}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Create/Edit form */}
      <div className="space-y-4 rounded-2xl border border-border-color bg-card-bg p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">
            {editingRule ? 'Edit rule' : 'Create new rule'}
          </h3>
          {editingRule && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="space-y-5">
          {/* Basic fields */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-text-primary">Basic</h4>

            <div>
              <label htmlFor="rule-name" className="block text-sm font-medium text-text-primary">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="rule-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                placeholder="e.g., First follow-up after 24h"
              />
              {formErrors.name && (
                <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="rule-description" className="block text-sm font-medium text-text-primary">
                Description
              </label>
              <textarea
                id="rule-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                placeholder="Optional description of what this rule does"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="rule-active"
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-border-color text-accent focus:ring-accent"
              />
              <label htmlFor="rule-active" className="text-sm font-medium text-text-primary">
                Active
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Mode</label>
              <div className="flex gap-2">
                {(['auto', 'manual', 'both'] as FollowUpMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFormData({ ...formData, mode })}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      formData.mode === mode
                        ? 'bg-accent text-white'
                        : 'border border-border-color bg-bg-primary text-text-secondary hover:border-accent hover:text-text-primary'
                    }`}
                  >
                    {mode === 'auto' ? 'Auto' : mode === 'manual' ? 'Manual' : 'Both'}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                Auto = send at scheduled time; Manual = queue for review
              </p>
            </div>

            <div>
              <label htmlFor="rule-delay" className="block text-sm font-medium text-text-primary">
                Delay (minutes) <span className="text-red-500">*</span>
              </label>
              <input
                id="rule-delay"
                type="number"
                min="1"
                value={formData.delay_minutes}
                onChange={(e) => setFormData({ ...formData, delay_minutes: parseInt(e.target.value) || 1 })}
                className="mt-1 w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
              />
              <p className="mt-1 text-xs text-text-secondary">
                e.g. 1440 = 24 hours, 10080 = 7 days
              </p>
              {formErrors.delay_minutes && (
                <p className="mt-1 text-xs text-red-500">{formErrors.delay_minutes}</p>
              )}
            </div>

            <div>
              <label htmlFor="rule-sequence" className="block text-sm font-medium text-text-primary">
                Sequence index
              </label>
              <input
                id="rule-sequence"
                type="number"
                value={formData.sequence_index || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sequence_index: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                className="mt-1 w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                placeholder="Optional: for ordering multiple follow-ups (e.g. 1, 2, 3)"
              />
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-text-primary">Conditions (optional)</h4>
              <button
                type="button"
                onClick={() => setConditionsExpanded(!conditionsExpanded)}
                className="text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                {conditionsExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>
            {conditionsExpanded && (
              <div>
                <textarea
                  value={conditionsJson}
                  onChange={(e) => setConditionsJson(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 font-mono text-xs text-text-primary focus:border-accent focus:outline-none"
                  placeholder='{"lead_status_in": ["new"], "first_time_lead": true}'
                />
                <p className="mt-1 text-xs text-text-secondary">
                  Leave empty to apply to all conversations. Options: lead_status_in, channel_in, sentiment_lt,
                  first_time_lead, etc.
                </p>
                {formErrors.conditions && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.conditions}</p>
                )}
              </div>
            )}
          </div>

          {/* Message generation */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-text-primary">Message generation</h4>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Template type</label>
              <div className="flex gap-2">
                {(['llm', 'template', 'mixed'] as TemplateType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, template_type: type, template_id: type === 'llm' ? null : formData.template_id })}
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                      formData.template_type === type
                        ? 'bg-accent text-white'
                        : 'border border-border-color bg-bg-primary text-text-secondary hover:border-accent hover:text-text-primary'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {(formData.template_type === 'template' || formData.template_type === 'mixed') && (
              <div>
                <label htmlFor="rule-template" className="block text-sm font-medium text-text-primary">
                  Template
                </label>
                <select
                  id="rule-template"
                  value={formData.template_id || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, template_id: e.target.value ? parseInt(e.target.value) : null })
                  }
                  className="mt-1 w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                  disabled={templatesLoading}
                >
                  <option value="">Select a template...</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
                {templates.length === 0 && !templatesLoading && (
                  <p className="mt-1 text-xs text-text-secondary">No templates available</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="rule-llm-preset" className="block text-sm font-medium text-text-primary">
                LLM preset (optional)
              </label>
              <input
                id="rule-llm-preset"
                type="text"
                value={formData.llm_preset || ''}
                onChange={(e) => setFormData({ ...formData, llm_preset: e.target.value || undefined })}
                className="mt-1 w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                placeholder="e.g., friendly, professional"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-text-primary">Generation config (optional)</label>
                <button
                  type="button"
                  onClick={() => setGenerationConfigExpanded(!generationConfigExpanded)}
                  className="text-xs font-medium text-text-secondary hover:text-text-primary"
                >
                  {generationConfigExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>
              {generationConfigExpanded && (
                <div>
                  <textarea
                    value={generationConfigJson}
                    onChange={(e) => setGenerationConfigJson(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 font-mono text-xs text-text-primary focus:border-accent focus:outline-none"
                    placeholder="{}"
                  />
                  {formErrors.generation_config && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.generation_config}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving…' : editingRule ? 'Update rule' : 'Create rule'}
            </button>
            {editingRule && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-md border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary hover:border-accent"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
