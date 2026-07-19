'use client';

/**
 * Segments — saved audience filter library.
 *
 * Each segment is a named AudienceFilter that can be selected as the
 * audience for any campaign, instead of rebuilding filters from scratch.
 *
 * Features:
 *   - List all saved segments with cached contact count
 *   - Create new segment with full FilterBuilder + live preview count
 *   - Edit existing segment (name, description, filter)
 *   - Delete segment (with confirmation)
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Users, X, ChevronDown } from 'lucide-react';
import PermissionGuard from '@/components/permission-guard';
import { FilterBuilder } from '@/components/outbound/FilterBuilder';
import { RecipientPreview } from '@/components/outbound/RecipientPreview';
import {
  createSegment,
  updateSegment,
  deleteSegment,
  listSegments,
  previewAudience,
  type AudienceFilter,
  type Segment,
} from '@/services/outbound';

/* ── Empty filter ──────────────────────────────────────────────────────── */
const EMPTY_FILTER: AudienceFilter = {};

/* ── Segment form (shared for create + edit) ───────────────────────────── */
function SegmentForm({
  initial,
  onSave,
  onCancel,
  title,
}: {
  initial: { name: string; description: string; filter: AudienceFilter };
  onSave: (name: string, description: string, filter: AudienceFilter) => Promise<void>;
  onCancel: () => void;
  title: string;
}) {
  const [name,        setName]        = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [filter,      setFilter]      = useState<AudienceFilter>(initial.filter);
  const [preview,     setPreview]     = useState<number | null>(null);
  const [previewing,  setPreviewing]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const handlePreview = async () => {
    setPreviewing(true);
    setError('');
    try {
      const res = await previewAudience({ audience_type: 'ai_filter', filter });
      setPreview(res.count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(name.trim(), description.trim(), filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  };

  // Reset preview whenever filter changes
  const handleFilterChange = (next: AudienceFilter) => {
    setFilter(next);
    setPreview(null);
  };

  const hasFilter = Object.values(filter).some((v) =>
    Array.isArray(v) ? v.length > 0 : v != null,
  );

  return (
    <div className="border border-border-color rounded-xl bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center h-7 w-7 rounded-md text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Name + description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Segment name <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High-priority — silent 14d"
              className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-primary text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Description (optional)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this audience is for"
              className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-primary text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Filter builder */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">
            Filter criteria — who should be in this segment
          </p>
          <FilterBuilder value={filter} onChange={handleFilterChange} />
          {hasFilter && (
            <div className="mt-2">
              <RecipientPreview filter={filter} onChange={handleFilterChange} />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Footer: preview + save */}
        <div className="flex items-center justify-between pt-2 border-t border-border-color">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing || !hasFilter}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border-color rounded-lg text-text-secondary hover:bg-bg-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
            >
              <Users className="h-3.5 w-3.5" />
              {previewing ? 'Counting…' : 'Preview count'}
            </button>
            {preview !== null && (
              <span className="text-sm font-semibold text-accent">
                {preview.toLocaleString()} contact{preview !== 1 ? 's' : ''}
              </span>
            )}
            {!hasFilter && (
              <span className="text-xs text-text-secondary italic">
                Add at least one filter to preview
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm border border-border-color rounded-lg text-text-secondary hover:bg-bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-4 py-1.5 text-sm bg-accent text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Saving…' : 'Save segment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Filter summary (read-only display on list card) ───────────────────── */
function FilterSummaryBadges({ filter }: { filter: AudienceFilter }) {
  const parts: string[] = [];
  if ((filter.group_ids ?? []).length) parts.push(`${filter.group_ids!.length} group(s)`);
  if ((filter.tag_ids ?? []).length) parts.push(`${filter.tag_ids!.length} tag(s)`);
  if ((filter.source_channels ?? []).length) parts.push((filter.source_channels!).join(', '));
  if ((filter.priority ?? []).length) parts.push((filter.priority!).join(' / ') + ' priority');
  if (filter.last_messaged_within_days) parts.push(`active ≤${filter.last_messaged_within_days}d`);
  if (filter.not_messaged_within_days) parts.push(`silent ≥${filter.not_messaged_within_days}d`);
  if (filter.created_after) parts.push(`after ${filter.created_after}`);
  if (filter.created_before) parts.push(`before ${filter.created_before}`);
  if ((filter.pipeline_stage_ids ?? []).length) parts.push(`${filter.pipeline_stage_ids!.length} stage(s)`);
  if ((filter.exclude_pipeline_stage_ids ?? []).length) parts.push(`exclude ${filter.exclude_pipeline_stage_ids!.length} stage(s)`);
  if ((filter.assigned_to_ids ?? []).length || (filter.assigned_wa_employee_ids ?? []).length)
    parts.push(`${(filter.assigned_to_ids ?? []).length + (filter.assigned_wa_employee_ids ?? []).length} owner(s)`);
  if (filter.company_contains) parts.push(`company ~ ${filter.company_contains}`);
  if (filter.ad_platform) parts.push(`ad: ${filter.ad_platform}`);
  if ((filter.ad_campaign_names ?? []).length) parts.push(`${filter.ad_campaign_names!.length} campaign(s)`);
  if (filter.has_email) parts.push('has email');
  if (Object.keys(filter.custom_field_filters ?? {}).length)
    parts.push(`${Object.keys(filter.custom_field_filters!).length} custom field(s)`);

  if (parts.length === 0)
    return <span className="text-xs text-text-secondary italic">No filters set</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p, i) => (
        <span
          key={i}
          className="rounded-full bg-bg-secondary border border-border-color px-2 py-0.5 text-[11px] text-text-secondary"
        >
          {p}
        </span>
      ))}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function SegmentsPage() {
  const [segments,   setSegments]   = useState<Segment[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);

  // Edit form
  const [editId,     setEditId]     = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSegments(await listSegments());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load segments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (name: string, description: string, filter: AudienceFilter) => {
    await createSegment({ name, description: description || undefined, filter_config: filter });
    setShowCreate(false);
    await load();
  };

  const handleEdit = async (name: string, description: string, filter: AudienceFilter) => {
    if (!editId) return;
    await updateSegment(editId, { name, description: description || undefined, filter_config: filter });
    setEditId(null);
    await load();
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete segment "${name}"? Campaigns already using it are not affected.`)) return;
    try {
      await deleteSegment(id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const editingSegment = segments.find((s) => s.id === editId);

  return (
    <PermissionGuard permission="manage_channels">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div>
          <Link
            href="/outbound"
            className="text-xs text-text-secondary hover:text-accent transition-colors"
          >
            ← Back to Campaigns
          </Link>
          <div className="flex items-start justify-between mt-2 gap-4">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">Saved Segments</h1>
              <p className="text-sm text-text-secondary mt-0.5">
                Reusable audience filters — build once, use across any campaign.
              </p>
            </div>
            {!showCreate && !editId && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                New segment
              </button>
            )}
          </div>
        </div>

        {/* ── Global error ──────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* ── Create form ────────────────────────────────────────── */}
        {showCreate && (
          <SegmentForm
            title="New Segment"
            initial={{ name: '', description: '', filter: EMPTY_FILTER }}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {/* ── Edit form ──────────────────────────────────────────── */}
        {editId && editingSegment && (
          <SegmentForm
            title={`Edit — ${editingSegment.name}`}
            initial={{
              name: editingSegment.name,
              description: editingSegment.description ?? '',
              filter: (editingSegment.filter_config as AudienceFilter) ?? EMPTY_FILTER,
            }}
            onSave={handleEdit}
            onCancel={() => setEditId(null)}
          />
        )}

        {/* ── Segments list ─────────────────────────────────────── */}
        {loading ? (
          <div className="py-12 text-center text-sm text-text-secondary animate-pulse">
            Loading segments…
          </div>
        ) : segments.length === 0 && !showCreate ? (
          <div className="py-16 text-center border border-dashed border-border-color rounded-xl">
            <div className="text-3xl mb-3">🎯</div>
            <p className="text-sm font-medium text-text-primary">No segments yet</p>
            <p className="text-xs text-text-secondary mt-1 mb-4">
              Create a segment to save an audience filter and reuse it across campaigns.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Create your first segment
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {segments.map((seg) => (
              <div
                key={seg.id}
                className={`rounded-xl border bg-bg-primary transition-colors
                  ${editId === seg.id ? 'border-accent/40' : 'border-border-color hover:border-border-color/80'}`}
              >
                <div className="flex items-start gap-3 p-4">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text-primary">
                        {seg.name}
                      </span>
                      {seg.created_by_ai && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 rounded-full font-medium">
                          AI generated
                        </span>
                      )}
                      {seg.cached_count !== null && (
                        <span className="flex items-center gap-1 text-[11px] text-text-secondary">
                          <Users className="h-3 w-3" />
                          {seg.cached_count.toLocaleString()} contacts
                        </span>
                      )}
                    </div>
                    {seg.description && (
                      <p className="text-xs text-text-secondary">{seg.description}</p>
                    )}
                    <FilterSummaryBadges filter={(seg.filter_config as AudienceFilter) ?? {}} />
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditId(seg.id === editId ? null : seg.id)}
                      title="Edit segment"
                      className="flex items-center justify-center h-7 w-7 rounded-md text-text-secondary hover:bg-bg-secondary hover:text-accent transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(seg.id, seg.name)}
                      title="Delete segment"
                      className="flex items-center justify-center h-7 w-7 rounded-md text-text-secondary hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </PermissionGuard>
  );
}
