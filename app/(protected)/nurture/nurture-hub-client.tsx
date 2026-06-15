'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  listSequences, createSequence, deleteSequence, updateSequence,
  type NurtureSequence,
} from '@/services/nurture';

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    draft:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    archived: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg[status] ?? cfg.draft}`}>
      {status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
        <svg className="h-8 w-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h3 className="mb-1 text-lg font-semibold text-text-primary">No nurture sequences yet</h3>
      <p className="mb-6 max-w-sm text-sm text-text-secondary">
        Create a sequence of AI-personalized WhatsApp messages to keep leads warm automatically — from first touch to conversion.
      </p>
      <button onClick={onNew} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
        Create your first sequence
      </button>
    </div>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────
const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT)' },
  { value: 'Europe/London', label: 'UK Time (GMT/BST)' },
  { value: 'America/New_York', label: 'US Eastern Time (ET)' },
  { value: 'America/Los_Angeles', label: 'US Pacific Time (PT)' },
  { value: 'UTC', label: 'UTC' },
];

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (seq: NurtureSequence) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [onReply, setOnReply] = useState<'pause' | 'stop' | 'continue'>('pause');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const seq = await createSequence({ name: name.trim(), description: description.trim() || undefined, on_reply: onReply, timezone });
      onCreate(seq);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-color px-6 py-4">
          <h2 className="text-base font-semibold text-text-primary">New Nurture Sequence</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Sequence Name</label>
            <input
              autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. New WhatsApp Lead, 30-Day Follow-Up"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Description (optional)</label>
            <input
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this sequence's goal"
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">When lead replies</label>
            <div className="flex gap-2">
              {(['pause', 'stop', 'continue'] as const).map(opt => (
                <button key={opt} type="button" onClick={() => setOnReply(opt)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all capitalize ${
                    onReply === opt ? 'border-accent bg-accent text-white' : 'border-border-color text-text-secondary hover:border-accent/50'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-secondary">
              {onReply === 'pause' && 'Sequence pauses, AI takes over. You can resume later.'}
              {onReply === 'stop' && 'Sequence stops permanently when lead replies.'}
              {onReply === 'continue' && 'Sequence keeps sending even if lead replied.'}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Send timezone</label>
            <select
              value={timezone} onChange={e => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {TIMEZONE_OPTIONS.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p className="text-xs text-text-secondary">Step send windows &amp; weekend skipping are evaluated in this timezone.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim() || saving}
              className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? 'Creating…' : 'Create Sequence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sequence card ────────────────────────────────────────────────────────────
function SequenceCard({ seq, onArchive }: { seq: NurtureSequence; onArchive: (id: number) => void }) {
  const router = useRouter();
  const totalSteps = seq.steps.length;

  return (
    <div className="group rounded-2xl border border-border-color bg-card-bg p-5 hover:border-accent/30 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-text-primary truncate">{seq.name}</h3>
          {seq.description && <p className="text-xs text-text-secondary mt-0.5 truncate">{seq.description}</p>}
        </div>
        <StatusBadge status={seq.status} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl bg-bg-secondary px-3 py-2 text-center">
          <div className="text-lg font-bold text-text-primary">{totalSteps}</div>
          <div className="text-xs text-text-secondary">Steps</div>
        </div>
        <div className="rounded-xl bg-bg-secondary px-3 py-2 text-center">
          <div className="text-lg font-bold text-text-primary">{seq.active_enrolled}</div>
          <div className="text-xs text-text-secondary">Active</div>
        </div>
        <div className="rounded-xl bg-bg-secondary px-3 py-2 text-center">
          <div className="text-lg font-bold text-accent">{seq.reply_rate}%</div>
          <div className="text-xs text-text-secondary">Reply rate</div>
        </div>
      </div>

      {/* Step pills preview */}
      {totalSteps > 0 && (
        <div className="flex items-center gap-1 mb-4 overflow-hidden">
          {seq.steps.slice(0, 6).map((step, i) => (
            <div key={step.id} className="flex items-center gap-1">
              {i > 0 && <div className="h-px w-3 bg-border-color shrink-0" />}
              <div className="h-2 w-2 rounded-full shrink-0 bg-accent" title={`Step ${step.step_number}: Day ${step.delay_days}`} />
            </div>
          ))}
          {totalSteps > 6 && <span className="text-xs text-text-secondary ml-1">+{totalSteps - 6} more</span>}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push(`/nurture/${seq.id}`)}
          className="flex-1 rounded-lg border border-border-color bg-card-bg px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
        >
          Edit
        </button>
        {seq.status === 'draft' ? (
          <button
            onClick={async () => { await updateSequence(seq.id, { status: 'active' }); window.location.reload(); }}
            className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Activate
          </button>
        ) : seq.status === 'active' ? (
          <button
            onClick={() => router.push(`/nurture/${seq.id}?tab=enroll`)}
            className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Enroll Leads
          </button>
        ) : null}
        {seq.status !== 'archived' && (
          <button
            onClick={() => onArchive(seq.id)}
            title="Archive"
            className="rounded-lg border border-border-color px-3 py-2 text-sm text-text-secondary hover:text-red-500 hover:border-red-300 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main hub ─────────────────────────────────────────────────────────────────
export default function NurtureHubClient() {
  const router = useRouter();
  const [sequences, setSequences] = useState<NurtureSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'archived'>('all');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listSequences().then(setSequences).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleArchive = async (id: number) => {
    await deleteSequence(id);
    setSequences(prev => prev.map(s => s.id === id ? { ...s, status: 'archived' as const } : s));
  };

  const handleCreate = (seq: NurtureSequence) => {
    setShowCreate(false);
    router.push(`/nurture/${seq.id}`);
  };

  const filtered = filter === 'all' ? sequences.filter(s => s.status !== 'archived') : sequences.filter(s => s.status === filter);

  const totalActive = sequences.filter(s => s.status === 'active').length;
  const totalEnrolled = sequences.reduce((s, x) => s + x.active_enrolled, 0);
  const totalCompleted = sequences.reduce((s, x) => s + x.completed_enrolled, 0);
  const avgReplyRate = sequences.length > 0
    ? Math.round(sequences.reduce((s, x) => s + x.reply_rate, 0) / sequences.length)
    : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="mx-auto max-w-6xl px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Lead Nurture</h1>
            <p className="text-sm text-text-secondary mt-0.5">AI-powered WhatsApp sequences that keep leads warm automatically</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Sequence
          </button>
        </div>

        {/* Stats bar */}
        {sequences.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Active Sequences', value: totalActive, icon: '◉' },
              { label: 'Leads in Sequence', value: totalEnrolled, icon: '👥' },
              { label: 'Completed', value: totalCompleted, icon: '✓' },
              { label: 'Avg Reply Rate', value: `${avgReplyRate}%`, icon: '💬' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl border border-border-color bg-card-bg px-4 py-3">
                <div className="text-xs text-text-secondary mb-1">{stat.label}</div>
                <div className="text-2xl font-bold text-text-primary">{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border-color">
          {(['all', 'active', 'draft', 'archived'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
                filter === f
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {f}
              {f !== 'all' && (
                <span className="ml-1.5 text-xs text-text-secondary">
                  ({sequences.filter(s => s.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-56 rounded-2xl bg-bg-secondary animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onNew={() => setShowCreate(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(seq => (
              <SequenceCard key={seq.id} seq={seq} onArchive={handleArchive} />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  );
}
