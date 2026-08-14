'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Send, Zap, ChevronUp } from 'lucide-react';
import { useTaskConsole } from '@/stores/task-console-store';
import { useCreateTask } from '@/hooks/use-tasks';
import { endOfWorkdayISO } from '@/lib/tasks/format';
import { useToastStore } from '@/lib/toast-store';
import { sendMemberMessage } from '@/services/members';
import { AssignPopover } from './assign-popover';
import { SlashMenu } from './slash-menu';

export function Composer({ memberId, memberName }: { memberId: number; memberName: string }) {
  const { setDraft, clearDraft } = useTaskConsole();
  const create = useCreateTask(memberId);
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.add);
  const [text, setText] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(useTaskConsole.getState().composerDrafts[memberId] ?? '');
    setPopoverOpen(false);
    setSlashQuery(null);
  }, [memberId]);

  const persist = useCallback(
    (v: string) => {
      setText(v);
      setDraft(memberId, v);
      if (v.startsWith('/')) {
        setSlashQuery(v.slice(1));
      } else if (slashQuery !== null) {
        setSlashQuery(null);
      }
    },
    [memberId, setDraft, slashQuery],
  );

  const doAssignInstant = useCallback(async () => {
    const title = text.trim();
    if (!title) return;
    try {
      await create.mutateAsync({
        title,
        assignee_member_id: memberId,
        type: 'simple',
        priority: 'normal',
        due_at: endOfWorkdayISO(),
        source: 'app',
      });
      persist('');
      clearDraft(memberId);
      toast(`Assigned to ${memberName}`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not assign task', 'error');
    }
  }, [text, memberId, create, persist, clearDraft, toast, memberName]);

  const doSend = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await sendMemberMessage(memberId, body);
      persist('');
      clearDraft(memberId);
      qc.invalidateQueries({ queryKey: ['member-chat', memberId] });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send message', 'error');
    } finally {
      setSending(false);
    }
  }, [text, sending, memberId, persist, clearDraft, qc, toast]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashQuery !== null) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        doAssignInstant();
      } else {
        e.preventDefault();
        doSend();
      }
    }
  };

  return (
    <div className="relative border-t border-tc-rule bg-tc-bg-card p-3">
      {popoverOpen && (
        <AssignPopover
          memberId={memberId}
          memberName={memberName}
          initialText={text}
          onClose={() => setPopoverOpen(false)}
          onAssigned={() => {
            persist('');
            clearDraft(memberId);
          }}
        />
      )}
      {slashQuery !== null && (
        <SlashMenu
          query={slashQuery}
          memberId={memberId}
          onClose={() => {
            setSlashQuery(null);
            persist('');
            clearDraft(memberId);
          }}
        />
      )}
      <div className="flex items-end gap-2 rounded-tc-panel border border-tc-rule bg-tc-bg-ground p-2 focus-within:ring-2 focus-within:ring-tc-accent/40">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => persist(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={`Message ${memberName}, / for templates, or Ctrl+Enter to assign…`}
          className="min-h-[36px] max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-tc-ink placeholder:text-tc-ink-muted focus:outline-none"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={doSend}
            disabled={!text.trim() || sending}
            aria-label="Send chat"
            title="Send (Enter)"
            className="flex h-8 w-8 items-center justify-center rounded-tc-chip text-tc-ink-muted hover:bg-tc-bg-card-2 hover:text-tc-ink disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
          <div className="flex items-stretch overflow-hidden rounded-tc-chip">
            <button
              onClick={doAssignInstant}
              disabled={!text.trim() || create.isPending}
              aria-label="Assign as task"
              title="Assign as task (Ctrl+Enter)"
              className="flex h-8 items-center gap-1 bg-tc-accent px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              <Zap className="h-3.5 w-3.5" /> Assign
            </button>
            <button
              onClick={() => setPopoverOpen((v) => !v)}
              aria-label="More assign options"
              title="Choose due, priority, type"
              className="flex h-8 w-6 items-center justify-center border-l border-white/20 bg-tc-accent text-white hover:opacity-90"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
