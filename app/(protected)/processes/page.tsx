'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/permission-guard';
import {
  listProcesses, createProcess, getProcessDashboard,
  type BusinessProcessListItem, type ProcessDashboard,
} from '@/services/processes';
import { listModels, type DynamicModel } from '@/services/dynamic-data';
import TemplateGallery from '@/components/processes/template-gallery';
import {
  Money, Pill,
  Button, Icon, EmptyState, formatNumber, formatPercent, formatCurrency,
  ToastHost, pushToast, formatDate,
} from '@/components/processes/design-system';

const PROCESS_COLORS = ['#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444','#EC4899','#06B6D4','#6366F1','#14B8A6','#F97316'];

// ─── Quick filters for the pipeline list ─────────────────────────────────────

type QuickFilter = 'all' | 'has-stuck' | 'with-value';
const FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'has-stuck',    label: 'Has stuck' },
  { key: 'with-value',   label: 'With value' },
];

// ─── Create-blank modal ──────────────────────────────────────────────────────

function CreateProcessModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState<'lead' | 'contact' | 'datasheet_record'>('lead');
  const [dynamicModelId, setDynamicModelId] = useState<number | null>(null);
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) listModels().then(setModels).catch(() => {});
    else { setName(''); setDescription(''); setEntityType('lead'); setDynamicModelId(null); setError(''); }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (entityType === 'datasheet_record' && !dynamicModelId) { setError('Pick a datasheet'); return; }
    setSubmitting(true); setError('');
    try {
      const p = await createProcess({
        name: name.trim(),
        description: description.trim() || undefined,
        entity_type: entityType,
        dynamic_model_id: entityType === 'datasheet_record' ? dynamicModelId : undefined,
        color: PROCESS_COLORS[Math.floor(Math.random() * PROCESS_COLORS.length)],
      });
      pushToast('success', `Created "${p.name}"`);
      onCreated(p.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to create process');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl border border-border-color bg-card-bg p-5 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-text-primary">New blank pipeline</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-secondary text-text-secondary"><Icon.close size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name" required>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
              placeholder="e.g. Patient Onboarding"
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none" />
          </Field>
          <Field label="What flows through it?">
            <div className="grid grid-cols-3 gap-2">
              {([['lead','Leads'],['contact','Contacts'],['datasheet_record','Records']] as const).map(([v,l]) => (
                <button key={v} type="button"
                  onClick={() => { setEntityType(v); setDynamicModelId(null); }}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition-quick
                    ${entityType === v
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border-color bg-bg-primary text-text-primary hover:bg-bg-secondary'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </Field>
          {entityType === 'datasheet_record' && (
            <Field label="Datasheet">
              <select value={dynamicModelId ?? ''} onChange={(e) => setDynamicModelId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                <option value="">Pick…</option>
                {models.filter(m => m.status === 'active').map(m => <option key={m.id} value={m.id}>{m.display_name || m.name}</option>)}
              </select>
            </Field>
          )}
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create pipeline'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-text-secondary mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

// ─── Main hub page ───────────────────────────────────────────────────────────

export default function ProcessesPage() {
  const router = useRouter();
  const [processes, setProcesses] = useState<BusinessProcessListItem[]>([]);
  const [dashboard, setDashboard] = useState<ProcessDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QuickFilter>('all');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true); setError('');
    try {
      const [list, dash] = await Promise.all([
        listProcesses(),
        getProcessDashboard().catch(() => null),
      ]);
      setProcesses(list);
      setDashboard(dash);
    } catch (err: any) {
      setError(err?.message || 'Failed to load processes');
    } finally {
      setLoading(false);
    }
  }

  function handleCreated(id: number) {
    setCreateOpen(false); setGalleryOpen(false);
    router.push(`/processes/${id}`);
  }

  const filtered = useMemo(() => {
    return processes.filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === 'has-stuck' && (p.stuck_count ?? 0) === 0) return false;
      if (filter === 'with-value' && !(p.open_value && p.open_value > 0)) return false;
      return true;
    });
  }, [processes, search, filter]);

  return (
    <PermissionGuard permission="manage_work" module="lms">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {/* Page hero */}
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Pipelines</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {loading ? 'Loading…' : `${processes.length} pipeline${processes.length !== 1 ? 's' : ''} · drag entries through stages, watch them convert`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" icon={<Icon.grid size={14} />} onClick={() => setGalleryOpen(true)}>
              Templates
            </Button>
            <Button variant="primary" size="md" icon={<Icon.plus size={14} />} onClick={() => setCreateOpen(true)}>
              New pipeline
            </Button>
          </div>
        </div>

        {/* Unified KPI strip — one horizontal band, no double row */}
        {!loading && dashboard && (
          <div className="rounded-xl border border-border-color bg-card-bg p-4 mb-5">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 md:gap-6">
              <KpiCell
                label="Open pipeline"
                primary={<Money value={dashboard.open_value} compact size="2xl" />}
                sub={<>Weighted <Money value={dashboard.weighted_value} compact size="sm" tone="muted" /></>}
                emphasis
              />
              <KpiCell
                label="Closing this week"
                primary={<Money value={dashboard.closing_this_week_value} compact size="lg" />}
                sub={
                  dashboard.stuck_count > 0 ? (
                    <Pill tone="danger" size="xs" icon={<Icon.alert size={9} />}>{dashboard.stuck_count} stuck</Pill>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">On track</span>
                  )
                }
              />
              <KpiCell
                label="Win rate · 30d"
                primary={<span className={`text-lg font-semibold tabular-nums ${dashboard.win_rate_30d >= 0.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {formatPercent(dashboard.win_rate_30d)}
                </span>}
              />
              <KpiCell
                label="Added today"
                primary={<span className="text-lg font-semibold tabular-nums">{formatNumber(dashboard.added_today)}</span>}
              />
              <KpiCell
                label="Won today"
                primary={<span className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatNumber(dashboard.completed_today)}</span>}
              />
              <KpiCell
                label="Stuck total"
                primary={<span className={`text-lg font-semibold tabular-nums ${dashboard.stuck_count > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {formatNumber(dashboard.stuck_count)}
                </span>}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20 px-4 py-3 text-sm text-red-800 dark:text-red-300">
            {error}
            <button onClick={loadData} className="ml-2 underline">Retry</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-40 rounded-xl bg-bg-secondary animate-pulse" />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && processes.length === 0 && (
          <EmptyState
            icon="🚀"
            title="Build your first pipeline"
            body="Start from an industry template, or design a custom workflow from scratch."
            action={
              <div className="flex gap-2">
                <Button variant="primary" size="md" icon={<Icon.grid size={14} />} onClick={() => setGalleryOpen(true)}>
                  Browse templates
                </Button>
                <Button variant="secondary" size="md" onClick={() => setCreateOpen(true)}>
                  Start blank
                </Button>
              </div>
            }
          />
        )}

        {/* Filters + pipeline grid */}
        {!loading && processes.length > 0 && (
          <>
            <div className="flex items-end justify-between mb-3 gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Your pipelines</h2>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  {filtered.length === processes.length
                    ? `${processes.length} total`
                    : `${filtered.length} of ${processes.length} shown`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center rounded-md border border-border-color overflow-hidden h-7">
                  {FILTERS.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={`px-2.5 h-full text-[11px] font-medium transition-quick
                        ${filter === f.key ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-secondary bg-card-bg'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary">
                    <Icon.search size={12} />
                  </span>
                  <input
                    type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search pipelines…"
                    className="pl-7 pr-2.5 h-7 text-[11px] rounded-md border border-border-color bg-card-bg text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent w-44"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(p => <PipelineCard key={p.id} p={p} onClick={() => router.push(`/processes/${p.id}`)} />)}
              {filtered.length === 0 && (
                <p className="col-span-full text-center text-sm text-text-secondary py-8">No pipelines match.</p>
              )}
            </div>
          </>
        )}
      </div>

      <CreateProcessModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      {galleryOpen && <TemplateGallery onClose={() => setGalleryOpen(false)} onCreated={handleCreated} />}
      <ToastHost />
    </PermissionGuard>
  );
}

// ─── KPI cell (inline, used by KPI strip) ────────────────────────────────────

function KpiCell({
  label, primary, sub, emphasis,
}: {
  label: string;
  primary: React.ReactNode;
  sub?: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={emphasis ? 'col-span-2 md:col-span-1 md:border-r md:border-border-color md:pr-6' : ''}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary mb-0.5">{label}</p>
      <div className="leading-tight">{primary}</div>
      {sub && <div className="mt-0.5 text-[11px] text-text-secondary flex items-center gap-1.5 flex-wrap">{sub}</div>}
    </div>
  );
}

// ─── Pipeline card with real stage-shape preview ─────────────────────────────

function PipelineCard({ p, onClick }: { p: BusinessProcessListItem; onClick: () => void }) {
  const color = p.color || '#3B82F6';
  const stageCount = Math.max(1, p.stage_count || 1);
  const fillCount = Math.min(stageCount, Math.max(1, Math.ceil((p.active_entries / Math.max(1, p.active_entries + 1)) * stageCount)));

  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-border-color bg-card-bg hover:border-accent/50 hover:shadow-md transition-card overflow-hidden group focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <div className="h-1" style={{ background: color }} />
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-text-primary group-hover:text-accent transition-quick truncate">{p.name}</p>
            <p className="text-[11px] text-text-secondary capitalize mt-0.5">
              {p.entity_type === 'datasheet_record' ? (p.dynamic_model_name || 'Record') : p.entity_type}
              <span className="mx-1 text-text-secondary/40">·</span>
              {p.stage_count} {p.stage_count === 1 ? 'stage' : 'stages'}
            </p>
          </div>
          {(p.stuck_count ?? 0) > 0 && (
            <Pill tone="danger" size="xs" icon={<Icon.alert size={9} />}>{p.stuck_count}</Pill>
          )}
        </div>

        {/* Real stage-shape preview — N segments visualizes the pipeline structure */}
        <div className="mb-3">
          <div className="flex items-center gap-[3px]" aria-label={`${p.stage_count} stages`}>
            {Array.from({ length: stageCount }).map((_, i) => {
              const filled = i < fillCount;
              return (
                <div
                  key={i}
                  className="flex-1 h-1.5 rounded-full transition-card"
                  style={{
                    background: filled ? color : `${color}25`,
                    opacity: filled ? 1 - i * 0.05 : 0.4,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Money + counts */}
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Money value={p.open_value ?? 0} compact size="lg" tone="success" />
            <p className="text-[11px] text-text-secondary mt-0.5 truncate">
              {p.active_entries} active
              {(p.weighted_value ?? 0) > 0 && (
                <> · weighted {formatCurrency(p.weighted_value ?? 0, true)}</>
              )}
            </p>
          </div>
          <span className="inline-flex items-center text-text-secondary/40 group-hover:text-accent transition-quick">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
        </div>

        {p.created_at && (
          <p className="mt-3 pt-2 border-t border-border-color text-[10px] text-text-secondary">
            Created {formatDate(p.created_at)}
          </p>
        )}
      </div>
    </button>
  );
}
