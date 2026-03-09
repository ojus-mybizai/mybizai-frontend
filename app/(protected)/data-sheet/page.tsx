'use client';

import ModuleGuard from '@/components/module-guard';
import { ModelDirectoryPage } from '@/features/data-sheet';

export default function DataSheetPage() {
  return (
    <ModuleGuard module="lms">
      <ModelDirectoryPage />
    </ModuleGuard>
  );
}
