'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Loader2, Trash2, Lock, Tag as TagIcon, X, Check, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import {
  listConversationTopics,
  createConversationTopic,
  updateConversationTopic,
  deleteConversationTopic,
  seedDefaultConversationTopics,
  type ConversationTopic,
} from '@/services/conversationTopics';

const PRESET_COLORS = [
  '#f59e0b', '#6366f1', '#10b981', '#ef4444',
  '#f97316', '#0ea5e9', '#6b7280', '#94a3b8',
  '#a855f7', '#ec4899', '#14b8a6', '#84cc16',
];

interface TopicDraft {
  name: string;
  description: string;
  keywords: string;
  color: string;
}

const EMPTY_DRAFT: TopicDraft = {
  name: '',
  description: '',
  keywords: '',
  color: PRESET_COLORS[0],
};

export default function ConversationTopicsPage() {
  const [topics, setTopics] = useState<ConversationTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<TopicDraft>(EMPTY_DRAFT);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  const load = async () => {
    try {
      setLoading(true);
      const rows = await listConversationTopics();
      setTopics(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load topics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const startEdit = (t: ConversationTopic) => {
    setEditingId(t.id);
    setShowCreate(false);
    setDraft({
      name: t.name,
      description: t.description ?? '',
      keywords: t.keywords ?? '',
      color: t.color ?? PRESET_COLORS[0],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowCreate(false);
    setDraft(EMPTY_DRAFT);
    setError(null);
  };

  const save = async () => {
    const name = draft.name.trim();
    if (!name) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      if (editingId != null) {
        const updated = await updateConversationTopic(editingId, {
          name,
          description: draft.description.trim() || null,
          keywords: draft.keywords.trim() || null,
          color: draft.color,
        });
        setTopics(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
      } else {
        const created = await createConversationTopic({
          name,
          description: draft.description.trim() || null,
          keywords: draft.keywords.trim() || null,
          color: draft.color,
        });
        setTopics(prev => [...prev, created]);
      }
      cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: ConversationTopic) => {
    if (t.is_system) return;
    if (!confirm(`Delete topic "${t.name}"? Historical messages tagged with it will keep the label but no new conversations will be classified here.`)) return;
    setDeletingIds(prev => new Set(prev).add(t.id));
    try {
      await deleteConversationTopic(t.id);
      setTopics(prev => prev.filter(x => x.id !== t.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingIds(prev => { const n = new Set(prev); n.delete(t.id); return n; });
    }
  };

  const reseed = async () => {
    setSeeding(true);
    try {
      const rows = await seedDefaultConversationTopics();
      setTopics(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Re-seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const totalUsage = topics.reduce((s, t) => s + (t.usage_count ?? 0), 0);

  return (
    <div className="flex flex-col h-full bg-main-bg overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border-color bg-bg-primary px-6 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/settings" className="p-1.5 rounded-md text-text-secondary hover:bg-bg-secondary hover:text-text-primary">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <TagIcon className="w-5 h-5 text-accent" />
            <h1 className="text-lg font-semibold text-text-primary">Conversation Topics</h1>
            <span className="text-xs text-text-secondary bg-bg-secondary px-2 py-0.5 rounded-full border border-border-color">
              {topics.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reseed}
              disabled={seeding}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border-color rounded-lg hover:bg-bg-secondary transition-colors text-text-primary disabled:opacity-60"
              title="Add any missing default topics (existing topics are kept)"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Re-seed defaults
            </button>
            <button
              onClick={() => { setShowCreate(true); setEditingId(null); setDraft(EMPTY_DRAFT); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Topic
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-text-secondary max-w-2xl">
          Topics are how your AI agent classifies each conversation. The agent reads each topic's <strong>description</strong> to decide when to apply it, then writes the topic onto the conversation so you can filter your inbox by it. Edit the description to teach the agent your business's vocabulary.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex-shrink-0 flex items-center gap-2 px-6 py-2.5 bg-red-50 border-b border-red-300 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-4">
        {/* Inline create form */}
        {showCreate && (
          <TopicForm
            draft={draft}
            onChange={setDraft}
            onSave={save}
            onCancel={cancelEdit}
            saving={saving}
            mode="create"
          />
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-text-secondary text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading topics…
          </div>
        ) : topics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary text-sm gap-2">
            <TagIcon className="w-8 h-8 opacity-30" />
            No topics yet. Click <strong>Add Topic</strong> or <strong>Re-seed defaults</strong>.
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            {topics.map(t => (
              editingId === t.id ? (
                <TopicForm
                  key={t.id}
                  draft={draft}
                  onChange={setDraft}
                  onSave={save}
                  onCancel={cancelEdit}
                  saving={saving}
                  mode="edit"
                />
              ) : (
                <TopicRow
                  key={t.id}
                  topic={t}
                  totalUsage={totalUsage}
                  onEdit={() => startEdit(t)}
                  onDelete={() => remove(t)}
                  deleting={deletingIds.has(t.id)}
                />
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TopicRow({
  topic, totalUsage, onEdit, onDelete, deleting,
}: {
  topic: ConversationTopic;
  totalUsage: number;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const usage = topic.usage_count ?? 0;
  const pct = totalUsage > 0 ? Math.round((usage / totalUsage) * 100) : 0;
  return (
    <div className="group flex items-start gap-3 px-4 py-3 border border-border-color rounded-xl bg-card-bg hover:border-accent/40 transition-colors">
      <span
        className="mt-1 w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-2 ring-offset-card-bg"
        style={{ backgroundColor: topic.color ?? '#94a3b8', ['--tw-ring-color' as string]: (topic.color ?? '#94a3b8') + '33' }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-text-primary">{topic.name}</span>
          {topic.is_system && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded-full border border-border-color">
              <Lock className="w-2.5 h-2.5" /> Built-in
            </span>
          )}
          <span className="text-xs text-text-secondary">
            {usage.toLocaleString()} {usage === 1 ? 'conversation' : 'conversations'}
            {pct > 0 && <span className="ml-1 opacity-60">· {pct}%</span>}
          </span>
        </div>
        {topic.description && (
          <p className="mt-1 text-xs text-text-secondary line-clamp-2">{topic.description}</p>
        )}
        {topic.keywords && (
          <p className="mt-1 text-[11px] text-text-secondary/70 line-clamp-1">
            <span className="font-semibold uppercase tracking-wide mr-1">Keywords:</span>
            {topic.keywords}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="px-2.5 py-1 text-xs font-medium border border-border-color rounded-md text-text-primary hover:bg-bg-secondary"
        >
          Edit
        </button>
        {!topic.is_system && (
          deleting ? (
            <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
          ) : (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-md text-text-secondary hover:text-red-500 hover:bg-red-50"
              title="Delete topic"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )
        )}
      </div>
    </div>
  );
}

function TopicForm({
  draft, onChange, onSave, onCancel, saving, mode,
}: {
  draft: TopicDraft;
  onChange: (d: TopicDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  mode: 'create' | 'edit';
}) {
  const set = <K extends keyof TopicDraft>(k: K, v: TopicDraft[K]) => onChange({ ...draft, [k]: v });
  return (
    <div className="p-4 border border-accent/40 bg-accent/5 rounded-xl space-y-3 mb-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
        {mode === 'create' ? 'New topic' : 'Edit topic'}
      </div>

      {/* Name + color */}
      <div className="flex items-center gap-3">
        <input
          autoFocus
          value={draft.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Topic name (e.g. Pricing)"
          className="flex-1 px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-primary text-text-primary focus:outline-none focus:border-accent"
        />
        <div className="flex gap-1 flex-wrap max-w-[240px]">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => set('color', c)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${draft.color === c ? 'scale-110 border-text-primary' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: c }}
              title={c}
              aria-label={`Color ${c}`}
            >
              {draft.color === c && <Check className="w-3 h-3 text-white mx-auto" />}
            </button>
          ))}
        </div>
      </div>

      {/* Description — agent reads this */}
      <div>
        <label className="block text-[11px] uppercase tracking-wide font-semibold text-text-secondary mb-1">
          Description (what the agent reads to decide when to apply this)
        </label>
        <textarea
          value={draft.description}
          onChange={e => set('description', e.target.value)}
          placeholder='e.g. "User is asking about cost, plans, discounts, or quoting for a specific product."'
          rows={3}
          className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-primary text-text-primary focus:outline-none focus:border-accent resize-none"
        />
      </div>

      {/* Keywords */}
      <div>
        <label className="block text-[11px] uppercase tracking-wide font-semibold text-text-secondary mb-1">
          Keywords (optional, comma-separated — helps the agent on noisy chats)
        </label>
        <input
          value={draft.keywords}
          onChange={e => set('keywords', e.target.value)}
          placeholder="price, cost, how much, quote, plan, discount"
          className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-primary text-text-primary focus:outline-none focus:border-accent"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 text-sm border border-border-color rounded-lg text-text-secondary hover:bg-bg-secondary disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving || !draft.name.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-60"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mode === 'create' ? 'Create topic' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
