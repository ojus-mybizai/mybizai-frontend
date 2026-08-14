'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { assignTaskTemplate, type TaskTemplate } from '@/services/taskTemplates';
import { useMembers } from '@/hooks/use-members';
import { useToastStore } from '@/lib/toast-store';
import { parse, extractFreeVariables } from '@/lib/tasks/token-parser';
import { useDatasheetSchema } from '@/hooks/use-datasheet-schema';
import { listModels } from '@/services/dynamic-data';
import { RowPicker } from './shared/row-picker';
import { ContactPicker } from './shared/contact-picker';
import { MemberAvatar } from './shared/member-avatar';

const PER_ROW_WARN = 20;
const INLINE_CONFIRM_MAX = 50;

type ConfirmState = 'idle' | 'inline' | 'hard';

export function DispatchWizard({
  template,
  defaultMemberId,
  onDone,
  onCancel,
}: {
  template: TaskTemplate;
  defaultMemberId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToastStore((s) => s.add);

  const isMulti = template.row_count === 'multi';
  const hasEntity = template.entity_kind !== 'none';
  const needsAssigneePick = template.assignee_mode === 'prompt';

  // Free var detection (schema tokens excluded).
  const { data: models } = useQuery({ queryKey: ['dynamic-models'], queryFn: listModels });
  const datasheet =
    template.entity_kind === 'datasheet'
      ? models?.find((m) => m.id === template.entity_datasheet_id) ?? null
      : null;
  const schema = useDatasheetSchema(datasheet?.id);
  const freeVarNames = useMemo(() => {
    const set = new Set<string>();
    const ctx = { datasheetName: datasheet?.name ?? undefined, fields: schema.data };
    for (const p of extractFreeVariables(parse(template.title_pattern, ctx))) set.add(p);
    for (const p of extractFreeVariables(parse(template.instructions ?? '', ctx))) set.add(p);
    for (const v of template.variables ?? []) set.add(v.name);
    return Array.from(set);
  }, [template, datasheet?.name, schema.data]);
  const varMeta = useMemo(() => new Map((template.variables ?? []).map((v) => [v.name, v])), [template]);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sharedVars, setSharedVars] = useState<Record<string, string>>({});
  const [perRow, setPerRow] = useState(false);
  const [perRowVars, setPerRowVars] = useState<Record<number, Record<string, string>>>({});
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState>('idle');
  const [submitting, setSubmitting] = useState(false);

  const { data: members } = useMembers();
  const filteredMembers = useMemo(
    () =>
      (members ?? []).filter((m) =>
        m.name.toLowerCase().includes(assigneeSearch.toLowerCase().trim()),
      ),
    [members, assigneeSearch],
  );

  const total = hasEntity ? selectedIds.length : 1;

  const missingRequired = useMemo(() => {
    if (perRow) return false;
    return freeVarNames.some(
      (n) => varMeta.get(n)?.required && !(sharedVars[n] ?? '').trim(),
    );
  }, [freeVarNames, sharedVars, varMeta, perRow]);

  const canSubmit =
    !submitting &&
    total > 0 &&
    !missingRequired &&
    (!needsAssigneePick || assigneeId != null);

  const submit = async (opts?: { largeConfirmed?: boolean }) => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload: Parameters<typeof assignTaskTemplate>[1] = {
        variables: perRow ? {} : sharedVars,
        per_row_variables: perRow
          ? Object.fromEntries(
              Object.entries(perRowVars).map(([k, v]) => [Number(k), v]),
            )
          : undefined,
        target_records:
          template.entity_kind === 'datasheet' && selectedIds.length ? selectedIds : undefined,
        target_contacts:
          template.entity_kind === 'contact' && selectedIds.length ? selectedIds : undefined,
        assignee_override: needsAssigneePick && assigneeId ? { member_id: assigneeId } : undefined,
        confirm_large: opts?.largeConfirmed ?? false,
      };
      const res = await assignTaskTemplate(template.id, payload);
      toast(
        res.delivered < res.total
          ? `Assigned "${template.name}" — ${res.delivered}/${res.total} delivered`
          : `Assigned "${template.name}" (${res.total})`,
        'success',
      );
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Assign failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const onClickAssign = () => {
    if (total <= 5) return submit();
    if (total <= INLINE_CONFIRM_MAX) {
      if (confirm === 'inline') return submit();
      setConfirm('inline');
      return;
    }
    setConfirm('hard');
  };

  // Reset per-row entries when selection changes.
  useEffect(() => {
    setPerRowVars((prev) => {
      const next: Record<number, Record<string, string>> = {};
      for (const id of selectedIds) next[id] = prev[id] ?? {};
      return next;
    });
  }, [selectedIds]);

  useEffect(() => {
    if (needsAssigneePick && assigneeId == null && defaultMemberId) {
      setAssigneeId(defaultMemberId);
    }
  }, [needsAssigneePick, assigneeId, defaultMemberId]);

  return (
    <div
      role="dialog"
      aria-label={`Dispatch ${template.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-tc-panel border border-tc-rule bg-tc-bg-card shadow-xl">
        <header className="flex items-center justify-between border-b border-tc-rule px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-tc-ink">Dispatch: {template.name}</h2>
            <p className="mt-0.5 text-[11px] text-tc-ink-muted">
              {template.entity_kind}·{template.row_count}·{template.assignee_mode}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="rounded p-1 text-tc-ink-muted hover:bg-tc-bg-card-2 hover:text-tc-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {hasEntity && (
            <Section label={template.entity_kind === 'datasheet' ? 'Rows' : 'Contacts'}>
              {template.entity_kind === 'datasheet' && template.entity_datasheet_id ? (
                <RowPicker
                  datasheetId={template.entity_datasheet_id}
                  multi={isMulti}
                  selected={selectedIds}
                  onChange={setSelectedIds}
                />
              ) : (
                <ContactPicker multi={isMulti} selected={selectedIds} onChange={setSelectedIds} />
              )}
            </Section>
          )}

          {freeVarNames.length > 0 && (
            <Section label="Variables">
              {isMulti && (
                <div className="mb-2 flex gap-1">
                  <ToggleChip active={!perRow} onClick={() => setPerRow(false)}>
                    Same for all rows
                  </ToggleChip>
                  <ToggleChip active={perRow} onClick={() => setPerRow(true)}>
                    Per row
                  </ToggleChip>
                </div>
              )}
              {perRow && selectedIds.length > PER_ROW_WARN && (
                <div className="mb-2 flex items-start gap-2 rounded-tc-chip bg-tc-warn-soft px-2 py-1.5 text-[11px] text-tc-warn">
                  <AlertTriangle className="mt-0.5 h-3 w-3" />
                  <span>
                    Per-row values for {selectedIds.length} items. Consider shared values or split
                    the dispatch.
                  </span>
                </div>
              )}
              {!perRow ? (
                <div className="space-y-2">
                  {freeVarNames.map((name) => {
                    const meta = varMeta.get(name);
                    return (
                      <label key={name} className="block">
                        <div className="mb-0.5 flex items-center gap-1 text-[11px] text-tc-ink-2">
                          {meta?.label || name}
                          {meta?.required && <span className="text-tc-alert">*</span>}
                          {meta?.hint && (
                            <span className="text-[10px] text-tc-ink-muted">· {meta.hint}</span>
                          )}
                        </div>
                        <input
                          value={sharedVars[name] ?? ''}
                          onChange={(e) =>
                            setSharedVars((v) => ({ ...v, [name]: e.target.value }))
                          }
                          placeholder={name}
                          className={`w-full rounded border bg-tc-bg-ground px-2 py-1.5 text-xs text-tc-ink focus:outline-none ${
                            meta?.required && !(sharedVars[name] ?? '').trim()
                              ? 'border-tc-alert focus:border-tc-alert'
                              : 'border-tc-rule focus:border-tc-accent'
                          }`}
                        />
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="max-h-56 overflow-auto rounded border border-tc-rule">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-tc-bg-card-2 text-left text-[10px] uppercase tracking-wider text-tc-ink-muted">
                      <tr>
                        <th className="px-2 py-1.5 font-semibold">Row</th>
                        {freeVarNames.map((n) => (
                          <th key={n} className="px-2 py-1.5 font-semibold">
                            {varMeta.get(n)?.label || n}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedIds.map((id) => (
                        <tr key={id} className="border-t border-tc-rule">
                          <td className="px-2 py-1 font-mono text-[11px] text-tc-ink-muted">
                            #{id}
                          </td>
                          {freeVarNames.map((n) => (
                            <td key={n} className="px-2 py-1">
                              <input
                                value={perRowVars[id]?.[n] ?? ''}
                                onChange={(e) =>
                                  setPerRowVars((v) => ({
                                    ...v,
                                    [id]: { ...(v[id] ?? {}), [n]: e.target.value },
                                  }))
                                }
                                className="w-full rounded border border-tc-rule bg-tc-bg-ground px-1.5 py-1 text-xs text-tc-ink focus:border-tc-accent focus:outline-none"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                      {selectedIds.length === 0 && (
                        <tr>
                          <td
                            colSpan={freeVarNames.length + 1}
                            className="px-2 py-3 text-center text-[11px] text-tc-ink-muted"
                          >
                            Pick rows above first.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

          {needsAssigneePick && (
            <Section label="Assignee">
              <input
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
                placeholder="Search members…"
                className="mb-2 w-full rounded border border-tc-rule bg-tc-bg-ground px-2 py-1.5 text-xs text-tc-ink focus:border-tc-accent focus:outline-none"
              />
              {!members ? (
                <div className="flex items-center justify-center gap-1 py-4 text-xs text-tc-ink-muted">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-4 text-center text-xs text-tc-ink-muted">
                  {members.length === 0
                    ? 'No members available. Invite a member first.'
                    : 'No matching members.'}
                </div>
              ) : (
                <ul className="max-h-40 overflow-y-auto rounded border border-tc-rule">
                  {filteredMembers.map((m) => (
                    <li key={m.id}>
                      <button
                        onClick={() => setAssigneeId(m.id)}
                        className={`flex w-full items-center gap-2 border-b border-tc-rule px-2 py-1.5 text-left last:border-b-0 hover:bg-tc-bg-card-2 ${
                          assigneeId === m.id ? 'bg-tc-accent-soft' : ''
                        }`}
                      >
                        <MemberAvatar name={m.name} size={20} />
                        <span className="flex-1 truncate text-xs text-tc-ink">{m.name}</span>
                        {m.role_name && (
                          <span className="text-[10px] text-tc-ink-muted">{m.role_name}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-tc-rule bg-tc-bg-card-2 px-4 py-3">
          <div className="text-[11px] text-tc-ink-muted">
            {hasEntity ? `${total} selected` : '1 task'}
          </div>
          {confirm === 'inline' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-tc-ink-2">Assign to {total}?</span>
              <button
                onClick={() => setConfirm('idle')}
                className="rounded-tc-chip border border-tc-rule px-2 py-1 text-xs text-tc-ink-2 hover:bg-tc-bg-card"
              >
                Cancel
              </button>
              <button
                onClick={() => submit()}
                disabled={submitting}
                className="rounded-tc-chip bg-tc-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
              </button>
            </div>
          ) : (
            <button
              onClick={onClickAssign}
              disabled={!canSubmit}
              className="inline-flex items-center gap-1 rounded-tc-chip bg-tc-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              {hasEntity && isMulti ? `Assign to ${total}` : 'Assign'}
            </button>
          )}
        </footer>

        {confirm === 'hard' && (
          <HardConfirm
            template={template}
            total={total}
            onCancel={() => setConfirm('idle')}
            onConfirm={() => {
              setConfirm('idle');
              submit({ largeConfirmed: true });
            }}
          />
        )}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-tc-ink-muted">
        {label}
      </h3>
      {children}
    </section>
  );
}

function ToggleChip({
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
      className={`rounded-tc-chip border px-2 py-1 text-[11px] transition-colors ${
        active
          ? 'border-tc-accent bg-tc-accent-soft text-tc-accent'
          : 'border-tc-rule text-tc-ink-2 hover:border-tc-accent/50'
      }`}
    >
      {children}
    </button>
  );
}

function HardConfirm({
  template,
  total,
  onCancel,
  onConfirm,
}: {
  template: TaskTemplate;
  total: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md space-y-3 rounded-tc-panel border border-tc-rule bg-tc-bg-card p-4 shadow-xl">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-tc-ink">
          <AlertTriangle className="h-4 w-4 text-tc-warn" />
          Large dispatch — confirm
        </h3>
        <p className="text-xs text-tc-ink-2">
          You are about to assign <b>{template.name}</b> to <b>{total}</b> items.
          {template.delivery_channel !== 'in_app' && (
            <span> WhatsApp will send now.</span>
          )}
        </p>
        <label className="block">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-tc-ink-muted">
            Type "yes" to confirm
          </div>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="w-full rounded border border-tc-rule bg-tc-bg-ground px-2 py-1.5 text-xs text-tc-ink focus:border-tc-accent focus:outline-none"
          />
        </label>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-tc-chip border border-tc-rule px-2 py-1 text-xs text-tc-ink-2 hover:bg-tc-bg-card-2"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={typed.trim().toLowerCase() !== 'yes'}
            className="rounded-tc-chip bg-tc-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
