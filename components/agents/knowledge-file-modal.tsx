'use client';

import { useEffect, useState, FormEvent } from 'react';
import type { KnowledgeFile, KnowledgeFileCreateInput, KnowledgeFileUpdateInput } from '@/services/knowledge-files';
import { X, Save, Loader2 } from 'lucide-react';

interface KnowledgeFileModalProps {
  open: boolean;
  agentId: number;
  initial?: KnowledgeFile | null;
  onClose: () => void;
  onSubmit: (
    payload: KnowledgeFileCreateInput | KnowledgeFileUpdateInput,
    isUpdate: boolean,
  ) => Promise<void>;
}

const TOPIC_KEY_PATTERN = /^[a-z0-9_]+$/;

function slugify(v: string): string {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

export function KnowledgeFileModal({
  open,
  agentId,
  initial,
  onClose,
  onSubmit,
}: KnowledgeFileModalProps) {
  const isUpdate = Boolean(initial);
  const [title, setTitle] = useState('');
  const [topicKey, setTopicKey] = useState('');
  const [triggerDescription, setTriggerDescription] = useState('');
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [topicTouched, setTopicTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setTopicKey(initial.topic_key);
      setTriggerDescription(initial.trigger_description ?? '');
      setContent(initial.content);
      setIsActive(initial.is_active);
      setTopicTouched(true);
    } else {
      setTitle('');
      setTopicKey('');
      setTriggerDescription('');
      setContent('');
      setIsActive(true);
      setTopicTouched(false);
    }
    setError(null);
  }, [open, initial]);

  // Auto-fill topic_key from title until user touches the field
  useEffect(() => {
    if (!topicTouched && !isUpdate) {
      setTopicKey(slugify(title));
    }
  }, [title, topicTouched, isUpdate]);

  if (!open) return null;

  const validate = (): string | null => {
    if (!title.trim()) return 'Title is required';
    if (!topicKey.trim()) return 'Topic key is required';
    if (!TOPIC_KEY_PATTERN.test(topicKey)) {
      return 'Topic key must only contain lowercase letters, numbers, and underscores';
    }
    if (!content.trim()) return 'Content is required';
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isUpdate) {
        const updatePayload: KnowledgeFileUpdateInput = {
          title: title.trim(),
          topic_key: topicKey.trim(),
          content,
          trigger_description: triggerDescription.trim() || null,
          is_active: isActive,
        };
        await onSubmit(updatePayload, true);
      } else {
        const createPayload: KnowledgeFileCreateInput = {
          agent_id: agentId,
          title: title.trim(),
          topic_key: topicKey.trim(),
          content,
          trigger_description: triggerDescription.trim() || null,
          is_active: isActive,
        };
        await onSubmit(createPayload, false);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border-color bg-card-bg shadow-xl">
        <div className="flex items-center justify-between border-b border-border-color px-5 py-3">
          <h2 className="text-base font-semibold text-text-primary">
            {isUpdate ? 'Edit knowledge file' : 'Add knowledge file'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-secondary transition hover:bg-bg-secondary"
            disabled={saving}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-secondary">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Discount negotiation policy"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              maxLength={200}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-secondary">
              Topic key
              <span className="ml-1 font-normal text-text-secondary/70">
                (lowercase, unique per agent — the LLM picks from this enum)
              </span>
            </label>
            <input
              type="text"
              value={topicKey}
              onChange={(e) => {
                setTopicTouched(true);
                setTopicKey(e.target.value.replace(/\s+/g, '_').toLowerCase());
              }}
              placeholder="e.g. discounts"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent"
              maxLength={100}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-secondary">
              When to use <span className="font-normal text-text-secondary/70">(optional)</span>
            </label>
            <input
              type="text"
              value={triggerDescription}
              onChange={(e) => setTriggerDescription(e.target.value)}
              placeholder="e.g. When customer asks about pricing, discounts, or wants to negotiate"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
            <p className="mt-1 text-[11px] text-text-secondary">
              This hint is shown to the LLM. It decides to call{' '}
              <code className="rounded bg-bg-secondary px-1 py-0.5">lookup_knowledge</code> when
              the customer's question matches.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-secondary">
              Content <span className="font-normal text-text-secondary/70">(plain text — full file is returned to the LLM)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              placeholder="Paste or type the full knowledge content here.&#10;&#10;Example: For properties above ₹75L, offer up to 3% discount after the 2nd customer interaction. Always mention the flexible payment plan first. Never offer discounts above 5% without manager approval."
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 font-mono text-xs text-text-primary outline-none focus:border-accent"
            />
            <p className="mt-1 text-[11px] text-text-secondary">{content.length} characters</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="kf-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="kf-active" className="text-xs text-text-primary">
              Active <span className="text-text-secondary">(inactive files are hidden from the LLM)</span>
            </label>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border-color pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-border-color px-3 py-1.5 text-sm text-text-primary transition hover:bg-bg-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isUpdate ? 'Save changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
