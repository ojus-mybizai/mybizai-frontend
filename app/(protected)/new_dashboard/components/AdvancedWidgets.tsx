'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { X, ArrowUpRight, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

const LineChartBox = dynamic(() => import('../line-chart'), {
  ssr: false,
  loading: () => <div className="w-full h-full rounded-xl bg-bg-secondary animate-pulse" />,
});

interface SeriesPoint { date: string; value: number; }
interface WidgetItem  { label: string; count: number; color?: string; href?: string; subtitle?: string; }
export interface AdvancedWidgetData {
  widget_id: number;
  title: string;
  source_type: string;
  display_type: string;
  value?: number;
  href?: string;
  items?: WidgetItem[];
  series?: SeriesPoint[];
  series_label?: string;
  target?: number;
  unit?: string;
  prev_value?: number | null;
  delta_pct?: number | null;
}

// ── Shared card chrome ──────────────────────────────────────────────────────
function cardCls(editing: boolean) {
  return [
    'bg-card-bg border border-border-color rounded-2xl shadow-sm hover:shadow-md',
    'transition-all duration-200',
    editing ? 'ring-2 ring-dashed ring-blue-200 dark:ring-blue-700/50' : '',
  ].join(' ');
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className="absolute top-3 right-3 z-20 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md"
    >
      <X size={11} />
    </button>
  );
}

function Header({ title, href, editing, accentClass }: { title: string; href?: string; editing: boolean; accentClass: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accentClass}`}>
        <BarChart3 size={15} />
      </div>
      <p className="text-sm font-semibold text-text-primary flex-1 min-w-0 truncate">{title}</p>
      {href && !editing && (
        <Link href={href} className="ml-auto shrink-0 flex items-center gap-0.5 text-xs text-text-secondary hover:text-accent">
          All <ArrowUpRight size={11} />
        </Link>
      )}
    </div>
  );
}

// ── TrendCard: number + sparkline ───────────────────────────────────────────
export function TrendCard({ data, editing, onDelete }: { data: AdvancedWidgetData; editing: boolean; onDelete: () => void }) {
  const series = data.series ?? [];
  const max = Math.max(1, ...series.map((p) => p.value));
  const w = 120, h = 36;
  const step = series.length > 1 ? w / (series.length - 1) : 0;
  const points = series.map((p, i) => `${i * step},${h - (p.value / max) * h}`).join(' ');
  const delta = data.delta_pct;
  const positive = (delta ?? 0) >= 0;

  const inner = (
    <div className={`relative p-5 h-full ${cardCls(editing)}`}>
      {editing && <DeleteBtn onClick={onDelete} />}
      <p className="text-xs font-medium text-text-secondary mb-1.5 truncate">{data.title}</p>
      <div className="flex items-end justify-between gap-3 mb-2">
        <p className="text-[28px] font-bold tracking-tight text-text-primary leading-none">
          {(data.value ?? 0).toLocaleString()}
        </p>
        {delta !== null && delta !== undefined && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums ${
            positive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                     : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
          }`}>
            {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {positive ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
      </div>
      {series.length > 1 && (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9 text-blue-500" preserveAspectRatio="none">
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
      {data.series_label && <p className="text-[10px] text-text-secondary opacity-60 mt-1">{data.series_label}</p>}
    </div>
  );
  return data.href && !editing ? <Link href={data.href} className="block">{inner}</Link> : inner;
}

// ── TimeSeriesCard: full line chart ─────────────────────────────────────────
export function TimeSeriesCard({ data, editing, onDelete }: { data: AdvancedWidgetData; editing: boolean; onDelete: () => void }) {
  const series = data.series ?? [];
  return (
    <div className={`relative p-5 h-full ${cardCls(editing)}`}>
      {editing && <DeleteBtn onClick={onDelete} />}
      <Header title={data.title} href={data.href} editing={editing} accentClass="bg-blue-100 dark:bg-blue-500/15 text-blue-500" />
      {series.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-text-secondary text-sm">No data</div>
      ) : (
        <div className="h-44 text-text-secondary">
          <LineChartBox data={series} color="#3B82F6" />
        </div>
      )}
      {data.series_label && <p className="text-[10px] text-text-secondary opacity-60 mt-1.5">{data.series_label}</p>}
    </div>
  );
}

// ── GaugeCard: radial progress ──────────────────────────────────────────────
export function GaugeCard({ data, editing, onDelete }: { data: AdvancedWidgetData; editing: boolean; onDelete: () => void }) {
  const value = data.value ?? 0;
  const target = data.target ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const unit = data.unit ?? '';

  // SVG radial: half-circle gauge
  const r = 42;
  const c = Math.PI * r;
  const offset = c - (pct / 100) * c;
  const color = pct < 70 ? '#10B981' : pct < 90 ? '#F59E0B' : '#EF4444';

  const inner = (
    <div className={`relative p-5 h-full ${cardCls(editing)}`}>
      {editing && <DeleteBtn onClick={onDelete} />}
      <p className="text-xs font-medium text-text-secondary mb-1 truncate">{data.title}</p>
      <div className="flex flex-col items-center justify-center pt-2">
        <svg viewBox="0 0 100 60" className="w-full max-w-[140px]">
          <path d="M 8 54 A 42 42 0 0 1 92 54" fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={8} className="text-text-secondary" />
          <path
            d="M 8 54 A 42 42 0 0 1 92 54"
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 600ms ease' }}
          />
        </svg>
        <p className="text-[22px] font-bold text-text-primary -mt-3 tabular-nums">{pct}%</p>
        <p className="text-[10px] text-text-secondary opacity-70">
          {unit}{value.toLocaleString()} of {unit}{Math.round(target).toLocaleString()}
        </p>
      </div>
    </div>
  );
  return data.href && !editing ? <Link href={data.href} className="block">{inner}</Link> : inner;
}

// ── FunnelCard: stacked stage bars ──────────────────────────────────────────
export function FunnelCard({ data, editing, onDelete }: { data: AdvancedWidgetData; editing: boolean; onDelete: () => void }) {
  const items = data.items ?? [];
  const max = Math.max(1, ...items.map((i) => i.count));

  return (
    <div className={`relative p-5 h-full ${cardCls(editing)}`}>
      {editing && <DeleteBtn onClick={onDelete} />}
      <Header title={data.title} href={data.href} editing={editing} accentClass="bg-violet-100 dark:bg-violet-500/15 text-violet-500" />
      {items.length === 0 ? (
        <div className="flex items-center justify-center h-28 text-text-secondary text-sm">No active stages</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, idx) => {
            const pct = (it.count / max) * 100;
            const row = (
              <div className="group">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs font-medium text-text-primary truncate">{it.label}</span>
                  <span className="text-xs font-bold text-text-primary tabular-nums">{it.count}</span>
                </div>
                <div
                  className="h-6 rounded-md transition-all"
                  style={{
                    width: `${Math.max(8, pct)}%`,
                    background: it.color ?? '#9CA3AF',
                    opacity: 0.85,
                  }}
                />
              </div>
            );
            return it.href && !editing
              ? <Link key={idx} href={it.href} className="block">{row}</Link>
              : <div key={idx}>{row}</div>;
          })}
        </div>
      )}
    </div>
  );
}

