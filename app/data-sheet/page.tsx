'use client';

import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { ModelDirectoryPage } from '@/features/data-sheet';

export default function DataSheetPage() {
  return (
    <ProtectedShell>
      <ModuleGuard module="lms">
        <ModelDirectoryPage />
      </ModuleGuard>
    </ProtectedShell>
  );
}
