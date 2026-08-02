'use client';

/**
 * P3b — right-side slide-over for the internal-chat panel. Three tabs:
 *   Sessions — list / new / switch / rename
 *   Saved    — ⭐ saved results; click one to preview read-only (reuses BlockList)
 *   Details  — agent name / kind
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDateTime } from '@/lib/format-date';
import { ArrowLeft, Check, Pencil, Plus, Trash2, X, Zap } from 'lucide-react';
import type { AgentSummary, Block, CommandOut, CommandSave, SavedViewOut } from '@/lib/agent-blocks';
import { queryKeys } from '@/lib/query-client';
import {
  createSession, renameSession, deleteSaved, setAgentModel,
  createCommand, updateCommand, deleteCommand,
} from '@/services/internal-chat';
import { useSessions, useSavedViews, useModels, useCommands } from '@/lib/hooks/use-internal-chat';
import Markdown from './Markdown';
import { BlockList } from './blocks';
import CanvasPreview from './CanvasPreview';

type Tab = 'sessions' | 'saved' | 'commands' | 'details';

interface Props {
  open: boolean;
  onClose: () => void;
  agent: AgentSummary | null;
  activeSessionId: number | null;
  onSwitch: (sessionId: number) => void;
}

export default function SessionModal({ open, onClose, agent, activeSessionId, onSwitch }: Props) {
  const [tab, setTab] = useState<Tab>('sessions');
  const [viewing, setViewing] = useState<SavedViewOut | null>(null);
  const agentId = agent?.id ?? null;
  const qc = useQueryClient();

  const { data: sessions = [] } = useSessions(open ? agentId : null);
  const { data: saved = [] } = useSavedViews(open ? agentId : null);

  const refreshSessions = () =>
    agentId != null && qc.invalidateQueries({ queryKey: queryKeys.internalSessions(agentId) });
  const refreshSaved = () =>
    agentId != null && qc.invalidateQueries({ queryKey: queryKeys.internalSaved(agentId) });
  const refreshAgents = () => qc.invalidateQueries({ queryKey: queryKeys.internalAgents() });
  const refreshCommands = () =>
    agentId != null && qc.invalidateQueries({ queryKey: queryKeys.internalCommands(agentId) });

  const handleNew = async () => {
    if (agentId == null) return;
    const meta = await createSession(agentId);
    await refreshSessions();
    onSwitch(meta.conversation_id);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" className="flex-1 bg-black/40" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col border-l border-border-color bg-bg-primary shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border-color px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">{agent?.name ?? 'Agent'}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-text-secondary hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* tabs */}
        <div className="flex gap-1 border-b border-border-color px-3 pt-2">
          {(['sessions', 'saved', 'commands', 'details'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setViewing(null);
              }}
              className={`rounded-t-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                tab === t ? 'border-b-2 border-accent text-accent' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === 'sessions' && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void handleNew()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-color px-3 py-2 text-sm font-medium text-text-secondary transition hover:border-accent hover:text-accent"
              >
                <Plus className="h-4 w-4" /> New chat
              </button>
              {sessions.map((s) => (
                <SessionRow
                  key={s.conversation_id}
                  id={s.conversation_id}
                  title={s.title}
                  active={s.conversation_id === activeSessionId}
                  onSwitch={() => {
                    onSwitch(s.conversation_id);
                    onClose();
                  }}
                  onRenamed={refreshSessions}
                />
              ))}
              {sessions.length === 0 && <p className="px-1 py-4 text-sm text-text-secondary">No sessions yet.</p>}
            </div>
          )}

          {tab === 'saved' && !viewing && (
            <div className="space-y-2">
              {saved.map((sv) => (
                <div
                  key={sv.id}
                  className="group flex items-start justify-between gap-2 rounded-lg border border-border-color px-3 py-2 transition hover:border-accent/40"
                >
                  <button type="button" onClick={() => setViewing(sv)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-text-primary">{sv.title || 'Saved result'}</p>
                    {sv.created_at && (
                      <p className="text-[11px] text-text-secondary">{formatDateTime(sv.created_at)}</p>
                    )}
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={async () => {
                      await deleteSaved(sv.id);
                      await refreshSaved();
                    }}
                    className="shrink-0 rounded-md p-1 text-text-secondary opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {saved.length === 0 && (
                <p className="px-1 py-4 text-sm text-text-secondary">No saved results yet. ⭐ a reply to save it.</p>
              )}
            </div>
          )}

          {tab === 'saved' && viewing && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              {viewing.content && <Markdown text={viewing.content} />}
              {viewing.blocks?.length ? <BlockList blocks={viewing.blocks} disabled /> : null}
              {viewing.canvas?.length ? <CanvasPreview canvas={viewing.canvas} /> : null}
            </div>
          )}

          {tab === 'commands' && agentId != null && (
            <CommandsTab agentId={agentId} saved={saved} onChanged={refreshCommands} />
          )}

          {tab === 'details' && (
            <div className="space-y-3 text-sm">
              <Detail label="Name" value={agent?.name ?? '—'} />
              <Detail label="Kind" value={agent?.kind ?? '—'} />
              <ModelPicker agent={agent} onChanged={refreshAgents} />
              <p className="pt-2 text-[12px] text-text-secondary">
                This agent replies on the internal chat surface and can return rich results (charts, tables, forms).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModelPicker({ agent, onChanged }: { agent: AgentSummary | null; onChanged: () => void }) {
  const { data } = useModels(!!agent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!agent) return null;
  // System agents always run the platform default — read-only.
  if (agent.is_system) {
    return (
      <Detail label="Model" value={`${data?.default ?? agent.model_name ?? '—'} (default)`} />
    );
  }

  const current = agent.model_name ?? data?.default ?? '';
  const options = data?.models ?? [];

  const onSelect = async (model: string) => {
    if (!model || model === current) return;
    setSaving(true);
    setError(null);
    try {
      await setAgentModel(agent.id, model);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set model.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border-color px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-secondary">Model</span>
        <select
          value={current}
          disabled={saving || options.length === 0}
          onChange={(e) => void onSelect(e.target.value)}
          className="min-w-0 max-w-[60%] truncate rounded-md border border-border-color bg-bg-primary px-2 py-1 text-sm font-medium text-text-primary outline-none focus:border-accent disabled:opacity-60"
        >
          {options.length === 0 && <option value={current}>{current || '—'}</option>}
          {options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
              {m.is_default ? ' (default)' : ''}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function CommandsTab({
  agentId,
  saved,
  onChanged,
}: {
  agentId: number;
  saved: SavedViewOut[];
  onChanged: () => void;
}) {
  const { data: commands = [] } = useCommands(agentId);
  // null = list view; otherwise editing this command (or a fresh 'new' draft).
  const [editing, setEditing] = useState<CommandOut | 'new' | null>(null);

  if (editing) {
    return (
      <CommandEditor
        agentId={agentId}
        saved={saved}
        initial={editing === 'new' ? null : editing}
        onDone={() => {
          setEditing(null);
          onChanged();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setEditing('new')}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-color px-3 py-2 text-sm font-medium text-text-secondary transition hover:border-accent hover:text-accent"
      >
        <Plus className="h-4 w-4" /> New command
      </button>
      {commands.map((c) => (
        <div
          key={`${c.scope}-${c.id}`}
          className="group flex items-start justify-between gap-2 rounded-lg border border-border-color px-3 py-2 transition hover:border-accent/40"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="text-sm font-semibold text-text-primary">/{c.command}</span>
              {c.inherited && (
                <span className="rounded-full bg-bg-secondary px-1.5 py-0.5 text-[9px] uppercase text-text-secondary">
                  {c.scope}
                </span>
              )}
            </div>
            {c.description && <p className="mt-0.5 truncate text-[12px] text-text-secondary">{c.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              title={c.inherited ? 'Customize for this agent' : 'Edit'}
              onClick={() => setEditing(c)}
              className="rounded-md p-1 text-text-secondary hover:text-text-primary"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {!c.inherited && (
              <button
                type="button"
                title="Delete"
                onClick={async () => {
                  await deleteCommand(c.id);
                  onChanged();
                }}
                className="rounded-md p-1 text-text-secondary hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
      {commands.length === 0 && (
        <p className="px-1 py-4 text-sm text-text-secondary">No commands yet. Create one to fire it with /.</p>
      )}
    </div>
  );
}

function CommandEditor({
  agentId,
  saved,
  initial,
  onDone,
  onCancel,
}: {
  agentId: number;
  saved: SavedViewOut[];
  initial: CommandOut | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [instruction, setInstruction] = useState(initial?.instruction ?? '');
  const [scope, setScope] = useState<'agent' | 'business'>(
    initial && initial.scope === 'business' ? 'business' : 'agent',
  );
  const [example, setExample] = useState<Block[] | null>(initial?.example_canvas ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing an OWN agent/business command updates it; otherwise (new or inherited)
  // we POST a new row — which is the override-copy path for inherited commands.
  const isOwnEditable = !!initial && !initial.inherited;
  const savedCanvases = saved.filter((s) => s.canvas && s.canvas.length);

  const save = async () => {
    if (!title.trim() || !instruction.trim()) {
      setError('Title and instruction are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const body: CommandSave = {
      title: title.trim(),
      description: description.trim() || undefined,
      instruction: instruction.trim(),
      example_canvas: example,
      scope,
      command: initial?.command,
    };
    try {
      if (isOwnEditable && initial) await updateCommand(initial.id, body);
      else await createCommand(agentId, body);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save command.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Report"
          className="w-full rounded-md border border-border-color bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
        />
        <p className="mt-1 text-[11px] text-text-secondary">Fired as /{title ? slugify(title) : 'command'}</p>
      </Field>

      <Field label="Description">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="KPIs + charts for the inventory"
          className="w-full rounded-md border border-border-color bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
        />
      </Field>

      <Field label="Instruction (what to compute + how to lay out)">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={5}
          placeholder="Produce a report canvas: call aggregate_<sheet> for totals + a group_by breakdown, then lay out a stat row and chart cards…"
          className="w-full rounded-md border border-border-color bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
        />
      </Field>

      <Field label="Scope">
        <div className="flex gap-2">
          {(['agent', 'business'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`rounded-lg border px-3 py-1.5 text-sm capitalize transition ${
                scope === s ? 'border-accent bg-accent/10 text-accent' : 'border-border-color text-text-secondary'
              }`}
            >
              {s === 'agent' ? 'This agent' : 'Business'}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Example canvas (few-shot the agent mimics)">
        {example ? (
          <div className="space-y-2">
            <CanvasPreview canvas={example} />
            <button type="button" onClick={() => setExample(null)} className="text-[12px] text-text-secondary hover:text-red-500">
              Remove example
            </button>
          </div>
        ) : savedCanvases.length ? (
          <div className="space-y-1">
            <p className="text-[11px] text-text-secondary">Pick one of your ⭐ saved canvases:</p>
            {savedCanvases.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setExample(s.canvas ?? null)}
                className="block w-full truncate rounded-md border border-border-color px-2.5 py-1.5 text-left text-sm text-text-primary transition hover:border-accent"
              >
                {s.title || 'Saved canvas'}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-text-secondary">No saved canvases yet — ⭐ a canvas in chat, then attach it here.</p>
        )}
      </Field>

      {error && <p className="text-[12px] text-red-500">{error}</p>}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : isOwnEditable ? 'Save changes' : initial ? 'Save as my copy' : 'Create command'}
      </button>
    </div>
  );
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'command';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-medium text-text-secondary">{label}</label>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border-color px-3 py-2">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

function SessionRow({
  id,
  title,
  active,
  onSwitch,
  onRenamed,
}: {
  id: number;
  title: string;
  active: boolean;
  onSwitch: () => void;
  onRenamed: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  const save = async () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) {
      await renameSession(id, next);
      onRenamed();
    }
  };

  return (
    <div
      className={`group flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
        active ? 'border-accent bg-accent/5' : 'border-border-color hover:border-accent/40'
      }`}
    >
      {editing ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
            className="min-w-0 flex-1 rounded-md border border-border-color bg-bg-primary px-2 py-1 text-sm text-text-primary outline-none focus:border-accent"
          />
          <button type="button" onClick={() => void save()} className="shrink-0 text-accent">
            <Check className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={onSwitch} className="min-w-0 flex-1 truncate text-left text-sm text-text-primary">
            {title}
          </button>
          <button
            type="button"
            title="Rename"
            onClick={() => {
              setDraft(title);
              setEditing(true);
            }}
            className="shrink-0 rounded-md p-1 text-text-secondary opacity-0 transition hover:text-text-primary group-hover:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
