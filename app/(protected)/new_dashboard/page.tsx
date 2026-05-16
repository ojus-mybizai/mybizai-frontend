'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Plus, Check, GripVertical,
  TrendingUp, TrendingDown, Users, MessageSquare, Clock, BarChart3,
  X, ArrowUpRight, Zap, Database, LayoutGrid,
  UsersRound, Send,
  Wallet, Bot, Activity, Megaphone, Mail, Phone, ListChecks, Radio, Tag,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { apiFetch } from '@/lib/api-client';
import { useDateRangeStore } from '@/lib/stores/date-range-store';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { TrendCard, TimeSeriesCard, GaugeCard, FunnelCard, TableCard } from './components/AdvancedWidgets';
import { LayoutSwitcher, type Layout } from './components/LayoutSwitcher';
import { useDashboardStream } from './hooks/useDashboardStream';

// ── Recharts donut (single lazy bundle — keeps Recharts component identity intact) ─
const DonutChart = dynamic(() => import('./donut-chart'), {
  ssr: false,
  loading: () => <div className="w-full h-full rounded-full bg-bg-secondary animate-pulse" />,
});

// ── Types ────────────────────────────────────────────────────────────────────

interface WidgetMeta {
  id: number;
  title: string;
  source_type: string;
  display_type: string;
  size: string;
  sort_order: number;
}

interface WidgetDataItem {
  label: string;
  count: number;
  color?: string;
  href?: string;
  subtitle?: string;
}

interface SeriesPoint { date: string; value: number; }

interface WidgetData {
  widget_id: number;
  title: string;
  source_type: string;
  display_type: string;
  value?: number;
  href?: string;
  prev_value?: number | null;
  delta_pct?: number | null;
  items?: WidgetDataItem[];
  series?: SeriesPoint[];
  series_label?: string;
  target?: number;
  unit?: string;
}

interface WidgetOption {
  source_type: string;
  display_type: string;
  default_title: string;
  description: string;
  size: string;
  source_id?: number;
  source_name?: string;
  field_id?: number;       // field-based widgets (breakdown / number / count_date)
  aggregation?: string;    // "total"|"recent"|"group_by"|"sum"|"avg"|"this_week"|"this_month"
}

// ── API helpers ──────────────────────────────────────────────────────────────

const fetchWidgets = (layoutId?: number | null) => {
  const qs = layoutId ? `?layout_id=${layoutId}` : '';
  return apiFetch<WidgetMeta[]>(`/widgets${qs}`);
};

const fetchAllData = async (startDate?: string, endDate?: string, layoutId?: number | null) => {
  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate)   params.set('end_date',   endDate);
  if (layoutId)  params.set('layout_id',  String(layoutId));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return (await apiFetch<{ widgets: WidgetData[] }>(`/widgets/data${qs}`)).widgets;
};

const fetchLayouts = () => apiFetch<Layout[]>('/widgets/layouts');

const fetchOptions = async () => (await apiFetch<{ options: WidgetOption[] }>('/widgets/options')).options;

const deleteWidget   = (id: number) => apiFetch<void>(`/widgets/${id}`, { method: 'DELETE' });
const reorderWidgets = (ids: number[]) =>
  apiFetch<void>('/widgets/reorder', { method: 'PATCH', body: JSON.stringify({ ordered_ids: ids }) });

async function createWidget(payload: {
  title: string; source_type: string; display_type: string;
  size: string; source_id?: number; field_id?: number; aggregation?: string;
}): Promise<WidgetMeta> {
  return apiFetch<WidgetMeta>('/widgets', {
    method: 'POST',
    body: JSON.stringify({ ...payload, sort_order: 999 }),
  });
}

// ── Per-source icon + color config ───────────────────────────────────────────

