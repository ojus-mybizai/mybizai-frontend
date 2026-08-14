'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useDatasheetSchema } from '@/hooks/use-datasheet-schema';
import { useContactFields } from '@/hooks/use-contact-fields';
import { contactTagService } from '@/services/contacts-v2';
import { contactGroupsService } from '@/services/contactGroups';
import type { EntityKind, CompletionSignal, CompletionCondition } from '@/services/taskTemplates';

export type { CompletionSignal, CompletionCondition };

type InputKind = 'field' | 'fields' | 'value' | 'tag' | 'group';

interface SignalDef {
  key: CompletionSignal;
  label: string;
  hint: string;
  inputs: InputKind[];
}

const CATALOG: Record<EntityKind, SignalDef[]> = {
  datasheet: [
    { key: 'manual',         label: 'Only when marked done',       hint: 'Assignee marks it done manually.', inputs: [] },
    { key: 'record_created', label: 'A record is created',         hint: 'Any new row in this datasheet.', inputs: [] },
    { key: 'record_updated', label: 'A record is updated',         hint: 'Any write to the bound row.', inputs: [] },
    { key: 'field_changed',  label: 'A specific field changes',    hint: 'Fires when the picked field is written.', inputs: ['fields'] },
    { key: 'fields_filled',  label: 'Specific fields are filled',  hint: 'All picked fields must be non-empty.', inputs: ['fields'] },
    { key: 'field_equals',   label: 'A field equals a value',      hint: 'The picked field must equal the target value.', inputs: ['field', 'value'] },
    { key: 'record_deleted', label: 'A record is deleted',         hint: 'The bound row is removed.', inputs: [] },
  ],
  contact: [
    { key: 'manual',                 label: 'Only when marked done',           hint: 'Assignee marks it done manually.', inputs: [] },
    { key: 'contact_field_filled',   label: 'Contact fields are filled',       hint: 'All picked contact fields become non-empty.', inputs: ['fields'] },
    { key: 'contact_field_equals',   label: 'A contact field equals a value',  hint: 'The picked contact field reaches the target value.', inputs: ['field', 'value'] },
    { key: 'contact_tagged',         label: 'The contact gets a tag',          hint: 'A specific tag is added to the contact.', inputs: ['tag'] },
    { key: 'contact_added_to_group', label: 'The contact joins a group',       hint: 'The contact is added to a specific group.', inputs: ['group'] },
  ],
  none: [
    { key: 'manual', label: 'Only when marked done', hint: 'This template has no bound entity, so auto-completion isn’t available.', inputs: [] },
  ],
};

