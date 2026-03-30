'use client';

import React, { useMemo } from 'react';
import type { Work } from '@/services/work';
import {
  statusLabel,
  statusColor,
  priorityDotColor,
  formatDate,
  isOverdue,
} from './work-utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WorkTemplateTableProps {
  items: Work[];
  formFields: Array<{ id: string; label: string; type: string }>;
  onRowClick: (workId: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Cell value renderer                                                */
/* ------------------------------------------------------------------ */

function renderCellValue(
  value: unknown,
  fieldType: string,
): string {
  if (value === null || value === undefined) return '\u2014';

  if (fieldType === 'datetime' && typeof value === 'string') {
    return formatDate(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

/* ------------------------------------------------------------------ */
/*  Table                                                              */
/* ------------------------------------------------------------------ */

export function WorkTemplateTable({
  items,
  formFields,
  onRowClick,
}: WorkTemplateTableProps) {
  /* Memoize sorted items (keep original order, just stabilize reference) */
  const rows = useMemo(() => items, [items]);

  /* Empty state */
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border-color bg-card-bg py-16">
        <p className="text-sm text-text-secondary">
          No work items to display.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border-color bg-card-bg">
      <table className="w-full min-w-[600px] text-sm">
        {/* Header */}
        <thead>
          <tr className="border-b border-border-color bg-bg-secondary">
            {/* Fixed columns */}
            <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-text-primary">
              Title
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-text-primary">
              Assignee
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-text-primary">
              Status
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-text-primary">
              Priority
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-text-primary">
              Due Date
            </th>

            {/* Dynamic form_data columns */}
            {formFields.map((field) => (
              <th
                key={field.id}
                className="whitespace-nowrap px-4 py-3 text-left font-semibold text-text-primary"
              >
                {field.label}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {rows.map((work) => {
            const overdue = isOverdue(work.due_date, work.status);

            return (
              <tr
                key={work.id}
                onClick={() => onRowClick(work.id)}
                className="cursor-pointer border-b border-border-color last:border-b-0 transition-colors hover:bg-bg-secondary/60"
              >
                {/* Title */}
                <td className="max-w-[200px] truncate px-4 py-3 text-text-primary">
                  {work.title || work.work_type_name || 'Untitled'}
                </td>

                {/* Assignee */}
                <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                  {work.assigned_to_name}
                </td>

                {/* Status badge */}
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(work.status)}`}
                  >
                    {statusLabel(work.status)}
                  </span>
                </td>

                {/* Priority dot */}
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${priorityDotColor(work.priority)}`}
                    />
                    <span className="text-xs capitalize text-text-secondary">
                      {work.priority}
                    </span>
                  </span>
                </td>

                {/* Due Date */}
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={
                      overdue
                        ? 'text-xs font-semibold text-red-600 dark:text-red-400'
                        : 'text-xs text-text-secondary'
                    }
                  >
                    {formatDate(work.due_date)}
                    {overdue && ' (overdue)'}
                  </span>
                </td>

                {/* Dynamic form_data cells */}
                {formFields.map((field) => (
                  <td
                    key={field.id}
                    className="max-w-[180px] truncate whitespace-nowrap px-4 py-3 text-text-secondary"
                  >
                    {renderCellValue(work.form_data?.[field.id], field.type)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
