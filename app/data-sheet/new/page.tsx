'use client';

import ProtectedShell from '@/components/protected-shell';
import ModuleGuard from '@/components/module-guard';
import { NewModelPage } from '@/features/data-sheet';

export default function NewModelPageRoute() {
  return (
    <ProtectedShell>
      <ModuleGuard module="lms">
        <NewModelPage />
      </ModuleGuard>
    </ProtectedShell>
  );
}
