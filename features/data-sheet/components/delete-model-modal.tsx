'use client';

import { useState } from 'react';

const CONFIRM_WORD = 'delete';

export interface DeleteModelModalProps {
  model: { id: number; name: string; display_name: string };
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  deleting: boolean;
}

export function DeleteModelModal({ model, onConfirm, onClose, deleting }: DeleteModelModalProps) {
  const [typed, setTyped] = useState('');
  const confirmed = typed.trim().toLowerCase() === CONFIRM_WORD;

  const handleConfirm = async () => {
    if (!confirmed || deleting) return;
    await onConfirm();
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
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!confirmed || deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deleting…' : 'Delete model'}
          </button>
        </div>
      </div>
    </div>
  );
}
