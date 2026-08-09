'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Send, RefreshCw, SlidersHorizontal, Users, X, Pin, AlertCircle,
} from 'lucide-react';
import {
  createWorkItem,
  type CreateWaWorkPayload,
  type WaWorkItem,
} from '@/services/waWork';
import { listAgentRoles, type AgentRoleOption } from '@/services/agentRoles';
import type { WaTemplate } from '@/services/waTemplates';
import type {
  WaEmployee, WaSettings,
} from '@/services/waEmployees';
import type { ContactTypeDef } from '@/services/contacts';

interface Props {
  employees: WaEmployee[];
  templates: WaTemplate[];
  contactTypes: ContactTypeDef[];
  waSettings: WaSettings | null;

  /** Fires after a successful send so the parent can refresh + open detail. */
  onSent?: (workItem: WaWorkItem) => void;

  /** Pin a single employee as a non-removable recipient. */
  lockedEmployee?: WaEmployee | null;

  /** Pin a template as the default — user can still change it. */
  lockedTemplate?: WaTemplate | null;

  /** Pass a key change when the lock context changes to fully reset state. */
  contextKey?: string | number;

  /** Variant: 'card' = full bordered card; 'flush' = no top border (caller owns it). */
  variant?: 'card' | 'flush';
}

/**
 * Compose + dispatch a WaWorkItem.
 *
 * Reused in three places:
 *  - wa-work → Work Items left panel (no locks)
 *  - wa-work → By Employee right panel footer (lockedEmployee)
 *  - wa-work → By Template right panel footer (lockedTemplate)
 *
 * Owns its own draft, recipient, template, due-date and advanced-options state.
 */
