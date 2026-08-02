'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import SmartInput from '@/components/agent-stream/SmartInput';
import { useStreamStore } from '@/lib/agent-stream/stream-store';
import {
  Plus, Check, GripVertical,
  TrendingUp, TrendingDown, Users, MessageSquare, Clock, BarChart3,
  X, ArrowUpRight, Zap, Database, LayoutGrid,
  UsersRound, Send,
  Wallet, Bot, Activity, Megaphone, Mail, ListChecks, Radio, Tag,
  Settings2, Calendar, Maximize2, ChevronDown, Search, Sparkles, Filter,
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
import WidgetComposer from '@/components/dashboard/widget-composer';
import { listInternalAgents } from '@/services/internal-chat';
import type { AgentSummary } from '@/lib/agent-blocks';
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
  date_range: string;
  sort_order: number;
  // custom_list source config (surfaced so the customize popover can prefill)
  source_id?: number | null;
  field_id?: number | null;
  aggregation?: string | null;
  filter_value?: string | null;
}

// Patch shape for updateWidget. Config keys use `null` to clear a value and are
// omitted entirely when unchanged (the backend keys off which keys are present).
type WidgetPatch = {
  title?: string; size?: string; date_range?: string;
  aggregation?: string | null; source_id?: number | null;
  field_id?: number | null; filter_value?: string | null;
};

// Per-widget date-window override options (settings popover)
const DATE_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'global',        label: 'Dashboard range' },
  { value: 'today',         label: 'Today' },
  { value: 'last_7_days',   label: 'Last 7 days' },
  { value: 'last_30_days',  label: 'Last 30 days' },
  { value: 'month_to_date', label: 'Month to date' },
  { value: 'last_90_days',  label: 'Last 90 days' },
];
const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: 'small',  label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large',  label: 'Large' },
];

// Source types whose value ignores the date window (live snapshots / all-time).
// Everything else honors the dashboard range and gets the inline date control.
const WINDOW_IGNORED = new Set<string>([
  'contacts_total', 'contacts_by_group', 'wallet_balance', 'agents_active',
  'agents_total_runs', 'agents_by_status', 'top_agents', 'conversations_unread',
  'unknown_senders', 'channels_health', 'ai_insights', 'campaigns_active',
  'campaigns_by_status', 'nurture_active', 'nurture_completion_rate',
  'work_overdue', 'work_by_priority', 'team_active_employees',
  'pipeline_open_value', 'pipeline_weighted_value',
  'pipeline_total_open_value', 'pipeline_closing_week', 'pipeline_win_rate_all',
  'pipeline_stuck_all', 'pipeline_added_today_all',
  // Structural "X by field" breakdown — resolved all-time on the backend, so it
  // must not offer a (dead) per-widget date window.
  'datasheet_breakdown',
  // Configurable list + live count — snapshot semantics on the backend (ignores window).
  'custom_list',
  'datasheet_list',
]);
const usesDateWindow = (sourceType: string) => !WINDOW_IGNORED.has(sourceType);
const rangeLabel = (v: string) =>
  DATE_RANGE_OPTIONS.find((o) => o.value === v)?.label ?? v;

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
  filter_value?: string;   // datasheet_list: pre-encoded field==value filter
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

// ── custom_list customize metadata ─────────────────────────────────────────────
interface ListField { id: number; name: string; label: string; field_type: string; options: string[]; }
interface ListDatasheet { id: number; name: string; fields: ListField[]; }
interface ListPipeline { id: number; name: string; }
interface ListSources {
  datasheets: ListDatasheet[];
  pipelines: ListPipeline[];
  work_statuses: string[];
  conversation_modes: string[];
}
const fetchListSources = () => apiFetch<ListSources>('/widgets/list-sources');

const deleteWidget   = (id: number) => apiFetch<void>(`/widgets/${id}`, { method: 'DELETE' });
const reorderWidgets = (ids: number[]) =>
  apiFetch<void>('/widgets/reorder', { method: 'PATCH', body: JSON.stringify({ ordered_ids: ids }) });
