'use client';

import ModuleGuard from '@/components/module-guard';

export default function DeployPage() {
  return (
    <ModuleGuard module="agents">
      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">Deploy</h2>
          <p className="text-sm text-text-secondary mt-1">
            Deployment settings will be available here.
          </p>
        </div>
      </div>
    </ModuleGuard>
  );
}
