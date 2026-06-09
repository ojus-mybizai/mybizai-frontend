'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PermissionGuard from '@/components/permission-guard';
import RuleEditor from '../components/rule-editor';
import { listFollowupRules, type FollowUpRule } from '@/services/followups';

export default function EditFollowupRulePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = parseInt(params?.id ?? '');

  const [rule, setRule] = useState<FollowUpRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    listFollowupRules()
      .then((rules) => {
        const found = rules.find((r) => r.id === id) || null;
        if (!found) {
          setError('Rule not found');
        } else {
          setRule(found);
        }
      })
      .catch((e) => setError(e?.message || 'Failed to load rule'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg bg-bg-secondary" />;
  }
  if (error) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
        <button
          onClick={() => router.push('/automation/followups')}
          className="text-sm text-accent hover:underline"
        >
          ← Back to rules
        </button>
      </div>
    );
  }

  return (
    <PermissionGuard permission="manage_settings">
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-bold text-text-primary">Edit: {rule?.name}</h1>
          <Link
            href={`/automation/followups/${id}/messages`}
            className="text-sm text-accent hover:underline"
          >
            View audit log →
          </Link>
        </div>
        <RuleEditor rule={rule} />
      </div>
    </PermissionGuard>
  );
}
