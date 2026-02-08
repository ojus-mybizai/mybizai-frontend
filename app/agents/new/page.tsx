'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { useAgentStore } from '@/lib/agent-store';

export default function NewAgentPage() {
  const router = useRouter();
  const { create, loading } = useAgentStore((s) => ({ create: s.create, loading: s.loading }));

  const [name, setName] = useState('');
  const [role, setRole] = useState<'sales' | 'support' | 'general'>('sales');
  const [tone, setTone] = useState('Calm and helpful');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!tone.trim()) {
      setError('Tone is required');
      return;
    }
    try {
      const agent = await create({ name: name.trim(), role, tone: tone.trim() });
      router.replace(`/agents/${agent.id}/overview`);
    } catch (err) {
      setError((err as Error).message || 'Failed to create agent');
    }
  };

  return (
    <ProtectedShell>
        <ModuleGuard module="agents">
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Create agent</h2>
            <p className="text-sm text-text-secondary">Set a name, role, and tone. Everything else is editable later.</p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border-color bg-card-bg p-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Agent name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="e.g., Concierge AI"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="sales">Sales</option>
                <option value="support">Support</option>
                <option value="general">General</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-text-primary">Tone</label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                required
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="e.g., Warm and concise"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {loading ? 'Creating…' : 'Create agent'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-md border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
        </ModuleGuard>
    </ProtectedShell>
  );
}
