'use client';

import ModuleGuard from '@/components/module-guard';
import SystemBuilderSurface from '@/components/system-builder/SystemBuilderSurface';

export default function SystemBuilderPage() {
  return (
    <ModuleGuard module="lms">
      <SystemBuilderSurface />
    </ModuleGuard>
  );
}
