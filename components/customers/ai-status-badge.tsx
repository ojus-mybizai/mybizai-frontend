'use client';

interface AIStatusBadgeProps {
  mode: 'ai' | 'manual' | 'closed';
}

export function AIStatusBadge({ mode }: AIStatusBadgeProps) {
  if (mode === 'ai') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        AI
      </span>
    );
  }
  if (mode === 'closed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Closed
      </span>
    );
  }
  // manual — show nothing prominent, just a quiet label
  return (
    <span className="text-xs text-text-secondary">Manual</span>
  );
}
