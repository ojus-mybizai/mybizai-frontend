import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Processes' };

export default function ProcessesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
