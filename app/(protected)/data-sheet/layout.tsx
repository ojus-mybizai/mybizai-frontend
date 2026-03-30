import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Data Sheets' };

export default function DataSheetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
