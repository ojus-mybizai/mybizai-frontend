'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Trash2,
  Save,
  Loader2,
  User,
  Users,
  HelpCircle,
  Radio,
  Target,
  Sparkles,
  Link2,
} from 'lucide-react';
import type {
  TaskTemplate,
  TaskTemplateCreatePayload,
  TemplateVariable,
  EntityKind,
  SnoozePreset,
} from '@/services/taskTemplates';
import { listModels, type DynamicModel } from '@/services/dynamic-data';
import { listRoles } from '@/services/roles';
import { useMembers } from '@/hooks/use-members';
import { useDatasheetSchema } from '@/hooks/use-datasheet-schema';
import { useUpdateTemplate, useDeleteTemplate, useCreateTemplate } from '@/hooks/use-templates';
import { useToastStore } from '@/lib/toast-store';
import { TokenEditor } from './token-editor';
import { BindingPicker } from './binding-picker';
import { FreeVarSidebar } from './free-var-sidebar';
import { ConditionBuilder, type CompletionCondition } from './condition-builder';
import { parse, extractFreeVariables } from '@/lib/tasks/token-parser';

type Draft = TaskTemplateCreatePayload;

function toDraft(t: TaskTemplate | null): Draft {
  return {
    name: t?.name ?? '',
    description: t?.description ?? '',
    icon: t?.icon ?? null,
    is_active: t?.is_active ?? true,

    title_pattern: t?.title_pattern ?? '',
    instructions: t?.instructions ?? '',
    task_type: t?.task_type ?? 'simple',
    priority: t?.priority ?? 'normal',
    due_in_days: t?.due_in_days ?? 1,

    assignee_mode: t?.assignee_mode ?? 'prompt',
    assignee_member_id: t?.assignee_member_id ?? null,
    assignee_role_id: t?.assignee_role_id ?? null,
    round_robin_within_role: t?.round_robin_within_role ?? true,

    delivery_channel: t?.delivery_channel ?? 'auto',
    delivery_mode: t?.delivery_mode ?? 'bundled_per_assignee',
    completion_condition: t?.completion_condition ?? null,

    entity_kind: t?.entity_kind ?? 'none',
    entity_datasheet_id: t?.entity_datasheet_id ?? null,
    row_count: t?.row_count ?? 'single',
    variables: t?.variables ?? [],

    reminder_enabled: t?.reminder_enabled ?? true,
    reminder_interval_hours: t?.reminder_interval_hours ?? 4,
    snooze_hours: t?.snooze_hours ?? 2,
    max_reminders: t?.max_reminders ?? 3,

    cadence_mode: t?.cadence_mode ?? 'delivery',
    due_offsets_hours: t?.due_offsets_hours ?? [],
    escalate_after_due_hours: t?.escalate_after_due_hours ?? 4,
    snooze_presets: t?.snooze_presets ?? [],
    max_self_reschedules: t?.max_self_reschedules ?? 3,
  };
}

const INTERVAL_HOUR_OPTIONS = [1, 2, 4, 8, 12, 24] as const;
const SNOOZE_HOUR_OPTIONS = [1, 2, 4, 8, 24] as const;

const SCHEMA_TOKEN_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;

function countSchemaTokens(text: string, datasheetName: string | null): number {
  if (!text || !datasheetName) return 0;
  let n = 0;
  const re = new RegExp(SCHEMA_TOKEN_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1].startsWith(`${datasheetName}.`) || m[1].startsWith('contact.')) n += 1;
  }
  return n;
}

function stripSchemaTokens(text: string, datasheetName: string | null): string {
  if (!text) return text;
  return text.replace(SCHEMA_TOKEN_RE, (whole, path: string) => {
    if (datasheetName && path.startsWith(`${datasheetName}.`)) return '';
    if (path.startsWith('contact.')) return '';
    return whole;
  });
}

