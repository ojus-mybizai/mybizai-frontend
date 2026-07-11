import { Suspense } from 'react';
import ModuleGuard from '@/components/module-guard';
import MemoryClient from './memory-client';

export default function MemoryPage() {
  return (
    <ModuleGuard module="chat_agent">
      <Suspense fallback={<div className="p-6 text-sm text-text-secondary">Loading…</div>}>
        <MemoryClient />
      </Suspense>
    </ModuleGuard>
  );
}
