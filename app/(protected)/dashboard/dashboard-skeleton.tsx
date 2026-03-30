export default function DashboardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 animate-pulse">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="h-4 w-20 rounded bg-bg-secondary" />
        <div className="flex gap-1 rounded-lg bg-bg-secondary p-0.5">
          <div className="h-6 w-16 rounded-md bg-card-bg" />
          <div className="h-6 w-16 rounded-md bg-bg-secondary" />
        </div>
      </div>

      {/* Chat panel skeleton */}
      <div className="flex flex-1 min-h-0 rounded-xl border border-border bg-card-bg p-4">
        <div className="flex flex-1 flex-col gap-3">
          {/* Message bubbles */}
          <div className="h-10 w-3/4 rounded-lg bg-bg-secondary" />
          <div className="h-10 w-1/2 rounded-lg bg-bg-secondary ml-auto" />
          <div className="h-10 w-2/3 rounded-lg bg-bg-secondary" />
          <div className="flex-1" />
          {/* Input bar */}
          <div className="h-10 w-full rounded-lg bg-bg-secondary" />
        </div>
      </div>
    </div>
  );
}