export function TaskComposer({
  employees,
  templates,
  contactTypes,
  waSettings,
  onSent,
  lockedEmployee = null,
  lockedTemplate = null,
  contextKey,
  variant = 'card',
}: Props) {
  const [text, setText] = useState('');
  const [extraEmployeeIds, setExtraEmployeeIds] = useState<number[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [roles, setRoles] = useState<AgentRoleOption[]>([]);
  const [templateId, setTemplateId] = useState<number | null>(lockedTemplate?.id ?? null);
  const [leadTypeId, setLeadTypeId] = useState<number | null>(null);
  const [dueAt, setDueAt] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Fetch the canonical agent-role list once (single source of truth — never a
  // local literal array).
  useEffect(() => {
    let active = true;
    listAgentRoles().then((r) => { if (active) setRoles(r); }).catch(() => {});
    return () => { active = false; };
  }, []);

  // Whenever the lock context changes (employee/template selection switches),
  // reset stale draft state so it doesn't leak between contexts.
  useEffect(() => {
    setText('');
    setExtraEmployeeIds([]);
    setRole(null);
    setLeadTypeId(null);
    setDueAt('');
    setAdvancedOpen(false);
    setRecipientOpen(false);
    setError(null);
    setTemplateId(lockedTemplate?.id ?? null);
  }, [contextKey, lockedTemplate?.id]);

  const template = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  const allRecipientIds = useMemo(() => {
    const set = new Set<number>(extraEmployeeIds);
    if (lockedEmployee) set.add(lockedEmployee.id);
    return Array.from(set);
  }, [extraEmployeeIds, lockedEmployee]);

  const recipientLabel = useMemo(() => {
    const parts: string[] = [];
    if (role) {
      const r = roles.find((r) => r.value === role);
      parts.push(`${r?.label ?? role} role`);
    }
    if (lockedEmployee) parts.push(lockedEmployee.name.split(' ')[0]);
    for (const id of extraEmployeeIds) {
      const emp = employees.find((e) => e.id === id);
      if (emp) parts.push(emp.name.split(' ')[0]);
    }
    if (parts.length === 0) return null;
    return parts.slice(0, 2).join(', ') + (parts.length > 2 ? ` +${parts.length - 2}` : '');
  }, [role, extraEmployeeIds, lockedEmployee, roles, employees]);

  function toggleExtraRecipient(empId: number) {
    if (lockedEmployee?.id === empId) return; // can't unselect the locked one
    setExtraEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId],
    );
  }

  const noRecipients = employees.length === 0;

  async function handleSend() {
    if (!text.trim()) return;
    if (allRecipientIds.length === 0 && !role) {
      setError('Pick at least one employee or a role');
      setRecipientOpen(true);
      return;
    }

    setSending(true);
    setError(null);
    try {
      const payload: CreateWaWorkPayload = {
        title: text.trim(),
        wa_template_id: templateId || undefined,
        assigned_employee_ids: allRecipientIds,
        assigned_role: role || undefined,
        due_at: dueAt ? dueAt + (dueAt.endsWith('Z') ? '' : ':00Z') : undefined,
        contact_type_id: leadTypeId || undefined,
        auto_dispatch: true,
      };
      const created = await createWorkItem(payload);

      // Reset draft, keep locked context
      setText('');
      setExtraEmployeeIds([]);
      setRole(null);
      setLeadTypeId(null);
      setDueAt('');
      setAdvancedOpen(false);
      setRecipientOpen(false);
      setTemplateId(lockedTemplate?.id ?? null);

      onSent?.(created);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */

  const wrapperClass =
    variant === 'flush'
      ? 'bg-bg-primary shrink-0'
      : 'border-t-2 border-border-color bg-bg-primary shrink-0';

  return (
    <div className={wrapperClass}>
      {/* Compose header */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide shrink-0">
            New Task
          </p>
          {lockedEmployee && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-green-800 bg-green-50 border border-green-300 rounded-full">
              <Pin className="w-2.5 h-2.5" />
              <span className="truncate max-w-[140px]">{lockedEmployee.name}</span>
            </span>
          )}
          {lockedTemplate && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-300 border border-purple-300 dark:border-purple-800 rounded-full">
              <Pin className="w-2.5 h-2.5" />
              <span className="truncate max-w-[140px]">{lockedTemplate.name}</span>
            </span>
          )}
        </div>
        <button
          onClick={() => setRecipientOpen(!recipientOpen)}
          className={`text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0 ${
            recipientOpen ? 'text-green-600' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Users className="w-3 h-3" />
          {recipientLabel ? (
            <span className="text-green-600 truncate max-w-[140px]">{recipientLabel}</span>
          ) : (
            <span>{lockedEmployee ? 'Add more' : 'Pick recipients'}</span>
          )}
        </button>
      </div>

      {/* Recipient picker */}
      {recipientOpen && (
        <div className="border-b border-border-color p-3 max-h-52 overflow-y-auto space-y-3">
          {noRecipients ? (
            <p className="text-xs text-text-secondary text-center py-2">
              No active members.{' '}
              <a href="/members" className="text-green-600 underline">Add members →</a>
            </p>
          ) : (
            <>
              {!lockedEmployee && roles.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase text-text-secondary mb-1.5">Role</p>
                  <div className="flex flex-wrap gap-1.5">
                    {roles.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setRole(role === r.value ? null : r.value)}
                        className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                          role === r.value
                            ? 'bg-green-600 text-white border-green-600'
                            : 'border-border-color text-text-primary hover:bg-bg-secondary'
                        }`}
                      >
                        🎭 {r.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-secondary">
                    Sends to every active member with that role. Most staff default to{' '}
                    <span className="font-medium">Staff</span> — set roles on the{' '}
                    <a href="/members" className="underline">Members page</a> for finer targeting.
                  </p>
                </div>
              )}
              {employees.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase text-text-secondary mb-1.5">
                    {lockedEmployee ? 'Also send to' : 'Employees'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {employees.map((emp) => {
                      const isLocked = lockedEmployee?.id === emp.id;
                      const isSelected = isLocked || extraEmployeeIds.includes(emp.id);
                      return (
                        <button
                          key={emp.id}
                          onClick={() => toggleExtraRecipient(emp.id)}
                          disabled={isLocked}
                          title={isLocked ? 'Locked recipient' : undefined}
                          className={`px-2.5 py-1 text-xs rounded-full border transition-all flex items-center gap-1 ${
                            isSelected
                              ? 'bg-green-600 text-white border-green-600'
                              : 'border-border-color text-text-primary hover:bg-bg-secondary'
                          } ${isLocked ? 'cursor-not-allowed opacity-90' : ''}`}
                        >
                          {isLocked && <Pin className="w-2.5 h-2.5" />}
                          {emp.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Advanced options */}
      {advancedOpen && (
        <div className="border-b border-border-color p-3 space-y-2">
          <div className="flex gap-2">
            <select
              value={templateId ?? ''}
              onChange={(e) => {
                setTemplateId(e.target.value ? Number(e.target.value) : null);
                setLeadTypeId(null);
              }}
              className="flex-1 border border-border-color rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-green-500 bg-bg-primary"
            >
              <option value="">No template (plain text)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  📋 {t.name} ({t.type.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="border border-border-color rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-green-500 w-36 bg-bg-primary"
            />
          </div>

          {template?.type === 'lead_list' && (
            <select
              value={leadTypeId ?? ''}
              onChange={(e) => setLeadTypeId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border border-border-color rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-green-500 bg-bg-primary"
            >
              <option value="">All contacts (no filter)</option>
              {contactTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>{ct.name}</option>
              ))}
            </select>
          )}

          {template?.type === 'whatsapp_form' && !template.meta_flow_id && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 rounded-lg px-2 py-1.5">
              ⚠ This form template hasn&apos;t been published to Meta yet.{' '}
              <a href="/wa-templates" className="underline font-medium">Publish it first →</a>
            </p>
          )}

          {waSettings && !waSettings.task_template_name && (
            <p className="text-xs text-text-secondary bg-bg-secondary rounded-lg px-2 py-1.5">
              💡 No task template set — messages only reach members who messaged you in the last 24h.{' '}
              <a href="/settings/whatsapp" className="underline">Configure →</a>
            </p>
          )}
        </div>
      )}

      {/* Textarea + action buttons */}
      <div className="flex gap-2 items-end px-3 py-2.5">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
          }}
          placeholder={
            lockedEmployee
              ? `Assign a task to ${lockedEmployee.name.split(' ')[0]}… (⌘Enter)`
              : 'Type a task… (⌘Enter to send)'
          }
          rows={2}
          className="flex-1 resize-none rounded-xl border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 transition-colors"
        />
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            title="Template, due date & options"
            className={`p-2 rounded-lg border transition-colors ${
              advancedOpen
                ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800 text-green-600'
                : 'border-border-color hover:bg-bg-secondary text-text-secondary'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            title="Send (⌘Enter)"
            className="p-2 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-3 mb-2.5 flex items-start gap-1.5 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-900 px-2.5 py-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-300 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
