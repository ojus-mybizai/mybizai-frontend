'use client';

import { useEffect, useState } from 'react';
import ModuleGuard from '@/components/module-guard';
import { listAgents } from '@/services/agents';
import {
  MessageTemplate,
  MessageTemplateCreate,
  createMessageTemplate,
  deleteMessageTemplate,
  listMessageTemplates,
  updateMessageTemplate,
} from '@/services/message-templates';

export default function AgentMessageTemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);

  const [form, setForm] = useState<MessageTemplateCreate>({
    name: '',
    description: '',
    channel: 'whatsapp',
    intent_key: '',
    body: '',
    language: 'en',
    is_active: true,
    priority: 0,
    agent_id: undefined,
  });

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const [tpls, ags] = await Promise.all([
          listMessageTemplates({ is_active: true }),
          listAgents(),
        ]);
        setTemplates(tpls);
        setAgents(ags.map((a) => ({ id: a.id, name: a.name })));
      } catch (e) {
        setError((e as Error).message ?? 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm({
      name: '',
      description: '',
      channel: 'whatsapp',
      intent_key: '',
      body: '',
      language: 'en',
      is_active: true,
      priority: 0,
      agent_id: undefined,
    });
  };

  const handleEdit = (tpl: MessageTemplate) => {
    setEditing(tpl);
    setForm({
      name: tpl.name,
      description: tpl.description ?? '',
      channel: tpl.channel,
      intent_key: tpl.intent_key ?? '',
      body: tpl.body,
      language: tpl.language ?? 'en',
      is_active: tpl.is_active,
      priority: tpl.priority,
      agent_id: tpl.agent_id ?? undefined,
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload: MessageTemplateCreate = {
        ...form,
        name: form.name.trim(),
        body: form.body,
        intent_key: form.intent_key?.trim() || undefined,
        description: form.description?.trim() || undefined,
      };
      let result: MessageTemplate;
      if (editing) {
        result = await updateMessageTemplate(editing.id, payload);
        setTemplates((prev) => prev.map((t) => (t.id === editing.id ? result : t)));
      } else {
        result = await createMessageTemplate(payload);
        setTemplates((prev) => [result, ...prev]);
      }
      resetForm();
    } catch (e) {
      setError((e as Error).message ?? 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tpl: MessageTemplate) => {
    if (!confirm(`Delete template "${tpl.name}"?`)) return;
    try {
      await deleteMessageTemplate(tpl.id);
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
      if (editing?.id === tpl.id) {
        resetForm();
      }
    } catch (e) {
      setError((e as Error).message ?? 'Failed to delete template');
    }
  };

  return (
    <ModuleGuard module="agents">
      <div className="mx-auto max-w-7xl space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">
                Message templates
              </h1>
              <p className="text-sm text-text-secondary">
                Predefined WhatsApp / Instagram messages that agents and AI can reuse.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="space-y-4 rounded-2xl border border-border-color bg-card-bg p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-text-primary">Existing templates</div>
                <span className="text-xs text-text-secondary">{templates.length} total</span>
              </div>
              {loading ? (
                <div className="text-sm text-text-secondary">Loading templates…</div>
              ) : templates.length === 0 ? (
                <div className="text-sm text-text-secondary">
                  No message templates yet. Create one on the right to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border-color bg-bg-primary px-3 py-3 text-sm"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-base font-semibold text-text-primary">
                            {tpl.name}
                          </div>
                          <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] uppercase text-text-secondary">
                            {tpl.channel}
                          </span>
                          {tpl.intent_key && (
                            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                              {tpl.intent_key}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-text-secondary line-clamp-2">
                          {tpl.description || 'No description'}
                        </div>
                        <div className="mt-1 text-xs text-text-secondary line-clamp-2">
                          {tpl.body}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-xs">
                        <span className="text-text-secondary">
                          {tpl.agent_id != null
                            ? agents.find((a) => a.id === String(tpl.agent_id))?.name ?? `Agent #${tpl.agent_id}`
                            : 'All agents / business-level'}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(tpl)}
                            className="rounded-md border border-border-color bg-bg-secondary px-2 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(tpl)}
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-border-color bg-card-bg p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-text-primary">
                  {editing ? 'Edit template' : 'New template'}
                </div>
                {editing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-text-secondary hover:text-text-primary"
                  >
                    Cancel edit
                  </button>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-primary">Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-primary">Agent</label>
                  <select
                    value={form.agent_id != null ? String(form.agent_id) : ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        agent_id: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">All agents (business-level)</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-primary">Channel</label>
                  <select
                    value={form.channel}
                    onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram_dm">Instagram DM</option>
                    <option value="generic">Generic</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-primary">
                    Situation / intent key
                  </label>
                  <input
                    value={form.intent_key ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        intent_key: e.target.value,
                      }))
                    }
                    placeholder="e.g. lead_won, follow_up, collect_email"
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-primary">Description</label>
                  <input
                    value={form.description ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-text-primary">
                    Body (supports variables like customer_name, business_name, agent_name, lead_score)
                  </label>
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    rows={5}
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="flex gap-3 items-center">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-text-primary">Language</label>
                    <input
                      value={form.language ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                      className="w-24 rounded-md border border-border-color bg-bg-primary px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-text-primary">Priority</label>
                    <input
                      type="number"
                      value={form.priority ?? 0}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))
                      }
                      className="w-20 rounded-md border border-border-color bg-bg-primary px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <label className="flex items-center gap-1 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={form.is_active ?? true}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                    Active
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={saving || !form.name.trim() || !form.body.trim()}
                    onClick={() => void handleSubmit()}
                    className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : editing ? 'Save changes' : 'Create template'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
    </ModuleGuard>
  );
}

