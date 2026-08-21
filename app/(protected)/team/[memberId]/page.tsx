/**
 * /team/[memberId] — Per-member console (chat / tasks / activity).
 *
 * Same TaskConsole component as the legacy /tasks/[memberId]; both routes
 * render it while the /tasks redirects settle. TaskConsole itself still
 * pushes to /tasks/... on member click — we override to /team/... in a
 * follow-up once the redirect direction is verified end-to-end.
 */
import { TaskConsole } from '@/components/tasks/task-console';

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const parsed = Number(memberId);
  const id = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  return <TaskConsole memberId={id} />;
}
