'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ModuleGuard from '@/components/module-guard';
import { useDesignerStore } from '@/lib/datasheet-designer-store';
import DesignerChat from '@/features/data-sheet/components/designer/DesignerChat';
import SchemaCanvas from '@/features/data-sheet/components/designer/SchemaCanvas';

export default function DatasheetDesignerPage() {
  const reset = useDesignerStore((s) => s.reset);
  const loadContext = useDesignerStore((s) => s.loadContext);

  // Fresh design each time the page is opened; load business context (contacts +
  // existing datasheets) so the canvas can show what new sheets connect to.
  useEffect(() => {
    reset();
    void loadContext();
    return () => reset();
  }, [reset, loadContext]);

  return (
    <ModuleGuard module="lms">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Link
          href="/data-sheet"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to data sheets
        </Link>

        <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border-color bg-bg-primary">
          <div className="w-[300px] shrink-0 md:w-[360px]">
            <DesignerChat />
          </div>
          <div className="min-w-0 flex-1">
            <SchemaCanvas />
          </div>
        </div>
      </div>
    </ModuleGuard>
  );
}
