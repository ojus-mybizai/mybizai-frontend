'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FileText, ArrowRight, Loader2 } from 'lucide-react';
import { templateKeys } from '@/lib/tasks/keys';
import {
  listTaskTemplates,
  assignTaskTemplate,
  type TaskTemplate,
} from '@/services/taskTemplates';
import { useToastStore } from '@/lib/toast-store';
import { parse, extractFreeVariables } from '@/lib/tasks/token-parser';
import { DispatchWizard } from './dispatch-wizard';

const MAX = 5;

export function SlashMenu({
  query,
  memberId,
  onClose,
}: {
  query: string;
  memberId: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToastStore((s) => s.add);
  const [cursor, setCursor] = useState(0);
  const [dispatching, setDispatching] = useState<TaskTemplate | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: templateKeys.list(true),
    queryFn: () => listTaskTemplates(true),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const list = templates ?? [];
    const q = query.trim().toLowerCase();
    const scored = q ? list.filter((t) => t.name.toLowerCase().includes(q)) : list;
    return [...scored]
      .sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0))
      .slice(0, MAX);
  }, [templates, query]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    if (dispatching) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(filtered.length - 1, c + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === 'Enter' && filtered[cursor]) {
        e.preventDefault();
        pick(filtered[cursor]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pick = async (t: TaskTemplate) => {
    const needsRows = t.entity_kind !== 'none';
    const freeVars = collectVars(t);
    const needsAssignee = t.assignee_mode === 'prompt';

    if (!needsRows && freeVars.length === 0 && !needsAssignee) {
      try {
        const res = await assignTaskTemplate(t.id, { variables: {} });
        toast(`Assigned "${t.name}" (${res.total})`, 'success');
        onClose();
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Assign failed', 'error');
      }
      return;
    }
    setDispatching(t);
  };

  if (dispatching) {
    return (
      <DispatchWizard
        template={dispatching}
        defaultMemberId={memberId}
        onDone={() => {
          setDispatching(null);
          onClose();
        }}
        onCancel={() => setDispatching(null)}
      />
    );
  }

  return (
    <div
      role="listbox"
      aria-label="Templates"
      className="absolute bottom-16 left-3 z-40 w-[320px] rounded-tc-panel border border-tc-rule bg-tc-bg-card shadow-[var(--tc-shadow-soft)]"
    >
      <div className="border-b border-tc-rule px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-tc-ink-muted">
        Templates{' '}
        {query && (
          <span className="normal-case text-tc-ink-2">· matching &quot;{query}&quot;</span>
        )}
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 p-4 text-xs text-tc-ink-muted">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-4 text-center text-xs text-tc-ink-muted">
          {templates && templates.length === 0
            ? 'No templates yet. Create one on /tasks/templates.'
            : 'No matches.'}
        </div>
      ) : (
        <ul className="max-h-72 overflow-y-auto py-1">
          {filtered.map((t, i) => (
            <li
              key={t.id}
              role="option"
              aria-selected={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(t)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 ${
                i === cursor ? 'bg-tc-accent-soft' : 'hover:bg-tc-bg-card-2'
              }`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-tc-ink-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-tc-ink">{t.name}</div>
                <div className="truncate text-[10px] text-tc-ink-muted">
                  {t.entity_kind}·{t.row_count} · {t.assignee_mode} · used {t.use_count ?? 0}×
                </div>
              </div>
              {i === cursor && <ArrowRight className="h-3 w-3 text-tc-accent" />}
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={() => {
          onClose();
          router.push('/tasks/templates');
        }}
        className="w-full border-t border-tc-rule px-3 py-2 text-left text-[11px] text-tc-ink-muted hover:bg-tc-bg-card-2 hover:text-tc-ink"
      >
        Manage templates →
      </button>
    </div>
  );
}

function collectVars(t: TaskTemplate): string[] {
  const set = new Set<string>();
  for (const p of extractFreeVariables(parse(t.title_pattern))) set.add(p);
  for (const p of extractFreeVariables(parse(t.instructions ?? ''))) set.add(p);
  for (const v of t.variables ?? []) if (v.name) set.add(v.name);
  return Array.from(set);
}
