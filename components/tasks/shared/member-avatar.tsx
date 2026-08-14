'use client';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hueFrom(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function MemberAvatar({
  name,
  size = 32,
  showPresence = false,
}: {
  name: string;
  size?: number;
  showPresence?: boolean;
}) {
  const label = initials(name || '');
  const hue = hueFrom(name || '?');
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full flex items-center justify-center font-medium text-white select-none"
        style={{
          width: size,
          height: size,
          backgroundColor: `hsl(${hue}, 38%, 42%)`,
          fontSize: Math.max(10, Math.floor(size * 0.4)),
        }}
        aria-hidden
      >
        {label}
      </div>
      {showPresence && (
        <span
          className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-tc-bg-card"
          aria-label="Online"
        />
      )}
    </div>
  );
}