const updateWidget   = (id: number, patch: WidgetPatch) =>
  apiFetch<WidgetMeta>(`/widgets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
const fetchOneData   = (id: number, startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate)   params.set('end_date',   endDate);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<WidgetData>(`/widgets/${id}/data${qs}`);
};

async function createWidget(payload: {
  title: string; source_type: string; display_type: string;
  size: string; source_id?: number; field_id?: number; aggregation?: string;
  filter_value?: string;
}): Promise<WidgetMeta> {
  return apiFetch<WidgetMeta>('/widgets', {
    method: 'POST',
    body: JSON.stringify({ ...payload, sort_order: 999 }),
  });
}

// ── Per-source icon + color config ───────────────────────────────────────────

const SOURCE_CONFIG: Record<string, { icon: React.ElementType; bg: string; icon_color: string }> = {
  contacts_new:           { icon: TrendingUp,    bg: 'bg-orange-100 dark:bg-orange-500/15',   icon_color: 'text-orange-500'  },
  contacts_total:         { icon: Users,         bg: 'bg-blue-100 dark:bg-blue-500/15',       icon_color: 'text-blue-500'    },
  contacts_trend:         { icon: TrendingUp,    bg: 'bg-sky-100 dark:bg-sky-500/15',         icon_color: 'text-sky-500'     },
  contacts_timeseries:    { icon: TrendingUp,    bg: 'bg-sky-100 dark:bg-sky-500/15',         icon_color: 'text-sky-500'     },
  contacts_by_source:     { icon: Zap,           bg: 'bg-amber-100 dark:bg-amber-500/15',     icon_color: 'text-amber-500'   },
  contacts_by_meta_campaign: { icon: Zap,        bg: 'bg-blue-100 dark:bg-blue-500/15',       icon_color: 'text-blue-500'    },
  recent_contacts:        { icon: Users,         bg: 'bg-sky-100 dark:bg-sky-500/15',         icon_color: 'text-sky-500'     },
  pipeline_by_stage:      { icon: BarChart3,     bg: 'bg-blue-100 dark:bg-blue-500/15',       icon_color: 'text-blue-500'    },
  pipeline_value_by_stage:{ icon: BarChart3,     bg: 'bg-emerald-100 dark:bg-emerald-500/15', icon_color: 'text-emerald-500' },
  pipeline_funnel:        { icon: BarChart3,     bg: 'bg-violet-100 dark:bg-violet-500/15',   icon_color: 'text-violet-500'  },
  pipeline_open_value:    { icon: Wallet,        bg: 'bg-emerald-100 dark:bg-emerald-500/15', icon_color: 'text-emerald-500' },
  pipeline_weighted_value:{ icon: TrendingUp,    bg: 'bg-emerald-100 dark:bg-emerald-500/15', icon_color: 'text-emerald-500' },
  pipeline_added:         { icon: TrendingUp,    bg: 'bg-blue-100 dark:bg-blue-500/15',       icon_color: 'text-blue-500'    },
  pipeline_won:           { icon: Check,         bg: 'bg-green-100 dark:bg-green-500/15',     icon_color: 'text-green-500'   },
  pipeline_win_rate:      { icon: BarChart3,     bg: 'bg-purple-100 dark:bg-purple-500/15',   icon_color: 'text-purple-500'  },
  pipeline_velocity:      { icon: TrendingUp,    bg: 'bg-sky-100 dark:bg-sky-500/15',         icon_color: 'text-sky-500'     },
  pipeline_total_open_value: { icon: Wallet,     bg: 'bg-emerald-100 dark:bg-emerald-500/15', icon_color: 'text-emerald-500' },
  pipeline_closing_week:  { icon: Clock,         bg: 'bg-amber-100 dark:bg-amber-500/15',     icon_color: 'text-amber-500'   },
  pipeline_win_rate_all:  { icon: BarChart3,     bg: 'bg-purple-100 dark:bg-purple-500/15',   icon_color: 'text-purple-500'  },
  pipeline_stuck_all:     { icon: Clock,         bg: 'bg-red-100 dark:bg-red-500/15',         icon_color: 'text-red-500'     },
  pipeline_added_today_all: { icon: TrendingUp,  bg: 'bg-blue-100 dark:bg-blue-500/15',       icon_color: 'text-blue-500'    },
  conversations_unread:   { icon: MessageSquare, bg: 'bg-emerald-100 dark:bg-emerald-500/15', icon_color: 'text-emerald-500' },
  conversations_active:   { icon: MessageSquare, bg: 'bg-teal-100 dark:bg-teal-500/15',       icon_color: 'text-teal-500'    },
  followups_due:          { icon: Clock,         bg: 'bg-violet-100 dark:bg-violet-500/15',   icon_color: 'text-violet-500'  },
  recent_conversations:   { icon: MessageSquare, bg: 'bg-green-100 dark:bg-green-500/15',     icon_color: 'text-green-500'   },
  // datasheet family — all share the indigo palette
  datasheet_count:        { icon: Database,      bg: 'bg-indigo-100 dark:bg-indigo-500/15',   icon_color: 'text-indigo-500'  },
  datasheet_recent:       { icon: Database,      bg: 'bg-indigo-100 dark:bg-indigo-500/15',   icon_color: 'text-indigo-500'  },
  datasheet_list:         { icon: Filter,        bg: 'bg-indigo-100 dark:bg-indigo-500/15',   icon_color: 'text-indigo-500'  },
  custom_list:            { icon: ListChecks,    bg: 'bg-indigo-100 dark:bg-indigo-500/15',   icon_color: 'text-indigo-500'  },
  datasheet_breakdown:    { icon: BarChart3,     bg: 'bg-violet-100 dark:bg-violet-500/15',   icon_color: 'text-violet-500'  },
  datasheet_count_date:   { icon: Clock,         bg: 'bg-sky-100 dark:bg-sky-500/15',         icon_color: 'text-sky-500'     },
  datasheet_number:       { icon: TrendingUp,    bg: 'bg-amber-100 dark:bg-amber-500/15',     icon_color: 'text-amber-500'   },
  wallet_balance:         { icon: Wallet,        bg: 'bg-green-100 dark:bg-green-500/15',     icon_color: 'text-green-500'   },
  wallet_spend:           { icon: Wallet,        bg: 'bg-rose-100 dark:bg-rose-500/15',       icon_color: 'text-rose-500'    },
  agents_active:          { icon: Bot,           bg: 'bg-purple-100 dark:bg-purple-500/15',   icon_color: 'text-purple-500'  },
  recent_activity:        { icon: Activity,      bg: 'bg-cyan-100 dark:bg-cyan-500/15',       icon_color: 'text-cyan-500'    },
  // P4 sources
  agents_total_runs:      { icon: Bot,           bg: 'bg-purple-100 dark:bg-purple-500/15',   icon_color: 'text-purple-500'  },
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
  work_completed:         { icon: ListChecks,    bg: 'bg-green-100 dark:bg-green-500/15',     icon_color: 'text-green-500'   },
  work_by_priority:       { icon: ListChecks,    bg: 'bg-amber-100 dark:bg-amber-500/15',     icon_color: 'text-amber-500'   },
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

// Sources where a non-zero value is something the owner should act on — colour the
// number by urgency instead of the default neutral.
const URGENCY_SOURCES = new Set([
  'conversations_unread', 'work_overdue', 'unknown_senders', 'followups_due',
]);

// Mini inline sparkline for stat cards that carry a daily series.
function Sparkline({ series, positive }: { series: SeriesPoint[]; positive: boolean }) {
  const w = 110, h = 28;
  const max = Math.max(1, ...series.map((p) => p.value));
  const step = series.length > 1 ? w / (series.length - 1) : 0;
  const pts = series.map((p, i) => `${i * step},${h - (p.value / max) * h}`).join(' ');
  const stroke = positive ? '#10B981' : '#EF4444';
  const fillId = `sx-${Math.round(max)}-${series.length}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7 mt-2" preserveAspectRatio="none">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${fillId})`} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function StatCard({ data, editing, onDelete }: { data: WidgetData; editing: boolean; onDelete: () => void }) {
  const cfg = getSourceConfig(data.source_type);
  const Icon = cfg.icon;
  const hasDelta = data.delta_pct !== null && data.delta_pct !== undefined;
  const series = data.series ?? [];
  const hasSpark = series.length > 1;
  const value = data.value ?? 0;
  const unit = (data.unit ?? '').trim();   // currency symbol for pipeline value cards

  // Threshold colour: urgent sources with a non-zero value read in amber/red.
  const urgent = URGENCY_SOURCES.has(data.source_type) && value > 0;
  const numberCls = urgent
    ? (data.source_type === 'work_overdue' ? 'text-red-500' : 'text-amber-500')
    : 'text-text-primary';

  // Sparkline direction follows the period delta (fallback: series slope).
  const sparkPositive = hasDelta
    ? (data.delta_pct as number) >= 0
    : series[series.length - 1]?.value >= (series[0]?.value ?? 0);

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

      {/* Number + delta */}
      <div className="flex items-end justify-between gap-2 mb-1.5">
        <p className={`text-[32px] font-bold tracking-tight leading-none ${numberCls}`}>
          {unit && <span className="text-[20px] font-semibold align-top mr-0.5">{unit}</span>}
          {value.toLocaleString()}
        </p>
        {hasDelta && <DeltaBadge delta={data.delta_pct as number} />}
      </div>

      {/* Label */}
      <p className="text-[13px] font-medium text-text-secondary leading-snug truncate">
        {data.title}
      </p>

      {/* Sparkline (only when a daily series is present) */}
      {hasSpark && <Sparkline series={series} positive={sparkPositive} />}
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
        <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
          <Icon size={17} className={cfg.icon_color} />
        </div>
        <p className="text-[15px] font-semibold text-text-primary truncate flex-1">{data.title}</p>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center justify-center h-28 text-text-secondary text-sm">
          No data yet
        </div>
      ) : (
        <div className="flex gap-5 items-center">
          {/* Donut — single lazy bundle preserves Recharts component identity.
              Segments are clickable (route to filtered rows); disabled while editing. */}
          <div className="w-[112px] h-[112px] shrink-0">
            <DonutChart
              items={editing ? items.map((i) => ({ ...i, href: undefined })) : items}
              total={total}
            />
          </div>

          {/* Clickable tabs — one per segment; each deep-links to the filtered rows */}
          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            {items.slice(0, 5).map((item, idx) => {
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              const clickable = !!item.href && !editing;
              const color = item.color ?? '#9CA3AF';
              const tab = (
                <div className={`flex items-center gap-2.5 pl-2.5 pr-2 py-2 rounded-xl border border-border-color bg-bg-secondary/40 transition-all ${clickable ? 'hover:bg-bg-secondary hover:border-accent/60 cursor-pointer group' : ''}`}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="flex-1 min-w-0 text-[15px] text-text-primary truncate font-medium">{item.label}</span>
                  <span className="text-[11px] font-semibold text-text-secondary tabular-nums">{pct}%</span>
                  <span className="text-base font-bold text-text-primary tabular-nums">{item.count.toLocaleString()}</span>
                  {clickable && (
                    <ArrowUpRight size={14} className="text-text-secondary opacity-40 group-hover:opacity-90 group-hover:text-accent transition-all shrink-0" />
                  )}
                </div>
              );
              return clickable
                ? <Link key={idx} href={item.href!}>{tab}</Link>
                : <div key={idx}>{tab}</div>;
            })}

            {/* Overflow indicator → full sheet */}
            {items.length > 5 && (
              data.href
                ? <Link href={data.href} className="block px-1 pt-0.5 text-xs font-semibold text-accent hover:underline">
                    +{items.length - 5} more
                  </Link>
                : <p className="px-1 pt-0.5 text-xs font-medium text-text-secondary">+{items.length - 5} more</p>
            )}
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
  // A "list with a count" (e.g. datasheet_list) carries a total in `value`; the
  // header shows it as a big number and the rows are a sample beneath it.
  const hasCount = data.value !== null && data.value !== undefined;
  const total    = data.value ?? 0;
  const shownMax = 6;

  return (
    <div className={`relative p-5 h-full ${cardCls(editing)}`}>
      {editing && <DeleteBtn onClick={onDelete} />}

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
          <Icon size={17} className={cfg.icon_color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-text-primary truncate leading-tight">
            {data.title}
          </p>
          {hasCount && (
            <p className="text-2xl font-bold tracking-tight text-text-primary leading-none mt-1 tabular-nums">
              {total.toLocaleString()}
              <span className="ml-1.5 text-[11px] font-medium text-text-secondary align-middle">
                {total === 1 ? 'record' : 'records'}
              </span>
            </p>
          )}
        </div>
        {data.href && !editing && (
          <Link
            href={data.href}
            className="shrink-0 self-start flex items-center gap-0.5 text-xs text-text-secondary hover:text-accent transition-colors"
          >
            All <ArrowUpRight size={11} />
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-text-secondary text-sm text-center px-4">
          {data.source_type === 'custom_list' && !hasCount
            ? 'Open customize (⚙) and pick a source'
            : hasCount ? 'No matching records' : 'No data yet'}
        </div>
      ) : (
        <div className="space-y-0.5">
          {items.slice(0, shownMax).map((item, idx) => {
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

          {/* Overflow — a count widget knows the true total; a plain list only
              knows how many rows it received. */}
          {(() => {
            const more = hasCount ? total - Math.min(items.length, shownMax)
                                  : items.length - shownMax;
            if (more <= 0) return null;
            return data.href && !editing ? (
              <Link href={data.href} className="block px-2 pt-1 text-xs font-semibold text-accent hover:underline">
                +{more.toLocaleString()} more
              </Link>
            ) : (
              <p className="px-2 pt-1 text-xs font-medium text-text-secondary">
                +{more.toLocaleString()} more
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── Per-widget settings popover ───────────────────────────────────────────────

function WidgetSettings({
  meta, onClose, onSave,
}: {
  meta: WidgetMeta;
  onClose: () => void;
  onSave: (patch: WidgetPatch) => Promise<void> | void;
}) {
  const [title, setTitle]   = useState(meta.title);
  const [size, setSize]     = useState(meta.size);
  const [range, setRange]   = useState(meta.date_range || 'global');
  const [saving, setSaving] = useState(false);

  // custom_list source config
  const isCustomList = meta.source_type === 'custom_list';
  const [kind,        setKind]        = useState<string>(meta.aggregation || '');
  const [sourceId,    setSourceId]    = useState<number | null>(meta.source_id ?? null);
  const [fieldId,     setFieldId]     = useState<number | null>(meta.field_id ?? null);
  const [filterValue, setFilterValue] = useState<string>(meta.filter_value || '');
  // Date-field filter reuses the widget's date_range column as the window preset.
  const [dateWindow,  setDateWindow]  = useState<string>(
    meta.date_range && meta.date_range !== 'global' ? meta.date_range : 'last_30_days');
  const [sources,     setSources]     = useState<ListSources | null>(null);

  useEffect(() => {
    if (!isCustomList) return;
    let alive = true;
    fetchListSources().then((s) => { if (alive) setSources(s); }).catch(() => {});
    return () => { alive = false; };
  }, [isCustomList]);

  const activeSheet = sources?.datasheets.find((d) => d.id === sourceId) ?? null;
  const activeField = activeSheet?.fields.find((f) => f.id === fieldId) ?? null;

  // Full-width shapes (time-series & tables) always span the whole row — size is moot.
  const sizeLocked = meta.display_type === 'timeseries' || meta.display_type === 'table';
  // Snapshot/structural widgets ignore the date window — hide the control for them.
  const rangeApplies = usesDateWindow(meta.source_type);

  async function handleSave() {
    setSaving(true);
    const patch: WidgetPatch = {
      title: title.trim() || meta.title,
      size: sizeLocked ? meta.size : size,
      date_range: rangeApplies ? range : 'global',
    };
    if (isCustomList) {
      patch.aggregation  = kind || null;
      // Datasheet keeps its model + field filter; work/conversations use only
      // filter_value, so clear the datasheet-only keys for them.
      patch.source_id    = kind === 'datasheet' ? sourceId : null;
      patch.field_id     = kind === 'datasheet' ? fieldId  : null;
      const dateFilter   = kind === 'datasheet' && activeField?.field_type === 'date';
      // A date-field filter carries its window in date_range and has no ==value;
      // a value filter uses filter_value and leaves date_range neutral.
      patch.filter_value = dateFilter ? null : (filterValue || null);
      patch.date_range   = dateFilter ? dateWindow : 'global';
    }
    await onSave(patch);
    setSaving(false);
    onClose();
  }

  return (
    <>
      {/* click-away backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-10 right-2 z-50 w-60 bg-card-bg border border-border-color rounded-xl shadow-xl p-3 space-y-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full px-2.5 py-1.5 text-sm rounded-lg bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        {isCustomList && (
          <div className="space-y-2.5 pt-1 border-t border-border-color">
            {/* Source kind */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1">
                <Filter size={10} /> Show
              </label>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {[
                  { value: 'datasheet',     label: 'Datasheet' },
                  { value: 'work',          label: 'Tasks' },
                  { value: 'conversations', label: 'Chats' },
                ].map((o) => (
                  <button
                    key={o.value}
                    onClick={() => { setKind(o.value); setSourceId(null); setFieldId(null); setFilterValue(''); }}
                    className={`px-2 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      kind === o.value
                        ? 'bg-accent text-white border-accent'
                        : 'bg-bg-secondary text-text-secondary border-border-color hover:text-text-primary'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Datasheet: which sheet + optional field==value filter */}
            {kind === 'datasheet' && (
              <>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Datasheet</label>
                  <select
                    value={sourceId ?? ''}
                    onChange={(e) => { setSourceId(e.target.value ? Number(e.target.value) : null); setFieldId(null); setFilterValue(''); }}
                    className="mt-1 w-full px-2.5 py-1.5 text-sm rounded-lg bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    <option value="">{sources ? 'Select a datasheet…' : 'Loading…'}</option>
                    {sources?.datasheets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                {activeSheet && activeSheet.fields.length > 0 && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Filter by (optional)</label>
                    <select
                      value={fieldId ?? ''}
                      onChange={(e) => { setFieldId(e.target.value ? Number(e.target.value) : null); setFilterValue(''); }}
                      className="mt-1 w-full px-2.5 py-1.5 text-sm rounded-lg bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                    >
                      <option value="">No filter — show all</option>
                      {activeSheet.fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  </div>
                )}

                {activeField && activeField.field_type === 'date' && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1">
                      <Calendar size={10} /> {activeField.label} within
                    </label>
                    <select
                      value={dateWindow}
                      onChange={(e) => setDateWindow(e.target.value)}
                      className="mt-1 w-full px-2.5 py-1.5 text-sm rounded-lg bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                    >
                      {DATE_RANGE_OPTIONS.filter((o) => o.value !== 'global').map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {activeField && activeField.field_type !== 'date' && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                      {activeField.label} =
                    </label>
                    {activeField.options.length > 0 ? (
                      <select
                        value={filterValue}
                        onChange={(e) => setFilterValue(e.target.value)}
                        className="mt-1 w-full px-2.5 py-1.5 text-sm rounded-lg bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                      >
                        <option value="">Any value</option>
                        {activeField.options.map((v) => (
                          <option key={v} value={v}>
                            {activeField.field_type === 'boolean' ? (v === 'true' ? 'Yes' : 'No') : v}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={filterValue}
                        onChange={(e) => setFilterValue(e.target.value)}
                        placeholder="Enter a value"
                        className="mt-1 w-full px-2.5 py-1.5 text-sm rounded-lg bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    )}
                  </div>
                )}
              </>
            )}

            {/* Work: status filter */}
            {kind === 'work' && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Status</label>
                <select
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm rounded-lg bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                >
                  <option value="">All statuses</option>
                  {(sources?.work_statuses ?? []).map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Conversations: mode filter */}
            {kind === 'conversations' && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Handled by</label>
                <select
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 text-sm rounded-lg bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                >
                  <option value="">All conversations</option>
                  {(sources?.conversation_modes ?? []).map((m) => (
                    <option key={m} value={m}>{m === 'ai' ? 'AI' : 'Manual'}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {!sizeLocked && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1">
              <Maximize2 size={10} /> Size
            </label>
            <div className="mt-1 flex gap-1">
              {SIZE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setSize(o.value)}
                  className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    size === o.value
                      ? 'bg-accent text-white border-accent'
                      : 'bg-bg-secondary text-text-secondary border-border-color hover:text-text-primary'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {rangeApplies && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1">
              <Calendar size={10} /> Date window
            </label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 text-sm rounded-lg bg-bg-secondary border border-border-color text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {DATE_RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent hover:bg-accent/90 text-white transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </>
  );
}

// ── Inline per-widget date control (normal view, date-sensitive widgets) ──────

function WidgetDateControl({
  value, loading, onChange,
}: {
  value: string; loading: boolean; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute top-2.5 right-2.5 z-20">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-bg-secondary/90 backdrop-blur border border-border-color text-text-secondary hover:text-text-primary transition-colors"
      >
        {loading
          ? <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
          : <Calendar size={9} />}
        {value === 'global' ? 'Range' : rangeLabel(value)}
        <ChevronDown size={9} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={(e) => { e.preventDefault(); setOpen(false); }} />
          <div className="absolute top-7 right-0 z-40 w-40 bg-card-bg border border-border-color rounded-xl shadow-xl py-1">
            {DATE_RANGE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={(e) => {
                  e.preventDefault(); e.stopPropagation(); setOpen(false);
                  if (o.value !== value) onChange(o.value);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  o.value === value
                    ? 'text-accent font-semibold'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── SortableWidget wrapper ────────────────────────────────────────────────────

// Desktop is a 12-col grid, mobile a 4-col grid. A widget's footprint is driven
// primarily by its display_type (its natural shape); the small/medium/large
// `size` only nudges the width within safe bounds so nothing can balloon. Spans
// always divide 12 cleanly (3·4, 4·3, 6·2, 8+4, 12) so rows pack without orphan
// gaps — the bug the old 3-of-4-column math produced. Class strings are static
// literals so Tailwind's JIT keeps them.
const COL_CLASS: Record<number, string> = {
  3:  'col-span-2 md:col-span-3',   // quarter — KPI, four across
  4:  'col-span-2 md:col-span-4',   // third
  6:  'col-span-4 md:col-span-6',   // half
  8:  'col-span-4 md:col-span-8',   // two-thirds
  12: 'col-span-4 md:col-span-12',  // full row
};

// display_types that always claim the full row — `size` is moot for them.
const FULL_WIDTH_TYPES = new Set(['timeseries', 'table']);
// Tall card shapes (charts / lists / funnels) — half width by default.
const WIDE_TYPES = new Set(['breakdown', 'funnel', 'list']);

function widgetSpanClass(displayType?: string, size?: string): string {
  const dt = displayType ?? 'stat';
  if (FULL_WIDTH_TYPES.has(dt)) return COL_CLASS[12];
  if (WIDE_TYPES.has(dt)) {
    const cols = size === 'large' ? 8 : size === 'small' ? 4 : 6;
    return COL_CLASS[cols];
  }
  // Compact shapes (stat / trend / gauge): a quarter by default.
  const cols = size === 'large' ? 6 : size === 'medium' ? 4 : 3;
  return COL_CLASS[cols];
}

function SortableWidget({
  meta, data, editing, loading, onDelete, onUpdate, onDateChange,
}: {
  meta: WidgetMeta; data?: WidgetData; editing: boolean; loading: boolean;
  onDelete: (id: number) => void;
  onUpdate: (id: number, patch: WidgetPatch) => Promise<void> | void;
  onDateChange: (id: number, range: string) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: meta.id, disabled: !editing });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  const spanClass = widgetSpanClass(data?.display_type, meta.size);

  if (!data) {
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, minHeight: 120 }}
        className={`${spanClass} bg-bg-secondary rounded-2xl animate-pulse`}
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={`${spanClass} relative`}>
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

      {/* Settings button + popover (left of the delete button) */}
      {editing && (
        <>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className="absolute top-3 right-11 z-20 w-6 h-6 rounded-full bg-card-bg border border-border-color text-text-secondary hover:text-text-primary flex items-center justify-center shadow-sm transition-colors"
          >
            <Settings2 size={12} />
          </button>
          {showSettings && (
            <WidgetSettings
              meta={meta}
              onClose={() => setShowSettings(false)}
              onSave={(patch) => onUpdate(meta.id, patch)}
            />
          )}
        </>
      )}

      {/* Inline date control — date-sensitive compact cards, normal view only.
          Header-style cards (breakdown/list/table/funnel) keep their "All →"
          link and use the edit-mode settings popover for window overrides. */}
      {!editing && usesDateWindow(meta.source_type)
        && ['stat', 'trend', 'gauge'].includes(meta.display_type) && (
        <WidgetDateControl
          value={meta.date_range || 'global'}
          loading={loading}
          onChange={(v) => onDateChange(meta.id, v)}
        />
      )}

      {/* Per-widget loading shimmer */}
      {loading && (
        <div className="absolute inset-0 z-[15] rounded-2xl bg-card-bg/40 animate-pulse pointer-events-none" />
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
    case 'contacts_new':
    case 'contacts_total':
    case 'contacts_trend':
    case 'contacts_timeseries':
    case 'contacts_by_source':
    case 'contacts_by_meta_campaign':
    case 'contacts_by_tag':
    case 'contacts_by_group':
    case 'recent_contacts':
      return 'Contacts';
    case 'pipeline_total_open_value':
    case 'pipeline_closing_week':
    case 'pipeline_win_rate_all':
    case 'pipeline_stuck_all':
    case 'pipeline_added_today_all':
      return 'Pipeline';
    // Per-pipeline widgets carry source_name → one tab per pipeline (like datasheets)
    case 'pipeline_open_value':
    case 'pipeline_weighted_value':
    case 'pipeline_added':
    case 'pipeline_won':
    case 'pipeline_win_rate':
    case 'pipeline_by_stage':
    case 'pipeline_value_by_stage':
    case 'pipeline_funnel':
    case 'pipeline_velocity':
      return opt.source_name ?? 'Pipeline';
    case 'conversations_unread':
    case 'conversations_active':
    case 'recent_conversations':
    case 'conversations_timeseries':
    case 'ai_vs_manual_split':
    case 'messages_by_channel':
    case 'unknown_senders':
    case 'channels_health':
      return 'Conversations';
    case 'followups_due':
      return 'Follow-ups';
    case 'agents_active':
    case 'agents_total_runs':
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
    case 'work_completed':
    case 'work_by_priority':
      return 'Work';
    case 'wallet_balance':
    case 'wallet_spend':
    case 'wallet_usage_gauge':
      return 'Money';
    case 'recent_activity':
    case 'ai_insights':
      return 'Activity';
    case 'custom_list':
      // Bound to a datasheet → live in that datasheet's tab (next to "Recent X");
      // the generic (unbound) List tile lives under "Lists".
      return opt.source_name ?? 'Lists';
    case 'team_active_employees':
    case 'team_attendance':
    case 'team_live_tasks':
    case 'team_completion_rate':
      return 'Team';
    // All datasheet-derived source types use source_name as the tab label
    case 'datasheet_count':
    case 'datasheet_recent':
    case 'datasheet_list':
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
  'Contacts':      { icon: Users,         color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/30'       },
  'Pipeline':      { icon: BarChart3,     color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-50 dark:bg-violet-900/30'   },
  'Conversations': { icon: MessageSquare, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
  'Follow-ups':    { icon: Clock,         color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-50 dark:bg-violet-900/30'   },
  'AI Agents':     { icon: Bot,           color: 'text-purple-600 dark:text-purple-400',   bg: 'bg-purple-50 dark:bg-purple-900/30'   },
  'Campaigns':     { icon: Megaphone,     color: 'text-pink-600 dark:text-pink-400',       bg: 'bg-pink-50 dark:bg-pink-900/30'       },
  'Work':          { icon: ListChecks,    color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/30'     },
  'Money':         { icon: Wallet,        color: 'text-green-600 dark:text-green-400',     bg: 'bg-green-50 dark:bg-green-900/30'     },
  'Activity':      { icon: Activity,      color: 'text-cyan-600 dark:text-cyan-400',       bg: 'bg-cyan-50 dark:bg-cyan-900/30'       },
  'Team':          { icon: UsersRound,    color: 'text-green-600 dark:text-green-400',     bg: 'bg-green-50 dark:bg-green-900/30'     },
  'Lists':         { icon: ListChecks,    color: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-50 dark:bg-indigo-900/30'   },
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

// ── Widget schematic preview (data-free, no Recharts — cheap "see before you add") ─
// Renders a small, theme-aware mock of each display_type using the source's colour
// config, so the Add flow shows what a widget looks like without fetching data or
// mounting dozens of chart instances.

function MiniSpark({ area = false }: { area?: boolean }) {
  // Fixed, pleasant upward-drifting shape — currentColor inherits the source tint.
  const line = '0,17 12,11 24,14 36,6 48,10 60,3 72,7';
  return (
    <svg viewBox="0 0 72 20" className="w-full h-4" preserveAspectRatio="none">
      {area && <polygon points={`0,20 ${line} 72,20`} fill="currentColor" fillOpacity={0.12} />}
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const MINI_BARS = [0.9, 0.62, 0.4];   // shared descending widths for bar-ish previews

function WidgetPreview({
  displayType, cfg,
}: {
  displayType: string;
  cfg: { icon: React.ElementType; bg: string; icon_color: string };
}) {
  const Icon = cfg.icon;
  const chip = (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg ${cfg.bg} shrink-0`}>
      <Icon size={12} className={cfg.icon_color} />
    </span>
  );

  let body: React.ReactNode;
  switch (displayType) {
    case 'stat':
      body = (
        <div className="h-full px-3 py-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            {chip}
            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 tabular-nums">
              +12%
            </span>
          </div>
          <div className="text-base font-bold text-text-primary tracking-tight leading-none tabular-nums">1,284</div>
          <MiniSpark />
        </div>
      );
      break;
    case 'trend':
      body = (
        <div className="h-full px-3 py-2.5 flex flex-col justify-center gap-1.5">
          <div className="text-base font-bold text-text-primary tracking-tight tabular-nums">842</div>
          <MiniSpark />
        </div>
      );
      break;
    case 'timeseries':
      body = (
        <div className="h-full px-3 py-2.5 flex flex-col justify-center">
          <div className="flex-1 min-h-0"><MiniSpark area /></div>
        </div>
      );
      break;
    case 'breakdown':
      body = (
        <div className="h-full px-3 py-2.5 flex items-center gap-3">
          <svg viewBox="0 0 36 36" className="w-9 h-9 shrink-0 -rotate-90">
            <circle cx={18} cy={18} r={14} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={5} />
            <circle cx={18} cy={18} r={14} fill="none" stroke="currentColor" strokeWidth={5}
              strokeLinecap="round" strokeDasharray={`${0.6 * 2 * Math.PI * 14} ${2 * Math.PI * 14}`} />
          </svg>
          <div className="flex-1 space-y-1.5">
            {MINI_BARS.map((w, i) => (
              <div key={i} className="h-1.5 rounded-full bg-current" style={{ width: `${w * 100}%`, opacity: 0.7 - i * 0.18 }} />
            ))}
          </div>
        </div>
      );
      break;
    case 'gauge':
      body = (
        <div className="h-full flex flex-col items-center justify-center gap-0.5">
          <svg viewBox="0 0 100 54" className="w-[86px]">
            <path d="M 8 50 A 42 42 0 0 1 92 50" fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={7} />
            <path d="M 8 50 A 42 42 0 0 1 92 50" fill="none" stroke="currentColor" strokeWidth={7}
              strokeLinecap="round" strokeDasharray={`${0.68 * Math.PI * 42} ${Math.PI * 42}`} />
          </svg>
          <span className="text-sm font-bold text-text-primary -mt-1 tabular-nums">68%</span>
        </div>
      );
      break;
    case 'funnel':
      body = (
        <div className="h-full px-3 py-2.5 flex flex-col justify-center gap-1.5">
          {[0.95, 0.7, 0.45, 0.25].map((w, i) => (
            <div key={i} className="h-2.5 rounded bg-current" style={{ width: `${w * 100}%`, opacity: 0.75 - i * 0.14 }} />
          ))}
        </div>
      );
      break;
    case 'list':
      body = (
        <div className="h-full px-3 py-2.5 flex flex-col justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-current shrink-0" style={{ opacity: 0.6 - i * 0.12 }} />
              <span className="h-1.5 rounded-full bg-text-secondary/25" style={{ width: `${70 - i * 14}%` }} />
            </div>
          ))}
        </div>
      );
      break;
    case 'table':
      body = (
        <div className="h-full px-3 py-2.5 flex flex-col justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[8px] font-bold text-text-secondary tabular-nums w-2">{i + 1}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" style={{ opacity: 0.7 - i * 0.15 }} />
              <span className="h-1.5 rounded-full bg-text-secondary/25 flex-1" style={{ maxWidth: `${64 - i * 12}%` }} />
              <span className="h-1.5 w-4 rounded-full bg-text-secondary/30 ml-auto" />
            </div>
          ))}
        </div>
      );
      break;
    default:
      body = (
        <div className="h-full flex items-center justify-center">{chip}</div>
      );
  }

  return (
    <div className={`h-[84px] rounded-xl bg-bg-secondary/50 border border-border-color/60 overflow-hidden ${cfg.icon_color}`}>
      {body}
    </div>
  );
}

// Curated high-value sources surfaced first for busy SMB owners (order matters).
const RECOMMENDED_SOURCES = [
  'contacts_new', 'conversations_unread', 'pipeline_total_open_value',
  'pipeline_open_value', 'followups_due', 'work_overdue',
  'wallet_balance', 'contacts_by_source',
];

/* Stable identity for a widget option (used for selection keys). */
function optKey(opt: WidgetOption) {
  return `${opt.source_type}|${opt.source_id ?? ''}|${opt.display_type}`;
}

function AddWidgetModal({
  options, onClose, onAdd,
}: {
  options: WidgetOption[];
  onClose: () => void;
  onAdd: (opts: WidgetOption[]) => Promise<void>;
}) {
  const [selected,        setSelected]        = useState<Map<string, WidgetOption>>(new Map());
  const [saving,          setSaving]          = useState(false);
  const [activeCategory,  setActiveCategory]  = useState<string>('All');
  const [search,          setSearch]          = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);

  const toggle = (opt: WidgetOption) => {
    if (saving) return;
    setSelected(prev => {
      const next = new Map(prev);
      const k = optKey(opt);
      if (next.has(k)) next.delete(k); else next.set(k, opt);
      return next;
    });
  };

  // Autofocus search on desktop; Escape closes.
  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* Derive ordered source tabs from available options */
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    // Fixed order for core sources first
    for (const cat of ['Lists', 'Contacts', 'Pipeline', 'Conversations', 'AI Agents', 'Campaigns', 'Work', 'Team', 'Money', 'Follow-ups', 'Activity']) {
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

  const q = search.trim().toLowerCase();

  /* Search overrides category — flat, ranked match on title + description. */
  const searchResults = useMemo(() => {
    if (!q) return [];
    return options.filter(o =>
      `${o.default_title} ${o.description} ${o.source_name ?? ''}`.toLowerCase().includes(q));
  }, [options, q]);

  /* Recommended picks (only on the All tab, not while searching). */
  const recommended = useMemo(() => {
    const picks: WidgetOption[] = [];
    const used = new Set<string>();
    for (const st of RECOMMENDED_SOURCES) {
      if (used.has(st)) continue;
      const opt = options.find(o => o.source_type === st);
      if (opt) { picks.push(opt); used.add(st); }
    }
    return picks;
  }, [options]);

  /* Sections to render below Recommended.
     - All tab:  one section per category.
     - A category: sub-grouped by display type (Stats/Trends/…). */
  const sections = useMemo(() => {
    if (activeCategory === 'All') {
      return categories
        .map(cat => ({ key: cat, label: cat, items: options.filter(o => getSourceCategory(o) === cat) }))
        .filter(s => s.items.length > 0);
    }
    const inCat = options.filter(o => getSourceCategory(o) === activeCategory);
    const byType: { key: string; label: string; items: WidgetOption[] }[] = [
      { key: 'stat',       label: 'Stats',   items: inCat.filter(o => o.display_type === 'stat')       },
      { key: 'trend',      label: 'Trends',  items: inCat.filter(o => o.display_type === 'trend')      },
      { key: 'gauge',      label: 'Gauges',  items: inCat.filter(o => o.display_type === 'gauge')      },
      { key: 'breakdown',  label: 'Charts',  items: inCat.filter(o => o.display_type === 'breakdown')  },
      { key: 'timeseries', label: 'Series',  items: inCat.filter(o => o.display_type === 'timeseries') },
      { key: 'funnel',     label: 'Funnels', items: inCat.filter(o => o.display_type === 'funnel')     },
      { key: 'table',      label: 'Tables',  items: inCat.filter(o => o.display_type === 'table')      },
      { key: 'list',       label: 'Lists',   items: inCat.filter(o => o.display_type === 'list')       },
    ];
    return byType.filter(s => s.items.length > 0);
  }, [activeCategory, categories, options]);

  async function handleSave() {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    await onAdd([...selected.values()]);
    setSaving(false);
    onClose();
  }

  /* Single widget tile with schematic preview. Tap toggles selection. */
  function Tile({ opt }: { opt: WidgetOption }) {
    const cfg        = getSourceConfig(opt.source_type);
    const tc         = TYPE_COLORS[opt.display_type] ?? TYPE_COLORS.stat;
    const isSelected = selected.has(optKey(opt));
    return (
      <button
        onClick={() => toggle(opt)}
        disabled={saving}
        aria-pressed={isSelected}
        aria-label={`${isSelected ? 'Remove' : 'Add'} ${opt.default_title}`}
        className={`group relative flex flex-col text-left p-2.5 rounded-2xl border bg-card-bg hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 transition-all disabled:opacity-50 ${
          isSelected ? 'border-accent ring-1 ring-accent shadow-md' : 'border-border-color hover:border-accent/60'
        }`}
      >
        <WidgetPreview displayType={opt.display_type} cfg={cfg} />
        <div className="flex items-start gap-2 px-0.5 pt-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text-primary truncate">{opt.default_title}</p>
            <p className="text-[10px] text-text-secondary truncate mt-0.5">{opt.description}</p>
          </div>
          <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${tc.bg} ${tc.text}`}>
            {tc.label}
          </span>
        </div>
        {/* Selection affordance — filled when selected, faint on hover otherwise. */}
        <span className={`absolute top-2 right-2 z-10 flex items-center justify-center w-6 h-6 rounded-full shadow-md transition-all ${
          isSelected
            ? 'bg-accent text-white opacity-100'
            : 'bg-accent text-white opacity-0 group-hover:opacity-100'
        }`}>
          {isSelected ? <Check size={13} /> : <Plus size={13} />}
        </span>
      </button>
    );
  }

  const grid = (items: WidgetOption[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {items.map((opt, idx) => (
        <Tile key={`${opt.source_type}|${opt.source_id ?? ''}|${opt.display_type ?? ''}|${idx}`} opt={opt} />
      ))}
    </div>
  );

  const sectionHeader = (label: string, icon?: React.ReactNode) => (
    <div className="flex items-center gap-2 px-1 mb-2">
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-widest text-text-secondary">{label}</span>
      <div className="flex-1 h-px bg-border-color" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card-bg rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col border border-border-color">

        {/* ── Header + search ── */}
        <div className="px-5 pt-5 pb-3 border-b border-border-color">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Add widgets</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Tap to select as many as you like, then add them all at once
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-xl border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors ml-3 mt-0.5 shrink-0"
            >
              <X size={14} />
            </button>
          </div>
          {/* Search */}
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search widgets…"
              className="w-full pl-9 pr-8 py-2 text-sm rounded-xl bg-bg-secondary border border-border-color text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* ── Category tabs (hidden while searching) ── */}
        {!q && (
          <div className="relative border-b border-border-color">
            {/* edge fades hint that the strip scrolls horizontally */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card-bg to-transparent z-10" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card-bg to-transparent z-10" />

            <div className="flex items-stretch gap-0.5 px-4 overflow-x-auto no-scrollbar">
              {(() => {
                const active = activeCategory === 'All';
                return (
                  <button
                    onClick={() => setActiveCategory('All')}
                    className={`group relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3.5 text-[13px] font-semibold shrink-0 transition-colors ${
                      active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <LayoutGrid size={14} className={active ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary transition-colors'} />
                    All
                    <span className={`absolute inset-x-1.5 bottom-0 h-0.5 rounded-full transition-all ${active ? 'bg-accent' : 'bg-transparent'}`} />
                  </button>
                );
              })()}

              {categories.map(cat => {
                const meta   = getCategoryMeta(cat);
                const Icon   = meta.icon;
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`group relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3.5 text-[13px] font-semibold shrink-0 transition-colors ${
                      active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Icon size={14} className={active ? meta.color : 'text-text-secondary group-hover:text-text-primary transition-colors'} />
                    {cat}
                    <span className={`absolute inset-x-1.5 bottom-0 h-0.5 rounded-full transition-all ${active ? 'bg-accent' : 'bg-transparent'}`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 p-4 space-y-5">
          {q ? (
            /* Search results — flat grid */
            searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-secondary text-sm gap-2">
                <Search size={24} className="opacity-30" />
                No widgets match “{search}”
              </div>
            ) : (
              <div>
                {sectionHeader(`${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`)}
                {grid(searchResults)}
              </div>
            )
          ) : (
            <>
              {/* Recommended (All tab only) */}
              {activeCategory === 'All' && recommended.length > 0 && (
                <div>
                  {sectionHeader('Recommended', <Sparkles size={13} className="text-accent" />)}
                  {grid(recommended)}
                </div>
              )}

              {sections.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-text-secondary text-sm gap-2">
                  <Database size={24} className="opacity-30" />
                  No widgets available for this source
                </div>
              )}

              {sections.map(sec => (
                <div key={sec.key}>
                  {sectionHeader(sec.label)}
                  {grid(sec.items)}
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Footer — batch add ── */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-border-color bg-card-bg rounded-b-2xl">
          <span className="text-xs text-text-secondary">
            {selected.size === 0
              ? 'No widgets selected'
              : `${selected.size} widget${selected.size === 1 ? '' : 's'} selected`}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {selected.size > 0 && !saving && (
              <button
                onClick={() => setSelected(new Map())}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={selected.size === 0 || saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white shadow-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving
                ? <><div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Adding…</>
                : <><Plus size={14} /> {selected.size > 0 ? `Add ${selected.size} widget${selected.size === 1 ? '' : 's'}` : 'Add widgets'}</>}
            </button>
          </div>
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
      <div className="grid grid-cols-4 md:grid-cols-12 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="col-span-2 md:col-span-3 h-[116px] bg-bg-secondary rounded-2xl animate-pulse" />
        ))}
        {[1, 2].map(i => (
          <div key={i} className="col-span-4 md:col-span-6 h-[200px] bg-bg-secondary rounded-2xl animate-pulse" />
        ))}
        <div className="col-span-4 md:col-span-12 h-[180px] bg-bg-secondary rounded-2xl animate-pulse" />
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
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [layouts,   setLayouts]   = useState<Layout[]>([]);
  const [agents,    setAgents]    = useState<AgentSummary[]>([]);
  // Widget Composer (spec-based authoring) — datasheets are the phase-1 sources.
  const [showComposer,  setShowComposer]  = useState(false);
  const [composerSheets, setComposerSheets] = useState<{ id: number; name: string }[]>([]);
  const [composerPipelines, setComposerPipelines] = useState<{ id: number; name: string }[]>([]);

  // A `?layout=<id>` URL param (e.g. a System's dashboard link in the sidebar)
  // selects a SPECIFIC layout to view, fetched via GET — it wins over the
  // globally-active layout. Clicking a layout in the switcher updates this too.
  const searchParams = useSearchParams();
  const [selectedLayoutId, setSelectedLayoutId] = useState<number | null>(() => {
    const v = Number(searchParams.get('layout'));
    return Number.isFinite(v) && v > 0 ? v : null;
  });
  // Follow the URL param if it changes via client navigation.
  useEffect(() => {
    const v = Number(searchParams.get('layout'));
    setSelectedLayoutId(Number.isFinite(v) && v > 0 ? v : null);
  }, [searchParams]);

  // The layout to DISPLAY: an explicit selection (URL or switcher) that exists in
  // the user's layouts wins; otherwise the globally-active one.
  const activeLayout =
    (selectedLayoutId != null && layouts.find((l) => l.id === selectedLayoutId)) ||
    layouts.find((l) => l.is_active) || null;
  const activeLayoutId = activeLayout?.id ?? null;

  // The agent the composer opens with = the active layout's bound default, else
  // the Dashboard Designer. Selecting a different one in the composer persists it
  // as this layout's default (below), so the chat surface opens with it too.
  const designerId = agents.find((a) => a.kind === 'dashboard_designer')?.id ?? null;
  const composerAgentId =
    (activeLayout?.default_agent_id != null &&
      agents.some((a) => a.id === activeLayout.default_agent_id)
      ? activeLayout.default_agent_id
      : designerId);
  const composerAgentKind =
    agents.find((a) => a.id === composerAgentId)?.kind ?? 'dashboard_designer';

  // Team Pulse state removed — now exposed via team_* widgets users can add.

  const startDate = useDateRangeStore((s) => s.startDate);
  const endDate   = useDateRangeStore((s) => s.endDate);

  const router = useRouter();

  // Scroll container for the grid — the floating SmartInput hides on scroll-down.
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // "Set up with AI" → hand a kickoff prompt to the designer chat (same path the
  // composer uses: stage the text, the chat view replays it on the live socket).
  const setupWithAI = useCallback(() => {
    useStreamStore.getState().stageText(
      'Set up my dashboard with the most useful widgets for my business.',
    );
    router.push('/dashboard/chat');
  }, [router]);

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

  // Internal-chat agents for the composer's agent picker (best-effort).
  useEffect(() => {
    let alive = true;
    void listInternalAgents().then((a) => { if (alive) setAgents(a); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Composer agent switch → set this agent as the ACTIVE layout's default. Optimistic
  // local update + persist; the chat surface then opens with it (reads layout default).
  const handleComposerSwitch = useCallback((agentId: number) => {
    if (activeLayoutId == null) return;
    const next = agentId === designerId ? null : agentId;   // designer = cleared default
    setLayouts((prev) =>
      prev.map((l) => (l.id === activeLayoutId ? { ...l, default_agent_id: next } : l)));
    void apiFetch(`/widgets/layouts/${activeLayoutId}`, {
      method: 'PATCH',
      body: JSON.stringify({ default_agent_id: next }),
    }).catch(() => { void loadLayouts(); });   // reconcile on failure
  }, [activeLayoutId, designerId, loadLayouts]);

  const loadAll = useCallback(async () => {
    try {
      const ls = await loadLayouts();
      // Honor a URL-selected layout if it resolves; else the active one.
      const sel = selectedLayoutId != null && ls.some((l) => l.id === selectedLayoutId)
        ? selectedLayoutId : null;
      const active = sel ?? ls.find((l) => l.is_active)?.id ?? null;
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
    // Shimmer every date-sensitive card while the new range loads.
    setLoadingIds(new Set(widgets.filter((w) => usesDateWindow(w.source_type)).map((w) => w.id)));
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
      .finally(() => { setDataLoading(false); setLoadingIds(new Set()); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function handleUpdate(id: number, patch: WidgetPatch) {
    // Optimistic meta update so title/size/chip change instantly…
    setWidgets(prev => prev.map(w => (w.id === id ? { ...w, ...patch } : w)));
    await updateWidget(id, patch);
    // …then re-fetch just this widget (size/title/window only affects itself).
    setLoadingIds(prev => new Set(prev).add(id));
    try {
      const d = await fetchOneData(id, startDate, endDate);
      setDataMap(prev => { const m = new Map(prev); m.set(id, d); return m; });
    } finally {
      setLoadingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  // Inline date change (normal view) — persist + refetch only this widget.
  async function handleInlineDate(id: number, range: string) {
    setWidgets(prev => prev.map(w => (w.id === id ? { ...w, date_range: range } : w)));
    setLoadingIds(prev => new Set(prev).add(id));
    try {
      await updateWidget(id, { date_range: range });
      const d = await fetchOneData(id, startDate, endDate);
      setDataMap(prev => { const m = new Map(prev); m.set(id, d); return m; });
    } catch { /* keep previous data on failure */ }
    finally {
      setLoadingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  async function handleAdd(opts: WidgetOption[]) {
    // Create all selected widgets, then refresh data once.
    const created: WidgetMeta[] = [];
    for (const opt of opts) {
      const w = await createWidget({
        title: opt.default_title, source_type: opt.source_type,
        display_type: opt.display_type, size: opt.size,
        source_id: opt.source_id, field_id: opt.field_id, aggregation: opt.aggregation,
        filter_value: opt.filter_value,
      });
      created.push(w);
    }
    setWidgets(prev => [...prev, ...created]);
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

  // Open the Widget Composer immediately, then load the datasheet list to seed
  // step 1 asynchronously — opening must never block on the fetch (core sources
  // don't need it, and a slow/failed call shouldn't wedge the modal shut).
  function openComposer() {
    setShowComposer(true);
    fetchListSources()
      .then(src => {
        setComposerSheets(src.datasheets.map(d => ({ id: d.id, name: d.name })));
        setComposerPipelines((src.pipelines ?? []).map(p => ({ id: p.id, name: p.name })));
      })
      .catch(() => { setComposerSheets([]); setComposerPipelines([]); });
  }

  // After a composed widget is created — refetch this layout's widgets + data.
  async function handleComposerCreated() {
    const ws = await fetchWidgets(activeLayoutId);
    setWidgets(ws);
    const allData = await fetchAllData(startDate, endDate, activeLayoutId);
    const map = new Map<number, WidgetData>();
    allData.forEach(d => map.set(d.widget_id, d));
    setDataMap(map);
    loadLayouts();
  }

  if (loading) return <Skeleton />;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">

      {/* ── Edit-mode banner ── */}
      {editing && (
        <div className="sticky top-0 z-40 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-300 dark:border-amber-800/60 px-6 py-2.5 flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Editing — drag to reorder, × to remove
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={openComposer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent hover:bg-accent/90 text-white transition-colors shadow-sm"
            >
              <Plus size={13} /> Compose
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-sm"
            >
              <Plus size={13} /> Add Widget
            </button>
            <button
              onClick={handleEditToggle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-card-bg border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
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
                onSelect={(id) => setSelectedLayoutId(id)}
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
              <>
                <button
                  onClick={handleEditToggle}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-card-bg border border-border-color text-text-secondary hover:bg-bg-secondary shadow-sm hover:shadow transition-all"
                >
                  <LayoutGrid size={15} /> Customize
                </button>
              </>
            )}
          </div>
        </div>

        {/* Every metric is an addable widget — see the Add Widget modal. New layouts
            seed the "Owner Cockpit" (new contacts, replies owed, money, pipeline,
            needs-attention). The dashboard stays empty until widgets are added. */}

        {/* ── Widget grid ── */}
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-bg-secondary flex items-center justify-center mb-5">
              <BarChart3 size={26} className="text-text-secondary" />
            </div>
            <p className="font-semibold text-text-primary text-base">No widgets yet</p>
            <p className="text-text-secondary text-sm mt-1.5 mb-6 max-w-xs">
              Let the AI build a dashboard for you, or add widgets yourself
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                onClick={setupWithAI}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent hover:bg-accent/90 text-white transition-colors shadow-sm"
              >
                <Zap size={15} /> Set up with AI
              </button>
              <button
                onClick={openComposer}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-card-bg border border-border-color text-text-primary hover:bg-bg-secondary transition-colors"
              >
                <Plus size={15} /> Compose a widget
              </button>
              <button
                onClick={async () => { await loadOptions(); setEditing(true); setShowModal(true); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-card-bg border border-border-color text-text-primary hover:bg-bg-secondary transition-colors"
              >
                <Plus size={15} /> Add a widget
              </button>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-4 md:grid-cols-12 gap-4 items-start [grid-auto-flow:dense] pb-28">
                {widgets.map(meta => (
                  <SortableWidget
                    key={meta.id}
                    meta={meta}
                    data={dataMap.get(meta.id)}
                    editing={editing}
                    loading={loadingIds.has(meta.id)}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                    onDateChange={handleInlineDate}
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

      {/* ── Widget Composer (spec-based) ── */}
      {showComposer && (
        <WidgetComposer
          datasheets={composerSheets}
          pipelines={composerPipelines}
          startDate={startDate}
          endDate={endDate}
          layoutId={activeLayoutId}
          onClose={() => setShowComposer(false)}
          onCreated={handleComposerCreated}
        />
      )}

      </div>

      {/* Floating streaming-agent composer — typing routes to /dashboard/chat.
          The agent picker here sets the ACTIVE layout's default agent. */}
      <SmartInput
        variant="floating"
        scrollRef={scrollRef}
        agentKind={composerAgentKind}
        agents={agents.length ? agents : undefined}
        agentId={composerAgentId}
        onSwitchAgent={agents.length ? handleComposerSwitch : undefined}
      />
    </div>
  );
}
