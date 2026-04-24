'use client';

import { useState, useMemo } from 'react';
import type { Customer, LeadPipelineStage } from '@/services/customers';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LeadPipelineBoardProps {
  leads: Customer[];
  stages: LeadPipelineStage[];
  onMoveStage: (leadId: string, stageId: number) => Promise<void>;
  onLeadClick: (leadId: string) => void;
  onEditPipeline: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(dateStr: string | undefined): string {
  if (!dateStr) return '\u2014';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

function priorityLabel(p: string | undefined): string {
  if (!p) return '';
  return p.charAt(0).toUpperCase();
}

function initials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Column background by stage type                                    */
/* ------------------------------------------------------------------ */

function columnBg(stageType: string): string {
  if (stageType === 'won') return 'bg-emerald-50/50 dark:bg-emerald-950/20';
  if (stageType === 'lost') return 'bg-red-50/50 dark:bg-red-950/20';
  return 'bg-card-bg';
}

/* ------------------------------------------------------------------ */
/*  Lead Card                                                          */
/* ------------------------------------------------------------------ */

interface LeadCardProps {
  lead: Customer;
  stages: LeadPipelineStage[];
  currentStageId: number;
  onMoveStage: (leadId: string, stageId: number) => Promise<void>;
  onLeadClick: (leadId: string) => void;
}

function LeadCard({
  lead,
  stages,
  currentStageId,
  onMoveStage,
  onLeadClick,
}: LeadCardProps) {
  const [moving, setMoving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const otherStages = stages.filter((s) => s.id !== currentStageId);

  async function handleMove(stageId: number) {
    setMoving(true);
    setShowMenu(false);
    try {
      await onMoveStage(lead.id, stageId);
    } finally {
      setMoving(false);
    }
  }

  return (
    <div
      className={`group relative rounded-xl border border-border-color bg-card-bg p-3 shadow-sm transition-all hover:shadow-md hover:border-accent/30 ${
        moving ? 'pointer-events-none opacity-50' : 'cursor-pointer'
      }`}
      onClick={() => !moving && onLeadClick(lead.id)}
    >
      {/* Top row: name + priority dot */}
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-semibold text-text-primary leading-snug">
          {lead.name || 'Unnamed'}
        </span>
        {lead.priority && (
          <span
            className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${PRIORITY_COLORS[lead.priority] ?? 'bg-gray-400'}`}
            title={`${lead.priority} priority`}
          />
        )}
      </div>

      {/* Phone */}
      {lead.phone && (
        <p className="mt-1 truncate text-xs text-text-secondary">
          {lead.phone}
        </p>
      )}

      {/* Activity */}
      <p className="mt-1.5 text-xs text-text-secondary">
        {relativeTime(lead.lastActivity)}
        {lead.assignedAgent ? ` · ${lead.assignedAgent}` : ''}
      </p>

      {/* Move-to dropdown (visible on hover) */}
      <div className="mt-2 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="relative">
          <button
            type="button"
            className="w-full rounded-lg border border-border-color bg-bg-secondary px-2 py-1 text-left text-xs font-medium text-text-secondary hover:border-accent hover:text-accent transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((v) => !v);
            }}
          >
            Move to ›
          </button>

          {showMenu && (
            <div className="absolute left-0 z-20 mt-1 w-full rounded-xl border border-border-color bg-card-bg py-1 shadow-xl">
              {otherStages.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMove(s.id);
                  }}
                >
                  <span
                    className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: s.color || '#6B7280' }}
                  />
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pipeline Board                                                     */
/* ------------------------------------------------------------------ */

export function LeadPipelineBoard({
  leads,
  stages,
  onMoveStage,
  onLeadClick,
  onEditPipeline,
}: LeadPipelineBoardProps) {
  /** Map leads into buckets by pipelineStageId */
  const buckets = useMemo(() => {
    const map = new Map<number, Customer[]>();
    for (const stage of stages) {
      map.set(stage.id, []);
    }
    for (const lead of leads) {
      const sid = lead.pipelineStageId;
      if (sid != null && map.has(sid)) {
        map.get(sid)!.push(lead);
      } else {
        // Put leads without a stage into the first column
        const first = stages[0];
        if (first) map.get(first.id)?.push(lead);
      }
    }
    return map;
  }, [leads, stages]);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.sort_order - b.sort_order),
    [stages],
  );

  return (
    <div className="relative flex h-full flex-col">
      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Pipeline</h2>
        <button
          type="button"
          onClick={onEditPipeline}
          className="flex items-center gap-1.5 rounded-md border border-border-color px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
          title="Edit pipeline stages"
        >
          {/* Gear icon (inline SVG to avoid extra deps) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path
              fillRule="evenodd"
              d="M8.34 1.804A1 1 0 019.32 1h1.36a1 1 0 01.98.804l.295 1.473c.497.2.963.46 1.39.77l1.398-.56a1 1 0 011.12.333l.68 1.178a1 1 0 01-.142 1.137l-1.104.913a6.5 6.5 0 010 1.544l1.104.913a1 1 0 01.142 1.137l-.68 1.178a1 1 0 01-1.12.333l-1.399-.56c-.426.31-.892.57-1.39.77l-.294 1.473a1 1 0 01-.98.804H9.32a1 1 0 01-.98-.804l-.295-1.473a6.518 6.518 0 01-1.39-.77l-1.398.56a1 1 0 01-1.12-.333l-.68-1.178a1 1 0 01.142-1.137l1.104-.913a6.47 6.47 0 010-1.544l-1.104-.913a1 1 0 01-.142-1.137l.68-1.178a1 1 0 011.12-.333l1.399.56c.426-.31.892-.57 1.39-.77l.294-1.473zM13 10a3 3 0 11-6 0 3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          Edit Pipeline
        </button>
      </div>

      {/* Columns container */}
      <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
        {sortedStages.map((stage) => {
          const stageLeads = buckets.get(stage.id) ?? [];
          return (
            <div
              key={stage.id}
              className={`flex min-w-[260px] max-w-[300px] flex-shrink-0 flex-col rounded-xl border border-border-color ${columnBg(
                stage.stage_type,
              )}`}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 border-b border-border-color px-3 py-2.5">
                <span
                  className="h-full w-1 self-stretch rounded-full"
                  style={{ backgroundColor: stage.color || '#6B7280' }}
                />
                <span className="flex-1 truncate text-sm font-semibold text-text-primary">
                  {stage.name}
                </span>
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-200 px-1.5 text-[11px] font-medium text-gray-700 dark:bg-white/10 dark:text-gray-300">
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                {stageLeads.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-color py-8 px-3 text-center">
                    <p className="text-xs text-text-secondary">No leads here</p>
                  </div>
                )}
                {stageLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    stages={sortedStages}
                    currentStageId={stage.id}
                    onMoveStage={onMoveStage}
                    onLeadClick={onLeadClick}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
