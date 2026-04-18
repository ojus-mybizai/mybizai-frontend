'use client';

/**
 * Visual no-code filter builder for outbound audience targeting.
 *
 * Renders a simple form that lets the user configure an AudienceFilter —
 * pipeline stages, priority, last/not-messaged windows, tags, etc. Emits
 * changes through onChange. The same shape feeds saved Segments and the AI
 * audience builder (Phase 4), so both paths converge on one filter schema.
 */

import { useEffect, useState } from 'react';
import type { AudienceFilter } from '@/services/outbound';
import { apiFetch } from '@/lib/api-client';

interface Props {
  value: AudienceFilter;
  onChange: (next: AudienceFilter) => void;
}

// Pipeline stage shape from /leads/pipeline-stages
interface PipelineStage {
  id: number;
  name: string;
  stage_type?: string;
}

const PRIORITY_CHOICES = ['high', 'medium', 'low'];

export function FilterBuilder({ value, onChange }: Props) {
  const [stages, setStages] = useState<PipelineStage[]>([]);

  // Load pipeline stages for the multiselect. Silent-fail: if the endpoint
  // changes or returns nothing, the builder still works with empty stage list.
  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<PipelineStage[]>('/leads/pipeline-stages', { method: 'GET' });
        setStages(Array.isArray(data) ? data : []);
      } catch {
        setStages([]);
      }
    })();
  }, []);

  const update = (patch: Partial<AudienceFilter>) => {
    onChange({ ...value, ...patch });
  };

  const toggleInArray = <T,>(arr: T[] | undefined, item: T): T[] => {
    const set = new Set(arr ?? []);
    if (set.has(item)) set.delete(item);
    else set.add(item);
    return Array.from(set);
  };

  return (
    <div className="space-y-4">
      {/* Pipeline stages */}
      {stages.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1">Pipeline Stage</label>
          <div className="flex flex-wrap gap-1.5">
            {stages.map((s) => {
              const selected = (value.pipeline_stage_ids ?? []).includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    update({
                      pipeline_stage_ids: toggleInArray(value.pipeline_stage_ids, s.id),
                    })
                  }
                  className={`px-3 py-1 rounded-full text-xs border transition ${
                    selected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Exclude stages */}
      {stages.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Exclude Stage(s){' '}
            <span className="text-xs text-gray-500">(e.g. exclude already-won)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {stages.map((s) => {
              const selected = (value.exclude_pipeline_stage_ids ?? []).includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    update({
                      exclude_pipeline_stage_ids: toggleInArray(
                        value.exclude_pipeline_stage_ids,
                        s.id,
                      ),
                    })
                  }
                  className={`px-3 py-1 rounded-full text-xs border transition ${
                    selected
                      ? 'bg-red-500/10 text-red-600 border-red-400'
                      : 'border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium mb-1">Priority</label>
        <div className="flex gap-1.5">
          {PRIORITY_CHOICES.map((p) => {
            const selected = (value.priority ?? []).includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => update({ priority: toggleInArray(value.priority, p) })}
                className={`px-3 py-1 rounded-full text-xs border capitalize ${
                  selected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-gray-300 dark:border-neutral-700'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* Messaged recency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            Last messaged within (days)
          </label>
          <input
            type="number"
            min={0}
            value={value.last_messaged_within_days ?? ''}
            onChange={(e) =>
              update({
                last_messaged_within_days: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
            placeholder="Any"
            className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Not messaged for (days)
          </label>
          <input
            type="number"
            min={0}
            value={value.not_messaged_within_days ?? ''}
            onChange={(e) =>
              update({
                not_messaged_within_days: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
            placeholder="Any"
            className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Tags <span className="text-xs text-gray-500">(comma-separated)</span>
        </label>
        <input
          type="text"
          value={(value.tags ?? []).join(', ')}
          onChange={(e) =>
            update({
              tags: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          placeholder="vip, repeat-customer"
          className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
        />
      </div>

      {/* Semantic query */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Natural language filter{' '}
          <span className="text-xs text-gray-500">
            (matches against conversation summaries & notes — Phase 4 AI)
          </span>
        </label>
        <input
          type="text"
          value={value.semantic_query ?? ''}
          onChange={(e) => update({ semantic_query: e.target.value || undefined })}
          placeholder="asked about pricing but didn't convert"
          className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
        />
      </div>
    </div>
  );
}
