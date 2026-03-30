export default function AgentsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-36 rounded bg-bg-secondary" />
          <div className="h-4 w-64 rounded bg-bg-secondary" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 rounded-md bg-bg-secondary" />
          <div className="h-10 w-28 rounded-md bg-bg-secondary" />
        </div>
      </div>

      {/* Summary strip */}
      <div className="rounded-2xl border border-border bg-card-bg p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-20 rounded bg-bg-secondary mb-2" />
              <div className="h-6 w-12 rounded bg-bg-secondary" />
            </div>
          ))}
        </div>
      </div>

      {/* Controls row */}
      <div className="flex gap-2 rounded-2xl border border-border bg-card-bg p-4">
        <div className="h-9 w-48 rounded-md bg-bg-secondary" />
        <div className="h-9 w-32 rounded-md bg-bg-secondary" />
        <div className="h-9 w-32 rounded-md bg-bg-secondary" />
      </div>

      {/* Agent cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card-bg p-5 space-y-3">
            <div className="flex justify-between">
              <div className="h-5 w-32 rounded bg-bg-secondary" />
              <div className="h-5 w-16 rounded-full bg-bg-secondary" />
            </div>
            <div className="h-12 w-full rounded bg-bg-secondary" />
            <div className="grid gap-2 grid-cols-3">
              <div className="h-14 rounded-lg bg-bg-secondary" />
              <div className="h-14 rounded-lg bg-bg-secondary" />
              <div className="h-14 rounded-lg bg-bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