export function ConditionBuilder({
  value,
  onChange,
  entityKind,
  entityDatasheetId,
}: {
  value: CompletionCondition | null;
  onChange: (v: CompletionCondition | null) => void;
  entityKind: EntityKind;
  entityDatasheetId: number | null;
}) {
  const catalog = CATALOG[entityKind] ?? CATALOG.none;
  const signal: CompletionSignal = value?.signal ?? 'manual';
  const currentDef = catalog.find((s) => s.key === signal);

  const dsSchema = useDatasheetSchema(entityKind === 'datasheet' ? entityDatasheetId : undefined);
  const cFields = useContactFields();
  const tagsQ = useQuery({
    queryKey: ['contacts-v2', 'tags', 'all'],
    queryFn: () => contactTagService.list(),
    enabled: entityKind === 'contact',
    staleTime: 60_000,
  });
  const groupsQ = useQuery({
    queryKey: ['contact-groups', 'all'],
    queryFn: () => contactGroupsService.list(),
    enabled: entityKind === 'contact',
    staleTime: 60_000,
  });

  const fieldOptions = useMemo(() => {
    if (entityKind === 'datasheet') {
      return (dsSchema.data ?? []).map((f) => ({
        name: f.name,
        display_name: f.display_name,
        field_type: f.field_type,
        config: f.config ?? {},
      }));
    }
    if (entityKind === 'contact') {
      return cFields.data ?? [];
    }
    return [];
  }, [entityKind, dsSchema.data, cFields.data]);

  const pickedField = useMemo(
    () => fieldOptions.find((f) => f.name === value?.field) ?? null,
    [fieldOptions, value?.field],
  );

  const setSignal = (s: CompletionSignal) => {
    if (s === 'manual') {
      onChange(null);
      return;
    }
    const base: CompletionCondition = { signal: s, entity_kind: entityKind };
    if (entityKind === 'datasheet' && entityDatasheetId) base.datasheet_id = entityDatasheetId;
    onChange(base);
  };

  const patch = (delta: Partial<CompletionCondition>) => {
    const next: CompletionCondition = {
      signal,
      entity_kind: entityKind,
      ...(value ?? {}),
      ...delta,
    };
    if (entityKind === 'datasheet' && entityDatasheetId) next.datasheet_id = entityDatasheetId;
    onChange(next);
  };

  const inputs = currentDef?.inputs ?? [];

  return (
    <div className="space-y-3 rounded-tc-panel border border-tc-rule bg-tc-bg-card-2 p-3">
      <div className="flex items-start gap-2 text-xs text-tc-ink-muted">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-tc-accent" />
        <span>
          <span className="font-medium text-tc-ink-2">Mark the task done automatically when:</span>
        </span>
      </div>

      <div className="space-y-1">
        {catalog.map((def) => {
          const disabled = entityKind === 'none' && def.key !== 'manual';
          const isActive = signal === def.key;
          return (
            <label
              key={def.key}
              title={disabled ? 'Bind an entity to unlock auto-completion signals.' : def.hint}
              className={`flex cursor-pointer items-start gap-2 rounded-tc-chip px-2 py-1 text-sm ${
                isActive ? 'bg-tc-accent-soft text-tc-accent' : 'text-tc-ink-2 hover:bg-tc-bg-card'
              } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <input
                type="radio"
                name="completion-signal"
                checked={isActive}
                disabled={disabled}
                onChange={() => !disabled && setSignal(def.key)}
                className="mt-0.5 accent-tc-accent"
              />
              <span className="flex-1">
                <span className="block">{def.label}</span>
                <span className="block text-[11px] text-tc-ink-muted">{def.hint}</span>
              </span>
            </label>
          );
        })}
      </div>

      {inputs.includes('fields') && (
        <div className="flex flex-wrap gap-1">
          {fieldOptions.length === 0 && (
            <span className="text-xs text-tc-ink-muted">
              {entityKind === 'datasheet'
                ? 'Bind a datasheet to see fields.'
                : 'No contact fields defined yet.'}
            </span>
          )}
          {fieldOptions.map((f) => {
            const active = (value?.fields ?? []).includes(f.name);
            return (
              <button
                key={f.name}
                type="button"
                onClick={() => {
                  const cur = new Set(value?.fields ?? []);
                  if (cur.has(f.name)) cur.delete(f.name);
                  else cur.add(f.name);
                  patch({ fields: Array.from(cur) });
                }}
                className={`rounded-tc-chip border px-2 py-0.5 text-[11px] ${
                  active
                    ? 'border-tc-accent bg-tc-accent-soft text-tc-accent'
                    : 'border-tc-rule text-tc-ink-2 hover:border-tc-accent/50'
                }`}
              >
                {f.display_name}
              </button>
            );
          })}
        </div>
      )}

      {inputs.includes('field') && (
        <div className="grid grid-cols-2 gap-2">
          <select
            value={value?.field ?? ''}
            onChange={(e) => patch({ field: e.target.value, value: '' })}
            className="rounded-tc-chip border border-tc-rule bg-tc-bg-ground px-2 py-1.5 text-xs text-tc-ink focus:border-tc-accent focus:outline-none"
          >
            <option value="">Field…</option>
            {fieldOptions.map((f) => (
              <option key={f.name} value={f.name}>
                {f.display_name}
              </option>
            ))}
          </select>
          {inputs.includes('value') && (
            <ValueInput
              field={pickedField}
              value={value?.value ?? ''}
              onChange={(v) => patch({ value: v })}
            />
          )}
        </div>
      )}

      {inputs.includes('tag') && (
        <select
          value={value?.tag_id ?? ''}
          onChange={(e) => patch({ tag_id: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full rounded-tc-chip border border-tc-rule bg-tc-bg-ground px-2 py-1.5 text-xs text-tc-ink focus:border-tc-accent focus:outline-none"
        >
          <option value="">Pick a tag…</option>
          {(tagsQ.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}

      {inputs.includes('group') && (
        <select
          value={value?.group_id ?? ''}
          onChange={(e) => patch({ group_id: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full rounded-tc-chip border border-tc-rule bg-tc-bg-ground px-2 py-1.5 text-xs text-tc-ink focus:border-tc-accent focus:outline-none"
        >
          <option value="">Pick a group…</option>
          {(groupsQ.data ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function ValueInput({
  field,
  value,
  onChange,
}: {
  field: { field_type: string; config: Record<string, unknown> } | null;
  value: string;
  onChange: (v: string) => void;
}) {
  const type = field?.field_type ?? 'text';
  const cls =
    'rounded-tc-chip border border-tc-rule bg-tc-bg-ground px-2 py-1.5 text-xs text-tc-ink focus:border-tc-accent focus:outline-none';

  if (type === 'boolean') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        <option value="">Value…</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (type === 'select' || type === 'enum') {
    const opts = (field?.config?.options as (string | { value: string; label?: string })[]) ?? [];
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        <option value="">Value…</option>
        {opts.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : (o.label ?? o.value);
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    );
  }
  if (type === 'number' || type === 'currency' || type === 'decimal') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Value"
        className={cls}
      />
    );
  }
  if (type === 'date') {
    return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />;
  }
  if (type === 'datetime') {
    return (
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value"
      className={cls}
    />
  );
}
