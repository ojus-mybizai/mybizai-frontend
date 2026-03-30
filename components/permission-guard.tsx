'use client';
// v2 - fixed permission guard with hydration safety
import { ReactNode, useEffect, useState } from 'react';
import ModuleGuard from '@/components/module-guard';
import { useAuthStore } from '@/lib/auth-store';

interface PermissionGuardProps {
  /** The permission key to check (e.g. 'manage_agents', 'manage_leads') */
  permission: string;
  /** Module gate — checks if the module is enabled for the business */
  module?: 'agents' | 'lms';
  /** Content to render when the user has permission */
  children: ReactNode;
}

function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-text-primary">Access Denied</h2>
        <p className="mt-1 text-sm text-text-secondary">
          You don&apos;t have permission to access this page.
        </p>
      </div>
    </div>
  );
}

export default function PermissionGuard({ permission, module, children }: PermissionGuardProps) {
  const [mounted, setMounted] = useState(false);
  const isOwner = useAuthStore((s) => s.isOwner);
  const permissionKeys = useAuthStore((s) => s.permissionKeys);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR or before hydration, render nothing to avoid flash of "Access Denied"
  if (!mounted) {
    return null;
  }

  // Owner always has full access
  if (isOwner) {
    if (module) {
      return <ModuleGuard module={module}>{children}</ModuleGuard>;
    }
    return <>{children}</>;
  }

  // Wait for auth store to finish loading before showing Access Denied
  if (!isInitialized || (accessToken && permissionKeys.length === 0)) {
    return null;
  }

  const allowed = Array.isArray(permissionKeys) && permissionKeys.includes(permission);
  const content = allowed ? children : <AccessDenied />;

  if (module) {
    return <ModuleGuard module={module}>{content}</ModuleGuard>;
  }

  return <>{content}</>;
}
