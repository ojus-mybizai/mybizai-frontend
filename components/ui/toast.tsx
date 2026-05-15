'use client';

import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const ICONS = {
  success: <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />,
  error:   <XCircle    className="w-4 h-4 text-red-500   shrink-0 mt-0.5" />,
  info:    <Info       className="w-4 h-4 text-blue-500  shrink-0 mt-0.5" />,
};

const STYLES = {
  success: 'bg-white border-green-200 text-gray-800',
  error:   'bg-white border-red-200   text-gray-800',
  info:    'bg-white border-blue-200  text-gray-800',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm max-w-sm w-full
        animate-in slide-in-from-right-5 fade-in duration-200 ${STYLES[toast.type]}`}
    >
      {ICONS[toast.type]}
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors ml-1"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