const SOURCE_CONFIG: Record<string, { icon: React.ElementType; bg: string; icon_color: string }> = {
  leads_today:            { icon: TrendingUp,    bg: 'bg-orange-100 dark:bg-orange-500/15',   icon_color: 'text-orange-500'  },
  leads_total:            { icon: Users,         bg: 'bg-blue-100 dark:bg-blue-500/15',       icon_color: 'text-blue-500'    },
  conversations_unread:   { icon: MessageSquare, bg: 'bg-emerald-100 dark:bg-emerald-500/15', icon_color: 'text-emerald-500' },
  conversations_today:    { icon: MessageSquare, bg: 'bg-teal-100 dark:bg-teal-500/15',       icon_color: 'text-teal-500'    },
  followups_due:          { icon: Clock,         bg: 'bg-violet-100 dark:bg-violet-500/15',   icon_color: 'text-violet-500'  },
  leads_by_stage:         { icon: BarChart3,     bg: 'bg-blue-100 dark:bg-blue-500/15',       icon_color: 'text-blue-500'    },
  leads_by_source:        { icon: Zap,           bg: 'bg-amber-100 dark:bg-amber-500/15',     icon_color: 'text-amber-500'   },
  recent_leads:           { icon: Users,         bg: 'bg-sky-100 dark:bg-sky-500/15',         icon_color: 'text-sky-500'     },
  recent_conversations:   { icon: MessageSquare, bg: 'bg-green-100 dark:bg-green-500/15',     icon_color: 'text-green-500'   },
  // datasheet family — all share the indigo palette
  datasheet_count:        { icon: Database,      bg: 'bg-indigo-100 dark:bg-indigo-500/15',   icon_color: 'text-indigo-500'  },
  datasheet_recent:       { icon: Database,      bg: 'bg-indigo-100 dark:bg-indigo-500/15',   icon_color: 'text-indigo-500'  },
  datasheet_breakdown:    { icon: BarChart3,     bg: 'bg-violet-100 dark:bg-violet-500/15',   icon_color: 'text-violet-500'  },
  datasheet_count_date:   { icon: Clock,         bg: 'bg-sky-100 dark:bg-sky-500/15',         icon_color: 'text-sky-500'     },
  datasheet_number:       { icon: TrendingUp,    bg: 'bg-amber-100 dark:bg-amber-500/15',     icon_color: 'text-amber-500'   },
  wallet_balance:         { icon: Wallet,        bg: 'bg-green-100 dark:bg-green-500/15',     icon_color: 'text-green-500'   },
  wallet_spend:           { icon: Wallet,        bg: 'bg-rose-100 dark:bg-rose-500/15',       icon_color: 'text-rose-500'    },
  agents_active:          { icon: Bot,           bg: 'bg-purple-100 dark:bg-purple-500/15',   icon_color: 'text-purple-500'  },
  recent_activity:        { icon: Activity,      bg: 'bg-cyan-100 dark:bg-cyan-500/15',       icon_color: 'text-cyan-500'    },
  // P4 sources
  agents_runs_today:      { icon: Bot,           bg: 'bg-purple-100 dark:bg-purple-500/15',   icon_color: 'text-purple-500'  },
  agents_by_status:       { icon: Bot,           bg: 'bg-purple-100 dark:bg-purple-500/15',   icon_color: 'text-purple-500'  },
  ai_vs_manual_split:     { icon: MessageSquare, bg: 'bg-purple-100 dark:bg-purple-500/15',   icon_color: 'text-purple-500'  },
  campaigns_active:       { icon: Megaphone,     bg: 'bg-pink-100 dark:bg-pink-500/15',       icon_color: 'text-pink-500'    },
  campaigns_sent:         { icon: Send,          bg: 'bg-pink-100 dark:bg-pink-500/15',       icon_color: 'text-pink-500'    },
  campaigns_delivery_rate:{ icon: Megaphone,     bg: 'bg-pink-100 dark:bg-pink-500/15',       icon_color: 'text-pink-500'    },
  campaigns_by_status:    { icon: Megaphone,     bg: 'bg-pink-100 dark:bg-pink-500/15',       icon_color: 'text-pink-500'    },
  nurture_active:         { icon: Mail,          bg: 'bg-fuchsia-100 dark:bg-fuchsia-500/15', icon_color: 'text-fuchsia-500' },
  nurture_completion_rate:{ icon: Mail,          bg: 'bg-fuchsia-100 dark:bg-fuchsia-500/15', icon_color: 'text-fuchsia-500' },
  messages_by_channel:    { icon: Radio,         bg: 'bg-teal-100 dark:bg-teal-500/15',       icon_color: 'text-teal-500'    },
  unknown_senders:        { icon: MessageSquare, bg: 'bg-orange-100 dark:bg-orange-500/15',   icon_color: 'text-orange-500'  },
  work_by_status:         { icon: ListChecks,    bg: 'bg-blue-100 dark:bg-blue-500/15',       icon_color: 'text-blue-500'    },
  work_overdue:           { icon: Clock,         bg: 'bg-red-100 dark:bg-red-500/15',         icon_color: 'text-red-500'     },
  work_by_priority:       { icon: ListChecks,    bg: 'bg-amber-100 dark:bg-amber-500/15',     icon_color: 'text-amber-500'   },
  calls_total:            { icon: Phone,         bg: 'bg-green-100 dark:bg-green-500/15',     icon_color: 'text-green-500'   },
  calls_missed:           { icon: Phone,         bg: 'bg-red-100 dark:bg-red-500/15',         icon_color: 'text-red-500'     },
  leads_by_meta_campaign: { icon: Zap,           bg: 'bg-blue-100 dark:bg-blue-500/15',       icon_color: 'text-blue-500'    },
  leads_timeseries:       { icon: TrendingUp,    bg: 'bg-sky-100 dark:bg-sky-500/15',         icon_color: 'text-sky-500'     },
  contacts_total:         { icon: Users,         bg: 'bg-blue-100 dark:bg-blue-500/15',       icon_color: 'text-blue-500'    },
  contacts_by_tag:        { icon: Tag,           bg: 'bg-violet-100 dark:bg-violet-500/15',   icon_color: 'text-violet-500'  },
  contacts_by_group:      { icon: UsersRound,    bg: 'bg-indigo-100 dark:bg-indigo-500/15',   icon_color: 'text-indigo-500'  },
  // Team Pulse / Channels / Insights replacements
  team_active_employees:  { icon: UsersRound,    bg: 'bg-green-100 dark:bg-green-500/15',     icon_color: 'text-green-500'   },
  team_attendance:        { icon: UsersRound,    bg: 'bg-blue-100 dark:bg-blue-500/15',       icon_color: 'text-blue-500'    },
  team_live_tasks:        { icon: ListChecks,    bg: 'bg-orange-100 dark:bg-orange-500/15',   icon_color: 'text-orange-500'  },
  team_completion_rate:   { icon: ListChecks,    bg: 'bg-purple-100 dark:bg-purple-500/15',   icon_color: 'text-purple-500'  },
  channels_health:        { icon: Radio,         bg: 'bg-teal-100 dark:bg-teal-500/15',       icon_color: 'text-teal-500'    },
  ai_insights:            { icon: Activity,      bg: 'bg-indigo-100 dark:bg-indigo-500/15',   icon_color: 'text-indigo-500'  },
};

