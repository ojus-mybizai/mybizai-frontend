'use client';

/**
 * Dashboard Phase 2 → agent-surface composer. Text + send, data-source context
 * chips (Datasheet/Pipeline — designer-only, they SCOPE what it builds), local
 * image upload (real S3 via /files/upload), and a real multi-agent switch.
 *
 * The data-source chips are gated on `agentKind` — only the dashboard designer
 * consumes attached refs today, so they show only for it; the Image button + agent
 * switch show for every agent.
 *
 * Submit: from the grid it stages the message and navigates to /dashboard/chat
 * (the module-level store + shared transport carry the in-flight run across the
 * route change); from the chat view it just sends. The `floating` variant hides
 * on scroll-down / reveals on scroll-up; the `pinned` variant is always visible.
 */
import { FormEvent, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import {
  Send, Paperclip, X, Database, GitBranch, Bot, ChevronDown, Plus,
} from 'lucide-react';
import { useStreamStore } from '@/lib/agent-stream/stream-store';
import type { ContextRef } from '@/lib/agent-stream/events';
import type { AgentSummary } from '@/lib/agent-blocks';
import { apiFetch } from '@/lib/api-client';
import { toast } from '@/lib/toast-store';

type SourceKind = 'datasheet' | 'pipeline';

// Data-source pickers — the label/icon per kind; `items` are loaded live below.
// Only the dashboard designer consumes these, so they render only for it.
const SOURCE_KINDS: {
  kind: SourceKind;
  label: string;
  icon: React.ElementType;
}[] = [
  { kind: 'datasheet', label: 'Datasheet', icon: Database  },
  { kind: 'pipeline',  label: 'Pipeline',  icon: GitBranch },
];

type SourceItem = { id: string | number; label: string };
type SourceMap = Record<SourceKind, SourceItem[]>;

/** Load the real pickable data sources from the dashboard's own widget-options
 *  catalog (the exact data sources the designer builds from). Defensive: any
 *  failure → empty. */
async function loadSources(): Promise<SourceMap> {
  const out: SourceMap = { datasheet: [], pipeline: [] };
  try {
    const res = await apiFetch<{
      options: { source_type: string; source_name?: string; source_id?: number }[];
    }>('/widgets/options');
    const seen = new Set<string>();
    for (const o of res.options ?? []) {
      const name = o.source_name;
      if (!name) continue;
      const kind: SourceKind | null = o.source_type.startsWith('datasheet_')
        ? 'datasheet'
        : o.source_type.startsWith('pipeline_')
          ? 'pipeline'
          : null;
      if (!kind) continue;
      const key = `${kind}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out[kind].push({ id: o.source_id ?? name, label: name });
    }
  } catch {
    /* best-effort — empty on failure */
  }
  return out;
}

type FileOut = { id: number; url?: string; original_name?: string };

export default function SmartInput({
  variant = 'pinned',
  scrollRef,
  agentKind = 'dashboard_designer',
  agents,
  agentId,
  onSwitchAgent,
}: {
  variant?: 'floating' | 'pinned';
  scrollRef?: React.RefObject<HTMLElement | null>;
  /** Kind of the active agent — gates the data-source chips (designer only). */
  agentKind?: string;
  /** When set, the agent-switch control lists these and calls onSwitchAgent. */
  agents?: AgentSummary[];
  agentId?: number | null;
  onSwitchAgent?: (id: number) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    phase, pendingContext, pendingAttachments,
    send, addContext, removeContext, addAttachment, removeAttachment,
  } = useStreamStore(
    useShallow((s) => ({
      phase: s.phase,
      pendingContext: s.pendingContext,
      pendingAttachments: s.pendingAttachments,
      send: s.send,
      addContext: s.addContext,
      removeContext: s.removeContext,
      addAttachment: s.addAttachment,
      removeAttachment: s.removeAttachment,
    })),
  );

  const [text, setText] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null); // source kind or 'agent'
  const [hidden, setHidden] = useState(false);
  const [sources, setSources] = useState<SourceMap>({ datasheet: [], pipeline: [] });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const busy = phase === 'working' || phase === 'streaming';

  // Auto-grow the textarea with its content, up to a max height (then it scrolls).
  const MAX_INPUT_HEIGHT = 160;
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden';
  }, [text]);

  const showSourceChips = agentKind === 'dashboard_designer';
  const activeAgentName =
    (agents && agentId != null && agents.find((a) => a.id === agentId)?.name) || 'Designer';

  // Load the real source lists once (best-effort — empty on failure). Only the
  // designer consumes them, so skip the fetch for other agents.
  useEffect(() => {
    if (!showSourceChips) return;
    let alive = true;
    void loadSources().then((s) => { if (alive) setSources(s); }).catch(() => {});
    return () => { alive = false; };
  }, [showSourceChips]);

  // The transport is owned by the VIEW (the chat page binds the real WebSocket /
  // mock; the grid needs none — it only stages + navigates). SmartInput no longer
  // forces a transport, so it can't clobber the live socket on the chat page.

  // Hide-on-scroll-down / reveal-on-scroll-up (floating/grid view only).
  useEffect(() => {
    if (variant !== 'floating') return;
    const el = scrollRef?.current ?? window;
    let last = scrollRef?.current ? scrollRef.current.scrollTop : window.scrollY;
    const onScroll = () => {
      const y = scrollRef?.current ? scrollRef.current.scrollTop : window.scrollY;
      const delta = y - last;
      if (Math.abs(delta) > 6) {
        setHidden(delta > 0 && y > 40);
        last = y;
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [variant, scrollRef]);

  const onSubmit = (e: FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setText('');
    if (pathname === '/dashboard') {
      // Grid: stash + navigate; the chat view replays it on the real transport.
      useStreamStore.getState().stageText(trimmed);
      router.push('/dashboard/chat');
      return;
    }
    // Chat view: the page has already bound a transport — send directly.
    send(trimmed);
  };

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const form = new FormData();
        form.append('file', f);
        form.append('source', 'dashboard_designer');
        try {
          const out = await apiFetch<FileOut>('/files/upload', { method: 'POST', body: form });
          // Real attachment id → the agent can reference/interpret it (vision-capable
          // model permitting); url is a fresh presigned link for the chip preview.
          addAttachment({ id: String(out.id), name: out.original_name || f.name, kind: 'image', url: out.url });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Couldn't upload ${f.name}.`);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const chips = pendingContext.length > 0 || pendingAttachments.length > 0;

  return (
    <div
      className={
        variant === 'floating'
          ? `pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 transition-all duration-300 ${
              hidden ? 'translate-y-24 opacity-0' : 'translate-y-0 opacity-100'
            }`
          : 'shrink-0 px-4 pb-4'
      }
    >
      <form
        onSubmit={onSubmit}
        className={`pointer-events-auto w-full max-w-3xl rounded-2xl border border-border-color bg-card-bg p-2.5 shadow-lg ${
          variant === 'pinned' ? 'mx-auto' : ''
        }`}
      >
        {/* Staged context + image chips */}
        {chips && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {pendingContext.map((c) => (
              <span
                key={`${c.kind}-${c.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2 py-1 text-[12px] font-medium text-accent"
              >
                <span className="opacity-70">{c.kind}</span>
                <span className="max-w-[140px] truncate">{c.label}</span>
                <button type="button" onClick={() => removeContext(c.id)} className="rounded p-0.5 hover:bg-accent/20" aria-label={`Remove ${c.label}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {pendingAttachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-bg-secondary px-1.5 py-1 text-[12px] font-medium text-text-secondary"
              >
                {a.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="h-5 w-5 rounded object-cover" />
                ) : null}
                <span className="max-w-[120px] truncate">{a.name}</span>
                <button type="button" onClick={() => removeAttachment(a.id)} className="rounded p-0.5 hover:bg-border-color" aria-label={`Remove ${a.name}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter inserts a newline.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            rows={1}
            placeholder="Ask the dashboard assistant…"
            className="min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-[14px] leading-6 text-text-primary outline-none placeholder:text-text-secondary/70"
          />
          <button
            type="submit"
            disabled={!text.trim() || busy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {/* Controls row: source chips · image · agent switch */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {showSourceChips && SOURCE_KINDS.map((src) => {
            const Icon = src.icon;
            const isOpen = openMenu === src.kind;
            const items = sources[src.kind];
            return (
              <div key={src.kind} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(isOpen ? null : src.kind)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border-color bg-bg-secondary px-2 py-1 text-[12px] font-medium text-text-secondary transition hover:text-text-primary"
                >
                  <Icon className="h-3 w-3" /> {src.label} <ChevronDown className="h-3 w-3" />
                </button>
                {isOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                    <div className="absolute bottom-full left-0 z-50 mb-1 max-h-64 w-44 overflow-y-auto rounded-xl border border-border-color bg-card-bg shadow-xl">
                      {items.length === 0 ? (
                        <div className="px-3 py-2 text-[12px] text-text-secondary">None available</div>
                      ) : (
                        items.map((item) => (
                          <button
                            key={`${src.kind}:${item.id}`}
                            type="button"
                            onClick={() => {
                              addContext({ kind: src.kind, id: item.id, label: item.label });
                              setOpenMenu(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-primary transition hover:bg-bg-secondary"
                          >
                            <Plus className="h-3 w-3 text-text-secondary" /> <span className="truncate">{item.label}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Image upload — real S3 upload via /files/upload */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 rounded-lg border border-border-color bg-bg-secondary px-2 py-1 text-[12px] font-medium text-text-secondary transition hover:text-text-primary disabled:opacity-50"
          >
            <Paperclip className="h-3 w-3" /> {uploading ? 'Uploading…' : 'Image'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />

          {/* Agent switch — real multi-agent picker (falls back to a static label
              when the host view doesn't pass an agent list, e.g. the grid). */}
          <div className="relative ml-auto">
            <button
              type="button"
              disabled={!agents || agents.length === 0 || !onSwitchAgent}
              onClick={() => setOpenMenu(openMenu === 'agent' ? null : 'agent')}
              className="inline-flex items-center gap-1 rounded-lg border border-border-color bg-bg-secondary px-2 py-1 text-[12px] font-medium text-text-secondary transition hover:text-text-primary disabled:cursor-default disabled:opacity-70"
            >
              <Bot className="h-3 w-3" />
              <span className="max-w-[140px] truncate">{activeAgentName}</span>
              {agents && agents.length > 0 && onSwitchAgent && <ChevronDown className="h-3 w-3" />}
            </button>
            {openMenu === 'agent' && agents && onSwitchAgent && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
                <div className="absolute bottom-full right-0 z-50 mb-1 max-h-64 w-52 overflow-y-auto rounded-xl border border-border-color bg-card-bg shadow-xl">
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        onSwitchAgent(a.id);
                        setOpenMenu(null);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition hover:bg-bg-secondary ${
                        a.id === agentId ? 'font-medium text-accent' : 'text-text-primary'
                      }`}
                    >
                      <Bot className="h-3 w-3 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <span className="shrink-0 rounded-full bg-bg-secondary px-1.5 py-0.5 text-[9px] text-text-secondary">
                        {a.kind}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
