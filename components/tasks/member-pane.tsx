'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, ListChecks, Activity, FilePlus2 } from 'lucide-react';
import type { Member } from '@/services/members';
import { useMemberTasks, useCompleteTask } from '@/hooks/use-tasks';
import { MemberAvatar } from './shared/member-avatar';
import { SessionWindowChip } from './shared/session-window-chip';
import { ChatStream } from './chat-stream';
import { TaskList } from './task-list';
import { Composer } from './composer';
import { ActivityFeed } from './activity-feed';

type Tab = 'chat' | 'tasks' | 'activity';

export function MemberPane({ member }: { member: Member }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const base = pathname?.startsWith('/team') ? '/team' : '/tasks';
  const tab = (searchParams?.get('tab') as Tab) || 'tasks';

  const { data: tasks = [], isLoading } = useMemberTasks(member.id);
  const complete = useCompleteTask(member.id);

  const openCount = useMemo(
    () => tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length,
    [tasks],
  );

  const setTab = (t: Tab) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', t);
    router.replace(`${base}/${member.id}?${params.toString()}`, { scroll: false });
  };

  const openDrawer = (id: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('task', String(id));
    router.push(`${base}/${member.id}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex h-full flex-col bg-tc-bg-ground">
      {/* Head */}
      <header className="flex items-center gap-3 border-b border-tc-rule bg-tc-bg-card px-4 py-3">
        <MemberAvatar name={member.name} size={40} showPresence={member.channels.includes('whatsapp')} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-lg font-semibold tracking-tight text-tc-ink">
            {member.name}
          </h1>
          <div className="flex items-center gap-2 text-xs text-tc-ink-muted">
            <span>{member.role_name ?? 'Member'}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">
              {openCount} open task{openCount === 1 ? '' : 's'}
            </span>
            {member.channels.includes('whatsapp') && (
              <>
                <span aria-hidden>·</span>
                <SessionWindowChip
                  expiresAt={member.session_window_expires_at}
                  active={member.session_active}
                  hasWhatsapp
                  size="md"
                  showIcon
                />
              </>
            )}
          </div>
        </div>
        <Link
          href="/team/templates/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-tc-chip border border-tc-rule-strong bg-tc-bg-ground px-3 py-1.5 text-xs font-medium text-tc-ink hover:border-tc-accent hover:text-tc-accent"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          New task template
        </Link>
      </header>

      {/* Tabs */}
      <nav
        role="tablist"
        aria-label="Member views"
        className="flex border-b border-tc-rule bg-tc-bg-card px-2"
      >
        <TabButton active={tab === 'chat'} onClick={() => setTab('chat')} icon={MessageSquare} label="Chat" />
        <TabButton
          active={tab === 'tasks'}
          onClick={() => setTab('tasks')}
          icon={ListChecks}
          label="Tasks"
          badge={openCount || undefined}
        />
        <TabButton active={tab === 'activity'} onClick={() => setTab('activity')} icon={Activity} label="Activity" />
      </nav>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'chat' && <ChatStream memberId={member.id} memberName={member.name} />}
        {tab === 'tasks' && (
          <TaskList
            tasks={tasks}
            loading={isLoading}
            memberName={member.name}
            onOpen={openDrawer}
            onComplete={(id) => complete.mutate(id)}
          />
        )}
        {tab === 'activity' && <ActivityFeed memberId={member.id} memberName={member.name} />}
      </div>

      {/* Composer — hidden on activity tab (nothing to send there) */}
      {tab !== 'activity' && <Composer memberId={member.id} memberName={member.name} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MessageSquare;
  label: string;
  badge?: number;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
        active
          ? 'border-tc-accent text-tc-accent'
          : 'border-transparent text-tc-ink-muted hover:text-tc-ink-2'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-0.5 rounded-full bg-tc-bg-card-2 px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal text-tc-ink-2">
          {badge}
        </span>
      )}
    </button>
  );
}

