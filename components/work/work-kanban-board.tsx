'use client';

import React, { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { Work } from '@/services/work';
import {
  STATUSES,
  statusLabel,
  statusColor,
  priorityDotColor,
  formatDate,
  isOverdue,
} from './work-utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WorkKanbanBoardProps {
  items: Work[];
  onStatusChange: (workId: number, newStatus: string) => Promise<void>;
  onCardClick: (workId: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Droppable Column                                                   */
/* ------------------------------------------------------------------ */

function KanbanColumn({
  status,
  children,
  count,
}: {
  status: string;
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[250px] flex-1 rounded-xl bg-bg-secondary p-3 transition-colors
        max-h-[calc(100vh-280px)] overflow-y-auto
        ${isOver ? 'ring-2 ring-accent/50' : ''}`}
    >
      {/* Column header */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(status)}`}
        >
          {statusLabel(status)}
        </span>
        <span className="rounded-full bg-bg-primary px-2 py-0.5 text-xs font-medium text-text-secondary">
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">{children}</div>

      {/* Empty state */}
      {count === 0 && (
        <p className="py-8 text-center text-xs text-text-secondary">
          No items
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Draggable Card                                                     */
/* ------------------------------------------------------------------ */

function KanbanCard({
  work,
  onClick,
  overlay = false,
}: {
  work: Work;
  onClick: (workId: number) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: work.id });

  const style: React.CSSProperties | undefined = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
      }
    : undefined;

  const overdue = isOverdue(work.due_date, work.status);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      onClick={(e) => {
        // Only fire click if not dragging
        if (!isDragging) {
          e.stopPropagation();
          onClick(work.id);
        }
      }}
      className={`rounded-lg border border-border-color bg-card-bg p-3 shadow-sm
        transition-shadow hover:shadow-md
        ${isDragging && !overlay ? 'opacity-30' : ''}
        ${overlay ? 'rotate-2 shadow-lg' : ''}
        cursor-grab active:cursor-grabbing`}
    >
      {/* Title */}
      <p className="truncate text-sm font-medium text-text-primary">
        {work.title || 'Untitled'}
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
/*  Board                                                              */
/* ------------------------------------------------------------------ */

export default function WorkKanbanBoard({
  items,
  onStatusChange,
  onCardClick,
}: WorkKanbanBoardProps) {
  const [activeWork, setActiveWork] = useState<Work | null>(null);
  const [optimistic, setOptimistic] = useState<Record<number, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  /* Bucket items by status (using optimistic overrides) */
  const buckets: Record<string, Work[]> = {};
  for (const s of STATUSES) {
    buckets[s] = [];
  }
  for (const w of items) {
    const effectiveStatus = optimistic[w.id] ?? w.status;
    const bucket = buckets[effectiveStatus] ?? buckets['pending'];
    bucket.push(w);
  }

  /* Drag handlers */
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const work = items.find((w) => w.id === event.active.id) ?? null;
      setActiveWork(work);
    },
    [items],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveWork(null);
      const { active, over } = event;
      if (!over) return;

      const workId = active.id as number;
      const newStatus = over.id as string;

      // Find current effective status
      const work = items.find((w) => w.id === workId);
      if (!work) return;
      const currentStatus = optimistic[workId] ?? work.status;
      if (currentStatus === newStatus) return;

      // Optimistic update
      setOptimistic((prev) => ({ ...prev, [workId]: newStatus }));

      try {
        await onStatusChange(workId, newStatus);
        // On success, remove optimistic override (parent will refresh items)
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[workId];
          return next;
        });
      } catch {
        // Revert on error
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[workId];
          return next;
        });
      }
    },
    [items, optimistic, onStatusChange],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            count={buckets[status].length}
          >
            {buckets[status].map((work) => (
              <KanbanCard
                key={work.id}
                work={work}
                onClick={onCardClick}
              />
            ))}
          </KanbanColumn>
        ))}
      </div>

      {/* Drag overlay for smooth visual feedback */}
      <DragOverlay>
        {activeWork ? (
          <KanbanCard work={activeWork} onClick={() => {}} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
