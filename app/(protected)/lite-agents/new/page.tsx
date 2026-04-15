'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useLiteAgentStore } from '@/lib/lite-agent-store';

export default function NewLiteAgentPage() {
  const router = useRouter();
  const create = useLiteAgentStore((s) => s.create);

  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      const agent = await create({ name: trimmed, instructions: instructions.trim() });
      router.push(`/lite-agents/${agent.id}/overview`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create agent');
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link
        href="/lite-agents"
        className="mb-6 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Lite Agents
      </Link>

      <div className="rounded-xl border border-border-color bg-card-bg p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">Create Lite Agent</h1>
            <p className="text-sm text-text-secondary">Fast AI replies with a single LLM call</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-1.5">
              Agent Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Support Bot"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="instructions" className="block text-sm font-medium text-text-primary mb-1.5">
              Instructions
            </label>
            <p className="mb-2 text-xs text-text-secondary">
              Tell the agent how to respond. This is the system prompt sent with every message.
            </p>
            <textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={8}
              placeholder={`You are a helpful assistant for [Your Business Name].\n\nGreet customers warmly and answer questions about our products and services.\nIf you don't know something, politely say so and suggest they contact us directly.`}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-secondary/50 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Creating...' : 'Create Lite Agent'}
          </button>
        </form>
      </div>
    </div>
  );
}
