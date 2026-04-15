import { redirect } from 'next/navigation';

export default function LiteAgentRedirect({ params }: { params: { agentId: string } }) {
  redirect(`/lite-agents/${params.agentId}/overview`);
}
