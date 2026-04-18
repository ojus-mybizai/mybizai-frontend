'use client';

/**
 * Segments manager — list, create, preview-count, delete saved audiences.
 *
 * Saved segments are reusable across campaigns: once a business defines
 * "Mumbai high-priority leads not messaged for 14 days", they can drop that
 * segment into any number of campaigns without rebuilding the filter.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PermissionGuard from '@/components/permission-guard';
import { FilterBuilder } from '@/components/outbound/FilterBuilder';
import {
  createSegment,
  deleteSegment,
  listSegments,
  previewAudience,
  type AudienceFilter,
  type Segment,
} from '@/services/outbound';

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // New segment form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [filter, setFilter] = useState<AudienceFilter>({});
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listSegments();
      setSegments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load segments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePreview = async () => {
    setPreviewing(true);
    setError(null);
    try {
      const res = await previewAudience({ audience_type: 'ai_filter', filter });
      setPreviewCount(res.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createSegment({ name, description: description || undefined, filter_config: filter });
      setShowNew(false);
      setName('');
      setDescription('');
      setFilter({});
      setPreviewCount(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this segment? Campaigns using it will not be affected retroactively.'))
      return;
    try {
      await deleteSegment(id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <PermissionGuard permission="manage_channels">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <Link href="/outbound" className="text-sm text-gray-500 hover:text-primary">
            ← Back to Outbound Hub
          </Link>
          <div className="flex items-center justify-between mt-2">
            <div>
              <h1 className="text-2xl font-semibold">Saved Segments</h1>
              <p className="text-sm text-gray-500 mt-1">
                Reusable audience filters for campaigns.
              </p>
            </div>
            <button
              onClick={() => setShowNew((v) => !v)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium"
            >
              {showNew ? 'Cancel' : '+ New Segment'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {showNew && (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6 space-y-4">
            <h2 className="font-semibold">New Segment</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. High-priority Mumbai leads"
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description (optional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
              />
            </div>

            <div className="border-t border-gray-200 dark:border-neutral-800 pt-4">
              <h3 className="text-sm font-medium mb-3">Filter Criteria</h3>
              <FilterBuilder value={filter} onChange={setFilter} />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewing}
                className="px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md text-sm"
              >
                {previewing ? 'Checking…' : '🔍 Preview Count'}
              </button>
              {previewCount !== null && (
                <span className="text-sm">
                  Matches: <span className="font-bold">{previewCount}</span> lead
                  {previewCount !== 1 ? 's' : ''}
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Segment'}
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading…</div>
          ) : segments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No saved segments yet. Create one to reuse across campaigns.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-neutral-800">
              {segments.map((s) => (
                <li key={s.id} className="p-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      {s.created_by_ai && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                          🤖 AI
                        </span>
                      )}
                      {s.cached_count !== null && (
                        <span className="text-xs text-gray-500">
                          · {s.cached_count} leads
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{s.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
}
