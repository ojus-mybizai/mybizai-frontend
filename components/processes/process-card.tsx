'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProcessEntry } from '@/services/processes';
import {
  Avatar, Money, PriorityDot, SlaBar, Icon, formatDateShort,
} from './design-system';

export type CardDensity = 'compact' | 'standard';

export interface ProcessCardProps {
  entry: ProcessEntry;
  density: CardDensity;
  emphasized?: boolean;  // high-value cards get a subtle accent ring
  slaDays?: number | null;
  stageColor?: string | null;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelect: (id: number) => void;
  onOpen: (entry: ProcessEntry) => void;
  onQuickWhatsApp?: (entry: ProcessEntry) => void;
  onQuickCall?: (entry: ProcessEntry) => void;
  onRemove?: (id: number) => void;
}

const ACTION_DATA = '[data-card-action]';

export default function ProcessCard({
  entry, density, emphasized, slaDays, stageColor,
  selected, selectionMode, onToggleSelect, onOpen,
  onQuickWhatsApp, onQuickCall, onRemove,
}: ProcessCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `entry:${entry.id}`,
    data: { type: 'entry', entry },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  // Single semantic SLA color (top-edge accent). Falls back to stage color, then border.
  const slaTone = entry.sla_status === 'breach' ? '#ef4444'
    : entry.sla_status === 'warn' ? '#f59e0b'
    : null;
  const topEdgeColor = slaTone || stageColor || null;

  function handleClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest(ACTION_DATA)) return;
    if (selectionMode) onToggleSelect(entry.id);
    else onOpen(entry);
  }

  const isCompact = density === 'compact';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      role="article"
      tabIndex={0}
      aria-label={`${entry.title || entry.entity_name || 'entry'} — ${entry.current_stage_name || ''}`}
      className={`group relative overflow-hidden rounded-md bg-card-bg shadow-sm hover:shadow-md transition-card cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none
        ${selected ? 'ring-2 ring-accent' : 'ring-1 ring-border-color hover:ring-accent/40'}
        ${emphasized ? 'shadow-[0_0_0_1px_rgba(59,130,246,0.35)]' : ''}
        ${isCompact ? 'min-h-[40px]' : 'min-h-[72px]'}
      `}
    >
      {/* Top-edge SLA / stage color — clearer signal than a 1.5px side stripe */}
      {topEdgeColor && (
        <div className="h-[3px]" style={{ background: topEdgeColor }} />
      )}

      {/* Body */}
      <div className={`min-w-0 ${isCompact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
        {/* Header row: priority dot + title + value */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-1.5 flex-1">
            {selectionMode && (
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => { e.stopPropagation(); onToggleSelect(entry.id); }}
                onClick={(e) => e.stopPropagation()}
                className="h-3.5 w-3.5 rounded border-border-color text-accent focus:ring-1 focus:ring-accent flex-shrink-0"
                data-card-action
              />
            )}
            {entry.priority && <PriorityDot priority={entry.priority} />}
            <p className={`font-semibold text-text-primary truncate ${isCompact ? 'text-xs' : 'text-[13px]'}`}>
              {entry.title || entry.entity_name || `#${entry.entity_id}`}
            </p>
          </div>
          {entry.expected_value != null && (
            <Money value={entry.expected_value} compact size="sm" tone="success" />
          )}
        </div>

        {/* Sub line (only in standard) */}
        {!isCompact && entry.title && entry.entity_name && (
          <p className="mt-0.5 text-[11px] text-text-secondary truncate pl-3.5">{entry.entity_name}</p>
        )}

        {/* Meta row: assignee · close · days-in-stage */}
        {!isCompact && (
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-text-secondary">
            <div className="flex items-center gap-1.5 min-w-0">
              {entry.assigned_to_name ? (
                <>
                  <Avatar name={entry.assigned_to_name} size="xs" />
                  <span className="truncate max-w-[110px]">{entry.assigned_to_name}</span>
                </>
              ) : (
                <span className="text-text-secondary/60 italic">Unassigned</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {entry.expected_close_date && (
                <span
                  className="inline-flex items-center gap-0.5"
                  title={`Expected close ${entry.expected_close_date}`}
                >
                  <Icon.clock size={10} />
                  {formatDateShort(entry.expected_close_date)}
                </span>
              )}
              {entry.days_in_stage != null && (
                <span className={`tabular-nums ${
                  entry.sla_status === 'breach' ? 'text-red-600 dark:text-red-400 font-semibold'
                  : entry.sla_status === 'warn' ? 'text-amber-600 dark:text-amber-400 font-semibold'
                  : ''
                }`}>
                  {entry.days_in_stage}d
                </span>
              )}
            </div>
          </div>
        )}

        {/* SLA bar — bottom edge of body */}
        {!isCompact && slaDays != null && entry.days_in_stage != null && (
          <div className="mt-2 -mb-0.5">
            <SlaBar daysInStage={entry.days_in_stage} slaDays={slaDays} />
          </div>
        )}

        {/* Hover quick actions — reveal on hover, don't take vertical space when idle */}
        {!isCompact && (onQuickWhatsApp || onQuickCall || onRemove) && (
          <div
            className="absolute right-1.5 top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-quick bg-card-bg/95 backdrop-blur-sm rounded-md px-0.5 shadow-sm"
            data-card-action
          >
            {entry.entity_phone && onQuickWhatsApp && (
              <button
                onClick={(e) => { e.stopPropagation(); onQuickWhatsApp(entry); }}
                className="p-1 rounded text-text-secondary hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-quick"
                title="Open WhatsApp"
                aria-label="WhatsApp"
              >
                <Icon.chat size={12} />
              </button>
            )}
            {entry.entity_phone && onQuickCall && (
              <button
                onClick={(e) => { e.stopPropagation(); onQuickCall(entry); }}
                className="p-1 rounded text-text-secondary hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-quick"
                title="Call"
                aria-label="Call"
              >
                <Icon.phone size={12} />
              </button>
            )}
            {onRemove && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
                className="p-1 rounded text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-quick"
                title="Remove from process"
                aria-label="Remove"
              >
                <Icon.close size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
