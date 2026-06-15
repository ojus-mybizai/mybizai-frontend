'use client';

import { useMemo } from 'react';
import {
  SlidersHorizontal, RotateCcw, PanelLeftClose,
  Flame, ArrowUp, Minus, ArrowDown,
  Bot, UserCheck, UserX,
  Zap, Clock, Snowflake, CircleSlash,
  UserPlus, AlarmClock, ContactRound,
  CalendarDays, Tag as TagIcon, Radio, ListChecks,
} from 'lucide-react';
import type {
  ContactFilters, ContactFilterCounts, Priority, RoutingMode,
  Engagement, CreatedWithin, Attention, ContactTag, CustomFilter,
} from '@/services/contacts-v2';
import type { Channel as BusinessChannel } from '@/services/channels';
import type { ContactSourceDef } from '@/services/contact-source-defs';
import type { ContactFieldDef } from '@/services/contact-field-defs';

interface Props {
  filters: ContactFilters;
  counts: ContactFilterCounts | null;
  loadingCounts: boolean;
  tags: ContactTag[];
  channelInstances: BusinessChannel[];
  sourceDefs: ContactSourceDef[];
  fieldDefs: ContactFieldDef[];
  onChange: (patch: Partial<ContactFilters>) => void;
  onReset: () => void;
  onCollapse: () => void;
}

// ── Segment option metadata ───────────────────────────────────────────────────

const PRIORITY_OPTS: { value: Priority; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'hot',    label: 'Hot',    icon: <Flame className="w-3.5 h-3.5" />,     color: 'text-red-500' },
  { value: 'high',   label: 'High',   icon: <ArrowUp className="w-3.5 h-3.5" />,   color: 'text-orange-500' },
  { value: 'medium', label: 'Medium', icon: <Minus className="w-3.5 h-3.5" />,     color: 'text-yellow-600' },
  { value: 'low',    label: 'Low',    icon: <ArrowDown className="w-3.5 h-3.5" />, color: 'text-blue-500' },
];

const ENGAGEMENT_OPTS: { value: Engagement; label: string; hint: string; icon: React.ReactNode; color: string }[] = [
  { value: 'active', label: 'Active',         hint: 'Messaged in last 7 days',  icon: <Zap className="w-3.5 h-3.5" />,        color: 'text-green-600' },
  { value: 'recent', label: 'Recent',         hint: '8–30 days ago',            icon: <Clock className="w-3.5 h-3.5" />,      color: 'text-teal-600' },
  { value: 'cold',   label: 'Going cold',     hint: 'No reply in 30+ days',     icon: <Snowflake className="w-3.5 h-3.5" />,  color: 'text-sky-600' },
  { value: 'never',  label: 'Never messaged', hint: 'No conversation yet',      icon: <CircleSlash className="w-3.5 h-3.5" />, color: 'text-text-secondary' },
];

const ATTENTION_OPTS: { value: Attention; label: string; hint: string; icon: React.ReactNode; color: string }[] = [
  { value: 'unassigned',       label: 'Unassigned',      hint: 'No owner yet',          icon: <UserPlus className="w-3.5 h-3.5" />,     color: 'text-amber-600' },
  { value: 'overdue_followup', label: 'Overdue follow-up', hint: 'Past due reminders',  icon: <AlarmClock className="w-3.5 h-3.5" />,   color: 'text-red-500' },
  { value: 'missing_contact',  label: 'Missing phone/email', hint: 'Cannot be reached', icon: <ContactRound className="w-3.5 h-3.5" />, color: 'text-orange-500' },
];

const LIFECYCLE_OPTS: { value: CreatedWithin; label: string }[] = [
  { value: 'today', label: 'Added today' },
  { value: '7d',    label: 'Added this week' },
  { value: '30d',   label: 'Added this month' },
];

