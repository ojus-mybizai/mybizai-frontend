export function RouteLoading() {
  return (
    <div className="flex w-full items-center justify-center py-12" aria-label="Loading">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-color border-t-accent" />
        <p className="text-sm text-text-secondary">Loading…</p>
      </div>
    </div>
  );
}