export function TemplateEditor({
  template,
  onSaved,
  onCancel,
}: {
  template: TaskTemplate | null;
  onSaved: (t: TaskTemplate) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(toDraft(template));
  const [dirty, setDirty] = useState(false);
  const toast = useToastStore((s) => s.add);

  const { data: members } = useMembers();
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: listRoles });
  const { data: models } = useQuery({ queryKey: ['dynamic-models'], queryFn: listModels });

  const datasheet = useMemo<DynamicModel | null>(
    () =>
      draft.entity_kind === 'datasheet'
        ? models?.find((m) => m.id === draft.entity_datasheet_id) ?? null
        : null,
    [models, draft.entity_kind, draft.entity_datasheet_id],
  );
  const schema = useDatasheetSchema(datasheet?.id);

  const freeVarNames = useMemo(() => {
    const set = new Set<string>();
    const context = { datasheetName: datasheet?.name ?? undefined, fields: schema.data };
    for (const p of extractFreeVariables(parse(draft.title_pattern ?? '', context))) set.add(p);
    for (const p of extractFreeVariables(parse(draft.instructions ?? '', context))) set.add(p);
    return Array.from(set);
  }, [draft.title_pattern, draft.instructions, datasheet?.name, schema.data]);

  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const del = useDeleteTemplate();

  useEffect(() => {
    setDraft(toDraft(template));
    setDirty(false);
  }, [template]);

  const patch = (delta: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...delta }));
    setDirty(true);
  };

  const changeEntity = (k: EntityKind) => {
    if (k === draft.entity_kind) return;
    const dsName = datasheet?.name ?? null;
    const titleTokens = countSchemaTokens(draft.title_pattern ?? '', dsName);
    const instrTokens = countSchemaTokens(draft.instructions ?? '', dsName);
    const total = titleTokens + instrTokens;
    if (total > 0) {
      const ok = confirm(
        `Changing the binding will remove ${total} schema token${total === 1 ? '' : 's'} from the title/instructions. Continue?`,
      );
      if (!ok) return;
    }
    patch({
      entity_kind: k,
      entity_datasheet_id: k === 'datasheet' ? draft.entity_datasheet_id : null,
      row_count: k === 'none' ? 'single' : draft.row_count,
      title_pattern: stripSchemaTokens(draft.title_pattern ?? '', dsName),
      instructions: stripSchemaTokens(draft.instructions ?? '', dsName),
    });
  };

  const changeDatasheet = (id: number | null) => {
    if (id === draft.entity_datasheet_id) return;
    const dsName = datasheet?.name ?? null;
    const total =
      countSchemaTokens(draft.title_pattern ?? '', dsName) +
      countSchemaTokens(draft.instructions ?? '', dsName);
    if (total > 0) {
      const ok = confirm(
        `Changing the datasheet will remove ${total} schema token${total === 1 ? '' : 's'}. Continue?`,
      );
      if (!ok) return;
    }
    patch({
      entity_datasheet_id: id,
      title_pattern: stripSchemaTokens(draft.title_pattern ?? '', dsName),
      instructions: stripSchemaTokens(draft.instructions ?? '', dsName),
    });
  };

  const save = async () => {
    if (!draft.name?.trim() || !draft.title_pattern?.trim()) {
      toast('Name and title are required.', 'error');
      return;
    }
    if (draft.entity_kind === 'datasheet' && !draft.entity_datasheet_id) {
      toast('Pick a datasheet for datasheet-bound templates.', 'error');
      return;
    }
    // Prune sidebar entries for tokens no longer present.
    const prunedVars = (draft.variables ?? []).filter((v) => freeVarNames.includes(v.name));
    const payload: Draft = {
      ...draft,
      assignee_member_id: draft.assignee_mode === 'specific' ? draft.assignee_member_id : null,
      assignee_role_id: draft.assignee_mode === 'role' ? draft.assignee_role_id : null,
      entity_datasheet_id:
        draft.entity_kind === 'datasheet' ? draft.entity_datasheet_id : null,
      completion_condition:
        draft.entity_kind === 'none' ? null : draft.completion_condition,
      variables: prunedVars,
    };
    try {
      const saved = template
        ? await update.mutateAsync({ id: template.id, payload })
        : await create.mutateAsync(payload);
      toast(template ? 'Template saved' : 'Template created', 'success');
      setDirty(false);
      onSaved(saved);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    }
  };

  const remove = async () => {
    if (!template) return;
    if (!confirm(`Delete "${template.name}"?`)) return;
    try {
      await del.mutateAsync(template.id);
      toast('Template deleted', 'success');
      onCancel?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  };

  const saving = create.isPending || update.isPending;

  const isDefault = template?.is_default === true;

  return (
    <div className="space-y-5">
      {isDefault && (
        <div className="rounded-tc-panel border border-tc-accent/40 bg-tc-accent-soft px-3 py-2 text-xs text-tc-ink-2">
          <span className="mr-2 rounded-tc-chip bg-tc-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Free-text default
          </span>
          Applied to tasks created by typing in a member's chat. Edit the reminder,
          snooze, and escalation settings here to change defaults for ad-hoc tasks.
        </div>
      )}

      <Section icon={Sparkles} label="Identity" hint="Name, description, icon">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" required>
            <input
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="input"
              placeholder="e.g. Stock check"
            />
          </Field>
          <Field label="Icon (lucide name)">
            <input
              value={draft.icon ?? ''}
              onChange={(e) => patch({ icon: e.target.value || null })}
              className="input font-mono"
              placeholder="clipboard-list"
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            value={draft.description ?? ''}
            onChange={(e) => patch({ description: e.target.value })}
            rows={2}
            className="input"
            placeholder="Short internal description"
          />
        </Field>
      </Section>

      <Section icon={Link2} label="Binding" hint="Entity this template acts on">
        <BindingPicker
          entityKind={draft.entity_kind ?? 'none'}
          entityDatasheetId={draft.entity_datasheet_id ?? null}
          rowCount={draft.row_count ?? 'single'}
          models={models}
          onChangeEntity={changeEntity}
          onChangeDatasheet={changeDatasheet}
          onChangeRowCount={(r) => patch({ row_count: r })}
        />
      </Section>

      <Section icon={Sparkles} label="Task shape" hint="What the assignee sees">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-3">
            <Field label="Title" required>
              <TokenEditor
                value={draft.title_pattern}
                onChange={(v) => patch({ title_pattern: v })}
                entityKind={draft.entity_kind ?? 'none'}
                entityDatasheetId={draft.entity_datasheet_id ?? null}
                datasheetName={datasheet?.name ?? null}
                fields={schema.data}
                placeholder={
                  draft.entity_kind === 'datasheet'
                    ? 'e.g. Check stock for {{stock.product_name}}'
                    : draft.entity_kind === 'contact'
                      ? 'e.g. Follow up with {{contact.name}}'
                      : 'e.g. Reminder: {{topic}} — due {{today}}'
                }
              />
            </Field>
            <Field label="Instructions">
              <TokenEditor
                value={draft.instructions ?? ''}
                onChange={(v) => patch({ instructions: v })}
                entityKind={draft.entity_kind ?? 'none'}
                entityDatasheetId={draft.entity_datasheet_id ?? null}
                datasheetName={datasheet?.name ?? null}
                fields={schema.data}
                placeholder="Optional. Guidance for the assignee."
                multiline
                maxLength={2000}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Type">
                <div className="flex gap-1">
                  <Chip
                    active={draft.task_type === 'simple'}
                    onClick={() => patch({ task_type: 'simple' })}
                  >
                    Simple
                  </Chip>
                  <Chip
                    active={draft.task_type === 'app_action'}
                    onClick={() => patch({ task_type: 'app_action' })}
                  >
                    App action
                  </Chip>
                </div>
              </Field>
              <Field label="Priority">
                <div className="flex gap-1">
                  {(['low', 'normal', 'high'] as const).map((p) => (
                    <Chip
                      key={p}
                      active={draft.priority === p}
                      onClick={() => patch({ priority: p })}
                    >
                      {p}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Due in (days)">
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={draft.due_in_days ?? 1}
                  onChange={(e) => patch({ due_in_days: Number(e.target.value) })}
                  className="input font-mono"
                />
              </Field>
            </div>
          </div>
          <div>
            <FreeVarSidebar
              names={freeVarNames}
              variables={draft.variables ?? []}
              onChange={(next) => patch({ variables: next })}
            />
          </div>
        </div>
      </Section>

      <Section icon={User} label="Assignee" hint="Who gets the task">
        <div className="flex flex-wrap gap-1">
          <Chip
            active={draft.assignee_mode === 'prompt'}
            onClick={() => patch({ assignee_mode: 'prompt' })}
          >
            <HelpCircle className="mr-1 inline h-3 w-3" /> Choose at assign time
          </Chip>
          <Chip
            active={draft.assignee_mode === 'specific'}
            onClick={() => patch({ assignee_mode: 'specific' })}
          >
            <User className="mr-1 inline h-3 w-3" /> Specific member
          </Chip>
          <Chip
            active={draft.assignee_mode === 'role'}
            onClick={() => patch({ assignee_mode: 'role' })}
          >
            <Users className="mr-1 inline h-3 w-3" /> Role
          </Chip>
        </div>

        {draft.assignee_mode === 'prompt' && (
          <p className="rounded-tc-chip bg-tc-info-soft px-2 py-1.5 text-[11px] text-tc-info">
            The person dispatching this template will pick a member (or role) at that moment. Best
            for ad-hoc, one-off work.
          </p>
        )}

        {draft.assignee_mode === 'specific' && (
          <Field label="Member">
            <select
              value={draft.assignee_member_id ?? ''}
              onChange={(e) =>
                patch({ assignee_member_id: e.target.value ? Number(e.target.value) : null })
              }
              className="input"
            >
              <option value="">Pick a member…</option>
              {(members ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {draft.assignee_mode === 'role' && (
          <>
            <Field label="Role">
              <select
                value={draft.assignee_role_id ?? ''}
                onChange={(e) =>
                  patch({ assignee_role_id: e.target.value ? Number(e.target.value) : null })
                }
                className="input"
              >
                <option value="">Pick a role…</option>
                {(roles ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-tc-ink-2">
              <input
                type="checkbox"
                checked={draft.round_robin_within_role ?? true}
                onChange={(e) => patch({ round_robin_within_role: e.target.checked })}
                className="accent-tc-accent"
              />
              Round-robin within role (rotate who gets each new task)
            </label>
          </>
        )}
      </Section>

      <Section icon={Radio} label="Delivery" hint="Where the assignee gets it">
        <Field label="Channel">
          <div className="flex flex-wrap gap-1">
            {(['auto', 'whatsapp', 'in_app', 'both'] as const).map((c) => (
              <Chip
                key={c}
                active={draft.delivery_channel === c}
                onClick={() => patch({ delivery_channel: c })}
              >
                {c === 'in_app' ? 'in-app' : c}
              </Chip>
            ))}
          </div>
        </Field>
        {draft.row_count === 'multi' && (
          <Field label="Bundle mode">
            <div className="flex flex-wrap gap-1">
              <Chip
                active={draft.delivery_mode === 'bundled_per_assignee'}
                onClick={() => patch({ delivery_mode: 'bundled_per_assignee' })}
              >
                Bundle (one message per assignee, N items inside)
              </Chip>
              <Chip
                active={draft.delivery_mode === 'one_per_child'}
                onClick={() => patch({ delivery_mode: 'one_per_child' })}
              >
                One message per row
              </Chip>
            </div>
          </Field>
        )}
      </Section>

      <Section icon={Radio} label="Reminders" hint="Nudge the assignee if they don't act">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.reminder_enabled ?? true}
            onChange={(e) => patch({ reminder_enabled: e.target.checked })}
            className="h-4 w-4 rounded border-tc-rule"
          />
          <span>Send reminders when the task is not done</span>
        </label>

        {draft.reminder_enabled !== false && (
          <div className="mt-3 space-y-3 pl-6">
            <Field label="Cadence mode">
              <div className="flex flex-wrap gap-1">
                {(['delivery', 'due', 'hybrid'] as const).map((m) => (
                  <Chip
                    key={m}
                    active={(draft.cadence_mode ?? 'delivery') === m}
                    onClick={() => patch({ cadence_mode: m })}
                  >
                    {m === 'delivery'
                      ? 'Time from delivery'
                      : m === 'due'
                        ? 'Offsets from due date'
                        : 'Hybrid (both)'}
                  </Chip>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-tc-ink-muted">
                {draft.cadence_mode === 'due'
                  ? 'Fires only at the offsets you set from the task due date. Falls back to interval mode if the task has no due date.'
                  : draft.cadence_mode === 'hybrid'
                    ? 'Fires interval ticks AND due-date offsets. Escalates once the escalate window past due date is crossed.'
                    : 'Fires every N hours from when the task is delivered, until max reminders reached.'}
              </p>
            </Field>
            <Field label="Interval (delivery / hybrid)">
              <select
                value={draft.reminder_interval_hours ?? 4}
                onChange={(e) => patch({ reminder_interval_hours: Number(e.target.value) })}
                className="rounded-tc-chip border border-tc-rule bg-tc-bg-card px-2 py-1 text-sm"
                disabled={draft.cadence_mode === 'due'}
              >
                {INTERVAL_HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h} h</option>
                ))}
              </select>
            </Field>
            {(draft.cadence_mode === 'due' || draft.cadence_mode === 'hybrid') && (
              <>
                <Field label="Due-date offsets (hours; negative = before, positive = after)">
                  <DueOffsetsEditor
                    value={draft.due_offsets_hours ?? []}
                    onChange={(v) => patch({ due_offsets_hours: v })}
                  />
                </Field>
                <Field label="Escalate to owner (hours past due)">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={720}
                      value={draft.escalate_after_due_hours ?? 4}
                      onChange={(e) =>
                        patch({
                          escalate_after_due_hours: Math.max(
                            0,
                            Math.min(720, Number(e.target.value) || 0),
                          ),
                        })
                      }
                      className="w-20 rounded-tc-chip border border-tc-rule bg-tc-bg-card px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-tc-ink-muted">
                      hours after due_at → owner ping
                    </span>
                  </div>
                </Field>
              </>
            )}
            <Field label='"Later" button snoozes for'>
              <select
                value={draft.snooze_hours ?? 2}
                onChange={(e) => patch({ snooze_hours: Number(e.target.value) })}
                className="rounded-tc-chip border border-tc-rule bg-tc-bg-card px-2 py-1 text-sm"
              >
                {SNOOZE_HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h} h</option>
                ))}
              </select>
            </Field>
            <Field label="Escalate to owner after">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={draft.max_reminders ?? 3}
                  onChange={(e) => patch({ max_reminders: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
                  className="w-16 rounded-tc-chip border border-tc-rule bg-tc-bg-card px-2 py-1 text-sm"
                />
                <span className="text-xs text-tc-ink-muted">reminders</span>
              </div>
            </Field>
            <Field label='"Later" button — snooze options shown on WhatsApp'>
              <SnoozePresetsEditor
                value={draft.snooze_presets ?? []}
                onChange={(v) => patch({ snooze_presets: v })}
              />
            </Field>
            <Field label="Max self-reschedules (Later + reply pushes)">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={draft.max_self_reschedules ?? 3}
                  onChange={(e) =>
                    patch({
                      max_self_reschedules: Math.max(
                        1,
                        Math.min(20, Number(e.target.value) || 1),
                      ),
                    })
                  }
                  className="w-16 rounded-tc-chip border border-tc-rule bg-tc-bg-card px-2 py-1 text-sm"
                />
                <span className="text-xs text-tc-ink-muted">
                  before owner is pinged
                </span>
              </div>
            </Field>
          </div>
        )}
      </Section>

      {draft.task_type === 'app_action' && (
        <Section icon={Target} label="Completion condition" hint="When to auto-close">
          <ConditionBuilder
            value={draft.completion_condition as CompletionCondition | null}
            onChange={(v) => patch({ completion_condition: v })}
            entityKind={draft.entity_kind ?? 'none'}
            entityDatasheetId={draft.entity_datasheet_id ?? null}
          />
        </Section>
      )}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between border-t border-tc-rule bg-tc-bg-card px-4 py-3">
        <div className="flex items-center gap-3 text-xs text-tc-ink-muted">
          {template && (
            <>
              <span>Used {template.use_count}×</span>
              {template.last_used_at && (
                <span>· Last {new Date(template.last_used_at).toLocaleDateString()}</span>
              )}
            </>
          )}
          {dirty && <span className="text-tc-alert">Unsaved</span>}
        </div>
        <div className="flex items-center gap-2">
          {template && !isDefault && (
            <button
              onClick={remove}
              disabled={del.isPending}
              className="inline-flex items-center gap-1 rounded-tc-chip border border-tc-rule px-2 py-1 text-xs text-tc-alert hover:bg-tc-alert-soft disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded-tc-chip border border-tc-rule px-2 py-1 text-xs text-tc-ink-2 hover:bg-tc-bg-card-2"
            >
              Cancel
            </button>
          )}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1 rounded-tc-chip bg-tc-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {template ? 'Save' : 'Create'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 4px;
          border: 1px solid var(--tc-rule);
          background: var(--tc-bg-ground);
          padding: 0.375rem 0.5rem;
          font-size: 0.8125rem;
          color: var(--tc-ink);
        }
        .input:focus {
          outline: none;
          border-color: var(--tc-accent);
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--tc-accent) 40%, transparent);
        }
      `}</style>
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: typeof Sparkles;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 rounded-tc-panel border border-tc-rule bg-tc-bg-card p-4">
      <header className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-tc-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-tc-ink">{label}</h3>
        {hint && <span className="text-[11px] text-tc-ink-muted">· {hint}</span>}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-tc-ink-muted">
        {label}
        {required && <span className="ml-1 text-tc-alert">*</span>}
      </div>
      {children}
    </label>
  );
}

function DueOffsetsEditor({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) return;
    if (value.includes(n)) {
      setDraft('');
      return;
    }
    onChange([...value, n].sort((a, b) => a - b));
    setDraft('');
  };
  const remove = (h: number) => onChange(value.filter((v) => v !== h));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.length === 0 && (
          <span className="text-[11px] italic text-tc-ink-muted">
            No offsets — add some (e.g. -24, -2, 0, 2).
          </span>
        )}
        {value.map((h) => (
          <span
            key={h}
            className="inline-flex items-center gap-1 rounded-tc-chip border border-tc-rule bg-tc-bg-card px-2 py-0.5 font-mono text-[11px] text-tc-ink"
          >
            {h > 0 ? `+${h}h` : `${h}h`}
            <button
              type="button"
              onClick={() => remove(h)}
              className="text-tc-ink-muted hover:text-tc-alert"
              aria-label={`Remove ${h}h offset`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. -2"
          className="w-24 rounded-tc-chip border border-tc-rule bg-tc-bg-card px-2 py-1 font-mono text-xs"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-tc-chip border border-tc-rule px-2 py-1 text-xs text-tc-ink-2 hover:border-tc-accent hover:text-tc-accent"
        >
          Add
        </button>
      </div>
    </div>
  );
}

type PresetKind = 'hours' | 'time' | 'custom';

function presetKind(p: SnoozePreset): PresetKind {
  if ('custom' in p && p.custom) return 'custom';
  if ('hours' in p) return 'hours';
  return 'time';
}

function SnoozePresetsEditor({
  value,
  onChange,
}: {
  value: SnoozePreset[];
  onChange: (next: SnoozePreset[]) => void;
}) {
  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= value.length) return;
    const next = value.slice();
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<SnoozePreset>) => {
    const next = value.slice();
    next[i] = { ...(next[i] as any), ...(patch as any) };
    onChange(next);
  };
  const add = (kind: PresetKind) => {
    if (value.length >= 10) return;
    if (kind === 'hours') {
      onChange([...value, { label: '1 hour', hours: 1 }]);
    } else if (kind === 'time') {
      onChange([...value, { label: 'Tomorrow 9am', day_offset: 1, time: '09:00' }]);
    } else {
      onChange([...value, { label: 'Custom time', custom: true }]);
    }
  };

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-[11px] italic text-tc-ink-muted">
          No snooze options — the assignee will get one fixed snooze based on
          &ldquo;Later&rdquo; snoozes for above. Add options to show a WhatsApp menu.
        </p>
      )}
      <ul className="space-y-1">
        {value.map((p, i) => {
          const kind = presetKind(p);
          return (
            <li
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-tc-chip border border-tc-rule bg-tc-bg-card px-2 py-1.5"
            >
              <span className="w-6 font-mono text-[10px] text-tc-ink-muted">#{i + 1}</span>
              <input
                value={p.label ?? ''}
                onChange={(e) => update(i, { label: e.target.value } as Partial<SnoozePreset>)}
                placeholder="Label"
                className="w-32 rounded border border-tc-rule bg-tc-bg-ground px-2 py-0.5 text-xs"
                maxLength={24}
              />
              <span className="rounded-tc-chip bg-tc-bg-card-2 px-1.5 py-0.5 font-mono text-[10px] text-tc-ink-muted">
                {kind}
              </span>
              {kind === 'hours' && (
                <label className="inline-flex items-center gap-1 text-[11px] text-tc-ink-2">
                  in
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={(p as { hours: number }).hours}
                    onChange={(e) => update(i, { hours: Number(e.target.value) } as Partial<SnoozePreset>)}
                    className="w-14 rounded border border-tc-rule bg-tc-bg-ground px-1 py-0.5 font-mono text-xs"
                  />
                  h
                </label>
              )}
              {kind === 'time' && (
                <>
                  <label className="inline-flex items-center gap-1 text-[11px] text-tc-ink-2">
                    +
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={(p as { day_offset: number }).day_offset}
                      onChange={(e) =>
                        update(i, { day_offset: Number(e.target.value) } as Partial<SnoozePreset>)
                      }
                      className="w-12 rounded border border-tc-rule bg-tc-bg-ground px-1 py-0.5 font-mono text-xs"
                    />
                    d
                  </label>
                  <label className="inline-flex items-center gap-1 text-[11px] text-tc-ink-2">
                    at
                    <input
                      type="time"
                      value={(p as { time: string }).time}
                      onChange={(e) => update(i, { time: e.target.value } as Partial<SnoozePreset>)}
                      className="rounded border border-tc-rule bg-tc-bg-ground px-1 py-0.5 font-mono text-xs"
                    />
                  </label>
                </>
              )}
              {kind === 'custom' && (
                <span className="text-[11px] italic text-tc-ink-muted">
                  Assignee replies with their own time (parsed).
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded px-1 text-tc-ink-muted hover:text-tc-ink disabled:opacity-30"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === value.length - 1}
                  className="rounded px-1 text-tc-ink-muted hover:text-tc-ink disabled:opacity-30"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded px-1 text-tc-ink-muted hover:text-tc-alert"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-1 pt-1">
        <span className="text-[11px] text-tc-ink-muted">Add:</span>
        <button
          type="button"
          onClick={() => add('hours')}
          disabled={value.length >= 10}
          className="rounded-tc-chip border border-tc-rule px-2 py-0.5 text-[11px] text-tc-ink-2 hover:border-tc-accent hover:text-tc-accent disabled:opacity-40"
        >
          + Hours
        </button>
        <button
          type="button"
          onClick={() => add('time')}
          disabled={value.length >= 10}
          className="rounded-tc-chip border border-tc-rule px-2 py-0.5 text-[11px] text-tc-ink-2 hover:border-tc-accent hover:text-tc-accent disabled:opacity-40"
        >
          + Time of day
        </button>
        <button
          type="button"
          onClick={() => add('custom')}
          disabled={value.length >= 10 || value.some((p) => 'custom' in p && p.custom)}
          className="rounded-tc-chip border border-tc-rule px-2 py-0.5 text-[11px] text-tc-ink-2 hover:border-tc-accent hover:text-tc-accent disabled:opacity-40"
        >
          + Custom time
        </button>
      </div>
      {value.length >= 10 && (
        <p className="text-[11px] italic text-tc-ink-muted">
          WhatsApp limits list menus to 10 rows.
        </p>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-tc-chip border px-2 py-1 text-xs transition-colors ${
        active
          ? 'border-tc-accent bg-tc-accent-soft text-tc-accent'
          : 'border-tc-rule text-tc-ink-2 hover:border-tc-accent/50'
      }`}
    >
      {children}
    </button>
  );
}
