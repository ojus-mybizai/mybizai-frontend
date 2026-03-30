'use client';

import { useState, useEffect } from 'react';
import {
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  type LeadPipelineStage,
} from '@/services/customers';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PipelineEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  stages: LeadPipelineStage[];
  onSave: () => void; // reload stages after save
}

/** Internal mutable row used during editing */
interface StageRow {
  /** Negative ids = newly created (not yet persisted) */
  id: number;
  name: string;
  color: string;
  stage_type: 'open' | 'won' | 'lost';
  sort_order: number;
  /** Track whether this row existed before editing */
  _isNew: boolean;
  /** Track whether a field was changed */
  _dirty: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STAGE_COLORS = [
  '#6B7280',
  '#3B82F6',
  '#8B5CF6',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#EC4899',
  '#06B6D4',
];

const STAGE_TYPE_OPTIONS: { value: 'open' | 'won' | 'lost'; label: string }[] =
  [
    { value: 'open', label: 'Open' },
    { value: 'won', label: 'Won' },
    { value: 'lost', label: 'Lost' },
  ];

let _nextTempId = -1;
function nextTempId() {
  return _nextTempId--;
}

/* ------------------------------------------------------------------ */
/*  Color Picker                                                       */
/* ------------------------------------------------------------------ */

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="h-6 w-6 flex-shrink-0 rounded-full border border-border-color"
        style={{ backgroundColor: value }}
        onClick={() => setOpen((v) => !v)}
        title="Pick color"
      />
      {open && (
        <div className="absolute left-0 z-30 mt-1 flex flex-wrap gap-1.5 rounded-lg border border-border-color bg-card-bg p-2 shadow-lg">
          {STAGE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                c === value
                  ? 'border-text-primary ring-2 ring-accent'
                  : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pipeline Editor Modal                                              */
/* ------------------------------------------------------------------ */

export function PipelineEditorModal({
  isOpen,
  onClose,
  stages,
  onSave,
}: PipelineEditorModalProps) {
  const [rows, setRows] = useState<StageRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync from props when modal opens
  useEffect(() => {
    if (isOpen) {
      setRows(
        [...stages]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((s) => ({
            id: s.id,
            name: s.name,
            color: s.color || '#6B7280',
            stage_type: s.stage_type,
            sort_order: s.sort_order,
            _isNew: false,
            _dirty: false,
          })),
      );
      setDeletedIds([]);
      setError(null);
      _nextTempId = -1;
    }
  }, [isOpen, stages]);

  if (!isOpen) return null;

  /* ---- Row mutation helpers ---- */

  function updateRow(idx: number, patch: Partial<StageRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch, _dirty: true } : r)),
    );
  }

  function addRow() {
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
    setRows((prev) => [
      ...prev,
      {
        id: nextTempId(),
        name: '',
        color: STAGE_COLORS[prev.length % STAGE_COLORS.length],
        stage_type: 'open',
        sort_order: maxOrder + 1,
        _isNew: true,
        _dirty: true,
      },
    ]);
  }

  function removeRow(idx: number) {
    const row = rows[idx];
    if (rows.length <= 1) return; // cannot delete last stage
    if (!row._isNew && row.id > 0) {
      setDeletedIds((prev) => [...prev, row.id]);
    }
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  /* ---- Move row up / down ---- */

  function moveRow(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      // Recalculate sort_order
      return next.map((r, i) => ({ ...r, sort_order: i + 1, _dirty: true }));
    });
  }

  /* ---- Save ---- */

  async function handleSave() {
    // Validate
    for (const r of rows) {
      if (!r.name.trim()) {
        setError('All stages must have a name.');
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      // 1. Delete removed stages
      for (const id of deletedIds) {
        await deletePipelineStage(id);
      }

      // 2. Create new stages
      for (const r of rows) {
        if (r._isNew) {
          await createPipelineStage({
            name: r.name.trim(),
            color: r.color,
            stage_type: r.stage_type,
            sort_order: r.sort_order,
          });
        }
      }

      // 3. Update existing dirty stages
      for (const r of rows) {
        if (!r._isNew && r._dirty && r.id > 0) {
          await updatePipelineStage(r.id, {
            name: r.name.trim(),
            color: r.color,
            stage_type: r.stage_type,
            sort_order: r.sort_order,
          });
        }
      }

      onSave();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save pipeline stages.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="w-full max-w-lg rounded-xl border border-border-color bg-card-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color px-5 py-4">
          <h3 className="text-base font-semibold text-text-primary">
            Edit Pipeline Stages
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-secondary transition-colors hover:bg-gray-100 hover:text-text-primary dark:hover:bg-white/10"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] space-y-2 overflow-y-auto px-5 py-4">
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className="flex items-center gap-2 rounded-lg border border-border-color bg-gray-50 px-3 py-2 dark:bg-white/5"
            >
              {/* Reorder arrows */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  className="text-text-secondary transition-colors hover:text-text-primary disabled:opacity-30"
                  disabled={idx === 0}
                  onClick={() => moveRow(idx, -1)}
                  title="Move up"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="h-3 w-3"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8 3.293l-4.354 4.354a.5.5 0 00.708.708L8 4.707l3.646 3.648a.5.5 0 00.708-.708L8 3.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="text-text-secondary transition-colors hover:text-text-primary disabled:opacity-30"
                  disabled={idx === rows.length - 1}
                  onClick={() => moveRow(idx, 1)}
                  title="Move down"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="h-3 w-3"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8 12.707l4.354-4.354a.5.5 0 00-.708-.708L8 11.293 4.354 7.645a.5.5 0 10-.708.708L8 12.707z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              {/* Color picker */}
              <ColorPicker
                value={row.color}
                onChange={(c) => updateRow(idx, { color: c })}
              />

              {/* Name input */}
              <input
                type="text"
                className="min-w-0 flex-1 rounded border border-border-color bg-transparent px-2 py-1 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Stage name"
                value={row.name}
                onChange={(e) => updateRow(idx, { name: e.target.value })}
              />

              {/* Stage type dropdown */}
              <select
                className="rounded border border-border-color bg-transparent px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                value={row.stage_type}
                onChange={(e) =>
                  updateRow(idx, {
                    stage_type: e.target.value as 'open' | 'won' | 'lost',
                  })
                }
              >
                {STAGE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Delete button */}
              <button
                type="button"
                className="rounded p-1 text-text-secondary transition-colors hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/30"
                onClick={() => removeRow(idx)}
                disabled={rows.length <= 1}
                title="Delete stage"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Add stage button */}
        <div className="px-5">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Add Stage
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="px-5 pt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border-color px-5 py-4 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving\u2026' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
