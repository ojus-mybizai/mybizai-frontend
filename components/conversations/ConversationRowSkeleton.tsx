'use client';

export function ConversationRowSkeleton() {
  return (
    <li className="py-1">
      <div className="flex items-start gap-3 rounded-lg px-4 py-3 min-h-[60px]">
        <div className="h-9 w-9 shrink-0 rounded-full bg-bg-secondary animate-pulse" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="h-4 w-36 bg-bg-secondary animate-pulse rounded" />
            <div className="h-4 w-14 bg-bg-secondary animate-pulse rounded" />
          </div>
          <div className="h-3 w-full max-w-[220px] mt-2 bg-bg-secondary/80 animate-pulse rounded" />
          <div className="h-3 w-20 mt-2 bg-bg-secondary/60 animate-pulse rounded" />
        </div>
      </div>
    </li>
  );
}
