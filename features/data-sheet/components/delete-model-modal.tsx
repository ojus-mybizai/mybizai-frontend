'use client';

import { useMemo, useState } from 'react';
import type { ReferencingField } from '@/features/data-sheet/api/normalize-error';

const CONFIRM_WORD = 'delete';

export interface DeleteModelModalProps {
  model: { id: number; name: string; display_name: string };
  onConfirm: (detach: boolean) => void | Promise<void>;
  onClose: () => void;
  deleting: boolean;
  /** Set after a blocked delete: relation columns on other sheets pointing here. */
  referencingFields?: ReferencingField[];
  /** Whether the backend allows a "detach links & delete" override. */
  canDetach?: boolean;
}

export function DeleteModelModal({
  model,
  onConfirm,
  onClose,
  deleting,
  referencingFields,
  canDetach,
}: DeleteModelModalProps) {
  const [typed, setTyped] = useState('');
  const confirmed = typed.trim().toLowerCase() === CONFIRM_WORD;

  const blocked = !!referencingFields && referencingFields.length > 0;

  // Group the referencing columns by the data sheet they live on.
  const grouped = useMemo(() => {
    const map = new Map<number, { name: string; fields: string[] }>();
    for (const r of referencingFields ?? []) {
      const entry = map.get(r.model_id) ?? { name: r.model_name, fields: [] };
      entry.fields.push(r.field_name);
      map.set(r.model_id, entry);
    }
    return Array.from(map.values());
  }, [referencingFields]);

  const handleConfirm = async (detach: boolean) => {
    if (!confirmed || deleting) return;
    await onConfirm(detach);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-border-color bg-card-bg p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-text-primary">Delete data sheet</h2>
        <p className="mt-2 text-sm text-text-secondary">
          This will permanently delete the model <strong className="text-text-primary">{model.display_name}</strong> and
          all its records, fields, and data. This action cannot be undone.
        </p>

        {blocked && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Other data sheets link to this one:
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
              {grouped.map((g) => (
                <li key={g.name}>
                  • <strong className="text-text-primary">{g.name}</strong>
                  <span className="text-text-secondary"> — via {g.fields.map((f) => `“${f}”`).join(', ')}</span>
                </li>
              ))}
            </ul>
            {canDetach ? (
              <p className="mt-2 text-xs text-text-secondary">
                You can open those sheets and clear the link columns yourself, or use
                <strong className="text-text-primary"> Detach links &amp; delete</strong> to empty those columns
                automatically (the columns stay, their links are cleared) and delete this sheet.
              </p>
            ) : (
              <p className="mt-2 text-xs text-text-secondary">
                Open those sheets and remove the link columns above, then delete this sheet.
              </p>
            )}
          </div>
        )}

        <div className="mt-4">
          <label className="block text-sm font-medium text-text-secondary">
            Type <strong className="text-text-primary">{CONFIRM_WORD}</strong> to confirm
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM_WORD}
            className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            autoComplete="off"
          />
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          {blocked && canDetach ? (
            <button
              type="button"
              onClick={() => handleConfirm(true)}
              disabled={!confirmed || deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting…' : 'Detach links & delete'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleConfirm(false)}
              disabled={!confirmed || deleting || blocked}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting…' : 'Delete model'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
