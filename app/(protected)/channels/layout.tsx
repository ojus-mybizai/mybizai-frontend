import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Channels' };

export default function ChannelsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
