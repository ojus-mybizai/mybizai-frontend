'use client';

import { useToastStore, type ToastVariant } from '@/lib/toast-store';

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-card-bg text-text-primary border border-border-color',
};

const icons: Record<ToastVariant, string> = {
  success: '\u2713',
  error: '\u2717',
  info: '\u2139',
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          style={{ animation: 'toast-in 0.2s ease-out both' }}
          className={`pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${variantStyles[t.variant]}`}
        >
          <span className="text-base leading-none">{icons[t.variant]}</span>
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => remove(t.id)}
            className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
