'use client';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border-color bg-card-bg px-6 py-10 text-center">
      <div className="mb-2 text-base font-semibold text-text-primary">{title}</div>
      {description && (
        <div className="mb-4 max-w-md text-sm text-text-secondary">{description}</div>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
