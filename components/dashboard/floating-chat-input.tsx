'use client';

import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

// Most useful for business owners first: work, employees, then rest
const SCOPE_OPTIONS = [
  { mention: '@work', model: 'work', label: 'Work & tasks' },
  { mention: '@employees', model: 'employees', label: 'Team & employees' },
  { mention: '@leads', model: 'leads', label: 'Leads' },
  { mention: '@orders', model: 'orders', label: 'Orders' },
  { mention: '@catalog', model: 'catalog', label: 'Catalog' },
  { mention: '@conversations', model: 'conversations', label: 'Conversations' },
  { mention: '@contacts', model: 'contacts', label: 'Contacts' },
  { mention: '@channels', model: 'channels', label: 'Channels' },
] as const;

export interface DatasheetScopeOption {
  mention: string;
  model: string;
  label: string;
  dynamicModelId: number;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const ACCEPT = [...IMAGE_TYPES, ...DOC_TYPES].join(',');

function getActiveScope(value: string): string | null {
  const match = value.trimStart().match(/^@([\w-]+)\s*/);
  return match ? match[1].toLowerCase() : null;
}

function applyScopeClick(value: string, model: string): string {
  const mention = `@${model} `;
  const trimmed = value.trimStart();
  const match = trimmed.match(/^@[\w-]+\s*/);
  if (match) {
    return mention + trimmed.slice(match[0].length);
  }
  if (!trimmed) return mention;
  return mention + value;
}

/** Returns true if cursor is right after @ or in @foo / @datasheet-5 (scope mention). */
function getScopeQuery(value: string, caretIndex: number): { show: boolean; query: string } {
  const beforeCaret = value.slice(0, caretIndex);
  const atMatch = beforeCaret.match(/@([\w-]*)$/);
  if (!atMatch) return { show: false, query: '' };
  return { show: true, query: (atMatch[1] || '').toLowerCase() };
}

export interface AttachmentFile {
  file: File;
  id: string;
  preview?: string; // data URL for images
}

interface FloatingChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string, attachments?: File[]) => void;
  isLoading: boolean;
  datasheetScopes?: DatasheetScopeOption[];
}

const allScopeOptions = (
  base: readonly { mention: string; model: string; label: string }[],
  datasheet: DatasheetScopeOption[]
): { mention: string; model: string; label: string }[] => [...base, ...datasheet];

