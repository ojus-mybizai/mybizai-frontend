'use client';

import React, { useMemo } from 'react';
import type { Work } from '@/services/work';
import {
  priorityDotColor,
  formatDate,
  isOverdue,
} from './work-utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WorkPipelineViewProps {
  items: Work[];
  stepsSchema: Array<{ order: number; label: string }>;
  onCardClick: (workId: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Pipeline Card                                                      */
/* ------------------------------------------------------------------ */

function PipelineCard({
  work,
  onClick,
}: {
  work: Work;
  onClick: (workId: number) => void;
}) {
  const overdue = isOverdue(work.due_date, work.status);

  return (
    <div
      onClick={() => onClick(work.id)}
      className="mx-3 my-2 rounded-lg border border-border-color bg-card-bg p-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Title */}
      <p className="truncate text-sm font-medium text-text-primary">
        {work.title || work.work_type_name || 'Untitled'}
      </p>

      {/* Assignee */}
      <p className="mt-1 truncate text-xs text-text-secondary">
        {work.assigned_to_name}
      </p>

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* Priority dot */}
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${priorityDotColor(work.priority)}`}
          title={`${work.priority} priority`}
        />

        {/* Due date */}
        {work.due_date && (
          <span
            className={`text-xs ${
              overdue
                ? 'font-semibold text-red-600 dark:text-red-400'
                : 'text-text-secondary'
            }`}
          >
            {formatDate(work.due_date)}
            {overdue && ' (overdue)'}
          </span>
        )}
      </div>

      {/* Project badge */}
      {work.project_name && (
        <span className="mt-2 inline-block truncate rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
          {work.project_name}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pipeline Column                                                    */
/* ------------------------------------------------------------------ */

function PipelineColumn({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-[250px] max-w-[300px] flex-shrink-0 rounded-xl border border-border-color bg-bg-secondary">
      {/* Column header */}
      <div className="flex items-center gap-2 border-b border-border-color px-4 py-3">
        <span className="text-sm font-semibold text-text-primary">
          {label}
        </span>
        <span className="rounded-full bg-bg-primary px-2 py-0.5 text-xs font-medium text-text-secondary">
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto py-1">
        {children}

        {/* Empty state */}
        {count === 0 && (
          <p className="py-8 text-center text-xs text-text-secondary">
            No items
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pipeline View                                                      */
/* ------------------------------------------------------------------ */

export function WorkPipelineView({
  items,
  stepsSchema,
  onCardClick,
}: WorkPipelineViewProps) {
  /* Sort steps by order */
  const sortedSteps = useMemo(
    () => [...stepsSchema].sort((a, b) => a.order - b.order),
    [stepsSchema],
  );

  /* Bucket items into columns by steps_completed */
  const buckets = useMemo(() => {
    const cols: Work[][] = Array.from(
      { length: sortedSteps.length + 1 }, // +1 for "Done"
      () => [],
    );

    for (const item of items) {
      const completed = item.steps_completed ?? 0;
      if (completed >= sortedSteps.length) {
        // Done column (last bucket)
        cols[sortedSteps.length].push(item);
      } else {
        cols[completed].push(item);
      }
    }

    return cols;
  }, [items, sortedSteps]);

  /* Empty state when no steps schema */
  if (sortedSteps.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border-color bg-card-bg py-16">
        <p className="text-sm text-text-secondary">
          No pipeline steps defined for this template.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {/* Step columns */}
      {sortedSteps.map((step, idx) => (
        <PipelineColumn
          key={`step-${step.order}`}
          label={step.label}
          count={buckets[idx].length}
        >
          {buckets[idx].map((work) => (
            <PipelineCard
              key={work.id}
              work={work}
              onClick={onCardClick}
            />
          ))}
        </PipelineColumn>
      ))}

      {/* Done column */}
      <PipelineColumn
        label="Done"
        count={buckets[sortedSteps.length].length}
      >
        {buckets[sortedSteps.length].map((work) => (
          <PipelineCard
            key={work.id}
            work={work}
            onClick={onCardClick}
          />
        ))}
      </PipelineColumn>
    </div>
  );
}
