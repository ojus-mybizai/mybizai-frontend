'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAgentStore } from '@/lib/agent-store';
import { useShallow } from 'zustand/react/shallow';
import { Save, Loader2, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import type {
  SkillDefinition,
  SkillOverride,
  SkillOverridesMap,
} from '@/services/agents';

// ─── Helpers ─────────────────────────────────────────────────

/** A blank override shape — used when an owner first opens the customization drawer. */
function emptyOverride(): SkillOverride {
  return { customGuidance: '', mode: 'append', examples: [] };
}

/** Equality check used by the dirty-state detector. */
function overridesEqual(a: SkillOverridesMap, b: SkillOverridesMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const x = a[k];
    const y = b[k];
    const xEmpty = !x || (!x.customGuidance.trim() && (x.examples ?? []).length === 0);
    const yEmpty = !y || (!y.customGuidance.trim() && (y.examples ?? []).length === 0);
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


export default function AgentSkillsPage() {
  const { current, skills, loadSkills, saveSkills } = useAgentStore(
    useShallow((s) => ({
      current: s.current,
      skills: s.skills,
      loadSkills: s.loadSkills,
      saveSkills: s.saveSkills,
    })),
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<SkillOverridesMap>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  // Sync local state from the store whenever the agent changes
  useEffect(() => {
    if (current) {
      setSelected(current.skills ?? []);
      setOverrides(current.skillOverrides ?? {});
      setExpanded(new Set());
    }
  }, [current?.id, current?.skills, current?.skillOverrides]);

  const categories = useMemo(
    () => Array.from(new Set(skills.map((s) => s.category))).sort(),
    [skills],
  );

  // Dirty: skills array changed OR overrides map changed
  const dirty = useMemo(() => {
    const prev = new Set(current?.skills ?? []);
    const next = new Set(selected);
    if (prev.size !== next.size) return true;
    for (const v of prev) if (!next.has(v)) return true;
    if (!overridesEqual(current?.skillOverrides ?? {}, overrides)) return true;
    return false;
  }, [current?.skills, current?.skillOverrides, selected, overrides]);

  const toggleSelected = useCallback((name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  }, []);

  const toggleExpanded = useCallback((name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const updateOverride = useCallback(
    (name: string, patch: Partial<SkillOverride>) => {
      setOverrides((prev) => {
        const current = prev[name] ?? emptyOverride();
        return { ...prev, [name]: { ...current, ...patch } };
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

  const onSave = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    try {
      await saveSkills(String(current.id), selected, overrides);
      setNotice('Skills and rules saved');
      setTimeout(() => setNotice(null), 2500);
    } catch (err) {
      setNotice((err as Error).message || 'Failed to save');
      setTimeout(() => setNotice(null), 4000);
    } finally {
      setSaving(false);
    }
  }, [current, selected, overrides, saveSkills]);

  if (!current) return null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border-color bg-card-bg p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Skills</h2>
            <p className="text-sm text-text-secondary mt-1 max-w-2xl">
              Skills are the actions this agent can take. The same skill list applies to{' '}
              <strong>both chat and automation runs</strong> — enable everything you want the
              agent to be able to do, and its instructions (in the Overview and Automation
              tabs) decide when to use which.{' '}
              <br />
              <span className="text-text-secondary/80">
                For chat agents,{' '}
                <code className="text-xs rounded bg-bg-secondary px-1 py-0.5">send_message</code>{' '}
                is required so the agent can reply to customers.
              </span>
              <br />
              <span className="text-text-secondary/80 mt-1 inline-block">
                Click <Settings2 className="inline h-3 w-3" /> on any enabled skill to add
                business-specific rules — these are layered on top of the default skill behavior.
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </button>
        </div>
        {notice && (
          <div className="mt-3 rounded-lg border border-border-color bg-bg-secondary px-3 py-1.5 text-xs text-text-primary">
            {notice}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border-color bg-card-bg p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Available skills</h3>
          <span className="text-xs text-text-secondary">
            {selected.length} selected · {Object.keys(overrides).filter((k) => {
              const ov = overrides[k];
              return ov && (ov.customGuidance.trim() || (ov.examples ?? []).length > 0);
            }).length} customized · {skills.length} available
          </span>
        </div>

        {skills.length === 0 ? (
          <div className="text-sm text-text-secondary">Loading skills…</div>
        ) : (
          <div className="space-y-4">
            {categories.map((cat) => {
              const catSkills = skills.filter((s) => s.category === cat);
              return (
                <SkillCategorySection
                  key={cat}
                  category={cat}
                  skills={catSkills}
                  selected={selected}
                  overrides={overrides}
                  expanded={expanded}
                  onToggleSelected={toggleSelected}
                  onToggleExpanded={toggleExpanded}
                  onUpdateOverride={updateOverride}
                  onClearOverride={clearOverride}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Category section ────────────────────────────────────────

function SkillCategorySection({
  category,
  skills,
  selected,
  overrides,
  expanded,
  onToggleSelected,
  onToggleExpanded,
  onUpdateOverride,
  onClearOverride,
}: {
  category: string;
  skills: SkillDefinition[];
  selected: string[];
  overrides: SkillOverridesMap;
  expanded: Set<string>;
  onToggleSelected: (name: string) => void;
  onToggleExpanded: (name: string) => void;
  onUpdateOverride: (name: string, patch: Partial<SkillOverride>) => void;
  onClearOverride: (name: string) => void;
}) {
  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
        {category}
      </h4>
      <div className="space-y-2">
        {skills.map((skill) => {
          const on = selected.includes(skill.name);
          const ov = overrides[skill.name];
          const hasOverride =
            !!ov && (ov.customGuidance.trim().length > 0 || (ov.examples ?? []).length > 0);
          const isExpanded = expanded.has(skill.name);

          return (
            <div
              key={skill.name}
              className={`rounded-lg border transition ${
                on
                  ? 'border-accent/40 bg-accent/5'
                  : 'border-border-color bg-bg-primary'
              }`}
            >
              {/* Header row */}
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => onToggleSelected(skill.name)}
                  className="flex flex-1 items-start gap-2 px-3 py-2 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {skill.is_llm_based && <span className="mr-1">🧠</span>}
                        {skill.name}
                      </span>
                      {on && (
                        <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                          ON
                        </span>
                      )}
                      {hasOverride && (
                        <span
                          className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600"
                          title="Owner has added business-specific rules for this skill"
                        >
                          CUSTOM RULES
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">
                      {skill.description}
                    </p>
                  </div>
                </button>

                {/* Expand-toggle. Only visible when the skill is ON. */}
                {on && (
                  <button
                    type="button"
                    onClick={() => onToggleExpanded(skill.name)}
                    className="flex items-center gap-1 border-l border-border-color px-2.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                    title={isExpanded ? 'Hide custom rules' : 'Add business-specific rules'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    <Settings2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Customization drawer */}
              {on && isExpanded && (
                <SkillCustomizationDrawer
                  skillName={skill.name}
                  override={ov ?? emptyOverride()}
                  hasOverride={hasOverride}
                  onChange={(patch) => onUpdateOverride(skill.name, patch)}
                  onClear={() => onClearOverride(skill.name)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Customization drawer (per-skill) ───────────────────────

function SkillCustomizationDrawer({
  skillName,
  override,
  hasOverride,
  onChange,
  onClear,
}: {
  skillName: string;
  override: SkillOverride;
  hasOverride: boolean;
  onChange: (patch: Partial<SkillOverride>) => void;
  onClear: () => void;
}) {
  return (
    <div className="border-t border-border-color px-3 py-3 space-y-3 bg-bg-primary/50">
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          Business-specific rules for {skillName}
        </label>
        <textarea
          value={override.customGuidance}
          onChange={(e) => onChange({ customGuidance: e.target.value })}
          rows={4}
          placeholder={
            'E.g. "Only mark a lead hot if they mention BOTH a budget AND a timeline.\n' +
            'Treat any mention of a competitor name as a warm signal."'
          }
          className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-text-secondary">
          This text is injected into the AI's view of this skill at runtime, layered on top
          of the default rules. Be specific — name your fields, products, and edge cases.
        </p>
      </div>

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          How should these rules combine with the defaults?
        </label>
        <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <ModeRadio
            label="Add to default rules"
            description="Recommended. Your text is shown alongside the built-in skill rules."
            active={override.mode === 'append'}
            onClick={() => onChange({ mode: 'append' })}
          />
          <ModeRadio
            label="Replace default rules"
            description="Advanced. Drops the built-in WHEN/DO-NOT rules entirely. Use only if you need full control."
            active={override.mode === 'replace'}
            onClick={() => onChange({ mode: 'replace' })}
          />
        </div>
      </div>

      {hasOverride && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-text-secondary underline hover:text-text-primary"
          >
            Reset to default rules
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Mode radio (presentational) ────────────────────────────

function ModeRadio({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-[11px] transition ${
        active
          ? 'border-accent bg-accent/10'
          : 'border-border-color bg-bg-primary hover:border-text-secondary'
      }`}
    >
      <span className="flex items-center gap-1.5 font-medium text-text-primary">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full border ${
            active ? 'border-accent bg-accent' : 'border-text-secondary'
          }`}
        />
        {label}
      </span>
      <span className="text-text-secondary">{description}</span>
    </button>
  );
}