export default function FloatingChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  datasheetScopes = [],
}: FloatingChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeHighlight, setScopeHighlight] = useState(0);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [caretPos, setCaretPos] = useState(0);
  const activeScope = getActiveScope(value);

  const scopeOptions = allScopeOptions(SCOPE_OPTIONS, datasheetScopes);
  const { show: showScopePopover, query: scopeQuery } = getScopeQuery(value, caretPos);
  const filteredScopes = scopeQuery
    ? scopeOptions.filter(
        (o) =>
          o.model.toLowerCase().startsWith(scopeQuery) || o.mention.toLowerCase().includes(scopeQuery)
      )
    : scopeOptions;

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    onChange(nextValue);
    const el = event.target;
    setCaretPos(el.selectionStart ?? nextValue.length);
    autosize();
  };

  const handleSelectScope = useCallback(
    (model: string) => {
      const mention = `@${model} `;
      const el = textareaRef.current;
      if (!el) {
        onChange(applyScopeClick(value, model));
        setScopeOpen(false);
        return;
      }
      const start = value.slice(0, caretPos).replace(/@[\w-]*$/, '');
      const end = value.slice(caretPos);
      const newValue = start + mention + end;
      onChange(newValue);
      setScopeOpen(false);
      setScopeHighlight(0);
      requestAnimationFrame(() => {
        el.focus();
        const pos = (start + mention).length;
        el.setSelectionRange(pos, pos);
        setCaretPos(pos);
      });
    },
    [value, caretPos, onChange]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showScopePopover && filteredScopes.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setScopeHighlight((i) => Math.min(i + 1, filteredScopes.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setScopeHighlight((i) => Math.max(i - 1, 0));
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        handleSelectScope(filteredScopes[scopeHighlight].model);
        return;
      }
      if (event.key === 'Escape') {
        setScopeOpen(false);
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!isLoading && (value.trim() || attachments.length > 0)) {
        handleSend();
      }
    }
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (isLoading && !trimmed && attachments.length === 0) return;
    const files = attachments.map((a) => a.file);
    onSend(trimmed || ' ', files.length ? files : undefined);
    setAttachments([]);
    onChange('');
  };

  const handleCaret = () => {
    const el = textareaRef.current;
    if (el) setCaretPos(el.selectionStart ?? 0);
  };

  const onFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files;
    if (!chosen?.length) return;
    const next: AttachmentFile[] = [];
    for (let i = 0; i < chosen.length; i++) {
      const file = chosen[i];
      const id = `att-${Date.now()}-${i}`;
      const isImage = IMAGE_TYPES.includes(file.type);
      if (isImage) {
        const url = URL.createObjectURL(file);
        next.push({ file, id, preview: url });
      } else {
        next.push({ file, id });
      }
    }
    setAttachments((prev) => [...prev, ...next]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const one = prev.find((a) => a.id === id);
      if (one?.preview) URL.revokeObjectURL(one.preview);
      return prev.filter((a) => a.id !== id);
    });
  };

  useEffect(() => {
    setScopeOpen(showScopePopover);
    if (showScopePopover) setScopeHighlight(0);
  }, [showScopePopover]);

  const autosize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minHeight = 52;
    const maxHeight = 160;
    const h = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${h}px`;
  };

  useEffect(() => {
    autosize();
  }, [value]);

  const disabled = isLoading || (!value.trim() && attachments.length === 0);

  return (
    <div ref={wrapperRef} className="fixed bottom-0 left-0 right-0 md:left-56 lg:left-64 z-30 px-4 pb-4">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-border-color bg-bg-primary shadow-sm transition-colors focus-within:border-accent/80 focus-within:shadow-md">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-3">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-md bg-bg-secondary border border-border-color overflow-hidden max-w-[140px]"
                >
                  {a.preview ? (
                    <img src={a.preview} alt={`Preview of ${a.file.name}`} className="h-9 w-9 object-cover shrink-0" />
                  ) : (
                    <span className="h-9 w-9 flex items-center justify-center bg-bg-primary shrink-0 text-xs text-text-secondary">
                      doc
                    </span>
                  )}
                  <span className="truncate text-xs text-text-primary pr-1" title={a.file.name}>
                    {a.file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    aria-label={`Remove ${a.file.name}`}
                    className="shrink-0 p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-primary rounded"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className={`flex items-end gap-2 p-3 ${attachments.length > 0 ? 'pt-2' : ''}`}>
            <div className="flex-1 min-w-0 relative rounded-lg bg-bg-secondary/50 border border-transparent focus-within:border-border-color/60 transition-colors">
              <textarea
                ref={textareaRef}
                rows={1}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onSelect={handleCaret}
                onClick={handleCaret}
                placeholder="Ask about work, team, leads, orders…"
                aria-label="Message for AI Manager"
                aria-describedby={showScopePopover ? 'scope-list' : undefined}
                aria-disabled={isLoading}
                readOnly={isLoading}
                className="min-h-[44px] w-full resize-none overflow-y-auto border-0 bg-transparent py-2.5 px-3 text-base leading-relaxed text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-0"
              />
              {scopeOpen && filteredScopes.length > 0 && (
                <div
                  id="scope-list"
                  role="listbox"
                  aria-label="Scope options"
                  className="absolute left-0 right-0 bottom-full mb-1.5 py-1 rounded-lg border border-border-color bg-bg-primary shadow-lg max-h-52 overflow-y-auto z-10"
                >
                  {filteredScopes.map((opt, i) => (
                    <button
                      key={opt.model}
                      type="button"
                      role="option"
                      aria-selected={i === scopeHighlight}
                      onClick={() => handleSelectScope(opt.model)}
                      onMouseEnter={() => setScopeHighlight(i)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                        i === scopeHighlight ? 'bg-(--accent-soft) text-accent' : 'text-text-primary hover:bg-bg-secondary'
                      } ${activeScope === opt.model ? 'font-medium' : ''}`}
                    >
                      <span>{opt.mention}</span>
                      <span className="text-text-secondary text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <label className="cursor-pointer inline-flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-secondary focus-within:ring-2 focus-within:ring-accent/50 focus-within:ring-offset-2 focus-within:ring-offset-bg-primary">
                <input
                  type="file"
                  accept={ACCEPT}
                  multiple
                  onChange={onFileSelect}
                  className="sr-only"
                  aria-label="Attach image or document"
                />
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              </label>
              <button
                type="button"
                disabled={disabled}
                onClick={handleSend}
                aria-label="Send message"
                aria-busy={isLoading}
                className="inline-flex h-9 px-3 sm:px-4 items-center justify-center gap-1.5 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-primary"
              >
                {isLoading ? (
                  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                ) : (
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                <span className="hidden sm:inline">{isLoading ? 'Sending…' : 'Send'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