function getSourceConfig(st: string) {
  return SOURCE_CONFIG[st] ?? { icon: BarChart3, bg: 'bg-bg-secondary', icon_color: 'text-text-secondary' };
}

// ── Card base classes (shared) ────────────────────────────────────────────────

function cardCls(editing: boolean, extra = '') {
  return [
    'bg-card-bg',
    'border border-border-color',
    'rounded-2xl shadow-sm hover:shadow-md',
    'transition-all duration-200',
    editing ? 'ring-2 ring-dashed ring-blue-200 dark:ring-blue-700/50' : '',
    extra,
  ].join(' ');
}

// ── Delete overlay ────────────────────────────────────────────────────────────

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className="absolute top-3 right-3 z-20 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-colors"
    >
      <X size={11} />
    </button>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-bg-secondary text-text-secondary">
        0%
      </span>
    );
  }
  const positive = delta > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const cls = positive
    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
    : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums ${cls}`}>
      <Icon size={10} />
      {positive ? '+' : ''}{delta.toFixed(1)}%
    </span>
  );
}

function StatCard({ data, editing, onDelete }: { data: WidgetData; editing: boolean; onDelete: () => void }) {
  const cfg = getSourceConfig(data.source_type);
  const Icon = cfg.icon;
  const hasDelta = data.delta_pct !== null && data.delta_pct !== undefined;

  const inner = (
    <div className="relative p-5">
      {editing && <DeleteBtn onClick={onDelete} />}

      {/* Top row: icon left, arrow right */}
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center`}>
          <Icon size={18} className={cfg.icon_color} />
        </div>
        {data.href && !editing && (
          <ArrowUpRight size={15} className="text-text-secondary opacity-40 group-hover:opacity-80 transition-opacity" />
        )}
      </div>

      {/* Number */}
      <p className="text-[28px] font-bold tracking-tight text-text-primary leading-none mb-1.5">
        {(data.value ?? 0).toLocaleString()}
      </p>

      {/* Label + delta */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-secondary leading-snug truncate">
          {data.title}
        </p>
        {hasDelta && <DeltaBadge delta={data.delta_pct as number} />}
      </div>
    </div>
  );

  if (data.href && !editing)
    return <Link href={data.href} className={`block group ${cardCls(editing)}`}>{inner}</Link>;
  return <div className={cardCls(editing)}>{inner}</div>;
}

// ── BreakdownWidget ───────────────────────────────────────────────────────────

