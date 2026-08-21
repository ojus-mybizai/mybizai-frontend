'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, Megaphone, UserPlus } from 'lucide-react';
import type { Member } from '@/services/members';
import type { Task } from '@/services/tasks';
import { useMembers } from '@/hooks/use-members';
import { useDebounce } from '@/lib/use-debounce';
import { MemberAvatar } from './shared/member-avatar';
import { MemberListSkeleton } from './shared/skeletons';
import { SessionWindowChip } from './shared/session-window-chip';

interface MemberListProps {
  selectedId: number | null;
  memberTaskCounts?: Record<number, { open: number; overdue: number }>;
}

export function MemberList({ selectedId }: MemberListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // Stay in whichever namespace we entered from; the /team surface should not
  // hand navigation back to the legacy /tasks route on every click.
  const base = pathname?.startsWith('/team') ? '/team' : '/tasks';
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 200);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: members, isLoading } = useMembers();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    if (!members) return [];
    const needle = debounced.toLowerCase().trim();
    const list = needle
      ? members.filter((m) => m.name.toLowerCase().includes(needle))
      : members;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, debounced]);

  const go = (memberId: number) => {
    const tab = searchParams?.get('tab');
    router.push(`${base}/${memberId}${tab ? `?tab=${tab}` : ''}`);
  };

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-tc-rule bg-tc-bg-card lg:w-[260px] md:w-[200px]">
      <div className="border-b border-tc-rule p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tc-ink-muted" />
          <input
            ref={searchRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search members  ⌘K"
            className="w-full rounded-tc-chip border border-tc-rule bg-tc-bg-ground py-1.5 pl-8 pr-2 text-sm text-tc-ink placeholder:text-tc-ink-muted focus:border-tc-accent focus:outline-none focus:ring-1 focus:ring-tc-accent/40"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto" aria-label="Team members">
        <BroadcastRow />
        {isLoading ? (
          <MemberListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-tc-ink-muted">
            No members match &quot;{debounced}&quot;.
          </div>
        ) : (
          <ul className="space-y-0.5 p-2">
            {filtered.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                selected={m.id === selectedId}
                onSelect={go}
              />
            ))}
          </ul>
        )}
      </nav>

      <div className="border-t border-tc-rule p-3">
        <button className="flex w-full items-center justify-center gap-2 rounded-tc-chip border border-dashed border-tc-rule-strong px-3 py-2 text-xs font-medium text-tc-ink-muted hover:border-tc-accent hover:text-tc-accent">
          <UserPlus className="h-3.5 w-3.5" /> Invite member
        </button>
      </div>
    </aside>
  );
}

function BroadcastRow() {
  return (
    <button
      disabled
      title="Broadcast lands in Phase 4"
      className="flex w-full items-center gap-3 border-b border-tc-rule px-4 py-3 text-left opacity-60"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tc-alert-soft text-tc-alert">
        <Megaphone className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-tc-ink">Broadcast</div>
        <div className="truncate text-[11px] text-tc-ink-muted">Bulk template dispatch</div>
      </div>
    </button>
  );
}

function MemberRow({
  member,
  selected,
  onSelect,
}: {
  member: Member;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <li>
      <button
        onClick={() => onSelect(member.id)}
        className={`flex w-full items-center gap-3 rounded-tc-card px-2 py-2 text-left transition-colors ${
          selected
            ? 'bg-tc-accent-soft'
            : 'hover:bg-tc-bg-card-2'
        }`}
      >
        <MemberAvatar name={member.name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`truncate text-sm ${selected ? 'font-semibold text-tc-ink' : 'text-tc-ink-2'}`}>
              {member.name}
            </span>
            <SessionWindowChip
              expiresAt={member.session_window_expires_at}
              active={member.session_active}
              hasWhatsapp={member.channels.includes('whatsapp')}
            />
          </div>
          <div className="truncate text-[11px] text-tc-ink-muted">
            {member.role_name ?? 'Member'}
            {member.channels.includes('whatsapp') && ' · WA'}
          </div>
        </div>
      </button>
    </li>
  );
}
