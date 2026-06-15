'use client';

import { X, LayoutList } from 'lucide-react';
import { FieldDefsTab } from '@/components/contacts-v2/group-routing-panel';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Manage business-wide (global) custom fields — i.e. fields that apply to
 * every contact regardless of group. Group-scoped fields are still managed
 * from each group's panel. Reuses the same FieldDefsTab CRUD UI with a null
 * group, which the backend treats as a global field.
 */
export function ManageFieldsModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border-color bg-card-bg shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-color flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
              <LayoutList className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Custom Fields</h2>
              <p className="text-[11px] text-text-secondary">Business-wide fields shown on every contact</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-bg-secondary text-text-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto">
          <FieldDefsTab groupId={null} groupName="your business" />
        </div>
      </div>
    </div>
  );
}
