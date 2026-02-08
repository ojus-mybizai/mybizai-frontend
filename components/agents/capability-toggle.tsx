'use client';

interface CapabilityToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

export function CapabilityToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: CapabilityToggleProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent'
      } ${checked ? 'border-accent/70 bg-accent/5' : 'border-border-color bg-card-bg'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text-primary">{label}</div>
          {description && <div className="text-xs text-text-secondary">{description}</div>}
        </div>
        <div
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
            checked ? 'bg-accent' : 'bg-border-color'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
              checked ? 'translate-x-4' : 'translate-x-1'
            }`}
          />
        </div>
      </div>
    </button>
  );
}
