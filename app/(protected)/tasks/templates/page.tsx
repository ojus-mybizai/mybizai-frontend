'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, FileText, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { useToastStore } from '@/lib/toast-store';
import { useTaskTemplates } from '@/hooks/use-templates';
import { TemplateEditor } from '@/components/tasks/template-editor';
import type { TaskTemplate } from '@/services/taskTemplates';

export default function TemplatesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TemplatesInner />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex h-full items-center justify-center bg-tc-bg-ground text-tc-ink-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}

function TemplatesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOwner = useAuthStore((s) => s.isOwner);
  const toast = useToastStore((s) => s.add);
  const { data: templates, isLoading } = useTaskTemplates(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const raw = searchParams?.get('edit');
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) setExpandedId(n);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isOwner === false) {
      toast('Templates are owner-only.', 'error');
      router.replace('/tasks');
    }
  }, [isOwner, router, toast]);

  const setExpanded = (id: number | null) => {
    setExpandedId(id);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (id) params.set('edit', String(id));
    else params.delete('edit');
    router.replace(`/tasks/templates${params.toString() ? `?${params.toString()}` : ''}`, {
      scroll: false,
    });
  };

  return (
    <div className="flex h-full flex-col bg-tc-bg-ground">
      <header className="flex items-center justify-between border-b border-tc-rule bg-tc-bg-card px-6 py-4">
        <div>
          <h1 className="font-serif text-xl font-semibold tracking-tight text-tc-ink">
            Task templates
          </h1>
          <p className="mt-0.5 text-xs text-tc-ink-muted">
            Author reusable task shapes with schema-aware tokens.
          </p>
        </div>
        <button
          onClick={() => router.push('/tasks/templates/new')}
          className="inline-flex items-center gap-1.5 rounded-tc-chip bg-tc-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> New template
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-tc-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-3 h-10 w-10 text-tc-ink-muted opacity-40" />
            <p className="text-sm font-medium text-tc-ink-2">No templates yet</p>
            <p className="mt-1 max-w-sm text-xs text-tc-ink-muted">
              Templates capture reusable task shapes so anyone can dispatch them from the
              composer or Broadcast.
            </p>
            <button
              onClick={() => router.push('/tasks/templates/new')}
              className="mt-4 inline-flex items-center gap-1.5 rounded-tc-chip bg-tc-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Create your first template
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                expanded={expandedId === t.id}
                onToggle={() => setExpanded(expandedId === t.id ? null : t.id)}
                onSaved={() => setExpanded(null)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TemplateRow({
  template,
  expanded,
  onToggle,
  onSaved,
}: {
  template: TaskTemplate;
  expanded: boolean;
  onToggle: () => void;
  onSaved: (t: TaskTemplate) => void;
}) {
  return (
    <li className="overflow-hidden rounded-tc-panel border border-tc-rule bg-tc-bg-card">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-tc-bg-card-2"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-tc-ink-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 text-tc-ink-muted" />
        )}
        <FileText className="h-4 w-4 text-tc-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-tc-ink">{template.name}</span>
            {template.is_default && (
              <span className="rounded-tc-chip bg-tc-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                Default
              </span>
            )}
            <span className="rounded-tc-chip bg-tc-bg-card-2 px-1.5 py-0.5 font-mono text-[10px] text-tc-ink-muted">
              {template.entity_kind}·{template.row_count}
            </span>
            {!template.is_active && (
              <span className="rounded-tc-chip bg-tc-alert-soft px-1.5 py-0.5 text-[10px] font-medium text-tc-alert">
                Archived
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-tc-ink-muted">
            {template.title_pattern}
          </div>
        </div>
        <div className="shrink-0 text-right font-mono text-[10px] text-tc-ink-muted">
          <div>Used {template.use_count}×</div>
          {template.last_used_at && (
            <div>{new Date(template.last_used_at).toLocaleDateString()}</div>
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-tc-rule bg-tc-bg-ground p-4">
          <TemplateEditor template={template} onSaved={onSaved} onCancel={onToggle} />
        </div>
      )}
    </li>
  );
}
