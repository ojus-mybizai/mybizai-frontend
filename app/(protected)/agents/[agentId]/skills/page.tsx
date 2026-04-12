'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAgentStore } from '@/lib/agent-store';
import { useShallow } from 'zustand/react/shallow';
import { Save, Loader2 } from 'lucide-react';
import type { SkillDefinition } from '@/services/agents';

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
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    if (current) {
      setSelected(current.skills ?? []);
    }
  }, [current?.id, current?.skills]);

  const categories = useMemo(
    () => Array.from(new Set(skills.map((s) => s.category))).sort(),
    [skills],
  );

  const dirty = useMemo(() => {
    const prev = new Set(current?.skills ?? []);
    const next = new Set(selected);
    if (prev.size !== next.size) return true;
    for (const v of prev) if (!next.has(v)) return true;
    return false;
  }, [current?.skills, selected]);

  const toggle = (name: string) => {
    setSelected((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
  };

  const onSave = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    try {
      await saveSkills(String(current.id), selected);
      setNotice('Skills saved');
      setTimeout(() => setNotice(null), 2500);
    } catch (err) {
      setNotice((err as Error).message || 'Failed to save skills');
      setTimeout(() => setNotice(null), 4000);
    } finally {
      setSaving(false);
    }
  }, [current, selected, saveSkills]);

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
              agent to be able to do, and its instructions (in the Overview and Automation tabs)
              decide when to use which.{' '}
              <br />
              <span className="text-text-secondary/80">
                For chat agents, <code className="text-xs rounded bg-bg-secondary px-1 py-0.5">send_message</code> is required so the agent can reply to customers.
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
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
            {selected.length} selected · {skills.length} available
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
                  onToggle={toggle}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillCategorySection({
  category,
  skills,
  selected,
  onToggle,
}: {
  category: string;
  skills: SkillDefinition[];
  selected: string[];
  onToggle: (name: string) => void;
}) {
  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
        {category}
      </h4>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {skills.map((skill) => {
          const on = selected.includes(skill.name);
          return (
            <button
              key={skill.name}
              type="button"
              onClick={() => onToggle(skill.name)}
              className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-xs transition ${
                on
                  ? 'border-accent bg-accent/10'
                  : 'border-border-color bg-bg-primary hover:border-text-secondary'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="font-medium text-text-primary">
                  {skill.is_llm_based && <span className="mr-1">🧠</span>}
                  {skill.name}
                </span>
                {on && (
                  <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                    ON
                  </span>
                )}
              </div>
              <span className="text-text-secondary line-clamp-2">{skill.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