function BreakdownWidget({ data, editing, onDelete }: { data: WidgetData; editing: boolean; onDelete: () => void }) {
  const items = data.items ?? [];
  const total = items.reduce((s, i) => s + i.count, 0);
  const cfg   = getSourceConfig(data.source_type);
  const Icon  = cfg.icon;

  return (
    <div className={`relative p-5 h-full ${cardCls(editing)}`}>
      {editing && <DeleteBtn onClick={onDelete} />}

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
          <Icon size={15} className={cfg.icon_color} />
        </div>
        <p className="text-sm font-semibold text-text-primary truncate flex-1">{data.title}</p>
        {total > 0 && (
          <span className="text-xs font-medium text-text-secondary shrink-0 tabular-nums">
            {total.toLocaleString()} total
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center justify-center h-28 text-text-secondary text-sm">
          No data yet
        </div>
      ) : (
        <div className="flex gap-5 items-start">
          {/* Donut — single lazy bundle preserves Recharts component identity */}
          <div className="w-[88px] h-[88px] shrink-0">
            <DonutChart items={items} />
          </div>

          {/* Progress bar legend */}
          <div className="flex-1 space-y-2.5 overflow-hidden min-w-0">
            {items.slice(0, 5).map((item, idx) => {
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              return (
                <div key={idx}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs text-text-primary truncate max-w-[65%] font-medium">
                      {item.label}
                    </span>
                    <span className="text-xs font-bold text-text-primary shrink-0 tabular-nums ml-2">
                      {item.count}
                    </span>
                  </div>
                  <div className="w-full bg-bg-secondary rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: item.color ?? '#9CA3AF' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ListWidget ────────────────────────────────────────────────────────────────

function ListWidget({ data, editing, onDelete }: { data: WidgetData; editing: boolean; onDelete: () => void }) {
  const items = data.items ?? [];
  const cfg   = getSourceConfig(data.source_type);
  const Icon  = cfg.icon;

  return (
    <div className={`relative p-5 h-full ${cardCls(editing)}`}>
      {editing && <DeleteBtn onClick={onDelete} />}

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
          <Icon size={15} className={cfg.icon_color} />
        </div>
        <p className="text-sm font-semibold text-text-primary flex-1 min-w-0 truncate">
          {data.title}
        </p>
        {data.href && !editing && (
          <Link
            href={data.href}
            className="ml-auto shrink-0 flex items-center gap-0.5 text-xs text-text-secondary hover:text-accent transition-colors"
          >
            All <ArrowUpRight size={11} />
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-text-secondary text-sm">
          No data yet
        </div>
      ) : (
        <div className="space-y-0.5">
          {items.map((item, idx) => {
            const initials = item.label.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
            const row = (
              <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-bg-secondary transition-colors group cursor-pointer">
                <span
                  className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: item.color ?? '#6B7280' }}
                >
                  {initials || '#'}
                </span>
                <span className="flex-1 truncate text-sm text-text-primary font-medium">
                  {item.label}
                </span>
                {item.count > 0 && (
                  <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full px-2 py-0.5 font-semibold shrink-0 tabular-nums">
                    {item.count}
                  </span>
                )}
                {!editing && (
                  <ArrowUpRight size={13} className="text-text-secondary opacity-40 group-hover:opacity-80 shrink-0 transition-opacity" />
                )}
              </div>
            );
            if (item.href && !editing) return <Link key={idx} href={item.href}>{row}</Link>;
            return <div key={idx}>{row}</div>;
          })}
        </div>
      )}
    </div>
  );
}

// ── SortableWidget wrapper ────────────────────────────────────────────────────

function colSpan(size: string, displayType?: string): React.CSSProperties['gridColumn'] {
  // Time-series + funnel widgets always span 3 columns for readability
  if (displayType === 'timeseries' || displayType === 'funnel') return 'span 3';
  if (size === 'small') return undefined;    // 1 col
  if (size === 'medium') return 'span 2';   // 2 cols
  if (size === 'large') return 'span 3';    // 3 cols (we have 3-col inner grid)
  return undefined;
}

function SortableWidget({
  meta, data, editing, onDelete,
}: {
  meta: WidgetMeta; data?: WidgetData; editing: boolean; onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: meta.id, disabled: !editing });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
    gridColumn: colSpan(meta.size, data?.display_type),
  };

  if (!data) {
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, minHeight: 120 }}
        className="bg-bg-secondary rounded-2xl animate-pulse"
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Drag handle */}
      {editing && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2.5 left-2.5 z-30 w-6 h-6 rounded-lg bg-card-bg border border-border-color flex items-center justify-center cursor-grab active:cursor-grabbing shadow-sm hover:shadow transition-shadow"
        >
          <GripVertical size={12} className="text-text-secondary" />
        </div>
      )}

      {data.display_type === 'stat'       && <StatCard        data={data} editing={editing} onDelete={() => onDelete(meta.id)} />}
      {data.display_type === 'breakdown'  && <BreakdownWidget data={data} editing={editing} onDelete={() => onDelete(meta.id)} />}
      {data.display_type === 'list'       && <ListWidget      data={data} editing={editing} onDelete={() => onDelete(meta.id)} />}
      {data.display_type === 'trend'      && <TrendCard       data={data} editing={editing} onDelete={() => onDelete(meta.id)} />}
      {data.display_type === 'timeseries' && <TimeSeriesCard  data={data} editing={editing} onDelete={() => onDelete(meta.id)} />}
      {data.display_type === 'gauge'      && <GaugeCard       data={data} editing={editing} onDelete={() => onDelete(meta.id)} />}
      {data.display_type === 'funnel'     && <FunnelCard      data={data} editing={editing} onDelete={() => onDelete(meta.id)} />}
      {data.display_type === 'table'      && <TableCard       data={data} editing={editing} onDelete={() => onDelete(meta.id)} />}
    </div>
  );
}

