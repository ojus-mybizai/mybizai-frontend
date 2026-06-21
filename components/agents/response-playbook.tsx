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
 * Response Playbook — embedded in the Chat settings tab.
 * The agent's OWN list of "when asked about X → reply like Y" entries.
 * Each entry belongs to this agent only — nothing is shared across agents.
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
      setNotice(n > 0 ? `Drafted ${n} response${n === 1 ? '' : 's'} — review and tweak below.` : 'Nothing new to draft.');
      setTimeout(() => setNotice(null), 4000);
    } catch { /* error via store */ }
  }, [current, autodraft]);

  if (!current) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-text-secondary">
        Teach <span className="font-medium text-text-primary">this agent</span> how to reply to the
        kinds of questions it gets — in plain words. It matches each customer message to the closest
        entry and follows your approach. These are specific to this agent.{' '}
        {configuredCount > 0 && <span className="text-text-primary font-medium">{configuredCount} set.</span>}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-color px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" /> Add response
        </button>
        <button
          type="button"
          onClick={handleAutodraft}
          disabled={drafting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Auto-draft responses
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
          <p className="text-sm font-medium text-text-primary">No responses yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-text-secondary">
            Add the kinds of questions your customers ask (Pricing, Booking, Support…) and tell this
            agent how to handle each — or let AI draft a starter set.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add your first response
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <PlayCard
              key={item.id}
              agentId={current.id}
              item={item}
              knowledgeOptions={files.map((f) => ({ id: f.id, title: f.title }))}
            />
          ))}
        </div>
      )}

      {modalOpen && <AddPlayModal agentId={current.id} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

// ─── Add-response modal ──────────────────────────────────────

function AddPlayModal({ agentId, onClose }: { agentId: number | string; onClose: () => void }) {
  const add = useAgentPlaybookStore((s) => s.add);
  const [question, setQuestion] = useState('');
  const [guidance, setGuidance] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!question.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await add(agentId, { question: question.trim(), guidance: guidance.trim(), reply_mode: 'guide' });
      onClose();
    } catch (e) {
      setErr((e as Error).message || 'Failed to create');
      setSaving(false);
    }
  }, [question, guidance, add, agentId, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border-color bg-card-bg p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Add response</h3>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[11px] text-text-secondary">
          A kind of question this agent should recognise, and how it should reply.
        </p>

        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-text-secondary">When the customer asks about…</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              autoFocus
              placeholder="e.g. Pricing / fees"
              className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary">How should the agent reply? <span className="text-text-secondary/60">(optional now)</span></label>
            <textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              rows={3}
              placeholder="e.g. Don't quote a flat price. Ask which course first, then book a free demo."
              className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
            />
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
            disabled={!question.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── One response card ───────────────────────────────────────

function PlayCard({
  agentId,
  item,
  knowledgeOptions,
}: {
  agentId: number | string;
  item: ResponsePlayItem;
  knowledgeOptions: { id: number; title: string }[];
}) {
  const { save, remove } = useAgentPlaybookStore(
    useShallow((s) => ({ save: s.save, remove: s.remove })),
  );

  const [question, setQuestion] = useState(item.question || '');
  const [guidance, setGuidance] = useState(item.guidance || '');
  const [mode, setMode] = useState<ReplyMode>(item.reply_mode || 'guide');
  const [example, setExample] = useState(item.example_reply || '');
  const [knowledgeId, setKnowledgeId] = useState<number | null>(item.knowledge_file_id ?? null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);

  useEffect(() => {
    setQuestion(item.question || '');
    setGuidance(item.guidance || '');
    setMode(item.reply_mode || 'guide');
    setExample(item.example_reply || '');
    setKnowledgeId(item.knowledge_file_id ?? null);
  }, [item.question, item.guidance, item.reply_mode, item.example_reply, item.knowledge_file_id]);

  const dirty =
    question !== (item.question || '') ||
    guidance !== (item.guidance || '') ||
    mode !== (item.reply_mode || 'guide') ||
    example !== (item.example_reply || '') ||
    (knowledgeId ?? null) !== (item.knowledge_file_id ?? null);

  const configured = (item.guidance || '').trim().length > 0;

  const handleSave = useCallback(async () => {
    if (!question.trim()) return;
    setSaving(true);
    try {
      await save(agentId, item.id, {
        question: question.trim(),
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
  }, [save, agentId, item.id, question, mode, guidance, example, knowledgeId]);

  const handleDelete = useCallback(async () => {
    if (!confirm(`Delete the response for "${item.question}"?`)) return;
    await remove(agentId, item.id);
  }, [remove, agentId, item.id, item.question]);

  return (
    <div className="rounded-xl border border-border-color bg-bg-primary p-4">
      <div className="flex items-center justify-between gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="When customer asks about…"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-text-primary hover:border-border-color focus:border-accent focus:outline-none"
        />
        <div className="flex shrink-0 items-center gap-2">
          {configured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <Check className="h-2.5 w-2.5" /> set
            </span>
          )}
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
      </div>

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
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex items-center gap-1 rounded-lg border border-border-color px-2.5 py-1.5 text-xs text-text-secondary hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving || !question.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedAt ? <Check className="h-3.5 w-3.5" /> : null}
          {savedAt ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}
