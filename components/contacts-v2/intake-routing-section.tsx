'use client';

/**
 * Intake Routing Section
 *
 * Lets the owner override the hardcoded source_key → contact group mapping
 * used at intake time. Built-in defaults (Meta Leads, WhatsApp Inbound, ...)
 * are shown alongside the current override (if any). Selecting a different
 * group from the dropdown persists an override; "Reset" reverts to the
 * built-in default. Overrides affect NEW contacts only.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, RouteOff, Loader2, RotateCcw, Check, AlertTriangle,
} from 'lucide-react';
import {
  contactGroupService,
  type ContactGroup,
  type IntakeRoutingItem,
} from '@/services/contacts-v2';

interface Props {
  /** All groups available to pick as targets — passed in so we don't re-fetch. */
  allGroups: ContactGroup[];
  /** Optional callback fired after every successful override change. */
  onChange?: () => void;
}

export default function IntakeRoutingSection({ allGroups, onChange }: Props) {
  const [items, setItems] = useState<IntakeRoutingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await contactGroupService.listIntakeRouting();
      setItems(res.items ?? []);
    } catch (e) {
      setError((e as Error).message || 'Failed to load intake routing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const handlePick = useCallback(
    async (sourceKey: string, groupId: number) => {
      setPendingKey(sourceKey);
      setError(null);
      try {
        const next = await contactGroupService.setIntakeRouting(sourceKey, groupId);
        setItems((prev) => prev.map((it) => (it.source_key === sourceKey ? next : it)));
        onChange?.();
      } catch (e) {
        setError((e as Error).message || 'Failed to save');
      } finally {
        setPendingKey(null);
      }
    },
    [onChange],
  );

  const handleReset = useCallback(
    async (sourceKey: string) => {
      setPendingKey(sourceKey);
      setError(null);
      try {
        const next = await contactGroupService.clearIntakeRouting(sourceKey);
        setItems((prev) => prev.map((it) => (it.source_key === sourceKey ? next : it)));
        onChange?.();
      } catch (e) {
        setError((e as Error).message || 'Failed to reset');
      } finally {
        setPendingKey(null);
      }
    },
    [onChange],
  );

  const overrideCount = useMemo(
    () => items.filter((it) => it.override_group_id != null).length,
    [items],
  );

  return (
    <div className="border-b border-border-color bg-bg-secondary/30">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-bg-secondary/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-secondary" />
          )}
          <RouteOff className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-text-primary uppercase tracking-wide">
            Intake routing
          </span>
          <span className="text-[10px] text-text-secondary">
            ({items.length} sources · {overrideCount} customized)
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-3 space-y-2">
          <p className="text-[11px] text-text-secondary leading-relaxed">
            When a contact arrives, the system routes them to a group based on the
            source channel. Customize where each source lands.{' '}
            <span className="text-text-secondary/80">
              Affects new contacts only.
            </span>
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-6 text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-300">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.map((it) => {
                const isPending = pendingKey === it.source_key;
                const hasOverride = it.override_group_id != null;
                // Selected value in the dropdown: effective group id, or "" if neither default nor override exists yet (e.g. system group never auto-created).
                const selectedValue = it.effective_group_id ? String(it.effective_group_id) : '';
                return (
                  <div
                    key={it.source_key}
                    className="flex items-center gap-2 rounded-lg border border-border-color bg-card-bg px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-text-primary">
                          {it.source_label}
                        </span>
                        {hasOverride && (
                          <span
                            className="rounded-full bg-indigo-100 px-1.5 py-px text-[9px] font-semibold uppercase text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200"
                            title={`Default: ${it.default_group_name ?? '—'}`}
                          >
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[10px] text-text-secondary/80">
                        {it.source_description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <select
                        value={selectedValue}
                        disabled={isPending}
                        onChange={(e) => {
                          const gid = Number(e.target.value);
                          if (Number.isFinite(gid) && gid > 0) {
                            void handlePick(it.source_key, gid);
                          }
                        }}
                        className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-[11px] text-text-primary focus:border-accent focus:outline-none disabled:opacity-60 max-w-[180px]"
                      >
                        {/* Show default first, then all other groups in the business */}
                        {!selectedValue && (
                          <option value="">— Not created yet —</option>
                        )}
                        {it.default_group_id && (
                          <option value={String(it.default_group_id)}>
                            {it.default_group_name} (default)
                          </option>
                        )}
                        {allGroups
                          .filter((g) => g.id !== it.default_group_id)
                          .map((g) => (
                            <option key={g.id} value={String(g.id)}>
                              {g.name}
                            </option>
                          ))}
                      </select>

                      {hasOverride && (
                        <button
                          type="button"
                          onClick={() => void handleReset(it.source_key)}
                          disabled={isPending}
                          className="rounded-md border border-border-color bg-bg-primary p-1 text-text-secondary transition hover:text-text-primary disabled:opacity-50"
                          title="Reset to default"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                      {isPending && (
                        <Loader2 className="w-3 h-3 animate-spin text-text-secondary" />
                      )}
                      {!isPending && hasOverride && (
                        <Check className="w-3 h-3 text-emerald-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
