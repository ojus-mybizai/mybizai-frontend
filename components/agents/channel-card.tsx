'use client';

interface ChannelCardProps {
  name: string;
  description: string;
  connected: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}

export function ChannelCard({ name, description, connected, onToggle, disabled }: ChannelCardProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle(!connected)}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        connected ? 'border-emerald-300 bg-emerald-50' : 'border-border-color bg-card-bg'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-text-primary">{name}</div>
          <div className="text-sm text-text-secondary">{description}</div>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
            connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
    </button>
  );
}
