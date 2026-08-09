'use client';

import { useCallback, useEffect, useState } from 'react';
import PermissionGuard from '@/components/permission-guard';
import {
  getAutomationMetadata,
  listAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  toggleAutomationRule,
  aiSuggestRule,
  type AutomationRule,
  type AutomationMetadata,
  type RuleCategory,
} from '@/services/automation';
import dynamic from 'next/dynamic';
import { listModels } from '@/services/dynamic-data';
import type { RuleFormState } from './components/types';
import RuleList from './components/rule-list';
const RuleEditor = dynamic(() => import('./components/rule-editor'), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse rounded-lg bg-bg-secondary" />,
});

/* ═══════════════════════════════════════════════════════════════════════════ */
/* PAGE — orchestrates list vs. editor view                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

type View = { kind: 'list' } | { kind: 'editor'; rule: AutomationRule | null };

export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [datasheetNames, setDatasheetNames] = useState<Record<number, string>>({});
  const [metadata, setMetadata] = useState<AutomationMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<View>({ kind: 'list' });

  // AI suggestion
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<Record<string, unknown> | null>(null);

  /* ── Data loading ──────────────────────────────────────────────────── */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, metaRes] = await Promise.all([
        listAutomationRules(),
        getAutomationMetadata(),
      ]);
      setRules(rulesRes.items);
      setMetadata(metaRes);
      // Datasheet names for labelling scope groups (best-effort; non-blocking).
      listModels()
        .then((models) =>
          setDatasheetNames(Object.fromEntries(models.map((m) => [m.id, m.display_name || m.name]))))
        .catch(() => {});
    } catch (err: any) {
      setError(err?.message || 'Failed to load automation rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Handlers ──────────────────────────────────────────────────────── */

  const handleToggle = async (id: number) => {
    try {
      const updated = await toggleAutomationRule(id);
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err: any) {
      setError(err?.message || 'Failed to toggle rule');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAutomationRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      setError(err?.message || 'Failed to delete rule');
    }
  };

  const handleSave = async (form: RuleFormState) => {
    setSaving(true);
    setError(null);

    const selectedEvent = metadata?.events.find((e) => e.event === form.trigger_event);
    const isScheduleEvent = selectedEvent?.event.startsWith('schedule.');

    const trigger: AutomationRule['trigger'] = { event: form.trigger_event };
    if (Object.keys(form.trigger_filters).length > 0) {
      trigger.filters = Object.fromEntries(
        Object.entries(form.trigger_filters).filter(([, v]) => v)
      );
    }
    if (isScheduleEvent) {
      trigger.schedule = {
        type: form.trigger_schedule_type || 'daily',
        ...(form.trigger_schedule_time ? { time: form.trigger_schedule_time } : {}),
        ...(form.trigger_schedule_day ? { day: form.trigger_schedule_day } : {}),
      };
    }

    const conditions = form.conditions
      .filter((c) => c.field && c.op)
      .map((c) => ({ field: c.field, op: c.op, value: c.value }));

    const actions = form.actions
      .filter((a) => a.type)
      .map((a) => ({
        type: a.type,
        params: Object.fromEntries(
          Object.entries(a.params).filter(([, v]) => v !== '')
        ),
      }));

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      trigger,
      conditions,
      actions,
      is_active: form.is_active,
    };

    try {
      const editingRule = view.kind === 'editor' ? view.rule : null;
      if (editingRule && editingRule.id > 0) {
        const updated = await updateAutomationRule(editingRule.id, payload);
        setRules((prev) => prev.map((r) => (r.id === editingRule.id ? updated : r)));
      } else {
        const created = await createAutomationRule(payload);
        setRules((prev) => [...prev, created]);
      }
      setView({ kind: 'list' });
    } catch (err: any) {
      setError(err?.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);
    try {
      const res = await aiSuggestRule(aiPrompt.trim());
      if (res.error) {
        setAiError(res.error);
      } else if (res.suggestion) {
        setAiSuggestion(res.suggestion);
        // Auto-open editor with suggestion pre-filled as a "new rule"
        // The suggestion is a raw rule object — convert to AutomationRule shape for editor
        const sug = res.suggestion as Record<string, unknown>;
        const fakeRule = {
          id: 0,
          business_id: 0,
          name: (sug.name as string) || '',
          description: (sug.description as string) || '',
          category: ((sug.category as string) || 'general') as RuleCategory,
          trigger: (sug.trigger ?? { event: '' }) as AutomationRule['trigger'],
          conditions: (sug.conditions ?? []) as AutomationRule['conditions'],
          actions: ((sug.actions as Array<Record<string, unknown>>) || []).map((a) => {
            const { type, ...params } = a;
            return { type: type as string, params };
          }),
          is_active: true,
          run_count: 0,
          last_run_at: null,
          last_error: null,
          created_at: new Date().toISOString(),
          updated_at: null,
        } as AutomationRule;
        setView({ kind: 'editor', rule: fakeRule });
        setAiPrompt('');
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'AI suggestion failed');
    } finally {
      setAiLoading(false);
    }
  };

  /* ── Render ────────────────────────────────────────────────────────── */

  if (view.kind === 'editor' && metadata) {
    return (
      <PermissionGuard permission="manage_settings">
        <RuleEditor
          editingRule={view.rule}
          metadata={metadata}
          saving={saving}
          onSave={handleSave}
          onCancel={() => { setView({ kind: 'list' }); setError(null); }}
        />
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="manage_settings">
    <div className="space-y-4">
      {/* AI Automation Builder */}
      <div className="rounded-xl border border-accent/30 bg-accent/5 dark:bg-accent/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary mb-1">AI Automation Builder</p>
            <p className="text-xs text-text-secondary mb-3">
              Describe what you want to automate in plain English and AI will create the rule for you.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAiSuggest(); }}
                placeholder="e.g. When a lead status changes to qualified, notify the manager and create a follow-up task..."
                className="flex-1 rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                disabled={aiLoading}
              />
              <button
                type="button"
                onClick={handleAiSuggest}
                disabled={aiLoading || !aiPrompt.trim()}
                className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {aiLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Thinking...
                  </>
                ) : (
                  'Generate'
                )}
              </button>
            </div>
            {aiError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{aiError}</p>
            )}
          </div>
        </div>
      </div>

      <RuleList
        rules={rules}
        events={metadata?.events || []}
        actionOptions={metadata?.actions || []}
        loading={loading}
        error={error}
        onClearError={() => setError(null)}
        onNewRule={() => setView({ kind: 'editor', rule: null })}
        onEditRule={(rule) => setView({ kind: 'editor', rule })}
        onToggleRule={handleToggle}
        onDeleteRule={handleDelete}
        datasheetNames={datasheetNames}
      />
    </div>
    </PermissionGuard>
  );
}
