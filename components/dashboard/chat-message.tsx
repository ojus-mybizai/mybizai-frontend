'use client';

import React, { useState } from 'react';
import DynamicRenderer from '@/components/dynamic-ui/DynamicRenderer';
import SkillStateDisplay from './skill-state-display';
import { AgentActionCard } from './agent-action-card';
import type { DashboardMessage } from './types';

interface ChatMessageProps {
  message: DashboardMessage;
  onSend?: (message: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  disabled?: boolean;
}

/** Render text with **bold**, *italic*, and newline support */
function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
        const rendered = parts.map((part, pi) => {
          if (part.startsWith('**') && part.endsWith('**'))
            return <strong key={pi} className="font-semibold">{part.slice(2, -2)}</strong>;
          if (part.startsWith('*') && part.endsWith('*'))
            return <em key={pi}>{part.slice(1, -1)}</em>;
          // handle _(text)_ italic-ish for "stopped" note
          if (part.startsWith('_(') && part.endsWith(')_'))
            return <span key={pi} className="opacity-60 italic">{part.slice(2, -2)}</span>;
          return part;
        });
        return (
          <React.Fragment key={li}>
            {rendered}
            {li < lines.length - 1 && <br />}
          </React.Fragment>
        );
      })}
    </>
  );
}

function AIAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/60 text-white shadow-sm">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    </div>
  );
}

function EditIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function Timestamp({ iso }: { iso?: string }) {
  if (!iso) return null;
  return (
    <span className="mt-0.5 block text-[10px] text-text-secondary/60 tabular-nums">
      {new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

export default function ChatMessage({ message, onSend, onEdit, disabled }: ChatMessageProps) {
  const [hovered, setHovered] = useState(false);
  const isUser = message.role === 'user';
  const isWebhook = message.source === 'webhook';

  const displayContent = message.content?.startsWith('__') ? null : message.content;

  const hasAgentUI   = !isUser && !!message.agent_ui;
  const hasToolStates = !isUser && !!message.tool_states?.length;
  const hasLegacyUI  = !isUser && !!(message.ui?.blocks as unknown[])?.length;

  // Stopped message — render inline note, no bubble
  const isStopped = displayContent === '_(Response stopped)_';

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start py-2`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* AI avatar */}
      {!isUser && <div className="mt-0.5 shrink-0"><AIAvatar /></div>}

      <div className={`flex min-w-0 flex-col ${isUser ? 'items-end max-w-[80%]' : 'flex-1 min-w-0'}`}>

        {/* ── Stopped note ── */}
        {isStopped && (
          <span className="text-xs italic text-text-secondary/60 py-1">Response stopped</span>
        )}

        {/* ── User bubble ── */}
        {!isStopped && isUser && displayContent && (
          <div className="relative">
            <div className="rounded-2xl rounded-tr-sm bg-accent px-4 py-2.5 text-sm text-white leading-relaxed shadow-sm">
              {isWebhook && (
                <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
                  ⚡ Webhook
                </span>
              )}
              <RichText text={displayContent} />
            </div>
            {/* Edit button */}
            {onEdit && !disabled && hovered && (
              <button
                type="button"
                onClick={() => onEdit(message.id, displayContent)}
                title="Edit & resend"
                className="absolute -left-8 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border border-border-color bg-card-bg text-text-secondary opacity-0 group-hover:opacity-100 hover:border-accent hover:text-accent transition-all shadow-sm"
                style={{ opacity: hovered ? 1 : 0 }}
              >
                <EditIcon />
              </button>
            )}
          </div>
        )}

        {/* ── Assistant text ── */}
        {!isStopped && !isUser && displayContent && (
          <div className="text-sm leading-relaxed text-text-primary">
            {isWebhook && (
              <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-500">
                ⚡ Webhook
              </span>
            )}
            <RichText text={displayContent} />
          </div>
        )}

        {/* ── Skill states ── */}
        {hasToolStates && (
          <div className="mt-2 w-full">
            <SkillStateDisplay toolStates={message.tool_states!} />
          </div>
        )}

        {/* ── Agent UI card ── */}
        {hasAgentUI && onSend && (
          <div className="mt-2.5 w-full">
            <AgentActionCard block={message.agent_ui!} onSend={onSend} disabled={disabled} />
          </div>
        )}

        {/* ── Legacy dynamic UI ── */}
        {hasLegacyUI && (
          <div className="mt-2 w-full">
            <DynamicRenderer blocks={message.ui!.blocks ?? []} />
          </div>
        )}

        <Timestamp iso={message.created_at} />
      </div>
    </div>
  );
}