// ── Add Widget Modal ──────────────────────────────────────────────────────────

/* Maps source_type → user-facing category label */
function getSourceCategory(opt: WidgetOption): string {
  switch (opt.source_type) {
    case 'leads_today':
    case 'leads_total':
    case 'leads_by_stage':
    case 'leads_by_source':
    case 'recent_leads':
    case 'leads_trend':
    case 'leads_timeseries':
    case 'leads_by_meta_campaign':
    case 'pipeline_funnel':
      return 'Leads';
    case 'conversations_unread':
    case 'conversations_today':
    case 'recent_conversations':
    case 'conversations_timeseries':
    case 'ai_vs_manual_split':
    case 'messages_by_channel':
    case 'unknown_senders':
      return 'Conversations';
    case 'followups_due':
      return 'Follow-ups';
    case 'agents_active':
    case 'agents_runs_today':
    case 'agents_by_status':
    case 'top_agents':
      return 'AI Agents';
    case 'campaigns_active':
    case 'campaigns_sent':
    case 'campaigns_delivery_rate':
    case 'campaigns_by_status':
    case 'nurture_active':
    case 'nurture_completion_rate':
      return 'Campaigns';
    case 'work_by_status':
    case 'work_overdue':
    case 'work_by_priority':
    case 'calls_total':
    case 'calls_missed':
      return 'Work';
    case 'wallet_balance':
    case 'wallet_spend':
    case 'wallet_usage_gauge':
      return 'Wallet';
    case 'contacts_total':
    case 'contacts_by_tag':
    case 'contacts_by_group':
      return 'Contacts';
    case 'recent_activity':
    case 'ai_insights':
      return 'Activity';
    case 'team_active_employees':
    case 'team_attendance':
    case 'team_live_tasks':
    case 'team_completion_rate':
      return 'Team';
    case 'channels_health':
      return 'Conversations';
    // All datasheet-derived source types use source_name as the tab label
    case 'datasheet_count':
    case 'datasheet_recent':
    case 'datasheet_breakdown':
    case 'datasheet_count_date':
    case 'datasheet_number':
      return opt.source_name ?? 'Datasheet';
    default:
      return 'Other';
  }
}

