type DashboardView = 'metrics' | 'chat';

interface ViewToggleProps {
  view: DashboardView;
  onChange: (view: DashboardView) => void;
}

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-border-color bg-bg-primary p-1 text-sm">
      <button
        type="button"
        onClick={() => onChange('metrics')}
        className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
          view === 'metrics'
            ? 'bg-accent text-white'
            : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
        }`}
      >
        Metrics
      </button>
      <button
        type="button"
        onClick={() => onChange('chat')}
        className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
          view === 'chat'
            ? 'bg-accent text-white'
            : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
        }`}
      >
        Chat
      </button>
    </div>
  );
}
