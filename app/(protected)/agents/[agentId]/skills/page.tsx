'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAgentStore } from '@/lib/agent-store';
import { useShallow } from 'zustand/react/shallow';
import {
  Save,
  Loader2,
  ChevronRight,
  Sparkles,
  Plus,
  Trash2,
  Wand2,
  Search,
  Lock,
  Eye,
  EyeOff,
  Info,
  AlertTriangle,
  // Skill bucket icons — referenced by name via SKILL_ICONS map below
  MessageSquare,
  FileText,
  Image,
  PencilLine,
  StickyNote,
  CheckCircle2,
  Gauge,
  UserPlus,
  ArrowRightLeft,
  Search as SearchIcon,
  IdCard,
  MessagesSquare,
  BookOpen,
  ClipboardPlus,
  UserCheck,
  Repeat,
  ClipboardList,
  AlarmClockOff,
  MoveRight,
  BarChart3,
  BellRing,
  Wrench,
} from 'lucide-react';
import type {
  SkillDefinition,
  SkillOverride,
  SkillOverrideExample,
  SkillOverridesMap,
  RoleTemplateSummary,
} from '@/services/agents';
import {
  listSkillTemplates,
  suggestSkillGuidance,
  previewSkillWithDraft,
  type SkillPreview,
  type SkillGuidanceSuggestion,
} from '@/services/agents';
import {
  getSkillDisplay,
  isAlwaysOnSkill,
  SKILL_BUCKETS,
  type SkillBucketKey,
} from '@/lib/skill-display';

// ─── Helpers ─────────────────────────────────────────────────

const SKILL_ICONS: Record<string, typeof MessageSquare> = {
  MessageSquare, FileText, Image, PencilLine, StickyNote, CheckCircle2,
  Gauge, UserPlus, ArrowRightLeft, Search: SearchIcon, IdCard, MessagesSquare,
  BookOpen, ClipboardPlus, UserCheck, Repeat, ClipboardList, AlarmClockOff,
  MoveRight, BarChart3, BellRing, Wrench,
};

function emptyOverride(): SkillOverride {
  return { customGuidance: '', mode: 'append', examples: [] };
}

function isOverrideEmpty(o: SkillOverride | undefined): boolean {
  if (!o) return true;
  const g = (o.customGuidance ?? '').trim();
  const ex = (o.examples ?? []).filter((e) => (e.situation ?? '').trim() || (e.why ?? '').trim());
  return !g && ex.length === 0;
}

function overridesEqual(a: SkillOverridesMap, b: SkillOverridesMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const x = a[k];
    const y = b[k];
    const xEmpty = isOverrideEmpty(x);
    const yEmpty = isOverrideEmpty(y);
    if (xEmpty && yEmpty) continue;
    if (xEmpty !== yEmpty) return false;
    if ((x?.customGuidance ?? '') !== (y?.customGuidance ?? '')) return false;
    if ((x?.mode ?? 'append') !== (y?.mode ?? 'append')) return false;
    const ex1 = x?.examples ?? [];
    const ex2 = y?.examples ?? [];
    if (ex1.length !== ex2.length) return false;
    for (let i = 0; i < ex1.length; i += 1) {
      if ((ex1[i].situation ?? '') !== (ex2[i].situation ?? '')) return false;
      if ((ex1[i].why ?? '') !== (ex2[i].why ?? '')) return false;
    }
  }
  return true;
}

// ─── Page ────────────────────────────────────────────────────

