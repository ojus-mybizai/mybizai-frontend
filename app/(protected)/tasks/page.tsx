'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, MessageCircle, Monitor, Clock, X, CheckCircle2, CircleDashed, CircleDot, Ban, Plus } from 'lucide-react';
import { listTaskGroups, createTask, type TaskGroup, type TaskChannel, type TaskStatus } from '@/services/taskAssignments';
import { listMembers, type Member } from '@/services/members';

// Unified Tasks surface (Employee+Task Redesign V2 — Phase 4, Slice 3a: read).
// One list over `task_assignments`, replacing /work + /wa-work + /workstation +
// /employee-dashboard. Read-only for now; create/dispatch lands in Slice 3b.

const STATUS_META: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  pending:     { label: 'Pending',     cls: 'text-text-secondary',      Icon: CircleDashed },
  in_progress: { label: 'In progress', cls: 'text-blue-600',            Icon: CircleDot },
  done:        { label: 'Done',        cls: 'text-green-600',           Icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   cls: 'text-text-secondary line-through', Icon: Ban },
};

type StatusFilter = 'open' | TaskStatus | 'all';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
];

const CHANNEL_TABS: { key: TaskChannel | 'all'; label: string }[] = [
  { key: 'all', label: 'All channels' },
  { key: 'in_app', label: 'Dashboard' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

export default function TasksPage() {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState<StatusFilter>('open');
  const [channelF, setChannelF] = useState<TaskChannel | 'all'>('all');
  const [selected, setSelected] = useState<TaskGroup | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setGroups(await listTaskGroups({
        status: statusF === 'all' ? undefined : statusF,
        channel: channelF === 'all' ? undefined : channelF,
        q: q.trim() || undefined,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [statusF, channelF]);

  const counts = useMemo(() => ({
    total: groups.length,
    assignees: groups.reduce((n, g) => n + g.assignee_count, 0),
  }), [groups]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Tasks</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Every task across the dashboard and WhatsApp, in one place.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> New task
        </button>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-border-color overflow-hidden">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusF(t.key)}
              className={`px-3 py-1.5 text-sm font-medium ${statusF === t.key ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:text-text-primary'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-border-color overflow-hidden">
          {CHANNEL_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setChannelF(t.key)}
              className={`px-3 py-1.5 text-sm font-medium ${channelF === t.key ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:text-text-primary'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[12rem] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void load(); }}
            placeholder="Search task title…"
            className="w-full rounded-lg border border-border-color bg-bg-primary pl-9 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">{error}</div>
      )}

      {!loading && !error && (
        <p className="text-xs text-text-secondary mb-2">{counts.total} tasks · {counts.assignees} assignments</p>
      )}

      <div className="space-y-2">
        {loading ? (
          <div className="rounded-xl border border-border-color px-4 py-10 text-center text-text-secondary">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border border-border-color px-4 py-10 text-center text-text-secondary">No tasks match these filters.</div>
        ) : (
          groups.map((g) => <TaskRow key={`${g.source_kind}-${g.source_task_id}`} group={g} onOpen={() => setSelected(g)} />)
        )}
      </div>

      {selected && <TaskDetail group={selected} onClose={() => setSelected(null)} />}
      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); void load(); }}
        />
      )}
    </div>
  );
}

function CreateTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [assignee, setAssignee] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [due, setDue] = useState('');
  const [channel, setChannel] = useState<'' | TaskChannel>('');   // '' = auto
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMembers()
      .then((m) => setMembers(m))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, []);

  const selectedMember = members.find((m) => m.id === assignee) || null;
  // What the backend will deliver on, given the member's capability + override.
  const effectiveChannel: TaskChannel | null = (() => {
    if (!selectedMember) return null;
    if (channel) return channel;
    if (selectedMember.channels.includes('whatsapp')) return 'whatsapp';
    if (selectedMember.channels.includes('portal')) return 'in_app';
    return null;
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!assignee) { setError('Pick who this task is for.'); return; }
    setSaving(true);
    setError(null);
    try {
      await createTask({
        title: title.trim(),
        assignee_member_id: assignee,
        channel: channel || undefined,
        body: body.trim() || undefined,
        priority,
        due_at: due ? new Date(due).toISOString() : undefined,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-border-color bg-card-bg p-6 m-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">New task</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-secondary"><X className="w-4 h-4" /></button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Assign to</label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent">
              <option value="">{loadingMembers ? 'Loading members…' : '— pick a member —'}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.channels.length ? ` (${m.channels.join(', ')})` : ' (no channel)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Deliver via</label>
            <div className="inline-flex rounded-lg border border-border-color overflow-hidden">
              {([['', 'Auto'], ['in_app', 'Dashboard'], ['whatsapp', 'WhatsApp']] as const).map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => setChannel(val as '' | TaskChannel)}
                  className={`px-3 py-1.5 text-sm font-medium ${channel === val ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:text-text-primary'}`}>
                  {lbl}
                </button>
              ))}
            </div>
            {selectedMember && effectiveChannel && (
              <p className="mt-1 text-xs text-text-secondary">
                Will be delivered on <span className="font-medium">{effectiveChannel === 'whatsapp' ? 'WhatsApp' : 'the dashboard'}</span>.
              </p>
            )}
            {selectedMember && !effectiveChannel && (
              <p className="mt-1 text-xs text-red-600">This member has no channel yet — add WhatsApp or a login first.</p>
            )}
          </div>

          {effectiveChannel !== 'whatsapp' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Priority</label>
              <div className="inline-flex rounded-lg border border-border-color overflow-hidden">
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className={`px-3 py-1.5 text-sm font-medium capitalize ${priority === p ? 'bg-accent text-white' : 'bg-bg-primary text-text-secondary hover:text-text-primary'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Notes <span className="font-normal">(optional)</span></label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Due <span className="font-normal">(optional)</span></label>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)}
              className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
              {saving ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChannelChip({ channel }: { channel: TaskChannel }) {
  return channel === 'whatsapp' ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-300">
      <MessageCircle className="w-3 h-3" /> WhatsApp
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
      <Monitor className="w-3 h-3" /> Dashboard
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${m.cls}`}>
      <m.Icon className="w-3.5 h-3.5" /> {m.label}
    </span>
  );
}

function fmtDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

function TaskRow({ group, onOpen }: { group: TaskGroup; onOpen: () => void }) {
  const due = fmtDue(group.due_at);
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-xl border border-border-color bg-bg-primary px-4 py-3 hover:border-accent transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary truncate">{group.title || 'Untitled task'}</span>
            <ChannelChip channel={group.channel} />
          </div>
          {group.body && <p className="mt-0.5 text-sm text-text-secondary line-clamp-1">{group.body}</p>}
          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
            <StatusBadge status={group.status} />
            <span className="text-xs text-text-secondary">
              {group.assignee_count} assignee{group.assignee_count === 1 ? '' : 's'}
              {group.assignee_count > 1 && ` · ${group.done_count}/${group.assignee_count} done`}
            </span>
            {due && (
              <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                <Clock className="w-3 h-3" /> {due}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex -space-x-1.5">
          {group.assignees.slice(0, 4).map((a) => (
            <span
              key={a.assignment_id}
              title={`${a.member_name} · ${a.status}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-bg-primary bg-bg-secondary text-[10px] font-semibold text-text-secondary"
            >
              {a.member_name.slice(0, 2).toUpperCase()}
            </span>
          ))}
          {group.assignee_count > 4 && (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-bg-primary bg-bg-secondary text-[10px] font-semibold text-text-secondary">
              +{group.assignee_count - 4}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function TaskDetail({ group, onClose }: { group: TaskGroup; onClose: () => void }) {
  const due = fmtDue(group.due_at);
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-80 lg:w-96 bg-bg-primary border-l border-border-color shadow-2xl z-40 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
          <h2 className="text-sm font-semibold text-text-primary">Task</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-text-primary">{group.title || 'Untitled task'}</h3>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <ChannelChip channel={group.channel} />
              <StatusBadge status={group.status} />
            </div>
            {group.body && <p className="mt-3 text-sm text-text-secondary whitespace-pre-wrap">{group.body}</p>}
            <div className="mt-3 flex flex-col gap-1 text-xs text-text-secondary">
              {due && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Due {due}</span>}
              {group.priority && <span>Priority: {group.priority}</span>}
              <span className="uppercase tracking-wider text-[10px]">{group.source_kind === 'wa' ? 'WhatsApp task' : 'Dashboard work'} #{group.source_task_id}</span>
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Assignees ({group.assignee_count})
            </span>
            <div className="mt-3 space-y-2">
              {group.assignees.map((a) => {
                const m = STATUS_META[a.status] || STATUS_META.pending;
                return (
                  <div key={a.assignment_id} className="flex items-center justify-between rounded-lg border border-border-color px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-bg-secondary text-[11px] font-semibold text-text-secondary shrink-0">
                        {a.member_name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-sm text-text-primary truncate">{a.member_name}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${m.cls}`} title={a.status_raw || a.status}>
                      <m.Icon className="w-3.5 h-3.5" /> {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
