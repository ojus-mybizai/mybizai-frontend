'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UsersRound } from 'lucide-react';
import { useMembers } from '@/hooks/use-members';
import { ConsoleSkeleton } from '@/components/tasks/shared/skeletons';

export default function TasksIndex() {
  const router = useRouter();
  const { data: members, isLoading } = useMembers();

  useEffect(() => {
    if (isLoading || !members) return;
    if (members.length > 0) {
      router.replace(`/tasks/${members[0].id}`);
    }
  }, [members, isLoading, router]);

  if (isLoading || (members && members.length > 0)) return <ConsoleSkeleton />;

  return (
    <div className="flex h-full flex-col items-center justify-center bg-tc-bg-ground p-12 text-center">
      <UsersRound className="mb-4 h-12 w-12 text-tc-ink-muted opacity-40" />
      <h1 className="font-serif text-xl font-semibold text-tc-ink">No members yet</h1>
      <p className="mt-2 max-w-sm text-sm text-tc-ink-muted">
        Invite your first team member to start assigning tasks and tracking work.
      </p>
    </div>
  );
}
