'use client';

import { useEffect, useMemo, useState } from 'react';
import { bindKnowledgeBases, listAgents, type Agent } from '@/services/agents';
import { useKBStore } from '@/lib/kb-store';

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

type MessageState = {
  kind: 'success' | 'error';
  text: string;
} | null;

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatApiError(error: unknown, fallback: string): string {
  const err = error as { status?: number; message?: string } | null;
  const status = err?.status;
  const message = err?.message || fallback;
  if (status === 400) return `Validation error: ${message}`;
  if (status === 403) return `Permission denied: ${message}`;
  if (status === 404) return `Not found: ${message}`;
  return message;
}

export function SettingsKnowledgeBaseTab() {
  const {
    items,
    loading,
    actionLoading,
    error: storeError,
    list,
    createText,
    uploadFile,
    updateItem,
    deleteItem,
    resetError,
  } = useKBStore((s) => ({
    items: s.items,
    loading: s.loading,
    actionLoading: s.actionLoading,
    error: s.error,
    list: s.list,
    createText: s.createText,
    uploadFile: s.uploadFile,
    updateItem: s.updateItem,
    deleteItem: s.deleteItem,
    resetError: s.resetError,
  }));

  const [message, setMessage] = useState<MessageState>(null);
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [textTitle, setTextTitle] = useState('');
  const [textCategory, setTextCategory] = useState('');
  const [textContent, setTextContent] = useState('');
  const [fileTitle, setFileTitle] = useState('');
  const [fileCategory, setFileCategory] = useState('');
  const [fileInput, setFileInput] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editContent, setEditContent] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [selectedKbForLinking, setSelectedKbForLinking] = useState<string>('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [linkSaving, setLinkSaving] = useState(false);

  const linkableItems = useMemo(
    () => items.filter((item) => Number.isInteger(Number(item.id)) && Number(item.id) > 0),
    [items],
  );

  useEffect(() => {
    void list();
  }, [list]);

  useEffect(() => {
    let cancelled = false;
    const loadAgents = async () => {
      setAgentsLoading(true);
      try {
        const data = await listAgents();
        if (cancelled) return;
        setAgents(data);
      } catch (error) {
        if (cancelled) return;
        setMessage({
          kind: 'error',
          text: formatApiError(error, 'Failed to load agents for KB linking.'),
        });
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    };
    void loadAgents();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedKbForLinking && linkableItems.length > 0) {
      setSelectedKbForLinking(linkableItems[0].id);
    }
    if (
      selectedKbForLinking &&
      !linkableItems.some((item) => item.id === selectedKbForLinking)
    ) {
      setSelectedKbForLinking(linkableItems[0]?.id ?? '');
    }
  }, [linkableItems, selectedKbForLinking]);

  const linkedAgentIds = useMemo(() => {
    if (!selectedKbForLinking) return [];
    return agents.filter((agent) => agent.kbIds.includes(selectedKbForLinking)).map((agent) => agent.id);
  }, [agents, selectedKbForLinking]);

  useEffect(() => {
    setSelectedAgentIds(linkedAgentIds);
  }, [linkedAgentIds, selectedKbForLinking]);

  const editingItem = useMemo(() => items.find((item) => item.id === editingId) ?? null, [items, editingId]);

  const handleCreateText = async () => {
    if (!textTitle.trim() || !textContent.trim()) {
      setMessage({ kind: 'error', text: 'Title and content are required for text knowledge base.' });
      return;
    }
    setMessage(null);
    try {
      await createText({
        title: textTitle.trim(),
        category: textCategory.trim() || undefined,
        content: textContent.trim(),
      });
      setTextTitle('');
      setTextCategory('');
      setTextContent('');
      setMessage({ kind: 'success', text: 'Text knowledge base created.' });
    } catch (error) {
      setMessage({ kind: 'error', text: formatApiError(error, 'Could not create knowledge base.') });
    }
  };

  const handleUploadFile = async () => {
    if (!fileTitle.trim() || !fileInput) {
      setMessage({ kind: 'error', text: 'Title and file are required for file knowledge base.' });
      return;
    }
    const loweredName = fileInput.name.toLowerCase();
    const isAllowed = ALLOWED_EXTENSIONS.some((ext) => loweredName.endsWith(ext));
    if (!isAllowed) {
      setMessage({
        kind: 'error',
        text: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      });
      return;
    }
    if (fileInput.size > MAX_FILE_SIZE_BYTES) {
      setMessage({ kind: 'error', text: 'File too large. Maximum file size is 10MB.' });
      return;
    }

    setMessage(null);
    try {
      await uploadFile({
        title: fileTitle.trim(),
        category: fileCategory.trim() || undefined,
        file: fileInput,
      });
      setFileTitle('');
      setFileCategory('');
      setFileInput(null);
      setMessage({ kind: 'success', text: 'File knowledge base uploaded.' });
    } catch (error) {
      setMessage({ kind: 'error', text: formatApiError(error, 'Could not upload file.') });
    }
  };

  const startEdit = (id: string) => {
    const item = items.find((kb) => kb.id === id);
    if (!item) return;
    setEditingId(id);
    setEditTitle(item.title);
    setEditCategory(item.category ?? '');
    setEditContent(item.content ?? '');
    setMessage(null);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    if (!editTitle.trim()) {
      setMessage({ kind: 'error', text: 'Title is required.' });
      return;
    }
    if (editingItem.sourceType === 'text' && !editContent.trim()) {
      setMessage({ kind: 'error', text: 'Text knowledge base content cannot be empty.' });
      return;
    }
    setMessage(null);
    try {
      await updateItem(editingItem.id, {
        title: editTitle.trim(),
        category: editCategory.trim() || null,
        ...(editingItem.sourceType === 'text' ? { content: editContent.trim() } : {}),
      });
      setEditingId(null);
      setMessage({ kind: 'success', text: 'Knowledge base updated.' });
    } catch (error) {
      setMessage({ kind: 'error', text: formatApiError(error, 'Could not update knowledge base.') });
    }
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm('Delete this knowledge base entry? This cannot be undone.');
    if (!ok) return;
    setMessage(null);
    try {
      await deleteItem(id);
      setMessage({ kind: 'success', text: 'Knowledge base deleted.' });
    } catch (error) {
      setMessage({ kind: 'error', text: formatApiError(error, 'Could not delete knowledge base.') });
    }
  };

  const handleSaveLinks = async () => {
    if (!selectedKbForLinking) {
      setMessage({ kind: 'error', text: 'Select a knowledge base to manage links.' });
      return;
    }
    const selectedKbNumeric = Number(selectedKbForLinking);
    if (!Number.isInteger(selectedKbNumeric) || selectedKbNumeric <= 0) {
      setMessage({
        kind: 'error',
        text: 'This knowledge base is still syncing. Please wait a moment and try again.',
      });
      return;
    }
    setLinkSaving(true);
    setMessage(null);
    try {
      const freshAgents = await listAgents();
      const selected = new Set(selectedAgentIds);
      const affectedAgents = freshAgents.filter(
        (agent) => selected.has(agent.id) || agent.kbIds.includes(selectedKbForLinking),
      );
      await Promise.all(
        affectedAgents.map((agent) => {
          const withoutCurrent = agent.kbIds.filter((kbId) => kbId !== selectedKbForLinking);
          const nextKbIds = selected.has(agent.id)
            ? Array.from(new Set([...withoutCurrent, selectedKbForLinking]))
            : withoutCurrent;
          return bindKnowledgeBases(agent.id, nextKbIds);
        }),
      );
      const refreshedAgents = await listAgents();
      setAgents(refreshedAgents);
      setMessage({ kind: 'success', text: 'KB-to-agent links saved.' });
    } catch (error) {
      setMessage({ kind: 'error', text: formatApiError(error, 'Could not save KB links.') });
    } finally {
      setLinkSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {(message || storeError) && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            message?.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
          }`}
        >
          {message?.text ?? storeError}
        </div>
      )}

      {storeError && (
        <button
          type="button"
          onClick={() => {
            resetError();
            void list();
          }}
          className="rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-semibold text-text-primary hover:border-accent"
        >
          Retry loading knowledge bases
        </button>
      )}

      {loading && items.length === 0 && (
        <div className="rounded-2xl border border-border-color bg-card-bg p-5 text-sm text-text-secondary">
          Loading knowledge base entries...
        </div>
      )}

      {!loading && !storeError && items.length === 0 && (
        <div className="rounded-2xl border border-border-color bg-card-bg p-5">
          <h3 className="text-base font-semibold text-text-primary">Knowledge base</h3>
          <p className="mt-1 text-sm text-text-secondary">
            No entries yet. Create a text entry or upload a file to get started.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border-color bg-card-bg p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-text-primary">Create knowledge base entry</h3>
          <div className="rounded-full border border-border-color bg-bg-secondary p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode('text')}
              className={`rounded-full px-2 py-1 ${
                mode === 'text' ? 'bg-accent text-white' : 'text-text-secondary'
              }`}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => setMode('file')}
              className={`rounded-full px-2 py-1 ${
                mode === 'file' ? 'bg-accent text-white' : 'text-text-secondary'
              }`}
            >
              File
            </button>
          </div>
        </div>

        {mode === 'text' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Title</label>
              <input
                type="text"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Category (optional)
              </label>
              <input
                type="text"
                value={textCategory}
                onChange={(e) => setTextCategory(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-text-secondary">Content</label>
              <textarea
                rows={6}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => void handleCreateText()}
                disabled={actionLoading}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {actionLoading ? 'Saving...' : 'Create text entry'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Title</label>
              <input
                type="text"
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Category (optional)
              </label>
              <input
                type="text"
                value={fileCategory}
                onChange={(e) => setFileCategory(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                File (PDF, DOCX, TXT; max 10MB)
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => setFileInput(e.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => void handleUploadFile()}
                disabled={actionLoading}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {actionLoading ? 'Uploading...' : 'Upload file'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border-color bg-card-bg p-5">
        <h3 className="mb-3 text-base font-semibold text-text-primary">Existing entries</h3>
        {items.length === 0 ? (
          <p className="text-sm text-text-secondary">No knowledge base entries yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm md:flex-row md:items-start md:justify-between"
              >
                <div>
                  <div className="font-semibold text-text-primary">{item.title}</div>
                  <div className="mt-0.5 text-xs text-text-secondary">
                    <span className="rounded-full bg-bg-primary px-2 py-0.5">{item.sourceType}</span>
                    {item.category && (
                      <span className="ml-2 rounded-full bg-bg-primary px-2 py-0.5">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    Updated {formatDate(item.updatedAt)}
                  </div>
                  {item.sourceType === 'file' && item.fileUrl && (
                    <a
                      href={item.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-accent hover:underline"
                    >
                      View file
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(item.id)}
                    className="rounded-md border border-border-color bg-bg-primary px-3 py-1 text-xs font-semibold text-text-primary hover:border-accent"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    className="rounded-md border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingItem && (
        <div className="rounded-2xl border border-border-color bg-card-bg p-5">
          <h3 className="mb-3 text-base font-semibold text-text-primary">Edit knowledge base entry</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Category</label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            {editingItem.sourceType === 'text' && (
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-text-secondary">Content</label>
                <textarea
                  rows={6}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                />
              </div>
            )}
            <div className="md:col-span-2 flex gap-2">
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={actionLoading}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {actionLoading ? 'Saving...' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-md border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border-color bg-card-bg p-5">
        <h3 className="mb-3 text-base font-semibold text-text-primary">Link knowledge base to agents</h3>
        {linkableItems.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Create at least one knowledge base entry to link it with agents.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Knowledge base entry
              </label>
              <select
                value={selectedKbForLinking}
                onChange={(e) => setSelectedKbForLinking(e.target.value)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              >
                {linkableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            {agentsLoading ? (
              <p className="text-sm text-text-secondary">Loading agents...</p>
            ) : agents.length === 0 ? (
              <p className="text-sm text-text-secondary">No agents found for this workspace.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {agents.map((agent) => {
                  const checked = selectedAgentIds.includes(agent.id);
                  return (
                    <label
                      key={agent.id}
                      className="flex items-center gap-2 rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelectedAgentIds((prev) =>
                            e.target.checked
                              ? Array.from(new Set([...prev, agent.id]))
                              : prev.filter((id) => id !== agent.id),
                          )
                        }
                        className="h-4 w-4 rounded border-border-color text-accent focus:ring-accent"
                      />
                      <span>{agent.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <div>
              <button
                type="button"
                onClick={() => void handleSaveLinks()}
                disabled={linkSaving || agentsLoading || agents.length === 0}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {linkSaving ? 'Saving links...' : 'Save links'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
