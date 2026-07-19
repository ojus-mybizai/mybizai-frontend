'use client';

interface AIStatusBadgeProps {
  mode: 'ai' | 'manual' | 'closed';
}

export function AIStatusBadge({ mode }: AIStatusBadgeProps) {
  if (mode === 'ai') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        AI
      </span>
    );
  }
  if (mode === 'closed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800/50 px-2 py-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Closed
      </span>
    );
  }
  // manual — bold orange badge, equally visible as AI
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-xs font-semibold text-orange-800 dark:text-orange-400">
      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
      Manual
    </span>
  );
}
