'use client';

/**
 * /team — index. Sends the caller to the console for their first member so
 * the empty landing is never shown to a business that actually has a team.
 * Mirrors the old /tasks behaviour but hops within the /team namespace so
 * URLs stay consistent (Slice 4).
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UsersRound, UserPlus } from 'lucide-react';
import { useMembers } from '@/hooks/use-members';
import { ConsoleSkeleton } from '@/components/tasks/shared/skeletons';

export default function TeamIndex() {
  const router = useRouter();
  const { data: members, isLoading } = useMembers();

  useEffect(() => {
    if (isLoading || !members) return;
    if (members.length > 0) {
      router.replace(`/team/${members[0].id}`);
    }
  }, [members, isLoading, router]);

  if (isLoading || (members && members.length > 0)) return <ConsoleSkeleton />;

  return (
    <div className="flex h-full flex-col items-center justify-center bg-tc-bg-ground p-12 text-center">
      <UsersRound className="mb-4 h-12 w-12 text-tc-ink-muted opacity-40" />
      <h1 className="font-serif text-xl font-semibold text-tc-ink">No team members yet</h1>
      <p className="mt-2 max-w-sm text-sm text-tc-ink-muted">
        Invite your first team member to start assigning tasks, tracking check-ins, and chatting on
        WhatsApp.
      </p>
      <Link
        href="/team/members"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-tc-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        <UserPlus className="h-4 w-4" /> Invite a member
      </Link>
    </div>
  );
}
