'use client';

/**
 * Widget Composer — the 3-step wizard that authors a *saved query* (source +
 * filters + measure/dimension + tagged date field) decoupled from its *view*.
 *
 *   1. Model    → pick a datasheet (the only composable source in phase 1)
 *   2. Filters  → AND conditions with typed operators (incl. relative-date)
 *   3. Shape+View → measure / group-by / date field, then a view whose options
 *                   are constrained to the query's shape, with a live real-data
 *                   preview from POST /widgets/preview.
 *
 * Backend: app/services/widgets. See DASHBOARD_WIDGET_COMPOSER_PLAN.md.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, ArrowLeft, ArrowRight, Plus, Trash2, Loader2, Check,
  Hash, Gauge, BarChart3, PieChart, Table as TableIcon, List as ListIcon,
  TrendingUp, Activity, Filter as FilterIcon, Database, GitBranch,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

// ── Types mirroring the backend composer shapes ──────────────────────────────
interface ComposerField {
  key: string; label: string; type: string;
  roles: string[]; cardinality: string; options: string[]; operators: string[];
  choices?: { value: string; label: string }[];   // value/label pairs (e.g. groups)
  groupId?: number | null;                         // contact custom fields: owning group
}
// One row of GET /contact-field-defs (contacts only, group-scoped custom fields).
interface ContactFieldDef {
  id: number; group_id: number | null; name: string;
  field_type: string; options: string[] | null;
}
interface FieldsResp {
  source: string;
  caps: { has_target: boolean; supports_funnel: boolean };
  fields: ComposerField[];
}
interface FilterClause { field: string; operator: string; value?: unknown; value2?: unknown; }
interface WidgetDataItem { label: string; count: number; color?: string; subtitle?: string; }
interface SeriesPoint { date: string; value: number; }
interface WidgetData {
  display_type: string; value?: number; unit?: string; href?: string;
  items?: WidgetDataItem[]; series?: SeriesPoint[];
}
interface PreviewResp { view: string; available_views: string[]; data: WidgetData; }
interface DatasheetSource { id: number; name: string; }
interface PipelineSource { id: number; name: string; }

// Core (non-datasheet) composable sources — resolvers registered on the backend.
// Note: `pipeline` is offered per-process below (source key `pipeline:<id>`), not
// as a generic card — the composer must let the user pick WHICH pipeline.
const CORE_SOURCES: { key: string; name: string }[] = [
  { key: 'contacts', name: 'Contacts' },
  { key: 'work', name: 'Work / Tasks' },
  { key: 'conversations', name: 'Conversations' },
];

const VIEW_META: Record<string, { label: string; icon: React.ElementType }> = {
  stat: { label: 'Stat', icon: Hash },
  gauge: { label: 'Gauge', icon: Gauge },
  bar: { label: 'Bar', icon: BarChart3 },
  pie: { label: 'Pie', icon: PieChart },
  breakdown: { label: 'Breakdown', icon: BarChart3 },
  funnel: { label: 'Funnel', icon: FilterIcon },
  table: { label: 'Table', icon: TableIcon },
  list: { label: 'List', icon: ListIcon },
  trend: { label: 'Trend', icon: TrendingUp },
  timeseries: { label: 'Timeline', icon: Activity },
};

// operators that take no value / a single value / two values / an array
const NO_VALUE = new Set(['is_set', 'is_empty', 'is_true', 'is_false', 'before_today']);
const TWO_VALUE = new Set(['between']);
const ARRAY_VALUE = new Set(['in', 'not_in', 'has_any', 'has_all']);
const DAYS_VALUE = new Set(['within_last_n_days', 'older_than']);

const OP_LABEL: Record<string, string> = {
  eq: 'is', neq: 'is not', contains: 'contains', is_set: 'is set', is_empty: 'is empty',
  in: 'is any of', not_in: 'is none of', is_true: 'is true', is_false: 'is false',
  has_any: 'has any of', has_all: 'has all of', gt: '>', gte: '≥', lt: '<', lte: '≤',
  between: 'between', on: 'on', before: 'before', after: 'after',
  before_today: 'before today', within_last_n_days: 'in last N days', older_than: 'older than N days',
  in_group: 'is in group',
};

// Mirror of backend app/services/widgets/descriptors.py::OPERATORS_BY_TYPE — the
// chosen delivery reuses the raw /contact-field-defs endpoint (no operators on it),
// so contact custom fields derive their operator set here. Keep the two in sync.
const OPERATORS_BY_TYPE: Record<string, string[]> = {
  text: ['eq', 'neq', 'contains', 'is_set', 'is_empty'],
  enum: ['eq', 'neq', 'in', 'not_in', 'is_set'],
  boolean: ['is_true', 'is_false'],
  multi_select: ['has_any', 'has_all', 'is_set'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  currency: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'],
  date: ['on', 'before', 'after', 'between', 'before_today', 'within_last_n_days', 'older_than', 'is_set'],
};

// ContactFieldDef.field_type → composer field type. textarea/url/phone/email are
// plain text; select is a single-choice enum; the rest pass through.
function normalizeFieldType(ft: string): string {
  if (['textarea', 'url', 'phone', 'email'].includes(ft)) return 'text';
  if (ft === 'select') return 'enum';
  return ft; // text | number | date | boolean | multi_select
}

function contactFieldToComposerField(def: ContactFieldDef): ComposerField {
  const type = normalizeFieldType(def.field_type);
  return {
    key: `custom:${def.id}`,
    label: def.name,
    type,
    roles: ['filter', 'group'],
    cardinality: def.field_type === 'multi_select' ? 'multi' : 'scalar',
    options: def.options ?? [],
    operators: OPERATORS_BY_TYPE[type] ?? ['eq', 'neq', 'is_set'],
    choices: [],
    groupId: def.group_id ?? null,
  };
}

const inputBase =
  'rounded-lg border border-border-color bg-bg-secondary px-2.5 py-1.5 text-sm text-text-primary ' +
  'focus:outline-none focus:ring-2 focus:ring-accent/40';

export default function WidgetComposer({
  datasheets, pipelines = [], startDate, endDate, layoutId, onClose, onCreated,
}: {
  datasheets: DatasheetSource[];
  pipelines?: PipelineSource[];
  startDate?: string;
  endDate?: string;
  layoutId?: number | null;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<string>('');       // "datasheet:<id>"
  const [fields, setFields] = useState<ComposerField[]>([]);
  const [caps, setCaps] = useState<{ has_target: boolean; supports_funnel: boolean }>({ has_target: false, supports_funnel: false });

  const [filters, setFilters] = useState<FilterClause[]>([]);
  const [measureFn, setMeasureFn] = useState<'count' | 'sum' | 'avg'>('count');
  const [measureField, setMeasureField] = useState<string>('');
  const [dimension, setDimension] = useState<string>('');
  const [dateField, setDateField] = useState<string>('');
  const [timeMode, setTimeMode] = useState<'windowed' | 'snapshot'>('windowed');
  const [view, setView] = useState<string>('');
  const [title, setTitle] = useState<string>('');

  const [availableViews, setAvailableViews] = useState<string[]>([]);
  const [preview, setPreview] = useState<WidgetData | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Contacts-only: group-scoped custom fields. Globals (group_id null) load on
  // source select; a group slice loads when a `groups` filter picks a group and
  // is cleared/replaced when that selection changes (single group).
  const [globalCustom, setGlobalCustom] = useState<ComposerField[]>([]);
  const [groupCustom, setGroupCustom] = useState<ComposerField[]>([]);
  const customFields = useMemo(
    () => (source === 'contacts' ? [...globalCustom, ...groupCustom] : []),
    [source, globalCustom, groupCustom]);

  const allFields = useMemo(() => [...fields, ...customFields], [fields, customFields]);
  const filterFields = useMemo(() => allFields.filter(f => f.roles.includes('filter')), [allFields]);
  const groupFields = useMemo(() => allFields.filter(f => f.roles.includes('group')), [allFields]);
  const measureFields = useMemo(() => allFields.filter(f => f.roles.includes('measure')), [allFields]);
  const dateFields = useMemo(() => allFields.filter(f => f.roles.includes('date')), [allFields]);
  const fieldByKey = useCallback((k: string) => allFields.find(f => f.key === k), [allFields]);

  // the single group currently selected in a `groups` filter clause (or null)
  const selectedGroupId = useMemo(() => {
    const gc = filters.find(c => c.field === 'groups' && c.operator === 'in_group');
    const v = gc?.value;
    const n = v != null && v !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  }, [filters]);

  // cascade: fetch (or clear) the selected group's scoped custom fields
  useEffect(() => {
    if (source !== 'contacts' || selectedGroupId == null) { setGroupCustom([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const defs = await apiFetch<ContactFieldDef[]>(`/contact-field-defs?group_id=${selectedGroupId}`);
        if (!cancelled) setGroupCustom(defs.map(contactFieldToComposerField));
      } catch { if (!cancelled) setGroupCustom([]); }
    })();
    return () => { cancelled = true; };
  }, [source, selectedGroupId]);

  // auto-clear: drop filter clauses / dimension referencing custom fields that are
  // no longer available (group changed or cleared).
  useEffect(() => {
    if (source !== 'contacts') return;
    const valid = new Set(customFields.map(f => f.key));
    setFilters(prev => {
      const next = prev.filter(c => !c.field.startsWith('custom:') || valid.has(c.field));
      return next.length === prev.length ? prev : next;
    });
    if (dimension.startsWith('custom:') && !valid.has(dimension)) setDimension('');
  }, [customFields, source, dimension]);

  // ── select a datasheet → load its field catalog + smart defaults ───────────
  async function pickSource(sourceKey: string, name: string) {
    setSource(sourceKey);
    setTitle(name);
    setError('');
    try {
      const resp = await apiFetch<FieldsResp>(`/widgets/fields?source=${encodeURIComponent(sourceKey)}`);
      setFields(resp.fields);
      setCaps(resp.caps);
      const df = resp.fields.find(f => f.key === 'created_at' && f.roles.includes('date'))
        || resp.fields.find(f => f.roles.includes('date'));
      setDateField(df ? df.key : '');
      setFilters([]); setMeasureFn('count'); setMeasureField(''); setDimension('');
      setTimeMode('windowed'); setView('');
      // contacts: preload global custom fields; reset any prior group slice
      setGroupCustom([]);
      if (sourceKey === 'contacts') {
        try {
          const defs = await apiFetch<ContactFieldDef[]>('/contact-field-defs?group_id=0');
          setGlobalCustom(defs.map(contactFieldToComposerField));
        } catch { setGlobalCustom([]); }
      } else {
        setGlobalCustom([]);
      }
      setStep(2);
    } catch (e) {
      setError(`Could not load fields: ${e}`);
    }
  }

  // ── assemble the spec ──────────────────────────────────────────────────────
  const spec = useMemo(() => {
    const clauses = filters
      .filter(c => c.field && c.operator)
      .map(c => ({ field: c.field, operator: c.operator, value: encodeValue(c) }));
    return {
      source,
      filters: clauses.length ? { op: 'and', clauses } : null,
      measure: { fn: measureFn, field: measureFn === 'count' ? null : (measureField || null) },
      dimension: dimension || null,
      date_field: dateField || null,
      time_mode: timeMode,
    };
  }, [source, filters, measureFn, measureField, dimension, dateField, timeMode]);

  // ── live preview (debounced) whenever the spec or view changes on step 3 ───
  useEffect(() => {
    if (step !== 3 || !source) return;
    const handle = setTimeout(async () => {
      setPreviewing(true); setError('');
      try {
        const body = {
          spec, view: view || null,
          start_date: timeMode === 'windowed' ? startDate : null,
          end_date: timeMode === 'windowed' ? endDate : null,
        };
        const resp = await apiFetch<PreviewResp>('/widgets/preview', {
          method: 'POST', body: JSON.stringify(body),
        });
        setAvailableViews(resp.available_views);
        setPreview(resp.data);
        if (!resp.available_views.includes(view)) setView(resp.view);
      } catch (e) {
        setError(`${e}`); setPreview(null);
      } finally {
        setPreviewing(false);
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, JSON.stringify(spec), view, startDate, endDate]);

  async function create() {
    setSaving(true); setError('');
    try {
      await apiFetch('/widgets', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || 'Untitled widget',
          source_type: source,           // reference only; spec drives resolution
          display_type: view || 'stat',
          spec,
          size: 'medium',
          sort_order: 999,
          layout_id: layoutId ?? undefined,
        }),
      });
      await onCreated();
      onClose();
    } catch (e) {
      setError(`Could not save: ${e}`);
      setSaving(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/40 backdrop-blur-sm">
      <div className="m-auto flex h-[92vh] w-[min(1040px,96vw)] flex-col overflow-hidden rounded-2xl border border-border-color bg-card-bg shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border-color px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Compose a widget</h2>
            <p className="text-xs text-text-secondary mt-0.5">Pick data, filter it, then choose how it looks</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-text-secondary hover:bg-bg-secondary" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* stepper */}
        <div className="flex items-center gap-2 border-b border-border-color px-6 py-3">
          {['Model', 'Filters', 'View'].map((label, i) => {
            const n = i + 1;
            const active = step === n, done = step > n;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  active ? 'bg-accent text-white' : done ? 'bg-accent/20 text-accent' : 'bg-bg-secondary text-text-secondary'}`}>
                  {done ? <Check size={13} /> : n}
                </div>
                <span className={`text-sm ${active ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>{label}</span>
                {n < 3 && <div className="mx-1 h-px w-8 bg-border-color" />}
              </div>
            );
          })}
        </div>

        <div className="flex min-h-0 flex-1">
          {/* left: the wizard */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {step === 1 && (
              <Step1 datasheets={datasheets} pipelines={pipelines} source={source} onPick={pickSource} />
            )}
            {step === 2 && (
              <Step2
                filterFields={filterFields} filters={filters} setFilters={setFilters}
                fieldByKey={fieldByKey}
              />
            )}
            {step === 3 && (
              <Step3
                measureFn={measureFn} setMeasureFn={setMeasureFn}
                measureField={measureField} setMeasureField={setMeasureField}
                measureFields={measureFields}
                dimension={dimension} setDimension={setDimension} groupFields={groupFields}
                dateField={dateField} setDateField={setDateField} dateFields={dateFields}
                timeMode={timeMode} setTimeMode={setTimeMode}
                view={view} setView={setView} availableViews={availableViews}
                title={title} setTitle={setTitle}
              />
            )}
          </div>

          {/* right: live preview (step 3 only) */}
          {step === 3 && (
            <div className="hidden w-[380px] shrink-0 border-l border-border-color bg-bg-secondary/40 p-5 md:block">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-text-secondary">
                <Activity size={13} /> Live preview
                {previewing && <Loader2 size={12} className="animate-spin" />}
              </div>
              <PreviewRender data={preview} view={view} />
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-border-color px-6 py-4">
          <div className="min-h-4 text-xs text-red-500">{error}</div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary">
                <ArrowLeft size={15} /> Back
              </button>
            )}
            {step < 3 && (
              <button onClick={() => setStep(step + 1)} disabled={step === 1 && !source}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-40">
                Next <ArrowRight size={15} />
              </button>
            )}
            {step === 3 && (
              <button onClick={create} disabled={saving || !view}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-40">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Add to dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 1: pick a source (core / pipeline / datasheet) ───────────────────────
function Step1({ datasheets, pipelines, source, onPick }: {
  datasheets: DatasheetSource[]; pipelines: PipelineSource[];
  source: string; onPick: (s: string, name: string) => void;
}) {
  const card = (key: string, name: string, sub: string, Icon: React.ElementType = Database) => {
    const active = source === key;
    return (
      <button key={key} onClick={() => onPick(key, name)}
        className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
          active ? 'border-accent bg-accent/10' : 'border-border-color bg-bg-secondary hover:border-accent/50'}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-text-primary">{name}</div>
          <div className="text-xs text-text-secondary">{sub}</div>
        </div>
      </button>
    );
  };
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Core data</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {CORE_SOURCES.map(s => card(s.key, s.name, 'Built-in'))}
        </div>
      </div>
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Pipelines</p>
        {pipelines.length === 0
          ? <p className="text-sm text-text-secondary">No active pipelines yet — create one under Processes to compose widgets over it.</p>
          : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {pipelines.map(p => card(`pipeline:${p.id}`, p.name, 'Pipeline', GitBranch))}
            </div>
          )}
      </div>
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">Datasheets</p>
        {datasheets.length === 0
          ? <p className="text-sm text-text-secondary">No datasheets yet — create one to compose widgets over it.</p>
          : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {datasheets.map(ds => card(`datasheet:${ds.id}`, ds.name, 'Datasheet'))}
            </div>
          )}
      </div>
    </div>
  );
}

