'use client';

interface AIStatusBadgeProps {
  mode: 'ai' | 'manual' | 'closed';
}

export function AIStatusBadge({ mode }: AIStatusBadgeProps) {
  const styles: Record<AIStatusBadgeProps['mode'], string> = {
    ai: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    manual: 'bg-slate-100 text-slate-700 border-slate-200',
    closed: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  const labels: Record<AIStatusBadgeProps['mode'], string> = {
    ai: 'AI Active',
    manual: 'Manual',
    closed: 'Closed',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[mode]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {labels[mode]}
    </span>
  );
}
