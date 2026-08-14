'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Shield, X, Trash2, Users, ChevronRight, Lock,
} from 'lucide-react';
import {
  listRoles, createRole, updateRole, deleteRole, getRoleCatalog,
  type Role, type RoleScopeInput, type PermissionCatalog,
} from '@/services/roles';
import { listModels } from '@/services/dynamic-data';
import { listProcesses } from '@/services/processes';
import { contactGroupsService } from '@/services/contactGroups';

/** Which picker a scope_type needs, and which key it writes into scope_config.
 *  scope_types with no entry need no config. */
const CONFIG_FOR_SCOPE_TYPE: Record<string, { source: PickerSource; key: string }> = {
  selected_roles: { source: 'roles', key: 'role_ids' },
  by_group: { source: 'groups', key: 'group_ids' },
};

type PickerSource = 'roles' | 'groups' | 'datasheets' | 'pipelines';

/** `selected` means different things per resource, so it resolves by resource. */
function configFor(resource: string, scopeType: string): { source: PickerSource; key: string } | null {
  if (scopeType === 'selected') {
    if (resource === 'datasheets') return { source: 'datasheets', key: 'sheet_ids' };
    if (resource === 'pipelines') return { source: 'pipelines', key: 'pipeline_ids' };
    return null;
  }
  return CONFIG_FOR_SCOPE_TYPE[scopeType] ?? null;
}

interface PickerOption { id: number; name: string }

