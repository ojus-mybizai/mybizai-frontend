import { TaskConsole } from '@/components/tasks/task-console';

export default async function MemberConsolePage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const parsed = Number(memberId);
  const id = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  return <TaskConsole memberId={id} />;
}