/* Icon + colour per category */
const CATEGORY_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  'Leads':         { icon: Users,         color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/30'       },
  'Conversations': { icon: MessageSquare, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
  'Follow-ups':    { icon: Clock,         color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-50 dark:bg-violet-900/30'   },
  'AI Agents':     { icon: Bot,           color: 'text-purple-600 dark:text-purple-400',   bg: 'bg-purple-50 dark:bg-purple-900/30'   },
  'Campaigns':     { icon: Megaphone,     color: 'text-pink-600 dark:text-pink-400',       bg: 'bg-pink-50 dark:bg-pink-900/30'       },
  'Work':          { icon: ListChecks,    color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/30'     },
  'Wallet':        { icon: Wallet,        color: 'text-green-600 dark:text-green-400',     bg: 'bg-green-50 dark:bg-green-900/30'     },
  'Contacts':      { icon: Users,         color: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-50 dark:bg-indigo-900/30'   },
  'Activity':      { icon: Activity,      color: 'text-cyan-600 dark:text-cyan-400',       bg: 'bg-cyan-50 dark:bg-cyan-900/30'       },
  'Team':          { icon: UsersRound,    color: 'text-green-600 dark:text-green-400',     bg: 'bg-green-50 dark:bg-green-900/30'     },
};
function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? {
    icon: Database,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg:    'bg-indigo-50 dark:bg-indigo-900/30',
  };
}

/* Display-type badge colours */
const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  stat:       { bg: 'bg-blue-50 dark:bg-blue-900/30',       text: 'text-blue-600 dark:text-blue-400',       label: 'Stat'   },
  breakdown:  { bg: 'bg-violet-50 dark:bg-violet-900/30',   text: 'text-violet-600 dark:text-violet-400',   label: 'Chart'  },
  list:       { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', label: 'List'   },
  trend:      { bg: 'bg-sky-50 dark:bg-sky-900/30',         text: 'text-sky-600 dark:text-sky-400',         label: 'Trend'  },
  timeseries: { bg: 'bg-indigo-50 dark:bg-indigo-900/30',   text: 'text-indigo-600 dark:text-indigo-400',   label: 'Series' },
  gauge:      { bg: 'bg-rose-50 dark:bg-rose-900/30',       text: 'text-rose-600 dark:text-rose-400',       label: 'Gauge'  },
  funnel:     { bg: 'bg-purple-50 dark:bg-purple-900/30',   text: 'text-purple-600 dark:text-purple-400',   label: 'Funnel' },
  table:      { bg: 'bg-amber-50 dark:bg-amber-900/30',     text: 'text-amber-600 dark:text-amber-400',     label: 'Table'  },
};

function AddWidgetModal({
  options, onClose, onAdd,
}: {
  options: WidgetOption[];
  onClose: () => void;
  onAdd: (opt: WidgetOption) => Promise<void>;
}) {
  const [adding,          setAdding]          = useState<string | null>(null);
  const [activeCategory,  setActiveCategory]  = useState<string>('All');

  /* Derive ordered source tabs from available options */
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    // Fixed order for core sources first
    for (const cat of ['Leads', 'Contacts', 'Conversations', 'AI Agents', 'Campaigns', 'Work', 'Team', 'Follow-ups', 'Wallet', 'Activity']) {
      if (options.some(o => getSourceCategory(o) === cat)) {
        seen.add(cat);
        result.push(cat);
      }
    }
    // Then any datasheet / other sources in the order they appear
    for (const opt of options) {
      const cat = getSourceCategory(opt);
      if (!seen.has(cat)) { seen.add(cat); result.push(cat); }
    }
    return result; // no "All" in the list itself — handled below
  }, [options]);

  /* Options visible in the active tab */
  const filtered = useMemo(() =>
    activeCategory === 'All'
      ? options
      : options.filter(o => getSourceCategory(o) === activeCategory),
    [options, activeCategory],
  );

  /* Sub-group filtered options by display type */
  const groups = useMemo(() => [
    { key: 'stat',       label: 'Stats',   items: filtered.filter(o => o.display_type === 'stat')       },
    { key: 'trend',      label: 'Trends',  items: filtered.filter(o => o.display_type === 'trend')      },
    { key: 'gauge',      label: 'Gauges',  items: filtered.filter(o => o.display_type === 'gauge')      },
    { key: 'breakdown',  label: 'Charts',  items: filtered.filter(o => o.display_type === 'breakdown')  },
    { key: 'timeseries', label: 'Series',  items: filtered.filter(o => o.display_type === 'timeseries') },
    { key: 'funnel',     label: 'Funnels', items: filtered.filter(o => o.display_type === 'funnel')     },
    { key: 'table',      label: 'Tables',  items: filtered.filter(o => o.display_type === 'table')      },
    { key: 'list',       label: 'Lists',   items: filtered.filter(o => o.display_type === 'list')       },
  ].filter(g => g.items.length > 0), [filtered]);

  async function handleAdd(opt: WidgetOption) {
    const key = opt.source_type + (opt.source_id ?? '');
    setAdding(key);
    await onAdd(opt);
    setAdding(null);
    onClose();
  }

  const showSubHeaders = activeCategory === 'All' || groups.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card-bg rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[88vh] flex flex-col border border-border-color">

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border-color">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Add Widget</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Choose a data source, then pick what to display
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors ml-3 mt-0.5 shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Source tabs (scrollable strip) ── */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto border-b border-border-color [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* All pill */}
          <button
            onClick={() => setActiveCategory('All')}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors shrink-0 ${
              activeCategory === 'All'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:bg-bg-secondary'
            }`}
          >
            All
          </button>

          {/* Source-specific pills */}
          {categories.map(cat => {
            const meta   = getCategoryMeta(cat);
            const Icon   = meta.icon;
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors shrink-0 ${
                  active
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text-secondary hover:bg-bg-secondary'
                }`}
              >
                <Icon size={12} className={active ? 'opacity-100' : ''} />
                {cat}
              </button>
            );
          })}
        </div>

        {/* ── Widget list with sub-group headers ── */}
        <div className="overflow-y-auto flex-1 p-3 space-y-4">
          {groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-text-secondary text-sm gap-2">
              <Database size={24} className="opacity-30" />
              No widgets available for this source
            </div>
          )}

          {groups.map(group => (
            <div key={group.key}>
              {/* Sub-group header */}
              {showSubHeaders && (
                <div className="flex items-center gap-2 px-1 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-border-color" />
                </div>
              )}

              <div className="space-y-1">
                {group.items.map(opt => {
                  const key       = opt.source_type + (opt.source_id ?? '');
                  const isLoading = adding === key;
                  const cfg       = getSourceConfig(opt.source_type);
                  const Icon      = cfg.icon;
                  const tc        = TYPE_COLORS[opt.display_type] ?? TYPE_COLORS.stat;
                  const catMeta   = getCategoryMeta(getSourceCategory(opt));

                  return (
                    <button
                      key={key}
                      onClick={() => handleAdd(opt)}
                      disabled={!!adding}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-border-color hover:bg-bg-secondary transition-all text-left disabled:opacity-50 group"
                    >
                      {/* Source icon */}
                      <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                        {isLoading
                          ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
                          : <Icon size={17} className={cfg.icon_color} />
                        }
                      </div>

                      {/* Title + description */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{opt.default_title}</p>
                        <p className="text-xs text-text-secondary truncate mt-0.5">{opt.description}</p>
                      </div>

                      {/* Source category badge — visible only on "All" tab */}
                      {activeCategory === 'All' && (
                        <span className={`hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${catMeta.bg} ${catMeta.color} shrink-0`}>
                          {getSourceCategory(opt)}
                        </span>
                      )}

                      {/* Display type badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${tc.bg} ${tc.text} shrink-0`}>
                        {tc.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <div className="h-6 w-32 bg-bg-secondary rounded-lg animate-pulse" />
          <div className="h-4 w-48 bg-bg-secondary rounded-lg animate-pulse" />
        </div>
        <div className="h-9 w-28 bg-bg-secondary rounded-xl animate-pulse" />
      </div>
      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-[116px] bg-bg-secondary rounded-2xl animate-pulse" />
        ))}
        {[1, 2].map(i => (
          <div key={i} className="col-span-2 h-[200px] bg-bg-secondary rounded-2xl animate-pulse" />
        ))}
        <div className="col-span-2 h-[180px] bg-bg-secondary rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}

// Team Pulse hardcoded section removed — equivalent widgets are now in the modal:
// team_active_employees, team_attendance, team_live_tasks, team_completion_rate.

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NewDashboardPage() {
  const [widgets,   setWidgets]   = useState<WidgetMeta[]>([]);
  const [dataMap,   setDataMap]   = useState<Map<number, WidgetData>>(new Map());
  const [options,   setOptions]   = useState<WidgetOption[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [layouts,   setLayouts]   = useState<Layout[]>([]);
  const activeLayoutId = layouts.find((l) => l.is_active)?.id ?? null;

  // Team Pulse state removed — now exposed via team_* widgets users can add.

  const startDate = useDateRangeStore((s) => s.startDate);
  const endDate   = useDateRangeStore((s) => s.endDate);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadLayouts = useCallback(async () => {
    try {
      const ls = await fetchLayouts();
      setLayouts(ls);
      return ls;
    } catch {
      return [] as Layout[];
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const ls = await loadLayouts();
      const active = ls.find((l) => l.is_active)?.id ?? null;
      const [metas, allData] = await Promise.all([
        fetchWidgets(active),
        fetchAllData(startDate, endDate, active),
      ]);
      setWidgets(metas);
      const map = new Map<number, WidgetData>();
      allData.forEach((d) => map.set(d.widget_id, d));
      setDataMap(map);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Re-fetch widget list + data whenever the active layout changes
  useEffect(() => {
    if (activeLayoutId === null) return;
    setDataLoading(true);
    Promise.all([
      fetchWidgets(activeLayoutId),
      fetchAllData(startDate, endDate, activeLayoutId),
    ])
      .then(([metas, allData]) => {
        setWidgets(metas);
        const map = new Map<number, WidgetData>();
        allData.forEach((d) => map.set(d.widget_id, d));
        setDataMap(map);
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, [activeLayoutId, startDate, endDate]);

  // SSE live refresh — re-fetch widgets and layouts on tick
  useDashboardStream(useCallback(() => {
    loadLayouts();
    if (activeLayoutId !== null) {
      fetchAllData(startDate, endDate, activeLayoutId)
        .then((allData) => {
          const map = new Map<number, WidgetData>();
          allData.forEach((d) => map.set(d.widget_id, d));
          setDataMap(map);
        })
        .catch(() => {});
    }
  }, [activeLayoutId, startDate, endDate, loadLayouts]));

  async function loadOptions() {
    if (options.length === 0) setOptions(await fetchOptions());
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = widgets.findIndex(w => w.id === active.id);
    const to   = widgets.findIndex(w => w.id === over.id);
    const next = arrayMove(widgets, from, to);
    setWidgets(next);
    reorderWidgets(next.map(w => w.id));
  }

  async function handleDelete(id: number) {
    setWidgets(prev => prev.filter(w => w.id !== id));
    await deleteWidget(id);
  }

  async function handleAdd(opt: WidgetOption) {
    const w = await createWidget({
      title: opt.default_title, source_type: opt.source_type,
      display_type: opt.display_type, size: opt.size,
      source_id: opt.source_id, field_id: opt.field_id, aggregation: opt.aggregation,
    });
    setWidgets(prev => [...prev, w]);
    const allData = await fetchAllData(startDate, endDate, activeLayoutId);
    const map = new Map<number, WidgetData>();
    allData.forEach(d => map.set(d.widget_id, d));
    setDataMap(map);
    loadLayouts(); // refresh widget_count in switcher
  }

  async function handleEditToggle() {
    if (editing) { setEditing(false); return; }
    await loadOptions();
    setEditing(true);
  }

  if (loading) return <Skeleton />;

  return (
    <div className="min-h-full">

      {/* ── Edit-mode banner ── */}
      {editing && (
        <div className="sticky top-0 z-40 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/60 px-6 py-2.5 flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Editing — drag to reorder, × to remove
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-sm"
            >
              <Plus size={13} /> Add Widget
            </button>
            <button
              onClick={handleEditToggle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-card-bg border border-amber-200 dark:border-amber-700/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
            >
              <Check size={13} /> Done
            </button>
          </div>
        </div>
      )}

      <div className="p-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Dashboard</h1>
            <p className="text-sm text-text-secondary mt-0.5 font-medium">Your business at a glance</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Layout switcher */}
            {layouts.length > 0 && (
              <LayoutSwitcher
                layouts={layouts}
                activeId={activeLayoutId}
                onChange={loadLayouts}
              />
            )}
            {/* Date range picker — controls all widget data */}
            <div className="relative">
              <DateRangePicker />
              {dataLoading && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              )}
            </div>
            {!editing && (
              <button
                onClick={handleEditToggle}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-card-bg border border-border-color text-text-secondary hover:bg-bg-secondary shadow-sm hover:shadow transition-all"
              >
                <LayoutGrid size={15} /> Customize
              </button>
            )}
          </div>
        </div>

        {/* Hardcoded P2 rows removed — every previous row is now an addable widget:
            • AI insights → "Needs Attention" (list)
            • Headline KPIs → individual stats (leads_today, conversations_today, …)
            • Team Pulse → team_active_employees / team_attendance / team_live_tasks / team_completion_rate
            • Channels health → channels_health (table)
            • Activity feed → recent_activity (list)
            The dashboard is empty until the user adds widgets from the modal. */}

        {/* ── Widget grid ── */}
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-bg-secondary flex items-center justify-center mb-5">
              <BarChart3 size={26} className="text-text-secondary" />
            </div>
            <p className="font-semibold text-text-primary text-base">No widgets yet</p>
            <p className="text-text-secondary text-sm mt-1.5 mb-6 max-w-xs">
              Customize your dashboard to show the metrics that matter most to you
            </p>
            <button
              onClick={async () => { await loadOptions(); setEditing(true); setShowModal(true); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent hover:bg-accent/90 text-white transition-colors shadow-sm"
            >
              <Plus size={15} /> Add your first widget
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {widgets.map(meta => (
                  <SortableWidget
                    key={meta.id}
                    meta={meta}
                    data={dataMap.get(meta.id)}
                    editing={editing}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* ── Add Widget Modal ── */}
      {showModal && (
        <AddWidgetModal
          options={options}
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}
