'use client';

import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

interface Props {
  config: ConfirmDialogConfig | null;
}

export function ConfirmDialog({ config }: Props) {
  if (!config) return null;

  const { title, message, confirmLabel = 'Confirm', destructive = false, onConfirm, onCancel } = config;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9998] p-4">
      <div className="bg-bg-primary rounded-xl shadow-xl w-full max-w-sm border border-border-color">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex items-start gap-3">
            {destructive && (
              <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-text-primary text-sm">{title}</h3>
              <p className="text-sm text-text-secondary mt-1 leading-snug">{message}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 ml-2 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm border border-border-color rounded-lg text-text-secondary hover:bg-bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onCancel(); }}
            className={`flex-1 px-4 py-2 text-sm rounded-lg font-medium transition-colors text-white
              ${destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-accent hover:bg-accent/90'
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
