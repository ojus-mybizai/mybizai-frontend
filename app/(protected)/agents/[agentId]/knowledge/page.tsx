'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAgentStore } from '@/lib/agent-store';
import { useKnowledgeFileStore } from '@/lib/knowledge-file-store';
import { useShallow } from 'zustand/react/shallow';
import { KnowledgeFileCard } from '@/components/agents/knowledge-file-card';
import { KnowledgeFileModal } from '@/components/agents/knowledge-file-modal';
import type { KnowledgeFile, KnowledgeFileCreateInput, KnowledgeFileUpdateInput } from '@/services/knowledge-files';
import { Plus, FileText, BookOpen, Loader2 } from 'lucide-react';

export default function AgentKnowledgePage() {
  const { current } = useAgentStore(
    useShallow((s) => ({ current: s.current })),
  );

  const { files, loading, error, list, create, update, remove } = useKnowledgeFileStore(
    useShallow((s) => ({
      files: s.files,
      loading: s.loading,
      error: s.error,
      list: s.list,
      create: s.create,
      update: s.update,
      remove: s.remove,
    })),
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeFile | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (current?.id) {
      void list(current.id);
    }
  }, [current?.id, list]);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (file: KnowledgeFile) => {
    setEditing(file);
    setModalOpen(true);
  };

  const handleDelete = useCallback(
    async (file: KnowledgeFile) => {
      if (!confirm(`Delete knowledge file "${file.title}"? This cannot be undone.`)) return;
      setDeletingId(file.id);
      try {
        await remove(file.id);
      } finally {
        setDeletingId(null);
      }
    },
    [remove],
  );

  const handleSubmit = useCallback(
    async (payload: KnowledgeFileCreateInput | KnowledgeFileUpdateInput, isUpdate: boolean) => {
      if (isUpdate && editing) {
        await update(editing.id, payload as KnowledgeFileUpdateInput);
      } else {
        await create(payload as KnowledgeFileCreateInput);
      }
    },
    [create, update, editing],
  );

  if (!current) return null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border-color bg-card-bg p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Knowledge files</h2>
              <p className="mt-1 max-w-2xl text-sm text-text-secondary">
                Plain-text knowledge the agent can look up on demand. Each file has a unique
                <code className="mx-1 rounded bg-bg-secondary px-1 py-0.5 text-xs">topic_key</code>.
                The LLM picks from these topics when it calls the{' '}
                <code className="rounded bg-bg-secondary px-1 py-0.5 text-xs">lookup_knowledge</code>{' '}
                skill — you don't need to add it to the skill list, it's auto-registered when
                an agent has at least one knowledge file.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add knowledge
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && files.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-border-color bg-card-bg py-12 text-text-secondary">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-color bg-card-bg p-12 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-text-secondary/50" />
          <h3 className="text-sm font-semibold text-text-primary">No knowledge files yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary">
            Add reference text the agent can pull from — discount policies, negotiation scripts,
            warranty terms, product details. The LLM will only fetch the file when it's relevant.
          </p>
          <button
            type="button"
            onClick={openNew}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add your first knowledge file
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {files.map((file) => (
            <div key={file.id} className={deletingId === file.id ? 'opacity-50' : ''}>
              <KnowledgeFileCard file={file} onEdit={openEdit} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}

      <KnowledgeFileModal
        open={modalOpen}
        agentId={Number(current.id)}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
