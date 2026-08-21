'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Send, Zap, ChevronUp, MessageCircle, AlertTriangle } from 'lucide-react';
import { useTaskConsole } from '@/stores/task-console-store';
import { useCreateTask } from '@/hooks/use-tasks';
import { useMembers } from '@/hooks/use-members';
import { endOfWorkdayISO } from '@/lib/tasks/format';
import { useToastStore } from '@/lib/toast-store';
import {
  reopenMemberWindow,
  sendMemberMessage,
  waTaskTemplateSetupError,
} from '@/services/members';
import { classifyWindow } from './shared/session-window-chip';
import { AssignPopover } from './assign-popover';
import { SlashMenu } from './slash-menu';

export function Composer({ memberId, memberName }: { memberId: number; memberName: string }) {
  const { setDraft, clearDraft } = useTaskConsole();
  const create = useCreateTask(memberId);
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.add);
  const { data: members } = useMembers();
  const [text, setText] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reopening, setReopening] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const member = useMemo(
    () => members?.find((m) => m.id === memberId) ?? null,
    [members, memberId],
  );
  const windowState = useMemo(
    () =>
      classifyWindow(
        member?.session_window_expires_at,
        member?.session_active,
        member?.channels.includes('whatsapp') ?? false,
      ),
    [member],
  );
  const windowClosed = windowState === 'closed';
  const windowClosing = windowState === 'closing';
  const isWhatsApp = member?.channels.includes('whatsapp') ?? false;

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

  const doReopenWindow = useCallback(async () => {
    if (reopening) return;
    setReopening(true);
    try {
      await reopenMemberWindow(memberId);
      qc.invalidateQueries({ queryKey: ['member-chat', memberId] });
      qc.invalidateQueries({ queryKey: ['members'] });
      toast(`Template sent to ${memberName} — window will reopen on their reply.`, 'success');
    } catch (e) {
      const setup = waTaskTemplateSetupError(e);
      if (setup) {
        toast(setup.message, 'error');
      } else {
        toast(e instanceof Error ? e.message : 'Could not send template', 'error');
      }
    } finally {
      setReopening(false);
    }
  }, [reopening, memberId, memberName, qc, toast]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashQuery !== null) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        doAssignInstant();
      } else {
        e.preventDefault();
        if (!windowClosed || !isWhatsApp) doSend();
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

      {isWhatsApp && windowClosed && (
        <div className="mb-2 flex items-start gap-2 rounded-tc-panel border border-red-300 bg-red-50 px-3 py-2 text-xs dark:border-red-800/60 dark:bg-red-900/20">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="flex-1 text-red-800 dark:text-red-200">
            <b>WhatsApp 24-hour window closed.</b> Free-form messages won&apos;t
            deliver. Send an approved template to reopen — {memberName} replies,
            the window opens for another 24 hours.
          </div>
        </div>
      )}
      {isWhatsApp && windowClosing && (
        <div className="mb-2 flex items-center gap-2 rounded-tc-panel border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle className="h-3 w-3" />
          Window closes soon — after that, only approved templates will send.
        </div>
      )}

      <div
        className={`flex items-end gap-2 rounded-tc-panel border bg-tc-bg-ground p-2 focus-within:ring-2 focus-within:ring-tc-accent/40 ${
          windowClosed && isWhatsApp ? 'border-red-300/70 opacity-90' : 'border-tc-rule'
        }`}
      >
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => persist(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={
            windowClosed && isWhatsApp
              ? `Window closed — send a template to reach ${memberName}…`
              : `Message ${memberName}, / for templates, or Ctrl+Enter to assign…`
          }
          className="min-h-[36px] max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-tc-ink placeholder:text-tc-ink-muted focus:outline-none"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
        <div className="flex shrink-0 items-center gap-1">
          {windowClosed && isWhatsApp ? (
            <button
              onClick={doReopenWindow}
              disabled={reopening}
              aria-label="Send template to reopen WhatsApp window"
              title="Send the configured task template so the member's reply reopens the 24-hour window"
              className="flex h-8 items-center gap-1.5 rounded-tc-chip bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-600"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {reopening ? 'Sending…' : 'Send template'}
            </button>
          ) : (
            <button
              onClick={doSend}
              disabled={!text.trim() || sending}
              aria-label="Send chat"
              title="Send (Enter)"
              className="flex h-8 w-8 items-center justify-center rounded-tc-chip text-tc-ink-muted hover:bg-tc-bg-card-2 hover:text-tc-ink disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-stretch overflow-hidden rounded-tc-chip">
            <button
              onClick={doAssignInstant}
              disabled={!text.trim() || create.isPending}
              aria-label="Assign as task"
              title="Assign as task (Ctrl+Enter). Sends via template when the window is closed."
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
