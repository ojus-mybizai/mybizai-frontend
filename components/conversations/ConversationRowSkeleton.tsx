'use client';

export function ConversationRowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <div className="h-10 w-10 shrink-0 rounded-full bg-bg-secondary animate-pulse" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="h-4 w-32 rounded bg-bg-secondary animate-pulse" />
          <div className="h-4 w-12 rounded bg-bg-secondary animate-pulse" />
        </div>
        <div className="h-3 w-full max-w-[200px] rounded bg-bg-secondary/80 animate-pulse" />
        <div className="h-3 w-16 rounded bg-bg-secondary/60 animate-pulse" />
      </div>
    </li>
  );
}
