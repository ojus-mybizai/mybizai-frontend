'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAgentStore } from '@/lib/agent-store';
import { useAgentPlaybookStore } from '@/lib/agent-playbook-store';
import { useKnowledgeFileStore } from '@/lib/knowledge-file-store';
import type { ResponsePlayItem, ReplyMode } from '@/services/agent-playbook';
import {
  Sparkles, Loader2, Check, ChevronDown, ChevronUp,
  BookOpen, Info, Trash2, Plus, X,
} from 'lucide-react';

/**
 * Response Playbook — embedded inside the Chat settings tab.
 * Lists each conversation topic with the owner's reply guidance, an
 * auto-draft action, and a modal to create new topics (question types).
 */
export default function ResponsePlaybook() {
  const { current } = useAgentStore(useShallow((s) => ({ current: s.current })));
  const { items, loading, drafting, error, load, autodraft } = useAgentPlaybookStore(
    useShallow((s) => ({
      items: s.items,
      loading: s.loading,
      drafting: s.drafting,
      error: s.error,
      load: s.load,
      autodraft: s.autodraft,
    })),
  );
  const { files, list: listKnowledge } = useKnowledgeFileStore(
    useShallow((s) => ({ files: s.files, list: s.list })),
  );

  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (current?.id) {
      void load(current.id);
      void listKnowledge(current.id);
    }
  }, [current?.id, load, listKnowledge]);

  const configuredCount = useMemo(
    () => items.filter((i) => (i.guidance || '').trim().length > 0).length,
    [items],
  );

  const handleAutodraft = useCallback(async () => {
    if (!current) return;
    try {
      const n = await autodraft(current.id);
      setNotice(n > 0 ? `Drafted ${n} answer${n === 1 ? '' : 's'} — review and tweak below.` : 'All topics already have answers.');
      setTimeout(() => setNotice(null), 4000);
    } catch { /* error via store */ }
  }, [current, autodraft]);

  if (!current) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-text-secondary">
        Define how the agent should answer each kind of question — in plain words. It matches each
        customer message to the closest topic and follows your approach.{' '}
        {configuredCount > 0 && <span className="text-text-primary font-medium">{configuredCount} configured.</span>}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" /> Add question type
        </button>
        <button
          type="button"
          onClick={handleAutodraft}
          disabled={drafting || items.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Auto-draft answers
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-border-color bg-bg-primary py-8 text-text-secondary">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-color bg-bg-primary p-8 text-center">
          <p className="text-sm font-medium text-text-primary">No question types yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-text-secondary">
            Add the kinds of questions your customers ask (Pricing, Booking, Support…) and tell the
            agent how to handle each.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add your first question type
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <PlayCard
              key={item.topic_id}
              agentId={current.id}
              item={item}
              knowledgeOptions={files.map((f) => ({ id: f.id, title: f.title }))}
            />
          ))}
        </div>
      )}

      {modalOpen && <AddTopicModal agentId={current.id} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

// ─── Add-topic modal ─────────────────────────────────────────

function AddTopicModal({ agentId, onClose }: { agentId: number | string; onClose: () => void }) {
  const addTopic = useAgentPlaybookStore((s) => s.addTopic);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await addTopic(agentId, name, description);
      onClose();
    } catch (e) {
      setErr((e as Error).message || 'Failed to create');
      setSaving(false);
    }
  }, [name, description, addTopic, agentId, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border-color bg-card-bg p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Add question type</h3>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[11px] text-text-secondary">
          A topic the agent can recognise (e.g. Pricing, Booking). Shared with your inbox topic filters.
        </p>

        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-text-secondary">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Pricing"
              className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary">Description <span className="text-text-secondary/60">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="When does this apply? e.g. Customer asks about cost, plans, or discounts."
              className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
            />
            <p className="mt-0.5 text-[10px] text-text-secondary">Helps the agent decide when to use this topic.</p>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border-color px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add topic
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── One topic card ──────────────────────────────────────────

function PlayCard({
  agentId,
  item,
  knowledgeOptions,
}: {
  agentId: number | string;
  item: ResponsePlayItem;
  knowledgeOptions: { id: number; title: string }[];
}) {
  const { save, clear } = useAgentPlaybookStore(
    useShallow((s) => ({ save: s.save, clear: s.clear })),
  );

  const [guidance, setGuidance] = useState(item.guidance || '');
  const [mode, setMode] = useState<ReplyMode>(item.reply_mode || 'guide');
  const [example, setExample] = useState(item.example_reply || '');
  const [knowledgeId, setKnowledgeId] = useState<number | null>(item.knowledge_file_id ?? null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);

  useEffect(() => {
    setGuidance(item.guidance || '');
    setMode(item.reply_mode || 'guide');
    setExample(item.example_reply || '');
    setKnowledgeId(item.knowledge_file_id ?? null);
  }, [item.guidance, item.reply_mode, item.example_reply, item.knowledge_file_id]);

  const dirty =
    guidance !== (item.guidance || '') ||
    mode !== (item.reply_mode || 'guide') ||
    example !== (item.example_reply || '') ||
    (knowledgeId ?? null) !== (item.knowledge_file_id ?? null);

  const configured = (item.guidance || '').trim().length > 0;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await save(agentId, item.topic_id, {
        reply_mode: mode,
        guidance: guidance.trim(),
        example_reply: example.trim() || null,
        knowledge_file_id: knowledgeId,
        is_active: true,
      });
      setSavedAt(true);
      setTimeout(() => setSavedAt(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [save, agentId, item.topic_id, mode, guidance, example, knowledgeId]);

  const handleClear = useCallback(async () => {
    await clear(agentId, item.topic_id);
    setGuidance('');
    setExample('');
    setKnowledgeId(null);
    setMode('guide');
  }, [clear, agentId, item.topic_id]);

  return (
    <div className="rounded-xl border border-border-color bg-bg-primary p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.topic_color || '#94a3b8' }} />
          <span className="text-sm font-semibold text-text-primary">{item.topic_name}</span>
          {configured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <Check className="h-2.5 w-2.5" /> configured
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(['guide', 'exact'] as ReplyMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium capitalize border ${
                mode === m ? 'border-accent bg-accent/10 text-accent' : 'border-border-color text-text-secondary hover:border-text-secondary'
              }`}
            >
              {m === 'guide' ? 'Guide' : 'Exact'}
            </button>
          ))}
        </div>
      </div>

      {item.topic_description && <p className="mt-1 text-[11px] text-text-secondary">{item.topic_description}</p>}

      <textarea
        value={guidance}
        onChange={(e) => setGuidance(e.target.value)}
        rows={3}
        placeholder={
          mode === 'exact'
            ? 'Type the exact message the agent should send for this question…'
            : 'How should the agent handle this? e.g. “Ask which product and city first, then quote — don’t give a flat price.”'
        }
        className="mt-2 w-full rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm text-text-primary"
      />

      {mode === 'exact' && (
        <p className="mt-1 flex items-start gap-1 text-[10px] text-text-secondary">
          <Info className="mt-0.5 h-3 w-3 shrink-0" /> The agent sends this text word-for-word for this kind of question.
        </p>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Example reply &amp; knowledge link
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          <textarea
            value={example}
            onChange={(e) => setExample(e.target.value)}
            rows={2}
            placeholder="Optional: a sample reply the agent can learn the style from."
            className="w-full rounded-lg border border-border-color bg-card-bg px-3 py-1.5 text-sm text-text-primary"
          />
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <BookOpen className="h-3.5 w-3.5" />
            Pull facts from knowledge file:
            <select
              value={knowledgeId ?? ''}
              onChange={(e) => setKnowledgeId(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 rounded-lg border border-border-color bg-card-bg px-2 py-1 text-sm text-text-primary"
            >
              <option value="">None</option>
              {knowledgeOptions.map((k) => (
                <option key={k.id} value={k.id}>{k.title}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        {configured && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 rounded-lg border border-border-color px-2.5 py-1.5 text-xs text-text-secondary hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving || !guidance.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedAt ? <Check className="h-3.5 w-3.5" /> : null}
          {savedAt ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}
