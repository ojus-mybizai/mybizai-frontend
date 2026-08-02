'use client';

import { useEffect, useState } from 'react';
import { Save, CheckCircle } from 'lucide-react';
import { useLiteAgentStore } from '@/lib/lite-agent-store';
import { useShallow } from 'zustand/react/shallow';
import { formatDate } from '@/lib/format-date';

const TONE_OPTIONS = ['friendly', 'professional', 'casual', 'formal'];
const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'ar', label: 'Arabic' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
];

export default function LiteAgentOverviewPage() {
  const { current, update } = useLiteAgentStore(
    useShallow((s) => ({ current: s.current, update: s.update })),
  );

  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [tone, setTone] = useState('friendly');
  const [replyLanguage, setReplyLanguage] = useState('auto');
  const [personaName, setPersonaName] = useState('');
  const [fallbackMessage, setFallbackMessage] = useState('');
  const [businessContextHint, setBusinessContextHint] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!current) return;
    setName(current.name || '');
    setInstructions(current.instructions || '');
    setTone(current.tone || 'friendly');
    setReplyLanguage(current.replyLanguage || 'auto');
    setPersonaName(current.personaName || '');
    setFallbackMessage(current.fallbackMessage || '');
    setBusinessContextHint(current.businessContextHint || '');
  }, [current]);

  const handleSave = async () => {
    if (!current) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await update(current.id, {
        name: name.trim(),
        instructions: instructions.trim(),
        tone,
        reply_language: replyLanguage,
        persona_name: personaName.trim() || undefined,
        fallback_message: fallbackMessage.trim() || undefined,
        business_context_hint: businessContextHint.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!current) {
    return <div className="py-12 text-center text-sm text-text-secondary">Loading...</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left — Settings */}
      <div className="lg:col-span-2 space-y-5">
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Agent Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Instructions <span className="text-text-secondary font-normal">(system prompt)</span>
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={10}
            placeholder="Tell the agent how to respond to customers..."
            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-secondary/50 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Tone</label>
            <div className="flex flex-wrap gap-2">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    tone === t
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-border-color text-text-secondary hover:border-text-primary hover:text-text-primary'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Reply Language</label>
            <select
              value={replyLanguage}
              onChange={(e) => setReplyLanguage(e.target.value)}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Persona Name <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <input
            value={personaName}
            onChange={(e) => setPersonaName(e.target.value)}
            placeholder="e.g. Maya, Alex"
            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Business Context <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <textarea
            value={businessContextHint}
            onChange={(e) => setBusinessContextHint(e.target.value)}
            rows={3}
            placeholder="Brief info about your business the agent should know..."
            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Fallback Message <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <input
            value={fallbackMessage}
            onChange={(e) => setFallbackMessage(e.target.value)}
            placeholder="Message to send if AI fails to respond"
            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saved ? (
            <>
              <CheckCircle className="h-4 w-4" /> Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}
            </>
          )}
        </button>
      </div>

      {/* Right — Summary */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border-color bg-card-bg p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Agent Summary</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-secondary">Status</dt>
              <dd className="font-medium text-text-primary capitalize">{current.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Channels</dt>
              <dd className="font-medium text-text-primary">{current.channelIds.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Total Runs</dt>
              <dd className="font-medium text-text-primary">{current.totalRuns}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Created</dt>
              <dd className="font-medium text-text-primary">
                {current.createdAt ? formatDate(current.createdAt) : '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <strong>Lite Agent</strong> — Makes a single LLM call per incoming message.
            No tools, no automation, no knowledge files. Fast and cost-efficient.
          </p>
        </div>
      </div>
    </div>
  );
}