function scopeLabel(s: string) {
  return s.replace(/_/g, ' ');
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, c] = await Promise.all([listRoles(), getRoleCatalog()]);
      setRoles(r);
      setCatalog(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number) {
    if (!confirm('Delete this role? Members using it will lose their role assignment.')) return;
    try {
      await deleteRole(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete role');
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Roles & Permissions</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Define what each role can access. System roles cannot be edited.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={!catalog}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> New role
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-2">
          {roles.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-4 rounded-xl border border-border-secondary p-4 hover:bg-bg-secondary/50 transition-colors cursor-pointer"
              onClick={() => !r.is_system && setEditingRole(r)}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${r.is_system ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-bg-secondary'}`}>
                {r.is_system ? <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" /> : <Shield className="w-5 h-5 text-text-secondary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{r.name}</span>
                  {r.is_system && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      system
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {r.member_count} member{r.member_count !== 1 ? 's' : ''}
                  </span>
                  <span>Task scope: {scopeLabel(r.task_scope)}</span>
                  <span>{r.scopes.length} resource scope{r.scopes.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              {!r.is_system && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-text-secondary" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && catalog && (
        <RoleEditor
          catalog={catalog}
          roles={roles}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}

      {editingRole && catalog && (
        <RoleEditor
          role={editingRole}
          catalog={catalog}
          roles={roles}
          onClose={() => setEditingRole(null)}
          onSaved={() => { setEditingRole(null); load(); }}
        />
      )}
    </div>
  );
}

function RoleEditor({ role, catalog, roles, onClose, onSaved }: {
  role?: Role;
  catalog: PermissionCatalog;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!role;
  const resourceNames = Object.keys(catalog.resources);

  const [name, setName] = useState(role?.name || '');
  const [taskScope, setTaskScope] = useState(role?.task_scope || 'own_only');
  const [agentTemplateId, setAgentTemplateId] = useState<number | ''>(role?.agent_template_id ?? '');
  const [scopes, setScopes] = useState<RoleScopeInput[]>(
    role?.scopes.map((s) => ({
      resource: s.resource,
      scope_type: s.scope_type,
      scope_config: s.scope_config ?? undefined,
      allowed_actions: s.allowed_actions ?? undefined,
    })) || []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Picker options for scope_config. Datasheets/pipelines/groups are fetched
  // once on open; roles are already loaded by the page.
  const [datasheets, setDatasheets] = useState<PickerOption[]>([]);
  const [pipelines, setPipelines] = useState<PickerOption[]>([]);
  const [groups, setGroups] = useState<PickerOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ds, pl, gr] = await Promise.allSettled([
        listModels(), listProcesses(), contactGroupsService.list(),
      ]);
      if (cancelled) return;
      if (ds.status === 'fulfilled') {
        setDatasheets(ds.value.map((m) => ({ id: m.id, name: m.display_name || m.name })));
      }
      if (pl.status === 'fulfilled') {
        setPipelines(pl.value.map((p) => ({ id: p.id, name: p.name })));
      }
      if (gr.status === 'fulfilled') {
        setGroups(gr.value.map((g) => ({ id: g.id, name: g.name })));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function optionsFor(source: PickerSource): PickerOption[] {
    if (source === 'roles') return roles.map((r) => ({ id: r.id, name: r.name }));
    if (source === 'groups') return groups;
    if (source === 'datasheets') return datasheets;
    return pipelines;
  }

  function updateScope(idx: number, patch: Partial<RoleScopeInput>) {
    setScopes((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }

  // Changing resource or scope_type invalidates the actions and the config, so
  // both are reset to something valid rather than left silently wrong.
  function changeResource(idx: number, resource: string) {
    const entry = catalog.resources[resource];
    updateScope(idx, {
      resource,
      scope_type: entry.scope_types[0],
      allowed_actions: [...entry.actions],
      scope_config: undefined,
    });
  }

  function changeScopeType(idx: number, scopeType: string) {
    updateScope(idx, { scope_type: scopeType, scope_config: undefined });
  }

  function toggleAction(idx: number, action: string) {
    const current = scopes[idx].allowed_actions ?? [];
    updateScope(idx, {
      allowed_actions: current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action],
    });
  }

  function toggleConfigId(idx: number, key: string, id: number) {
    const current = ((scopes[idx].scope_config?.[key] as number[]) ?? []);
    const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
    updateScope(idx, { scope_config: { [key]: next } });
  }

  function removeScope(idx: number) {
    setScopes((prev) => prev.filter((_, i) => i !== idx));
  }

  function addScope() {
    // Default to every action checked: a role that silently does nothing is
    // exactly the bug this editor is fixing.
    const resource = resourceNames[0];
    const entry = catalog.resources[resource];
    setScopes((prev) => [...prev, {
      resource,
      scope_type: entry.scope_types[0],
      allowed_actions: [...entry.actions],
    }]);
  }

  async function save() {
    if (!name.trim()) { setError('Role name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        task_scope: taskScope,
        ...(agentTemplateId === '' ? {} : { agent_template_id: agentTemplateId }),
        scopes,
      };
      if (isEdit) {
        await updateRole(role!.id, payload);
      } else {
        await createRole(payload);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save role');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-2xl border border-border-secondary bg-bg-primary m-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-secondary sticky top-0 bg-bg-primary z-10">
          <h2 className="text-lg font-semibold text-text-primary">
            {isEdit ? `Edit ${role!.name}` : 'New Role'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Role name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Task scope</label>
            <select
              value={taskScope}
              onChange={(e) => setTaskScope(e.target.value)}
              className="w-full rounded-lg border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary"
            >
              {catalog.task_scopes.map((ts) => (
                <option key={ts} value={ts}>{scopeLabel(ts)}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-secondary">
              {taskScope === 'all' && 'Can see all tasks in the business.'}
              {taskScope === 'own_only' && 'Can only see tasks assigned to them.'}
              {taskScope === 'by_role' && 'Can see tasks assigned to members with specific roles.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">AI agent</label>
            <select
              value={agentTemplateId}
              onChange={(e) => setAgentTemplateId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-lg border border-border-secondary bg-bg-primary px-3 py-2 text-sm text-text-primary"
            >
              <option value="">None</option>
              {catalog.agent_templates.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-secondary">
              Which agent answers this role&apos;s messages on WhatsApp.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-primary">Resource scopes</label>
              <button onClick={addScope} className="text-xs text-accent font-medium hover:underline">
                + Add scope
              </button>
            </div>

            {scopes.length === 0 && (
              <p className="text-xs text-text-secondary py-3 text-center border border-dashed border-border-secondary rounded-lg">
                No scopes — this role can access nothing.
              </p>
            )}

            <div className="space-y-3">
              {scopes.map((s, idx) => {
                const entry = catalog.resources[s.resource];
                const config = entry ? configFor(s.resource, s.scope_type) : null;
                const selectedIds = config
                  ? ((s.scope_config?.[config.key] as number[]) ?? [])
                  : [];

                return (
                  <div key={idx} className="rounded-lg border border-border-secondary p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-text-secondary uppercase">Scope {idx + 1}</span>
                      <button onClick={() => removeScope(idx)} className="text-xs text-red-500 hover:text-red-600">
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-text-secondary mb-0.5">Resource</label>
                        <select
                          value={s.resource}
                          onChange={(e) => changeResource(idx, e.target.value)}
                          className="w-full rounded border border-border-secondary bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
                        >
                          {resourceNames.map((r) => (
                            <option key={r} value={r}>{scopeLabel(r)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-0.5">Scope type</label>
                        <select
                          value={s.scope_type}
                          onChange={(e) => changeScopeType(idx, e.target.value)}
                          className="w-full rounded border border-border-secondary bg-bg-primary px-2 py-1.5 text-sm text-text-primary"
                        >
                          {(entry?.scope_types ?? [s.scope_type]).map((st) => (
                            <option key={st} value={st}>{scopeLabel(st)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {entry && (
                      <div className="mt-3">
                        <label className="block text-xs text-text-secondary mb-1">Allowed actions</label>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.actions.map((a) => {
                            const on = (s.allowed_actions ?? []).includes(a);
                            return (
                              <button
                                key={a}
                                type="button"
                                onClick={() => toggleAction(idx, a)}
                                className={`px-2 py-1 rounded text-xs border transition-colors ${
                                  on
                                    ? 'bg-accent text-white border-accent'
                                    : 'bg-bg-primary text-text-secondary border-border-secondary hover:bg-bg-secondary'
                                }`}
                              >
                                {scopeLabel(a)}
                              </button>
                            );
                          })}
                        </div>
                        {(s.allowed_actions ?? []).length === 0 && (
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                            No actions selected — this scope grants nothing.
                          </p>
                        )}
                      </div>
                    )}

                    {config && (
                      <div className="mt-3">
                        <label className="block text-xs text-text-secondary mb-1">
                          Limited to ({scopeLabel(config.source)})
                        </label>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          {optionsFor(config.source).map((o) => {
                            const on = selectedIds.includes(o.id);
                            return (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => toggleConfigId(idx, config.key, o.id)}
                                className={`px-2 py-1 rounded text-xs border transition-colors ${
                                  on
                                    ? 'bg-accent text-white border-accent'
                                    : 'bg-bg-primary text-text-secondary border-border-secondary hover:bg-bg-secondary'
                                }`}
                              >
                                {o.name}
                              </button>
                            );
                          })}
                          {optionsFor(config.source).length === 0 && (
                            <span className="text-xs text-text-secondary">Nothing to choose from yet.</span>
                          )}
                        </div>
                        {selectedIds.length === 0 && (
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                            Nothing selected — this scope grants nothing.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border-secondary sticky bottom-0 bg-bg-primary">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-bg-secondary text-text-primary hover:bg-bg-secondary/80">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create role'}
          </button>
        </div>
      </div>
    </div>
  );
}
