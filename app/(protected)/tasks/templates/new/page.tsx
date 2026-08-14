'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { useToastStore } from '@/lib/toast-store';
import { TemplateEditor } from '@/components/tasks/template-editor';

export default function NewTemplatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-tc-bg-ground text-tc-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      }
    >
      <NewTemplateInner />
    </Suspense>
  );
}

function NewTemplateInner() {
  const router = useRouter();
  const isOwner = useAuthStore((s) => s.isOwner);
  const toast = useToastStore((s) => s.add);

  useEffect(() => {
    if (isOwner === false) {
      toast('Templates are owner-only.', 'error');
      router.replace('/tasks');
    }
  }, [isOwner, router, toast]);

  return (
    <div className="flex h-full flex-col bg-tc-bg-ground">
      <header className="flex items-center gap-3 border-b border-tc-rule bg-tc-bg-card px-6 py-4">
        <button
          onClick={() => router.push('/tasks/templates')}
          className="flex items-center gap-1 text-xs text-tc-ink-muted hover:text-tc-ink"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Templates
        </button>
        <span aria-hidden className="text-tc-ink-muted">·</span>
        <h1 className="font-serif text-lg font-semibold tracking-tight text-tc-ink">
          New template
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <TemplateEditor
            template={null}
            onSaved={(t) => router.replace(`/tasks/templates?edit=${t.id}`)}
            onCancel={() => router.push('/tasks/templates')}
          />
        </div>
      </div>
    </div>
  );
}
