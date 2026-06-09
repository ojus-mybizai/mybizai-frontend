'use client';

import PermissionGuard from '@/components/permission-guard';
import RuleEditor from '../components/rule-editor';

export default function NewFollowupRulePage() {
  return (
    <PermissionGuard permission="manage_settings">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-text-primary">New follow-up rule</h1>
        <RuleEditor rule={null} />
      </div>
    </PermissionGuard>
  );
}