const ROUTING_OPTS: { value: RoutingMode; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'ai',      label: 'AI auto-reply', icon: <Bot className="w-3.5 h-3.5" />,       color: 'text-green-600' },
  { value: 'manual',  label: 'Manual inbox',  icon: <UserCheck className="w-3.5 h-3.5" />, color: 'text-amber-600' },
  { value: 'blocked', label: 'Blocked',       icon: <UserX className="w-3.5 h-3.5" />,     color: 'text-red-500' },
];

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger',
  telegram: 'Telegram', meta_ads: 'Meta Ads', ctwa: 'Click-to-WhatsApp',
  manual: 'Manual', csv: 'CSV Import', website: 'Website', web_form: 'Web Form',
  api: 'API', gmail: 'Google', indiamart: 'IndiaMART',
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ContactFilterRail({
  filters, counts, loadingCounts, tags, channelInstances, sourceDefs, fieldDefs, onChange, onReset, onCollapse,
}: Props) {
  const customFilters = filters.custom_filters ?? [];

  const activeCount = [
    filters.priority, filters.routing_mode, filters.engagement,
    filters.created_within, filters.attention, filters.tag_id,
    filters.source, filters.channel_id,
  ].filter(v => v != null).length + customFilters.length;

  // Display label/color per source key, from the business registry.
  const sourceMeta = useMemo(() => {
    const map = new Map<string, { label: string; color: string | null }>();
    for (const s of sourceDefs) map.set(s.key, { label: s.label, color: s.color });
    return map;
  }, [sourceDefs]);

  const sourceLabel = (key: string) =>
    sourceMeta.get(key)?.label ?? SOURCE_LABELS[key] ?? key.replace(/_/g, ' ');

  const sourceRows = useMemo(() => {
    const counted = counts?.source ?? {};
    // Union of configured sources (registry) + sources actually present in data.
    const keys = new Set<string>([...sourceDefs.map(s => s.key), ...Object.keys(counted)]);
    if (filters.source) keys.add(filters.source);
    const entries: [string, number][] = Array.from(keys).map(k => [k, counted[k] ?? 0]);
    // Sort: non-empty buckets first (by count desc), then empty ones alphabetically.
    return entries.sort((a, b) => (b[1] - a[1]) || sourceLabel(a[0]).localeCompare(sourceLabel(b[0])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts?.source, filters.source, sourceDefs]);

  // ── Custom-field filter helpers ──────────────────────────────────────────────
  const getCF = (fieldId: number): CustomFilter | undefined =>
    customFilters.find(f => f.field_id === fieldId);

  const setCF = (fieldId: number, op: CustomFilter['op'], value: CustomFilter['value'] | null) => {
    const others = customFilters.filter(f => f.field_id !== fieldId);
    const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0);
    onChange({ custom_filters: empty ? others : [...others, { field_id: fieldId, op, value }] });
  };

  return (
    <aside className="w-64 flex-shrink-0 border-r border-border-color bg-bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-color flex-shrink-0">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-text-primary">Filters</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-accent text-white text-[10px] font-bold px-1.5 py-0.5">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {activeCount > 0 && (
            <button
              onClick={onReset}
              title="Clear all filters"
              className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary px-1.5 py-1 rounded-md hover:bg-bg-secondary"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          )}
          <button
            onClick={onCollapse}
            title="Hide filters"
            className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {/* Needs attention — most actionable, surfaced first */}
        <Section title="Needs attention">
          {ATTENTION_OPTS.map(o => (
            <CheckRow
              key={o.value}
              label={o.label}
              hint={o.hint}
              icon={o.icon}
              iconColor={o.color}
              count={counts?.attention?.[o.value]}
              loading={loadingCounts}
              active={filters.attention === o.value}
              onClick={() => onChange({ attention: filters.attention === o.value ? null : o.value })}
            />
          ))}
        </Section>

        {/* Engagement / recency */}
        <Section title="Engagement" icon={<Radio className="w-3 h-3" />}>
          {ENGAGEMENT_OPTS.map(o => (
            <CheckRow
              key={o.value}
              label={o.label}
              hint={o.hint}
              icon={o.icon}
              iconColor={o.color}
              count={counts?.engagement?.[o.value]}
              loading={loadingCounts}
              active={filters.engagement === o.value}
              onClick={() => onChange({ engagement: filters.engagement === o.value ? null : o.value })}
            />
          ))}
        </Section>

        {/* Priority */}
        <Section title="Priority">
          {PRIORITY_OPTS.map(o => (
            <CheckRow
              key={o.value}
              label={o.label}
              icon={o.icon}
              iconColor={o.color}
              count={counts?.priority?.[o.value]}
              loading={loadingCounts}
              active={filters.priority === o.value}
              onClick={() => onChange({ priority: filters.priority === o.value ? null : o.value })}
            />
          ))}
        </Section>

        {/* Lifecycle — date added */}
        <Section title="Recently added" icon={<CalendarDays className="w-3 h-3" />}>
          {LIFECYCLE_OPTS.map(o => (
            <CheckRow
              key={o.value}
              label={o.label}
              count={counts?.lifecycle?.[o.value]}
              loading={loadingCounts}
              active={filters.created_within === o.value}
              onClick={() => onChange({ created_within: filters.created_within === o.value ? null : o.value })}
            />
          ))}
        </Section>

        {/* Source */}
        {sourceRows.length > 0 && (
          <Section title="Source">
            {sourceRows.map(([key, n]) => (
              <CheckRow
                key={key}
                label={sourceLabel(key)}
                dotColor={sourceMeta.get(key)?.color ?? undefined}
                count={n}
                loading={loadingCounts}
                active={filters.source === key}
                onClick={() => onChange({ source: filters.source === key ? null : key })}
              />
            ))}
          </Section>
        )}

        {/* Custom fields — dynamic, driven by global + active-group field defs */}
        {fieldDefs.length > 0 && (
          <Section title="Custom fields" icon={<ListChecks className="w-3 h-3" />}>
            <div className="space-y-3">
              {fieldDefs.map(fd => (
                <CustomFieldFilter
                  key={fd.id}
                  field={fd}
                  current={getCF(fd.id)}
                  onSet={setCF}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Routing */}
        <Section title="Routing">
          {ROUTING_OPTS.map(o => (
            <CheckRow
              key={o.value}
              label={o.label}
              icon={o.icon}
              iconColor={o.color}
              count={counts?.routing?.[o.value]}
              loading={loadingCounts}
              active={filters.routing_mode === o.value}
              onClick={() => onChange({ routing_mode: filters.routing_mode === o.value ? null : o.value })}
            />
          ))}
        </Section>

        {/* Tags */}
        {tags.length > 0 && (
          <Section title="Tags" icon={<TagIcon className="w-3 h-3" />}>
            {tags.map(t => (
              <CheckRow
                key={t.id}
                label={t.name}
                dotColor={t.color ?? '#6366f1'}
                count={counts?.tags?.[String(t.id)] ?? 0}
                loading={loadingCounts}
                active={filters.tag_id === t.id}
                onClick={() => onChange({ tag_id: filters.tag_id === t.id ? null : t.id })}
              />
            ))}
          </Section>
        )}

        {/* Channel */}
        {channelInstances.length > 0 && (
          <Section title="Channel">
            <select
              value={filters.channel_id ?? ''}
              onChange={e => onChange({ channel_id: e.target.value ? Number(e.target.value) : null })}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">All channels</option>
              {channelInstances.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.name} ({ch.type})</option>
              ))}
            </select>
          </Section>
        )}

        {/* Sort */}
        <Section title="Sort by">
          <div className="grid grid-cols-1 gap-1.5">
            <select
              value={filters.sort_by ?? 'created_at'}
              onChange={e => onChange({ sort_by: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="created_at">Date added</option>
              <option value="name">Name</option>
              <option value="priority">Priority</option>
              <option value="updated_at">Last updated</option>
            </select>
            <select
              value={filters.sort_dir ?? 'desc'}
              onChange={e => onChange({ sort_dir: e.target.value as 'asc' | 'desc' })}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
        </Section>
      </div>
    </aside>
  );
}

// ── Custom-field filter control ─────────────────────────────────────────────────
// Renders the right input per field type and maps it to a CustomFilter condition.

function CustomFieldFilter({
  field, current, onSet,
}: {
  field: ContactFieldDef;
  current: CustomFilter | undefined;
  onSet: (fieldId: number, op: CustomFilter['op'], value: CustomFilter['value'] | null) => void;
}) {
  const labelEl = (
    <div className="flex items-center gap-1.5 px-1 mb-1">
      <span className="text-[11px] font-medium text-text-secondary truncate">{field.name}</span>
      {field.group_name && (
        <span className="text-[9px] px-1 rounded bg-bg-secondary text-text-secondary/70 truncate">{field.group_name}</span>
      )}
    </div>
  );

  // Toggle list for select / multi_select
  if ((field.field_type === 'select' || field.field_type === 'multi_select') && field.options?.length) {
    const op = field.field_type === 'multi_select' ? 'has' : 'eq';
    const activeVal = typeof current?.value === 'string' ? current.value : undefined;
    return (
      <div>
        {labelEl}
        <div className="space-y-0.5">
          {field.options.map(opt => (
            <CheckRow
              key={opt}
              label={opt}
              active={activeVal === opt}
              onClick={() => onSet(field.id, op, activeVal === opt ? null : opt)}
            />
          ))}
        </div>
      </div>
    );
  }

  // Yes / No for boolean
  if (field.field_type === 'boolean') {
    const activeVal = typeof current?.value === 'boolean' ? current.value : undefined;
    return (
      <div>
        {labelEl}
        <div className="space-y-0.5">
          <CheckRow label="Yes" active={activeVal === true}  onClick={() => onSet(field.id, 'bool', activeVal === true ? null : true)} />
          <CheckRow label="No"  active={activeVal === false} onClick={() => onSet(field.id, 'bool', activeVal === false ? null : false)} />
        </div>
      </div>
    );
  }

  // Text-ish: substring search (text/textarea/url/email/phone); exact for number; date picker for date
  const op: CustomFilter['op'] = (field.field_type === 'number' || field.field_type === 'date') ? 'eq' : 'contains';
  const inputType = field.field_type === 'date' ? 'date' : field.field_type === 'number' ? 'number' : 'text';
  const value = typeof current?.value === 'string' ? current.value : '';
  return (
    <div>
      {labelEl}
      <input
        type={inputType}
        value={value}
        onChange={e => onSet(field.id, op, e.target.value)}
        placeholder={op === 'contains' ? `Search ${field.name.toLowerCase()}…` : undefined}
        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border-color bg-bg-secondary text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
      />
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-1 mb-1.5">
        {icon && <span className="text-text-secondary/70">{icon}</span>}
        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">{title}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

// ── Checkable row with count badge ─────────────────────────────────────────────

function CheckRow({
  label, hint, icon, iconColor, dotColor, count, loading, active, onClick,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  dotColor?: string;
  count?: number;
  loading?: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const isZero = count === 0 && !active;
  return (
    <button
      onClick={onClick}
      title={hint}
      className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
        active
          ? 'bg-accent/10 ring-1 ring-accent/30'
          : 'hover:bg-bg-secondary'
      } ${isZero ? 'opacity-50' : ''}`}
    >
      {/* leading checkbox indicator */}
      <span
        className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
          active ? 'bg-accent border-accent' : 'border-border-color group-hover:border-accent/50'
        }`}
      >
        {active && (
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none">
            <path d="M2.5 6.2L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      {/* icon or color dot */}
      {icon && <span className={`flex-shrink-0 ${active ? 'text-accent' : iconColor ?? 'text-text-secondary'}`}>{icon}</span>}
      {dotColor && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />}

      {/* label */}
      <span className={`flex-1 truncate text-[13px] ${active ? 'font-medium text-accent' : 'text-text-primary'}`}>
        {label}
      </span>

      {/* count badge */}
      {loading ? (
        <span className="h-3.5 w-6 rounded bg-bg-secondary animate-pulse flex-shrink-0" />
      ) : count != null ? (
        <span className={`flex-shrink-0 text-[11px] tabular-nums font-medium px-1.5 py-0.5 rounded-md ${
          active ? 'bg-accent/15 text-accent' : 'bg-bg-secondary text-text-secondary'
        }`}>
          {count.toLocaleString()}
        </span>
      ) : null}
    </button>
  );
}
