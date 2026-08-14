'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useMembers } from '@/hooks/use-members';
import { taskKeys } from '@/lib/tasks/keys';
import { MemberList } from './member-list';
import { MemberPane } from './member-pane';
import { TaskDrawer } from './task-drawer';
import { ConsoleSkeleton } from './shared/skeletons';

export function TaskConsole({ memberId }: { memberId: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { data: members, isLoading } = useMembers();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      e.preventDefault();
      const order = ['chat', 'tasks', 'activity'] as const;
      const cur = (searchParams?.get('tab') as (typeof order)[number]) || 'tasks';
      const next = order[(order.indexOf(cur) + (e.shiftKey ? -1 : 1) + order.length) % order.length];
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('tab', next);
      router.replace(`/tasks/${memberId}?${params.toString()}`, { scroll: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [memberId, router, searchParams]);

  const drawerTaskId = (() => {
    const raw = searchParams?.get('task');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();

  const active = members?.find((m) => m.id === memberId) ?? null;

  useEffect(() => {
    if (!isLoading && members && members.length > 0 && !active) {
      router.replace(`/tasks/${members[0].id}`);
    }
  }, [isLoading, members, active, router]);

  const closeDrawer = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('task');
    const qs = params.toString();
    router.replace(`/tasks/${memberId}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  if (isLoading) return <ConsoleSkeleton />;

  return (
    <div className="grid h-full grid-cols-[260px_1fr] max-md:grid-cols-1 max-md:[&>aside]:hidden bg-tc-bg-ground">
      <MemberList selectedId={memberId} />
      {active ? (
        <MemberPane member={active} />
      ) : (
        <div className="flex h-full items-center justify-center bg-tc-bg-ground p-12 text-center text-tc-ink-muted">
          <div>
            <p className="font-serif text-lg text-tc-ink-2">No members yet</p>
            <p className="mt-1 text-xs">
              Invite someone from the sidebar to get started.
            </p>
          </div>
        </div>
      )}

      {drawerTaskId != null && (
        <TaskDrawer
          taskId={drawerTaskId}
          onClose={closeDrawer}
          onTaskUpdated={() => qc.invalidateQueries({ queryKey: taskKeys.member(memberId) })}
        />
      )}
    </div>
  );
}
