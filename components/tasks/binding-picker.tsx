'use client';

import { Database, User, CircleSlash } from 'lucide-react';
import type { EntityKind, RowCount } from '@/services/taskTemplates';
import type { DynamicModel } from '@/services/dynamic-data';

export function BindingPicker({
  entityKind,
  entityDatasheetId,
  rowCount,
  models,
  onChangeEntity,
  onChangeDatasheet,
  onChangeRowCount,
}: {
  entityKind: EntityKind;
  entityDatasheetId: number | null;
  rowCount: RowCount;
  models: DynamicModel[] | undefined;
  onChangeEntity: (k: EntityKind) => void;
  onChangeDatasheet: (id: number | null) => void;
  onChangeRowCount: (r: RowCount) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-tc-ink-muted">
          What is this task about?
        </div>
        <div className="flex flex-wrap gap-1">
          <EntityChip
            active={entityKind === 'datasheet'}
            icon={Database}
            label="Datasheet"
            onClick={() => onChangeEntity('datasheet')}
          />
          <EntityChip
            active={entityKind === 'contact'}
            icon={User}
            label="Contact"
            onClick={() => onChangeEntity('contact')}
          />
          <EntityChip
            active={entityKind === 'none'}
            icon={CircleSlash}
            label="Nothing"
            onClick={() => onChangeEntity('none')}
          />
        </div>
      </div>

      {entityKind !== 'none' && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-tc-ink-muted">
            How many?
          </div>
          <div className="flex flex-wrap gap-1">
            <SimpleChip
              active={rowCount === 'single'}
              onClick={() => onChangeRowCount('single')}
              label="One"
            />
            <SimpleChip
              active={rowCount === 'multi'}
              onClick={() => onChangeRowCount('multi')}
              label="Many"
            />
          </div>
        </div>
      )}

      {entityKind === 'datasheet' && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-tc-ink-muted">
            Datasheet
          </div>
          <select
            value={entityDatasheetId ?? ''}
            onChange={(e) =>
              onChangeDatasheet(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full rounded border border-tc-rule bg-tc-bg-ground px-2 py-1.5 text-xs text-tc-ink focus:border-tc-accent focus:outline-none"
          >
            <option value="">Pick a datasheet…</option>
            {(models ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function EntityChip({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Database;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-tc-chip border px-2 py-1 text-xs transition-colors ${
        active
          ? 'border-tc-accent bg-tc-accent-soft text-tc-accent'
          : 'border-tc-rule text-tc-ink-2 hover:border-tc-accent/50'
      }`}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function SimpleChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
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
      {label}
    </button>
  );
}
