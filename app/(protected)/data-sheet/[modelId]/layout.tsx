'use client';

import { ReactNode } from 'react';
import { ModelLayout } from '@/features/data-sheet';

export default function DataSheetModelLayout({ children }: { children: ReactNode }) {
  return <ModelLayout>{children}</ModelLayout>;
}
