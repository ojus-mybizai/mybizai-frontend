'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { queryKeys } from '@/lib/query-client';
import { useAgentMemory } from '@/lib/hooks/use-agent-memory';
import {
  createMemory,
  updateMemory,
  deleteMemory,
  type InjectionMode,
  type MemoryFileOut,
  type MemoryKind,
} from '@/services/agent-memory';
import MemoryList from '@/components/agent-memory/MemoryList';
import Markdown from '@/components/agent-surface/Markdown';

const INPUT_CLS =
  'w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent';

interface Form {
  title: string;
  description: string;
  content: string;
  kind: MemoryKind;
  attach_all_agents: boolean;
  default_injection: InjectionMode;
}

const EMPTY: Form = {
  title: '',
  description: '',
  content: '',
  kind: 'note',
  attach_all_agents: false,
  default_injection: 'on_demand',
};

export default function MemoryClient() {
  const qc = useQueryClient();
  const { data: items = [], isLoading, error } = useAgentMemory();

  // `null` = nothing selected, 'new' = creating, number = editing that id.
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [saving, setSaving] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.agentMemory() });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const selectItem = (m: MemoryFileOut) => {
    setEditing(m.id);
    setForm({
      title: m.title,
      description: m.description ?? '',
      content: m.content,
      kind: m.kind,
      attach_all_agents: m.attach_all_agents,
      default_injection: m.default_injection,
    });
    setTab('write');
  };

  const startNew = () => {
    setEditing('new');
    setForm(EMPTY);
    setTab('write');
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editing === 'new') {
        const created = await createMemory({
          title: form.title.trim(),
          description: form.description || null,
          content: form.content,
          kind: form.kind,
          attach_all_agents: form.attach_all_agents,
          default_injection: form.default_injection,
        });
        await refresh();
        selectItem(created);
      } else if (typeof editing === 'number') {
        await updateMemory(editing, {
          title: form.title.trim(),
          description: form.description || null,
          content: form.content,
          attach_all_agents: form.attach_all_agents,
          default_injection: form.default_injection,
        });
        await refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (typeof editing !== 'number') return;
    await deleteMemory(editing);
    await refresh();
    setEditing(null);
    setForm(EMPTY);
  };

  // Clear the editor if the selected memory disappears (e.g. deleted elsewhere).
  useEffect(() => {
    if (typeof editing === 'number' && !items.some((m) => m.id === editing)) {
      setEditing(null);
      setForm(EMPTY);
    }
  }, [items, editing]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Memory</h1>
        <p className="text-sm text-text-secondary">
          Markdown facts your agents can use. Attach them to all agents or specific ones, injected always or on demand.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* List */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={startNew}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-color px-3 py-2 text-sm font-medium text-text-secondary transition hover:border-accent hover:text-accent"
          >
            <Plus className="h-4 w-4" /> New memory
          </button>
          {isLoading && <p className="px-1 text-sm text-text-secondary">Loading…</p>}
          {error && (
            <p className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              Couldn&apos;t load memory. This feature may require the Lead Management module on your plan.
            </p>
          )}
          {!isLoading && !error && (
            <MemoryList
              items={items}
              selectedId={typeof editing === 'number' ? editing : null}
              onSelect={selectItem}
              emptyText="No memory files yet. Create one to get started."
            />
          )}
        </div>

        {/* Editor */}
        <div className="rounded-xl border border-border-color bg-card-bg p-4">
          {editing == null ? (
            <div className="flex h-full min-h-[300px] items-center justify-center text-center text-sm text-text-secondary">
              Select a memory file to edit, or create a new one.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Title</label>
                  <input className={INPUT_CLS} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Refund policy" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Kind</label>
                  <select
                    className={`${INPUT_CLS} disabled:opacity-60`}
                    value={form.kind}
                    disabled={editing !== 'new'}
                    onChange={(e) => set('kind', e.target.value as MemoryKind)}
                  >
                    <option value="note">Note</option>
                    <option value="profile">Business profile</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Description</label>
                <input className={INPUT_CLS} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Short summary (used for relevance)" />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-text-secondary">Content (markdown)</label>
                  <div className="flex gap-1 text-xs">
                    {(['write', 'preview'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={`rounded-md px-2 py-0.5 capitalize ${tab === t ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {tab === 'write' ? (
                  <textarea
                    className={`${INPUT_CLS} min-h-[220px] font-mono`}
                    value={form.content}
                    onChange={(e) => set('content', e.target.value)}
                    placeholder="# Refund policy&#10;We offer refunds within 30 days…"
                  />
                ) : (
                  <div className="min-h-[220px] rounded-lg border border-border-color bg-bg-primary p-3">
                    <Markdown text={form.content || '_Nothing to preview yet._'} />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" className="rounded" checked={form.attach_all_agents} onChange={(e) => set('attach_all_agents', e.target.checked)} />
                  Attach to all agents
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-text-secondary">Injection</span>
                  <select className={INPUT_CLS} value={form.default_injection} onChange={(e) => set('default_injection', e.target.value as InjectionMode)}>
                    <option value="on_demand">On demand</option>
                    <option value="always">Always</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving || !form.title.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editing === 'new' ? 'Create' : 'Save'}
                </button>
                {typeof editing === 'number' && (
                  <button
                    type="button"
                    onClick={() => void remove()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-3 py-2 text-sm text-text-secondary transition hover:border-red-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