// ── Step 2: filters (flat AND) ────────────────────────────────────────────────
function Step2({ filterFields, filters, setFilters, fieldByKey }: {
  filterFields: ComposerField[];
  filters: FilterClause[];
  setFilters: (f: FilterClause[]) => void;
  fieldByKey: (k: string) => ComposerField | undefined;
}) {
  const update = (i: number, patch: Partial<FilterClause>) =>
    setFilters(filters.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => setFilters(filters.filter((_, idx) => idx !== i));
  const add = () => {
    const f = filterFields[0];
    if (f) setFilters([...filters, { field: f.key, operator: f.operators[0], value: '' }]);
  };

  return (
    <div>
      <p className="mb-4 text-sm text-text-secondary">
        Narrow down the records (optional). All conditions must match.
      </p>
      <div className="space-y-2.5">
        {filters.map((c, i) => {
          const fld = fieldByKey(c.field);
          const ops = fld?.operators ?? ['eq'];
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              {i > 0 && <span className="text-xs font-medium text-text-secondary">and</span>}
              <select value={c.field} onChange={e => {
                const nf = fieldByKey(e.target.value);
                update(i, { field: e.target.value, operator: nf?.operators[0] ?? 'eq', value: '' });
              }} className={inputBase}>
                {filterFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <select value={c.operator} onChange={e => update(i, { operator: e.target.value, value: '' })} className={inputBase}>
                {ops.map(op => <option key={op} value={op}>{OP_LABEL[op] ?? op}</option>)}
              </select>
              <ValueInput clause={c} field={fld} onChange={patch => update(i, patch)} />
              <button onClick={() => remove(i)} className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-red-500" aria-label="Remove condition">
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
      <button onClick={add} disabled={!filterFields.length}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-border-color px-3 py-2 text-sm font-medium text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40">
        <Plus size={15} /> Add condition
      </button>
      {!filters.length && <p className="mt-4 text-xs text-text-secondary">No filters — the widget counts every record.</p>}
    </div>
  );
}

function ValueInput({ clause, field, onChange }: {
  clause: FilterClause; field?: ComposerField; onChange: (p: Partial<FilterClause>) => void;
}) {
  const op = clause.operator;
  if (NO_VALUE.has(op)) return null;
  // fields carrying a fixed value list (e.g. the groups membership picker)
  if (field?.choices?.length) {
    return (
      <select value={(clause.value as string) ?? ''} onChange={e => onChange({ value: e.target.value })} className={inputBase}>
        <option value="">—</option>
        {field.choices.map(ch => <option key={ch.value} value={ch.value}>{ch.label}</option>)}
      </select>
    );
  }
  if (DAYS_VALUE.has(op)) {
    return <input type="number" min={0} value={(clause.value as string) ?? ''} placeholder="days"
      onChange={e => onChange({ value: e.target.value })} className={`${inputBase} w-24`} />;
  }
  if (TWO_VALUE.has(op)) {
    const isDate = field?.type === 'date';
    return (
      <div className="flex items-center gap-1.5">
        <input type={isDate ? 'date' : 'number'} value={(clause.value as string) ?? ''}
          onChange={e => onChange({ value: e.target.value })} className={`${inputBase} w-32`} />
        <span className="text-xs text-text-secondary">and</span>
        <input type={isDate ? 'date' : 'number'} value={(clause.value2 as string) ?? ''}
          onChange={e => onChange({ value2: e.target.value })} className={`${inputBase} w-32`} />
      </div>
    );
  }
  // enum / select with a single-value operator → dropdown of choices
  if (field?.options?.length && (op === 'eq' || op === 'neq')) {
    return (
      <select value={(clause.value as string) ?? ''} onChange={e => onChange({ value: e.target.value })} className={inputBase}>
        <option value="">—</option>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field?.type === 'date') {
    return <input type="date" value={(clause.value as string) ?? ''}
      onChange={e => onChange({ value: e.target.value })} className={`${inputBase} w-40`} />;
  }
  const isNum = field?.type === 'number' || field?.type === 'currency';
  const placeholder = ARRAY_VALUE.has(op) ? 'comma, separated' : 'value';
  return <input type={isNum && !ARRAY_VALUE.has(op) ? 'number' : 'text'} value={(clause.value as string) ?? ''}
    placeholder={placeholder} onChange={e => onChange({ value: e.target.value })} className={`${inputBase} w-48`} />;
}

// ── Step 3: shape + view + title ──────────────────────────────────────────────
function Step3(p: {
  measureFn: 'count' | 'sum' | 'avg'; setMeasureFn: (v: 'count' | 'sum' | 'avg') => void;
  measureField: string; setMeasureField: (v: string) => void; measureFields: ComposerField[];
  dimension: string; setDimension: (v: string) => void; groupFields: ComposerField[];
  dateField: string; setDateField: (v: string) => void; dateFields: ComposerField[];
  timeMode: 'windowed' | 'snapshot'; setTimeMode: (v: 'windowed' | 'snapshot') => void;
  view: string; setView: (v: string) => void; availableViews: string[];
  title: string; setTitle: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* measure */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Measure</label>
        <div className="flex flex-wrap items-center gap-2">
          {(['count', 'sum', 'avg'] as const).map(fn => (
            <button key={fn} onClick={() => p.setMeasureFn(fn)}
              disabled={fn !== 'count' && !p.measureFields.length}
              className={`rounded-lg border px-3 py-1.5 text-sm capitalize disabled:opacity-40 ${
                p.measureFn === fn ? 'border-accent bg-accent/10 text-accent' : 'border-border-color text-text-primary hover:bg-bg-secondary'}`}>
              {fn === 'count' ? 'Count of records' : fn}
            </button>
          ))}
          {p.measureFn !== 'count' && (
            <select value={p.measureField} onChange={e => p.setMeasureField(e.target.value)} className={inputBase}>
              <option value="">— pick field —</option>
              {p.measureFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* group-by */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Group by (optional)</label>
        <select value={p.dimension} onChange={e => p.setDimension(e.target.value)} className={inputBase}>
          <option value="">— none —</option>
          {p.groupFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-text-secondary">Group to unlock bar / pie / breakdown views.</p>
      </div>

      {/* time */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Time</label>
        <div className="flex flex-wrap items-center gap-2">
          <select value={p.dateField} onChange={e => p.setDateField(e.target.value)} className={inputBase}>
            {p.dateFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {(['windowed', 'snapshot'] as const).map(m => (
            <button key={m} onClick={() => p.setTimeMode(m)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                p.timeMode === m ? 'border-accent bg-accent/10 text-accent' : 'border-border-color text-text-primary hover:bg-bg-secondary'}`}>
              {m === 'windowed' ? 'Follow dashboard range' : 'All-time'}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-text-secondary">The tagged date field drives the window and trend buckets.</p>
      </div>

      {/* view */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-secondary">View</label>
        <div className="flex flex-wrap gap-2">
          {Object.keys(VIEW_META).map(v => {
            const meta = VIEW_META[v];
            const Icon = meta.icon;
            const ok = p.availableViews.includes(v);
            const active = p.view === v;
            return (
              <button key={v} onClick={() => ok && p.setView(v)} disabled={!ok}
                title={ok ? '' : 'Not available for this query shape'}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
                  active ? 'border-accent bg-accent/10 text-accent'
                    : ok ? 'border-border-color text-text-primary hover:bg-bg-secondary'
                      : 'border-border-color/50 text-text-secondary/40 cursor-not-allowed'}`}>
                <Icon size={14} /> {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* title */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Title</label>
        <input value={p.title} onChange={e => p.setTitle(e.target.value)} placeholder="Widget title"
          className={`${inputBase} w-full max-w-sm`} />
      </div>
    </div>
  );
}

// ── minimal preview renderer (reuses the WidgetData shape the grid renders) ────
function PreviewRender({ data, view }: { data: WidgetData | null; view: string }) {
  if (!data) return <div className="rounded-xl border border-border-color bg-card-bg p-6 text-sm text-text-secondary">Configure the widget to see a preview.</div>;
  const dt = data.display_type;

  if (dt === 'stat' || dt === 'gauge') {
    return (
      <div className="rounded-xl border border-border-color bg-card-bg p-6">
        <div className="text-3xl font-semibold text-text-primary">
          {data.unit ? `${data.unit} ` : ''}{(data.value ?? 0).toLocaleString()}
        </div>
        <div className="mt-1 text-xs text-text-secondary">{VIEW_META[view]?.label ?? dt}</div>
      </div>
    );
  }
  if (dt === 'trend' || dt === 'timeseries') {
    const s = data.series ?? [];
    const max = Math.max(1, ...s.map(p => p.value));
    return (
      <div className="rounded-xl border border-border-color bg-card-bg p-4">
        <div className="flex h-24 items-end gap-0.5">
          {s.map((p, i) => (
            <div key={i} className="flex-1 rounded-t bg-accent/60" style={{ height: `${(p.value / max) * 100}%` }} title={`${p.date}: ${p.value}`} />
          ))}
        </div>
        <div className="mt-2 text-xs text-text-secondary">{s.length} points · {VIEW_META[view]?.label ?? dt}</div>
      </div>
    );
  }
  // breakdown / table / list — items
  const items = data.items ?? [];
  const max = Math.max(1, ...items.map(it => it.count));
  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-4">
      {items.length === 0 && <div className="py-6 text-center text-sm text-text-secondary">No matching records</div>}
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i}>
            <div className="flex items-center justify-between text-sm">
              <span className="truncate text-text-primary">{it.label}</span>
              {dt !== 'list' && <span className="ml-2 shrink-0 text-text-secondary">{it.count.toLocaleString()}</span>}
            </div>
            {dt !== 'list' && (
              <div className="mt-1 h-1.5 rounded-full bg-bg-secondary">
                <div className="h-full rounded-full" style={{ width: `${(it.count / max) * 100}%`, background: it.color ?? 'var(--accent, #6366f1)' }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── value encoding: turn UI inputs into the spec's leaf value ─────────────────
function encodeValue(c: FilterClause): unknown {
  const op = c.operator;
  if (NO_VALUE.has(op)) return null;
  if (TWO_VALUE.has(op)) return [c.value, c.value2];
  if (ARRAY_VALUE.has(op)) {
    return String(c.value ?? '').split(',').map(s => s.trim()).filter(Boolean);
  }
  if (DAYS_VALUE.has(op)) return Number(c.value) || 0;
  return c.value ?? '';
}