// ── TableCard: ranked rows ──────────────────────────────────────────────────
export function TableCard({ data, editing, onDelete }: { data: AdvancedWidgetData; editing: boolean; onDelete: () => void }) {
  const items = data.items ?? [];
  return (
    <div className={`relative p-5 h-full ${cardCls(editing)}`}>
      {editing && <DeleteBtn onClick={onDelete} />}
      <Header title={data.title} href={data.href} editing={editing} accentClass="bg-amber-100 dark:bg-amber-500/15 text-amber-500" />
      {items.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-text-secondary text-sm">No data</div>
      ) : (
        <div className="divide-y divide-border-color">
          {items.map((it, idx) => {
            const row = (
              <div className="flex items-center gap-3 py-2.5 group">
                <span className="w-5 text-xs font-bold text-text-secondary tabular-nums">{idx + 1}</span>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: it.color ?? '#9CA3AF' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{it.label}</p>
                  {it.subtitle && <p className="text-[10px] text-text-secondary truncate">{it.subtitle}</p>}
                </div>
                <span className="text-sm font-bold text-text-primary tabular-nums shrink-0">{it.count.toLocaleString()}</span>
              </div>
            );
            return it.href && !editing
              ? <Link key={idx} href={it.href} className="block hover:bg-bg-secondary -mx-2 px-2 rounded-lg">{row}</Link>
              : <div key={idx}>{row}</div>;
          })}
        </div>
      )}
    </div>
  );
}