export default function AgentSkillsPage() {
  const { current, skills, loadSkills, saveSkills, update } = useAgentStore(
    useShallow((s) => ({
      current: s.current,
      skills: s.skills,
      loadSkills: s.loadSkills,
      saveSkills: s.saveSkills,
      update: s.update,
    })),
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<SkillOverridesMap>({});
  const [roleTemplate, setRoleTemplate] = useState<string | null>(null);
  const [templates, setTemplates] = useState<RoleTemplateSummary[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [search, setSearch] = useState('');
  const [activeSkillName, setActiveSkillName] = useState<string | null>(null);

  useEffect(() => {
    void loadSkills();
    listSkillTemplates()
      .then(setTemplates)
      .catch((err) => console.error('Failed to load skill templates:', err));
  }, [loadSkills]);

  useEffect(() => {
    if (current) {
      setSelected(current.skills ?? []);
      setOverrides(current.skillOverrides ?? {});
      setRoleTemplate(current.roleTemplate ?? null);
    }
  }, [current?.id, current?.skills, current?.skillOverrides, current?.roleTemplate]);

  const visibleSkills = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skills.filter((s) => {
      if (!q) return true;
      const disp = getSkillDisplay(s.name, s.category);
      return (
        s.name.toLowerCase().includes(q) ||
        disp.label.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [skills, search]);

  // Group skills into task-led buckets (not technical categories).
  const skillsByBucket = useMemo(() => {
    const out: Record<SkillBucketKey, SkillDefinition[]> = {
      talk: [], capture: [], work: [], lookup: [], pipeline: [], notify: [], data: [], other: [],
    };
    for (const s of visibleSkills) {
      const disp = getSkillDisplay(s.name, s.category);
      out[disp.bucket].push(s);
    }
    return out;
  }, [visibleSkills]);

  // Dirty: skills array changed OR overrides map changed.
  const dirty = useMemo(() => {
    const prev = new Set(current?.skills ?? []);
    const next = new Set(selected);
    if (prev.size !== next.size) return true;
    for (const v of prev) if (!next.has(v)) return true;
    if (!overridesEqual(current?.skillOverrides ?? {}, overrides)) return true;
    return false;
  }, [current?.skills, current?.skillOverrides, selected, overrides]);

  const toggleSelected = useCallback((name: string) => {
    if (isAlwaysOnSkill(name)) return; // can't disable always-on skills
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  }, []);

  const updateOverride = useCallback(
    (name: string, patch: Partial<SkillOverride>) => {
      setOverrides((prev) => {
        const cur = prev[name] ?? emptyOverride();
        return { ...prev, [name]: { ...cur, ...patch } };
      });
    },
    [],
  );

  const clearOverride = useCallback((name: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const showNotice = (kind: 'ok' | 'err', msg: string, ms = 2500) => {
    setNotice({ kind, msg });
    setTimeout(() => setNotice(null), ms);
  };

  const onSave = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    try {
      await saveSkills(String(current.id), selected, overrides);
      showNotice('ok', 'Saved');
    } catch (err) {
      showNotice('err', (err as Error).message || 'Failed to save', 4000);
    } finally {
      setSaving(false);
    }
  }, [current, selected, overrides, saveSkills]);

  const onChangeRoleTemplate = useCallback(
    async (next: string | null) => {
      if (!current) return;
      const prev = roleTemplate;
      setRoleTemplate(next);
      setSavingTemplate(true);
      try {
        await update(String(current.id), { roleTemplate: next });
        showNotice('ok', next ? `Applied "${next}" template` : 'Cleared role template');
      } catch (err) {
        showNotice('err', (err as Error).message || 'Failed to update template', 4000);
        setRoleTemplate(prev);
      } finally {
        setSavingTemplate(false);
      }
    },
    [current, update, roleTemplate],
  );

  const activeSkill = useMemo(
    () => skills.find((s) => s.name === activeSkillName) ?? null,
    [skills, activeSkillName],
  );

  if (!current) return null;

  const totalEnabled = selected.length;
  const totalCustomized = Object.keys(overrides).filter((k) => !isOverrideEmpty(overrides[k])).length;

  return (
    // Viewport-bounded layout: header stays put, the master-detail area
    // fills the remaining height and each panel scrolls internally instead
    // of the whole page growing tall.
    <div className="flex h-[calc(100dvh-7rem)] min-h-[520px] flex-col gap-4">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="shrink-0 rounded-2xl border border-border-color bg-card-bg p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text-primary">Skills</h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              What this agent can do, and how it should think about each action.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">
              {totalEnabled} on · {totalCustomized} tuned
            </span>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save changes
            </button>
          </div>
        </div>

        {/* Role template inline */}
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border-color bg-bg-secondary/40 px-3 py-2 text-xs text-text-secondary">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="font-medium text-text-primary">Persona:</span>
          <select
            value={roleTemplate ?? ''}
            onChange={(e) => void onChangeRoleTemplate(e.target.value === '' ? null : e.target.value)}
            disabled={savingTemplate}
            className="rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none disabled:opacity-60"
          >
            <option value="">— None (use skill defaults) —</option>
            {templates.map((t) => (
              <option key={t.name} value={t.name}>{t.label}</option>
            ))}
          </select>
          {roleTemplate && (
            <span className="text-[11px] text-text-secondary/80">
              {templates.find((t) => t.name === roleTemplate)?.description}
              {' '}({templates.find((t) => t.name === roleTemplate)?.skillCount ?? 0} skills tuned)
            </span>
          )}
        </div>

        {notice && (
          <div className={`mt-3 rounded-lg border px-3 py-1.5 text-xs ${
            notice.kind === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400'
          }`}>
            {notice.msg}
          </div>
        )}
      </div>

      {/* ── Master-detail layout ─────────────────────────────── */}
      {/* min-h-0 lets the grid shrink inside the flex column so the inner
          panels can claim "fill remaining space" and scroll on overflow. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
        {/* LEFT — Skills list (scrolls internally) */}
        <div className="flex min-h-0 flex-col rounded-2xl border border-border-color bg-card-bg">
          {/* Sticky search inside the panel */}
          <div className="shrink-0 border-b border-border-color p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search skills..."
                className="w-full rounded-lg border border-border-color bg-bg-primary py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Scroll region */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {skills.length === 0 ? (
              <SkillListSkeleton />
            ) : (
              <div className="space-y-4">
                {Object.values(SKILL_BUCKETS)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((bucket) => {
                    const list = skillsByBucket[bucket.key];
                    if (!list || list.length === 0) return null;
                    return (
                      <BucketSection
                        key={bucket.key}
                        label={bucket.label}
                        description={bucket.description}
                        skills={list}
                        selected={selected}
                        overrides={overrides}
                        activeSkillName={activeSkillName}
                        onToggle={toggleSelected}
                        onSelectDetail={setActiveSkillName}
                      />
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Detail pane (scrolls internally) */}
        <div className="flex min-h-0 flex-col overflow-y-auto rounded-2xl border border-border-color bg-card-bg p-4">
          {activeSkill ? (
            <SkillDetailPane
              agentId={String(current.id)}
              skill={activeSkill}
              isEnabled={selected.includes(activeSkill.name)}
              override={overrides[activeSkill.name] ?? emptyOverride()}
              onChangeOverride={(patch) => updateOverride(activeSkill.name, patch)}
              onClearOverride={() => clearOverride(activeSkill.name)}
              onToggle={() => toggleSelected(activeSkill.name)}
              hasRoleTemplate={!!roleTemplate}
              roleTemplate={roleTemplate}
            />
          ) : (
            <EmptyDetail totalEnabled={totalEnabled} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── List components ────────────────────────────────────────

function BucketSection({
  label,
  description,
  skills,
  selected,
  overrides,
  activeSkillName,
  onToggle,
  onSelectDetail,
}: {
  label: string;
  description: string;
  skills: SkillDefinition[];
  selected: string[];
  overrides: SkillOverridesMap;
  activeSkillName: string | null;
  onToggle: (name: string) => void;
  onSelectDetail: (name: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-text-primary">{label}</h3>
        <span className="text-[10px] text-text-secondary/80">{description}</span>
      </div>
      <div className="space-y-1.5">
        {skills.map((s) => (
          <SkillRow
            key={s.name}
            skill={s}
            on={selected.includes(s.name)}
            override={overrides[s.name]}
            active={activeSkillName === s.name}
            onToggle={() => onToggle(s.name)}
            onSelectDetail={() => onSelectDetail(s.name)}
          />
        ))}
      </div>
    </div>
  );
}

function SkillRow({
  skill,
  on,
  override,
  active,
  onToggle,
  onSelectDetail,
}: {
  skill: SkillDefinition;
  on: boolean;
  override: SkillOverride | undefined;
  active: boolean;
  onToggle: () => void;
  onSelectDetail: () => void;
}) {
  const disp = getSkillDisplay(skill.name, skill.category);
  const Icon = SKILL_ICONS[disp.iconName] ?? Wrench;
  const alwaysOn = isAlwaysOnSkill(skill.name);
  const customized = !isOverrideEmpty(override);

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition cursor-pointer ${
        active
          ? 'border-accent bg-accent/10'
          : on
            ? 'border-accent/30 bg-accent/[0.04] hover:border-accent/50'
            : 'border-border-color bg-bg-primary hover:border-text-secondary/50'
      }`}
      onClick={onSelectDetail}
    >
      {/* Icon */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
          on ? 'bg-accent/15 text-accent' : 'bg-bg-secondary text-text-secondary'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Label + status */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-text-primary">{disp.label}</span>
          {customized && !alwaysOn && (
            <span
              className="rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-semibold uppercase text-amber-600 dark:text-amber-400"
              title="You've added business-specific rules for this skill"
            >
              Custom
            </span>
          )}
        </div>
        <p className="truncate text-[10px] text-text-secondary/80">{skill.name}</p>
      </div>

      {/* Toggle / Lock */}
      {alwaysOn ? (
        <div
          className="flex items-center gap-1 rounded-md bg-bg-secondary px-2 py-1 text-[10px] font-medium text-text-secondary"
          title="Required for chat agents — auto-enabled by the runtime"
        >
          <Lock className="h-3 w-3" />
          Always on
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`relative h-4 w-7 shrink-0 rounded-full transition ${
            on ? 'bg-accent' : 'bg-bg-secondary border border-border-color'
          }`}
          aria-pressed={on}
          aria-label={on ? 'Disable skill' : 'Enable skill'}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${
              on ? 'left-3.5' : 'left-0.5'
            }`}
          />
        </button>
      )}

      {active && <ChevronRight className="h-3 w-3 text-accent" />}
    </div>
  );
}

function SkillListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((g) => (
        <div key={g}>
          <div className="mb-1.5 h-3 w-32 animate-pulse rounded bg-bg-secondary" />
          <div className="space-y-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-bg-secondary/60" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Detail pane ────────────────────────────────────────────

function EmptyDetail({ totalEnabled }: { totalEnabled: number }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
      <div className="mb-3 rounded-full bg-bg-secondary p-3 text-text-secondary">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-text-primary">Pick a skill to tune</h3>
      <p className="mt-1 max-w-xs text-xs text-text-secondary">
        Click any skill on the left to see exactly what your AI sees for it,
        and add business-specific rules.
      </p>
      <p className="mt-3 text-[11px] text-text-secondary/80">
        {totalEnabled} {totalEnabled === 1 ? 'skill is' : 'skills are'} currently enabled.
      </p>
    </div>
  );
}

function SkillDetailPane({
  agentId,
  skill,
  isEnabled,
  override,
  onChangeOverride,
  onClearOverride,
  onToggle,
  hasRoleTemplate,
  roleTemplate,
}: {
  agentId: string;
  skill: SkillDefinition;
  isEnabled: boolean;
  override: SkillOverride;
  onChangeOverride: (patch: Partial<SkillOverride>) => void;
  onClearOverride: () => void;
  onToggle: () => void;
  hasRoleTemplate: boolean;
  roleTemplate: string | null;
}) {
  const disp = getSkillDisplay(skill.name, skill.category);
  const Icon = SKILL_ICONS[disp.iconName] ?? Wrench;
  const alwaysOn = isAlwaysOnSkill(skill.name);
  const hasOverride = !isOverrideEmpty(override);

  // ── Live preview ─────────────────────────────────────────
  const [preview, setPreview] = useState<SkillPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [showDiff, setShowDiff] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPreviewLoading(true);
      setPreviewError(null);
      previewSkillWithDraft(agentId, skill.name, override)
        .then(setPreview)
        .catch((err: Error) => setPreviewError(err.message || 'Preview failed'))
        .finally(() => setPreviewLoading(false));
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [agentId, skill.name, override.customGuidance, override.mode, JSON.stringify(override.examples)]);

  // ── AI suggest with accept/reject ────────────────────────
  const [pendingSuggest, setPendingSuggest] = useState<SkillGuidanceSuggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const onSuggest = async () => {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const sug = await suggestSkillGuidance(agentId, skill.name);
      setPendingSuggest(sug);
    } catch (err) {
      setSuggestError((err as Error).message || 'Suggestion failed');
    } finally {
      setSuggesting(false);
    }
  };

  const acceptSuggest = () => {
    if (!pendingSuggest) return;
    onChangeOverride({
      customGuidance: pendingSuggest.customGuidance,
      mode: pendingSuggest.mode,
      examples: pendingSuggest.examples.map((e) => ({ situation: e.situation, why: e.why })),
    });
    setPendingSuggest(null);
  };

  // ── Examples handlers ────────────────────────────────────
  const examples = override.examples ?? [];
  const addExample = () =>
    onChangeOverride({ examples: [...examples, { situation: '', why: '' }] });
  const updateExample = (i: number, patch: Partial<SkillOverrideExample>) => {
    const next = examples.slice();
    next[i] = { ...next[i], ...patch };
    onChangeOverride({ examples: next });
  };
  const removeExample = (i: number) => {
    const next = examples.slice();
    next.splice(i, 1);
    onChangeOverride({ examples: next });
  };

  // ── Replace-mode confirmation ─────────────────────────────
  const [confirmReplace, setConfirmReplace] = useState(false);
  const requestReplace = () => {
    if (override.mode === 'replace') return;
    if (hasOverride) setConfirmReplace(true);
    else onChangeOverride({ mode: 'replace' });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border-color pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            isEnabled ? 'bg-accent/15 text-accent' : 'bg-bg-secondary text-text-secondary'
          }`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary">{disp.label}</h2>
            <p className="text-[11px] text-text-secondary">{skill.name} · {skill.category}</p>
          </div>
        </div>
        {alwaysOn ? (
          <div className="flex items-center gap-1 rounded-md bg-bg-secondary px-2 py-1 text-[11px] font-medium text-text-secondary">
            <Lock className="h-3 w-3" /> Always on
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className={`relative h-5 w-9 shrink-0 rounded-full transition ${
              isEnabled ? 'bg-accent' : 'bg-bg-secondary border border-border-color'
            }`}
            aria-pressed={isEnabled}
            aria-label={isEnabled ? 'Disable skill' : 'Enable skill'}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                isEnabled ? 'left-4' : 'left-0.5'
              }`}
            />
          </button>
        )}
      </div>

      {/* What it does */}
      <div className="rounded-lg bg-bg-secondary/40 p-3 text-xs text-text-secondary">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          <Info className="h-3 w-3" /> What it does
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-text-primary">{skill.description}</p>
      </div>

      {/* Suggestion modal (inline diff) */}
      {pendingSuggest && (
        <SuggestionPanel
          current={override}
          suggestion={pendingSuggest}
          onAccept={acceptSuggest}
          onCancel={() => setPendingSuggest(null)}
        />
      )}

      {/* Tuning panel (only when enabled, or always-on) */}
      {(isEnabled || alwaysOn) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-text-primary">
              Business-specific rules
            </label>
            <button
              type="button"
              onClick={() => void onSuggest()}
              disabled={suggesting}
              className="inline-flex items-center gap-1 rounded-md border border-accent/50 bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              AI suggest
            </button>
          </div>
          <textarea
            value={override.customGuidance}
            onChange={(e) => onChangeOverride({ customGuidance: e.target.value })}
            rows={4}
            placeholder={`e.g. "When a candidate says BCom, save Qualification as Graduate. Save every field the moment it's shared — never batch into one summary message."`}
            className="w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
          />
          <p className="text-[10px] text-text-secondary/80">
            Goes into the tool description the AI sees. Be specific — name your fields, products,
            and edge cases.
          </p>
          {suggestError && <p className="text-[10px] text-rose-500">{suggestError}</p>}

          {/* Examples */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-text-primary">
                Examples ({examples.length})
              </label>
              <button
                type="button"
                onClick={addExample}
                className="inline-flex items-center gap-1 text-[10px] text-text-secondary transition hover:text-text-primary"
              >
                <Plus className="h-3 w-3" /> Add example
              </button>
            </div>
            {examples.length === 0 ? (
              <p className="mt-1 text-[10px] italic text-text-secondary/70">
                No examples yet. Add one to anchor the AI with a concrete scenario.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {examples.map((ex, i) => (
                  <div
                    key={i}
                    className="space-y-1.5 rounded-lg border border-border-color bg-bg-primary p-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-text-secondary">
                        Example {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeExample(i)}
                        className="text-text-secondary transition hover:text-rose-500"
                        title="Remove example"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={ex.situation ?? ''}
                      onChange={(e) => updateExample(i, { situation: e.target.value })}
                      placeholder="When the customer says ____"
                      className="w-full rounded-md border border-border-color bg-bg-primary px-2 py-1 text-[11px] text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={ex.why ?? ''}
                      onChange={(e) => updateExample(i, { why: e.target.value })}
                      placeholder="The agent should ____ because ____"
                      className="w-full rounded-md border border-border-color bg-bg-primary px-2 py-1 text-[11px] text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mode picker */}
          <div>
            <label className="text-[11px] font-semibold text-text-primary">
              How should these rules combine?
            </label>
            <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <ModeRadio
                label="Add to defaults"
                description="Recommended. Your rules show alongside the built-in ones."
                active={override.mode === 'append'}
                onClick={() => onChangeOverride({ mode: 'append' })}
              />
              <ModeRadio
                label="Replace defaults"
                description="Advanced. Drops built-in WHEN-TO-USE and examples. Safety rails stay."
                active={override.mode === 'replace'}
                onClick={requestReplace}
                warningIcon={hasOverride && override.mode !== 'replace'}
              />
            </div>
          </div>

          {hasOverride && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClearOverride}
                className="text-[10px] text-text-secondary underline transition hover:text-text-primary"
              >
                Reset to defaults
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live preview pane */}
      <div className="mt-auto rounded-lg border border-border-color bg-bg-primary">
        <div className="flex items-center justify-between border-b border-border-color px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            {showPreview ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            What the AI sees for this skill
            {previewLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            {preview && (
              <button
                type="button"
                onClick={() => setShowDiff((v) => !v)}
                className="rounded border border-border-color px-1.5 py-0.5 text-text-secondary transition hover:text-text-primary"
              >
                {showDiff ? 'Show full' : 'Show diff vs default'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="rounded border border-border-color px-1.5 py-0.5 text-text-secondary transition hover:text-text-primary"
            >
              {showPreview ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {showPreview && (
          <div className="max-h-72 overflow-auto p-3 text-[11px] leading-relaxed">
            {previewError ? (
              <p className="text-rose-500">{previewError}</p>
            ) : !preview ? (
              <p className="text-text-secondary/70 italic">Loading preview…</p>
            ) : showDiff ? (
              <DescriptionDiff
                defaultText={preview.defaultDescription}
                effectiveText={preview.effectiveDescription}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-text-primary">
                {preview.effectiveDescription}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Replace-mode confirmation modal */}
      {confirmReplace && (
        <ConfirmModal
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
          title="Switch to Replace mode?"
          body="Replace mode drops the built-in WHEN-TO-USE and example list for this skill. Your safety rules (DO-NOT-USE) stay. Most owners don't need this — use Append unless you're sure."
          confirmLabel="Yes, replace defaults"
          cancelLabel="Keep adding to defaults"
          onConfirm={() => {
            onChangeOverride({ mode: 'replace' });
            setConfirmReplace(false);
          }}
          onCancel={() => setConfirmReplace(false)}
        />
      )}
    </div>
  );
}

// ─── AI suggest panel (diff-style review) ────────────────────

function SuggestionPanel({
  current,
  suggestion,
  onAccept,
  onCancel,
}: {
  current: SkillOverride;
  suggestion: SkillGuidanceSuggestion;
  onAccept: () => void;
  onCancel: () => void;
}) {
  const wouldOverwrite = !isOverrideEmpty(current);
  return (
    <div className="rounded-lg border border-violet-500/40 bg-violet-500/5 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
          <Wand2 className="h-3.5 w-3.5" />
          AI suggestion
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border-color px-2 py-0.5 text-[10px] text-text-secondary transition hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-md bg-violet-600 px-2 py-0.5 text-[10px] font-medium text-white transition hover:bg-violet-700"
          >
            {wouldOverwrite ? 'Replace my rules' : 'Apply suggestion'}
          </button>
        </div>
      </div>
      {wouldOverwrite && (
        <p className="mb-2 text-[10px] text-amber-700 dark:text-amber-400">
          ⚠ Accepting will overwrite your current custom rules and examples for this skill.
        </p>
      )}
      <div className="space-y-2">
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            Proposed guidance
          </div>
          <pre className="whitespace-pre-wrap rounded bg-bg-primary px-2 py-1.5 text-[11px] text-text-primary">
            {suggestion.customGuidance || '(empty)'}
          </pre>
        </div>
        {suggestion.examples.length > 0 && (
          <div>
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              Proposed examples ({suggestion.examples.length})
            </div>
            <ul className="space-y-1">
              {suggestion.examples.map((ex, i) => (
                <li key={i} className="rounded bg-bg-primary px-2 py-1 text-[11px]">
                  <div className="font-medium text-text-primary">{ex.situation || '(no situation)'}</div>
                  {ex.why && <div className="text-text-secondary">{ex.why}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="text-[10px] text-text-secondary">
          Mode: <span className="font-medium text-text-primary">{suggestion.mode}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Diff renderer ───────────────────────────────────────────

function DescriptionDiff({ defaultText, effectiveText }: { defaultText: string; effectiveText: string }) {
  const defaultLines = new Set(defaultText.split('\n').map((l) => l.trim()).filter(Boolean));
  const lines = effectiveText.split('\n');
  return (
    <pre className="whitespace-pre-wrap font-mono">
      {lines.map((line, i) => {
        const isNew = !!line.trim() && !defaultLines.has(line.trim());
        return (
          <div
            key={i}
            className={
              isNew
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'text-text-secondary'
            }
          >
            {isNew ? '+ ' : '  '}
            {line}
          </div>
        );
      })}
    </pre>
  );
}

// ─── Shared primitives ───────────────────────────────────────

function ModeRadio({
  label,
  description,
  active,
  onClick,
  warningIcon,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
  warningIcon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-[11px] transition ${
        active
          ? 'border-accent bg-accent/10'
          : 'border-border-color bg-bg-primary hover:border-text-secondary/60'
      }`}
    >
      <span className="flex items-center gap-1.5 font-medium text-text-primary">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full border ${
            active ? 'border-accent bg-accent' : 'border-text-secondary'
          }`}
        />
        {label}
        {warningIcon && <AlertTriangle className="h-3 w-3 text-amber-500" />}
      </span>
      <span className="text-text-secondary">{description}</span>
    </button>
  );
}

function ConfirmModal({
  icon,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl border border-border-color bg-card-bg p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        </div>
        <p className="text-xs leading-relaxed text-text-secondary">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-xs text-text-primary transition hover:bg-bg-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
