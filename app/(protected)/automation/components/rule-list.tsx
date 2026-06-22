'use client';

import { useState } from 'react';
import {
  Zap, Plus, Trash2, Edit, Power, Clock, AlertCircle, X,
  Filter, Bell, Briefcase, Database, MessageCircle,
  ChevronDown, ChevronRight, Eye, EyeOff,
} from 'lucide-react';
import {
  RULE_CATEGORIES,
  type AutomationRule,
  type EventOption,
  type ActionOption,
  type RuleCategory,
} from '@/services/automation';
import { humanizeTrigger, humanizeConditions, humanizeActions, OP_LABELS } from './types';
import { ToggleSwitch, formatDate } from './shared';

/* ─── Category icon map ──────────────────────────────────────────────────── */

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  notification: <Bell className="h-3.5 w-3.5" />,
  work: <Briefcase className="h-3.5 w-3.5" />,
  data: <Database className="h-3.5 w-3.5" />,
  schedule: <Clock className="h-3.5 w-3.5" />,
  communication: <MessageCircle className="h-3.5 w-3.5" />,
  general: <Zap className="h-3.5 w-3.5" />,
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* DELETE CONFIRMATION DIALOG                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

function DeleteDialog({
  ruleName,
  onConfirm,
  onCancel,
}: {
  ruleName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border-color bg-card-bg p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center h-10 w-10 rounded-full bg-red-500/10">
            <Trash2 className="h-5 w-5 text-red-400" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Delete Rule</h3>
            <p className="text-xs text-text-secondary mt-0.5">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-text-secondary mb-5">
          Are you sure you want to delete <span className="font-medium text-text-primary">&quot;{ruleName}&quot;</span>?
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
          >
            Delete Rule
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* EXPANDABLE RULE CARD                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

function RuleCard({
  rule,
  events,
  actionOptions,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: AutomationRule;
  events: EventOption[];
  actionOptions: ActionOption[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const actionDetails = humanizeActions(rule.actions, actionOptions);
  const catDef = RULE_CATEGORIES.find((c) => c.key === (rule.category || 'general'));

  return (
    <div className={`rounded-2xl border bg-card-bg transition-all ${
      expanded ? 'border-accent/20 shadow-md shadow-accent/5' : 'border-border-color hover:border-border-color/80'
    }`}>
      {/* Main row — always visible */}
      <div
        className="flex items-start gap-4 p-5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left: info */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2.5">
            <span className={`${catDef?.color || 'text-text-secondary'}`}>
              {CATEGORY_ICONS[rule.category || 'general'] || <Zap className="h-3.5 w-3.5" />}
            </span>
            <h3 className="text-sm font-semibold text-text-primary truncate">{rule.name}</h3>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
              rule.is_active ? 'bg-green-500/10 text-green-400' : 'bg-text-secondary/10 text-text-secondary'
            }`}>
              {rule.is_active ? 'Active' : 'Inactive'}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="ml-auto text-text-secondary/40 hover:text-text-secondary transition-colors"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {rule.description && (
            <p className="text-xs text-text-secondary pl-6">{rule.description}</p>
          )}

          {/* WHEN / IF / THEN summary — compact */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pl-6">
            <span>
              <span className="font-semibold text-accent">WHEN</span>{' '}
              <span className="text-text-secondary">{humanizeTrigger(rule.trigger, events)}</span>
            </span>
            <span>
              <span className="font-semibold text-yellow-400">IF</span>{' '}
              <span className="text-text-secondary">{humanizeConditions(rule.conditions)}</span>
            </span>
            <span>
              <span className="font-semibold text-green-400">THEN</span>{' '}
              <span className="text-text-secondary">
                {actionDetails.map((a) => a.label).join(', ') || 'None'}
              </span>
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-[11px] text-text-secondary pl-6">
            <span className="flex items-center gap-1">
              <Power className="h-3 w-3" />
              {rule.run_count} runs
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last: {formatDate(rule.last_run_at)}
            </span>
          </div>

          {rule.last_error && (
            <div className="flex items-center gap-1.5 text-[11px] text-red-400 pl-6">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span className="truncate">{rule.last_error}</span>
            </div>
          )}
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <ToggleSwitch
            checked={rule.is_active}
            onChange={onToggle}
            label={rule.is_active ? 'Deactivate rule' : 'Activate rule'}
          />
          <button
            type="button"
            onClick={onEdit}
            title="Edit rule"
            className="rounded-md p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete rule"
            className="rounded-md p-1.5 text-text-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded details — nested info */}
      {expanded && (
        <div className="border-t border-border-color px-5 pb-5 pt-4 space-y-0">
          {/* WHEN detail */}
          <div className="flex items-start gap-3 p-3 rounded-t-xl bg-accent/5 border border-accent/10">
            <span className="shrink-0 mt-0.5 flex items-center justify-center h-6 w-6 rounded-full bg-accent text-white text-[10px] font-bold">W</span>
            <div>
              <p className="text-xs font-semibold text-accent uppercase tracking-wider">When</p>
              <p className="text-sm text-text-primary mt-0.5">
                {humanizeTrigger(rule.trigger, events)}
              </p>
              {rule.trigger.filters && Object.keys(rule.trigger.filters).length > 0 && (
                <div className="mt-2 space-y-1">
                  {Object.entries(rule.trigger.filters).filter(([, v]) => v).map(([k, v]) => (
                    <p key={k} className="text-xs text-text-secondary">
                      <span className="text-text-secondary/60">Filter:</span>{' '}
                      {k} = <span className="text-text-primary font-medium">{String(v)}</span>
                    </p>
                  ))}
                </div>
              )}
              {rule.trigger.schedule && (
                <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                  <Clock className="h-3 w-3" />
                  <span>
                    {rule.trigger.schedule.type}
                    {rule.trigger.schedule.day ? ` on ${rule.trigger.schedule.day}` : ''}
                    {rule.trigger.schedule.time ? ` at ${rule.trigger.schedule.time}` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Connector */}
          <div className="flex justify-center">
            <div className="w-px h-3 bg-border-color" />
          </div>

          {/* IF detail */}
          <div className="flex items-start gap-3 p-3 bg-yellow-400/5 border-x border-yellow-400/10">
            <span className="shrink-0 mt-0.5 flex items-center justify-center h-6 w-6 rounded-full bg-yellow-400 text-white text-[10px] font-bold">I</span>
            <div>
              <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">If</p>
              {(!rule.conditions || rule.conditions.length === 0) ? (
                <p className="text-sm text-text-secondary mt-0.5 italic">Always (no conditions)</p>
              ) : (
                <div className="mt-1 space-y-1">
                  {rule.conditions.map((c, i) => {
                    const opLabel = (c.op && OP_LABELS[c.op]) || c.op || '?';
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-sm">
                        {i > 0 && <span className="text-[10px] font-bold text-yellow-400/50 uppercase">AND</span>}
                        <code className="text-accent text-xs">{c.field || '?'}</code>
                        <span className="text-text-secondary">{opLabel}</span>
                        {c.op !== 'is_empty' && (
                          <span className="text-text-primary font-medium">{String(c.value ?? '')}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Connector */}
          <div className="flex justify-center">
            <div className="w-px h-3 bg-border-color" />
          </div>

          {/* THEN detail — show full nested params */}
          <div className="p-3 rounded-b-xl bg-green-400/5 border border-green-400/10 space-y-2">
            <div className="flex items-start gap-3">
              <span className="shrink-0 mt-0.5 flex items-center justify-center h-6 w-6 rounded-full bg-green-400 text-white text-[10px] font-bold">T</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Then</p>
                {actionDetails.length === 0 ? (
                  <p className="text-sm text-text-secondary mt-0.5 italic">No actions</p>
                ) : (
                  actionDetails.map((a, i) => (
                    <div key={i} className="mt-2 rounded-lg bg-bg-primary/50 p-2.5 border border-border-color">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-green-400 bg-green-400/10 rounded-full px-1.5 py-0.5">
                          {i + 1}
                        </span>
                        <p className="text-sm font-medium text-text-primary">{a.label}</p>
                        {a.description && (
                          <p className="text-[10px] text-text-secondary/50 ml-auto hidden sm:block">{a.description}</p>
                        )}
                      </div>
                      {a.params.length > 0 && (
                        <div className="mt-1.5 pl-7 space-y-0.5">
                          {a.params.map((p) => (
                            <p key={p.key} className="text-xs text-text-secondary">
                              <span className="text-text-secondary/60">{p.key}:</span>{' '}
                              <span className="text-text-primary">{p.value}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MAIN RULE LIST                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function RuleList({
  rules,
  events,
  actionOptions,
  loading,
  error,
  onClearError,
  onNewRule,
  onEditRule,
  onToggleRule,
  onDeleteRule,
}: {
  rules: AutomationRule[];
  events: EventOption[];
  actionOptions: ActionOption[];
  loading: boolean;
  error: string | null;
  onClearError: () => void;
  onNewRule: () => void;
  onEditRule: (rule: AutomationRule) => void;
  onToggleRule: (id: number) => void;
  onDeleteRule: (id: number) => void;
}) {
  const [filterCategory, setFilterCategory] = useState<RuleCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);

  /* ── Filtered rules ────────────────────────────────────────────────── */
  const filteredRules = rules.filter((r) => {
    if (filterCategory !== 'all' && (r.category || 'general') !== filterCategory) return false;
    if (filterStatus === 'active' && !r.is_active) return false;
    if (filterStatus === 'inactive' && r.is_active) return false;
    return true;
  });

  /* ── Group by category ─────────────────────────────────────────────── */
  const grouped: Record<string, AutomationRule[]> = {};
  for (const rule of filteredRules) {
    const cat = rule.category || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(rule);
  }
  const categoryOrder = RULE_CATEGORIES.map((c) => c.key);
  const sortedGroups = Object.entries(grouped).sort(
    ([a], [b]) => categoryOrder.indexOf(a as RuleCategory) - categoryOrder.indexOf(b as RuleCategory)
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            Automation Rules
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Automate actions when events happen in your business
          </p>
        </div>
        <button
          type="button"
          onClick={onNewRule}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Rule
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={onClearError} className="shrink-0 text-red-400 hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-text-secondary text-sm">
          <span className="h-5 w-5 border-2 border-text-secondary/30 border-t-text-secondary rounded-full animate-spin mr-3" />
          Loading automation rules...
        </div>
      )}

      {/* Empty state */}
      {!loading && rules.length === 0 && (
        <div className="rounded-2xl border border-border-color bg-card-bg p-12 text-center">
          <Zap className="mx-auto h-10 w-10 text-text-secondary/40 mb-3" />
          <p className="text-text-secondary text-sm">
            No automation rules yet. Create your first rule to automate your business.
          </p>
          <button
            type="button"
            onClick={onNewRule}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create First Rule
          </button>
        </div>
      )}

      {/* Filters */}
      {!loading && rules.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-text-secondary" />

          {/* Category filters */}
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterCategory === 'all'
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
            }`}
          >
            All ({rules.length})
          </button>
          {RULE_CATEGORIES.map((cat) => {
            const count = rules.filter((r) => (r.category || 'general') === cat.key).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setFilterCategory(cat.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterCategory === cat.key
                    ? 'bg-accent text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}

          {/* Divider */}
          <div className="h-4 w-px bg-border-color mx-1" />

          {/* Status filters */}
          <button
            type="button"
            onClick={() => setFilterStatus(filterStatus === 'active' ? 'all' : 'active')}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterStatus === 'active'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
            }`}
          >
            <Eye className="h-3 w-3" />
            Active ({rules.filter((r) => r.is_active).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus(filterStatus === 'inactive' ? 'all' : 'inactive')}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterStatus === 'inactive'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
            }`}
          >
            <EyeOff className="h-3 w-3" />
            Inactive ({rules.filter((r) => !r.is_active).length})
          </button>
        </div>
      )}

      {/* Rules list — grouped by category */}
      {!loading && filteredRules.length > 0 && (
        <div className="space-y-6">
          {sortedGroups.map(([catKey, catRules]) => {
            const catDef = RULE_CATEGORIES.find((c) => c.key === catKey);
            const activeCount = catRules.filter((r) => r.is_active).length;
            return (
              <div key={catKey}>
                {filterCategory === 'all' && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`${catDef?.color || 'text-text-secondary'}`}>
                      {CATEGORY_ICONS[catKey] || <Zap className="h-3.5 w-3.5" />}
                    </span>
                    <span className={`text-sm font-semibold ${catDef?.color || 'text-text-secondary'}`}>
                      {catDef?.label || catKey}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {activeCount}/{catRules.length} active
                    </span>
                    <div className="flex-1 border-t border-border-color" />
                  </div>
                )}
                <div className="space-y-3">
                  {catRules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      events={events}
                      actionOptions={actionOptions}
                      onToggle={() => onToggleRule(rule.id)}
                      onEdit={() => onEditRule(rule)}
                      onDelete={() => setDeleteTarget(rule)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No results after filtering */}
      {!loading && rules.length > 0 && filteredRules.length === 0 && (
        <div className="rounded-2xl border border-border-color bg-card-bg p-8 text-center">
          <Filter className="mx-auto h-8 w-8 text-text-secondary/30 mb-2" />
          <p className="text-sm text-text-secondary">No rules match your filters</p>
          <button
            type="button"
            onClick={() => { setFilterCategory('all'); setFilterStatus('all'); }}
            className="mt-2 text-xs text-accent hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteDialog
          ruleName={deleteTarget.name}
          onConfirm={() => {
            onDeleteRule(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
