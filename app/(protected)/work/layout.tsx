import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Work & Tasks' };

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
