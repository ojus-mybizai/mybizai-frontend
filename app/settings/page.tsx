'use client';

import { useEffect, useState } from 'react';
import ProtectedShell from '@/components/protected-shell';
import {
  changePassword,
  getCustomRoles,
  getPermissionsCatalog,
  getProfileSettings,
  getBusinessInfo,
  updateBusinessInfo,
  getRoleAssignments,
  getRolesOverview,
  getWorkspaceSettings,
  type ProfileSettings,
  type RolesOverview,
  type WorkspaceSettings,
  type Permission,
  type CustomRole,
  type RoleAssignmentsResponse,
  type BusinessInfo,
  updateProfileSettings,
  updateWorkspaceSettings,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  updateRoleAssignments,
} from '@/services/settings';

type TabKey = 'profile' | 'workspace' | 'business' | 'roles' | 'notifications';

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>('profile');
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [roles, setRoles] = useState<RolesOverview | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignmentsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState<{ name: string; phone: string }>({
    name: '',
    phone: '',
  });
  const [passwordForm, setPasswordForm] = useState<{ old: string; next: string }>({
    old: '',
    next: '',
  });
  const [workspaceForm, setWorkspaceForm] = useState<{
    name: string;
    timezone: string;
    default_currency: string;
  }>({
    name: '',
    timezone: '',
    default_currency: '',
  });

  const [selectedRoleId, setSelectedRoleId] = useState<number | 'new' | null>(null);
  const [roleDraft, setRoleDraft] = useState<{
    name: string;
    description: string;
    permission_keys: string[];
  }>({
    name: '',
    description: '',
    permission_keys: [],
  });
  const [assignmentDraft, setAssignmentDraft] = useState<Record<number, number[]>>({});
  const [businessForm, setBusinessForm] = useState<{
    name: string;
    website: string;
    address: string;
    phone_number: string;
    number_of_employees: string;
    business_type: 'product' | 'service' | 'both';
    industry: string;
    sub_industry: string;
    description: string;
    target_audience: string;
  }>({
    name: '',
    website: '',
    address: '',
    phone_number: '',
    number_of_employees: '',
    business_type: 'product',
    industry: '',
    sub_industry: '',
    description: '',
    target_audience: '',
  });

  const isOwnerOrManager =
    profile?.current_role === 'owner' || profile?.current_role === 'manager';
  const isOwner = profile?.current_role === 'owner';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(null);

    Promise.all([getProfileSettings(), getWorkspaceSettings().catch(() => null)])
      .then(([p, w]) => {
        if (cancelled) return;
        setProfile(p);
        setProfileForm({
          name: p.name ?? '',
          phone: p.phone ?? '',
        });
        if (w) {
          setWorkspace(w);
          setWorkspaceForm({
            name: w.name,
            timezone: (w.timezone as string) ?? '',
            default_currency: (w.default_currency as string) ?? '',
          });
        }
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load settings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tab === 'business' && business == null && profile?.current_business_id) {
      let cancelled = false;
      setLoading(true);
      setError(null);
      setSuccess(null);
      getBusinessInfo(profile.current_business_id)
        .then((b) => {
          if (cancelled) return;
          setBusiness(b);
          setBusinessForm({
            name: b.name,
            website: b.website ?? '',
            address: b.address ?? '',
            phone_number: b.phone_number,
            number_of_employees: b.number_of_employees ?? '',
            business_type: b.business_type,
            industry: b.industry ?? '',
            sub_industry: b.sub_industry ?? '',
            description: b.description ?? '',
            target_audience: b.target_audience ?? '',
          });
        })
        .catch((e: any) => {
          if (cancelled) return;
          setError(e?.message ?? 'Failed to load business information');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }
  }, [tab, business, profile?.current_business_id]);

  useEffect(() => {
    if (tab === 'roles' && roles == null) {
      let cancelled = false;
      setLoading(true);
      setError(null);
      Promise.all([
        getRolesOverview(),
        getPermissionsCatalog().catch(() => []),
        getCustomRoles().catch(() => []),
        getRoleAssignments().catch(() => null),
      ])
        .then(([r, perms, cRoles, assign]) => {
          if (cancelled) return;
          setRoles(r);
          setPermissions(perms);
          setCustomRoles(cRoles);
          if (assign) {
            setAssignments(assign);
            const draft: Record<number, number[]> = {};
            assign.employees.forEach((e) => {
              draft[e.business_user_id] = e.assigned_roles.map((ar) => ar.id);
            });
            setAssignmentDraft(draft);
          }
        })
        .catch((e: any) => {
          if (cancelled) return;
          setError(e?.message ?? 'Failed to load roles and permissions');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }
  }, [tab, roles]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateProfileSettings({
        name: profileForm.name,
        phone: profileForm.phone,
      });
      setProfile(updated);
      setSuccess('Profile updated successfully');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.old || !passwordForm.next) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await changePassword(passwordForm.old, passwordForm.next);
      setPasswordForm({ old: '', next: '' });
      setSuccess('Password changed successfully');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkspace = async () => {
    if (!workspace) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateWorkspaceSettings({
        name: workspaceForm.name,
        timezone: workspaceForm.timezone || undefined,
        default_currency: workspaceForm.default_currency || undefined,
      });
      setWorkspace(updated);
      setSuccess('Workspace settings saved');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save workspace settings');
    } finally {
      setLoading(false);
    }
  };

  const canManageRoles = isOwnerOrManager && permissions.length > 0;

  const startNewRole = () => {
    if (!canManageRoles) return;
    setSelectedRoleId('new');
    setRoleDraft({
      name: '',
      description: '',
      permission_keys: [],
    });
  };

  const startEditRole = (role: CustomRole) => {
    if (!canManageRoles) return;
    setSelectedRoleId(role.id);
    setRoleDraft({
      name: role.name,
      description: role.description ?? '',
      permission_keys: [...role.permission_keys],
    });
  };

  const togglePermissionInDraft = (key: string) => {
    setRoleDraft((prev) => {
      const exists = prev.permission_keys.includes(key);
      return {
        ...prev,
        permission_keys: exists
          ? prev.permission_keys.filter((k) => k !== key)
          : [...prev.permission_keys, key],
      };
    });
  };

  const handleSaveRole = async () => {
    if (!canManageRoles) return;
    if (!roleDraft.name.trim()) {
      setError('Role name is required.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (selectedRoleId === 'new') {
        const created = await createCustomRole({
          name: roleDraft.name.trim(),
          description: roleDraft.description || undefined,
          permission_keys: roleDraft.permission_keys,
        });
        setCustomRoles((prev) => [...prev, created]);
        setSelectedRoleId(created.id);
        setSuccess('Role created.');
      } else if (typeof selectedRoleId === 'number') {
        const updated = await updateCustomRole(selectedRoleId, {
          name: roleDraft.name.trim(),
          description: roleDraft.description || undefined,
          permission_keys: roleDraft.permission_keys,
        });
        setCustomRoles((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r)),
        );
        setSuccess('Role updated.');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (!canManageRoles) return;
    const ok = window.confirm('Delete this role? It cannot be undone.');
    if (!ok) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteCustomRole(roleId);
      setCustomRoles((prev) => prev.filter((r) => r.id !== roleId));
      setSelectedRoleId((cur) => (cur === roleId ? null : cur));
      // Strip role from assignmentDraft and assignments state
      setAssignmentDraft((prev) => {
        const next: Record<number, number[]> = {};
        Object.entries(prev).forEach(([buId, ids]) => {
          next[Number(buId)] = ids.filter((id) => id !== roleId);
        });
        return next;
      });
      if (assignments) {
        setAssignments({
          employees: assignments.employees.map((e) => ({
            ...e,
            assigned_roles: e.assigned_roles.filter((r) => r.id !== roleId),
          })),
        });
      }
      setSuccess('Role deleted.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to delete role');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeAssignment = async (businessUserId: number, roleIds: number[]) => {
    if (!canManageRoles) return;
    setAssignmentDraft((prev) => ({ ...prev, [businessUserId]: roleIds }));
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateRoleAssignments(businessUserId, roleIds);
      if (assignments) {
        const roleMap = new Map(customRoles.map((r) => [r.id, r]));
        setAssignments({
          employees: assignments.employees.map((e) =>
            e.business_user_id === businessUserId
              ? {
                  ...e,
                  assigned_roles: roleIds
                    .map((id) => roleMap.get(id))
                    .filter(Boolean)
                    .map((r) => ({ id: r!.id, name: r!.name })),
                }
              : e,
          ),
        });
      }
      setSuccess('Role assignments updated.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update role assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBusiness = async () => {
    if (!business || !profile?.current_business_id || !isOwner) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateBusinessInfo(profile.current_business_id, {
        name: businessForm.name,
        website: businessForm.website || null,
        address: businessForm.address || null,
        phone_number: businessForm.phone_number,
        number_of_employees: businessForm.number_of_employees || null,
        business_type: businessForm.business_type,
        industry: businessForm.industry || null,
        sub_industry: businessForm.sub_industry || null,
        description: businessForm.description || null,
        target_audience: businessForm.target_audience || null,
      });
      setBusiness(updated);
      setSuccess('Business information updated.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update business information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedShell>
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">Settings</h2>
              <p className="text-base text-text-secondary">
                Manage your profile, workspace, team roles, and notification preferences.
              </p>
            </div>
          </div>

          <div className="border-b border-border-color">
            <nav className="-mb-px flex flex-wrap gap-4 text-sm">
              {[
                { key: 'profile', label: 'Profile' },
                { key: 'workspace', label: 'Workspace' },
                { key: 'business', label: 'Business' },
                { key: 'roles', label: 'Team & roles' },
                { key: 'notifications', label: 'Notifications' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTab(t.key as TabKey);
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`border-b-2 px-1 pb-2 text-sm font-medium ${
                    tab === t.key
                      ? 'border-accent text-text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              {success}
            </div>
          )}

          {tab === 'profile' && (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-border-color bg-card-bg p-5">
                <h3 className="text-base font-semibold text-text-primary">Account info</h3>
                <div className="space-y-3 text-base">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Name
                    </label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) =>
                        setProfileForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profile?.email ?? ''}
                      disabled
                      className="w-full rounded-md border border-border-color bg-bg-secondary px-3 py-2 text-base text-text-secondary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary"
                    />
                  </div>
                  <div className="text-xs text-text-secondary">
                    <div>
                      Role:{' '}
                      <span className="font-semibold">
                        {profile?.current_role ?? '—'}
                      </span>
                    </div>
                    <div>
                      Workspace:{' '}
                      <span className="font-semibold">
                        {profile?.current_business_name ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => void handleSaveProfile()}
                    disabled={loading}
                    className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-base font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {loading ? 'Saving…' : 'Save profile'}
                  </button>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-border-color bg-card-bg p-5">
                <h3 className="text-base font-semibold text-text-primary">Security</h3>
                <div className="space-y-3 text-base">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Current password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.old}
                      onChange={(e) =>
                        setPasswordForm((f) => ({ ...f, old: e.target.value }))
                      }
                      className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      New password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.next}
                      onChange={(e) =>
                        setPasswordForm((f) => ({ ...f, next: e.target.value }))
                      }
                      className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary"
                    />
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => void handleChangePassword()}
                    disabled={loading}
                    className="inline-flex items-center rounded-md border border-border-color bg-bg-primary px-4 py-2 text-base font-semibold text-text-primary hover:border-accent disabled:opacity-60"
                  >
                    {loading ? 'Working…' : 'Change password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'workspace' && (
            <div className="space-y-4 rounded-2xl border border-border-color bg-card-bg p-5">
              <h3 className="text-base font-semibold text-text-primary">Workspace settings</h3>
              {!workspace ? (
                <p className="text-base text-text-secondary">
                  Workspace settings are not available yet.
                </p>
              ) : (
                <>
                  {!isOwnerOrManager && (
                    <p className="text-xs text-text-secondary">
                      Only owners and managers can change workspace settings. You can still view
                      them here.
                    </p>
                  )}
                  <div className="mt-3 grid gap-3 md:grid-cols-2 text-base">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Workspace name
                      </label>
                      <input
                        type="text"
                        value={workspaceForm.name}
                        onChange={(e) =>
                          setWorkspaceForm((f) => ({ ...f, name: e.target.value }))
                        }
                        disabled={!isOwnerOrManager}
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Timezone
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Asia/Kolkata"
                        value={workspaceForm.timezone}
                        onChange={(e) =>
                          setWorkspaceForm((f) => ({ ...f, timezone: e.target.value }))
                        }
                        disabled={!isOwnerOrManager}
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Default currency
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. INR, USD"
                        value={workspaceForm.default_currency}
                        onChange={(e) =>
                          setWorkspaceForm((f) => ({
                            ...f,
                            default_currency: e.target.value,
                          }))
                        }
                        disabled={!isOwnerOrManager}
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                      />
                    </div>
                    <div className="text-xs text-text-secondary">
                      <div>
                        LMS module:{' '}
                        <span className="font-semibold">
                          {workspace.lms_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div>
                        Agents module:{' '}
                        <span className="font-semibold">
                          {workspace.agents_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isOwnerOrManager && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => void handleSaveWorkspace()}
                        disabled={loading}
                        className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-base font-semibold text-white hover:opacity-90 disabled:opacity-60"
                      >
                        {loading ? 'Saving…' : 'Save workspace'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'business' && (
            <div className="space-y-4 rounded-2xl border border-border-color bg-card-bg p-5">
              <h3 className="text-base font-semibold text-text-primary">Business information</h3>
              {!business ? (
                <p className="text-base text-text-secondary">
                  {loading ? 'Loading business…' : 'Business information is not available.'}
                </p>
              ) : (
                <>
                  {!isOwner && (
                    <p className="text-xs text-text-secondary">
                      Only the business owner can edit business details. You can still view them
                      here.
                    </p>
                  )}
                  <div className="mt-3 grid gap-3 md:grid-cols-2 text-base">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Business name
                      </label>
                      <input
                        type="text"
                        value={businessForm.name}
                        onChange={(e) =>
                          setBusinessForm((f) => ({ ...f, name: e.target.value }))
                        }
                        disabled={!isOwner}
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Website
                      </label>
                      <input
                        type="text"
                        value={businessForm.website}
                        onChange={(e) =>
                          setBusinessForm((f) => ({ ...f, website: e.target.value }))
                        }
                        disabled={!isOwner}
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Phone number
                      </label>
                      <input
                        type="tel"
                        value={businessForm.phone_number}
                        onChange={(e) =>
                          setBusinessForm((f) => ({ ...f, phone_number: e.target.value }))
                        }
                        disabled={!isOwner}
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Number of employees
                      </label>
                      <input
                        type="text"
                        placeholder='e.g. "1-5", "6-10"'
                        value={businessForm.number_of_employees}
                        onChange={(e) =>
                          setBusinessForm((f) => ({
                            ...f,
                            number_of_employees: e.target.value,
                          }))
                        }
                        disabled={!isOwner}
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Business type
                      </label>
                      <select
                        value={businessForm.business_type}
                        onChange={(e) =>
                          setBusinessForm((f) => ({
                            ...f,
                            business_type: e.target.value as 'product' | 'service' | 'both',
                          }))
                        }
                        disabled={!isOwner}
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                      >
                        <option value="product">Product</option>
                        <option value="service">Service</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Industry
                      </label>
                      <input
                        type="text"
                        value={businessForm.industry}
                        onChange={(e) =>
                          setBusinessForm((f) => ({ ...f, industry: e.target.value }))
                        }
                        disabled={!isOwner}
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Sub-industry
                      </label>
                      <input
                        type="text"
                        value={businessForm.sub_industry}
                        onChange={(e) =>
                          setBusinessForm((f) => ({ ...f, sub_industry: e.target.value }))
                        }
                        disabled={!isOwner}
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 text-base">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Address
                      </label>
                      <textarea
                        rows={3}
                        value={businessForm.address}
                        onChange={(e) =>
                          setBusinessForm((f) => ({ ...f, address: e.target.value }))
                        }
                        disabled={!isOwner}
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Description
                      </label>
                      <textarea
                        rows={3}
                        value={businessForm.description}
                        onChange={(e) =>
                          setBusinessForm((f) => ({ ...f, description: e.target.value }))
                        }
                        disabled={!isOwner}
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Target audience
                    </label>
                    <textarea
                      rows={2}
                      value={businessForm.target_audience}
                      onChange={(e) =>
                        setBusinessForm((f) => ({ ...f, target_audience: e.target.value }))
                      }
                      disabled={!isOwner}
                      className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                    />
                  </div>
                  {isOwner && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => void handleSaveBusiness()}
                        disabled={loading}
                        className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-base font-semibold text-white hover:opacity-90 disabled:opacity-60"
                      >
                        {loading ? 'Saving…' : 'Save business'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'roles' && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {roles?.roles.map((role) => (
                  <div
                    key={role.key}
                    className="rounded-2xl border border-border-color bg-card-bg p-5 text-base"
                  >
                    <div className="mb-1 text-xs font-semibold uppercase text-text-secondary">
                      {role.key}
                    </div>
                    <div className="mb-1 text-sm font-semibold text-text-primary">
                      {role.name}
                    </div>
                    <p className="text-xs text-text-secondary">{role.description}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {/* Team members (base roles) */}
                <div className="space-y-4 lg:col-span-2">
                  <div className="rounded-2xl border border-border-color bg-card-bg p-5">
                    <h3 className="mb-2 text-base font-semibold text-text-primary">
                      Team members
                    </h3>
                    {!roles ? (
                      <p className="text-base text-text-secondary">
                        {loading ? 'Loading team…' : 'No team members yet.'}
                      </p>
                    ) : (
                      <div className="overflow-x-auto text-base">
                        <table className="min-w-full divide-y divide-border-color">
                          <thead className="bg-bg-secondary text-xs uppercase text-text-secondary">
                            <tr>
                              <th className="px-3 py-2 text-left">Name</th>
                              <th className="px-3 py-2 text-left">Email</th>
                              <th className="px-3 py-2 text-left">Base role</th>
                              <th className="px-3 py-2 text-left">Leads</th>
                              <th className="px-3 py-2 text-left">Work</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-color">
                            {roles.members.map((m) => (
                              <tr key={m.id}>
                                <td className="px-3 py-2 text-text-primary">
                                  {m.name ?? '—'}
                                  {m.role === 'owner' && (
                                    <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                                      Owner
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-text-secondary">{m.email ?? '—'}</td>
                                <td className="px-3 py-2 text-text-secondary">{m.role}</td>
                                <td className="px-3 py-2 text-text-secondary">
                                  {m.assigned_lead_count}
                                </td>
                                <td className="px-3 py-2 text-text-secondary">
                                  {m.assigned_work_count}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-text-secondary">
                      To change base roles or deactivate employees, use the Employees page. Custom
                      roles below refine what managers and executives can do.
                    </p>
                  </div>
                </div>

                {/* Custom roles & assignments */}
                <div className="space-y-4">
                  {/* Custom roles manager */}
                  <div className="rounded-2xl border border-border-color bg-card-bg p-5 text-sm">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-text-primary">
                        Custom roles (per workspace)
                      </h3>
                      {canManageRoles && (
                        <button
                          type="button"
                          onClick={startNewRole}
                          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                        >
                          New role
                        </button>
                      )}
                    </div>
                    {!permissions.length ? (
                      <p className="text-sm text-text-secondary">
                        No permissions catalog loaded yet. Create roles once permissions are
                        available.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-text-secondary">
                          Owners always have full access. Create roles that bundle permissions for
                          managers and executives.
                        </p>
                        {customRoles.length === 0 && (
                          <p className="text-xs text-text-secondary">
                            No custom roles yet. Click &quot;New role&quot; to create one.
                          </p>
                        )}
                        <ul className="space-y-1 text-xs text-text-secondary max-h-40 overflow-y-auto">
                          {customRoles.map((r) => {
                            const assignedCount =
                              assignments?.employees.filter((e) =>
                                e.assigned_roles.some((ar) => ar.id === r.id),
                              ).length ?? 0;
                            const isSelected = selectedRoleId === r.id;
                            return (
                              <li
                                key={r.id}
                                className={`flex items-center justify-between rounded-md px-2 py-1 ${
                                  isSelected ? 'bg-bg-secondary' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => startEditRole(r)}
                                  className="flex flex-1 flex-col items-start text-left"
                                >
                                  <span className="text-text-primary font-semibold">
                                    {r.name}
                                  </span>
                                  {r.description && (
                                    <span className="text-[11px] text-text-secondary line-clamp-1">
                                      {r.description}
                                    </span>
                                  )}
                                  <span className="text-[11px] text-text-secondary/80">
                                    {assignedCount} member
                                    {assignedCount === 1 ? '' : 's'}
                                  </span>
                                </button>
                                {canManageRoles && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRole(r.id)}
                                    disabled={assignedCount > 0}
                                    title={
                                      assignedCount > 0
                                        ? 'Cannot delete a role with assigned members'
                                        : 'Delete role'
                                    }
                                    className="ml-2 text-[11px] text-red-500 disabled:opacity-40"
                                  >
                                    Delete
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Role editor */}
                  <div className="rounded-2xl border border-border-color bg-card-bg p-5 text-sm">
                    <h3 className="mb-2 text-base font-semibold text-text-primary">
                      Role editor
                    </h3>
                    {!canManageRoles ? (
                      <p className="text-xs text-text-secondary">
                        You don&apos;t have permission to change roles. Contact the workspace owner.
                      </p>
                    ) : !permissions.length ? (
                      <p className="text-xs text-text-secondary">
                        Permissions are not available yet. Try reloading the page.
                      </p>
                    ) : selectedRoleId === null ? (
                      <p className="text-xs text-text-secondary">
                        Select a role from the list above or create a new role to edit its
                        permissions.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-secondary">
                            Role name
                          </label>
                          <input
                            type="text"
                            value={roleDraft.name}
                            onChange={(e) =>
                              setRoleDraft((prev) => ({ ...prev, name: e.target.value }))
                            }
                            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-secondary">
                            Description
                          </label>
                          <textarea
                            value={roleDraft.description}
                            onChange={(e) =>
                              setRoleDraft((prev) => ({
                                ...prev,
                                description: e.target.value,
                              }))
                            }
                            rows={3}
                            className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-text-secondary">
                              Permissions
                            </span>
                            <div className="space-x-2 text-[11px]">
                              <button
                                type="button"
                                className="text-accent hover:underline"
                                onClick={() =>
                                  setRoleDraft((prev) => ({
                                    ...prev,
                                    permission_keys: permissions.map((p) => p.key),
                                  }))
                                }
                              >
                                Select all
                              </button>
                              <button
                                type="button"
                                className="text-text-secondary hover:underline"
                                onClick={() =>
                                  setRoleDraft((prev) => ({ ...prev, permission_keys: [] }))
                                }
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                          <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border-color bg-bg-secondary p-2">
                            {permissions.map((p) => {
                              const checked = roleDraft.permission_keys.includes(p.key);
                              return (
                                <label
                                  key={p.id}
                                  className="flex items-start gap-2 text-xs text-text-secondary"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-3 w-3 rounded border-border-color"
                                    checked={checked}
                                    onChange={() => togglePermissionInDraft(p.key)}
                                  />
                                  <span>
                                    <span className="block font-semibold text-text-primary">
                                      {p.label}
                                    </span>
                                    {p.description && (
                                      <span className="text-[11px] text-text-secondary">
                                        {p.description}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => void handleSaveRole()}
                            disabled={loading}
                            className="inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                          >
                            {loading ? 'Saving…' : 'Save role'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRoleId(null);
                              setRoleDraft({
                                name: '',
                                description: '',
                                permission_keys: [],
                              });
                            }}
                            className="inline-flex items-center rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-xs font-semibold text-text-primary hover:border-accent"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Role assignments */}
                  <div className="rounded-2xl border border-border-color bg-card-bg p-5 text-sm">
                    <h3 className="mb-2 text-base font-semibold text-text-primary">
                      Custom role assignments
                    </h3>
                    {!assignments || customRoles.length === 0 ? (
                      <p className="text-sm text-text-secondary">
                        {customRoles.length === 0
                          ? 'Create a role above to start assigning permissions.'
                          : loading
                            ? 'Loading assignments…'
                            : 'No custom role assignments yet.'}
                      </p>
                    ) : (
                      <div className="space-y-3 text-xs text-text-secondary">
                        {assignments.employees.map((e) => {
                          const selectedIds =
                            assignmentDraft[e.business_user_id] ??
                            e.assigned_roles.map((ar) => ar.id);
                          const isOwnerRow = e.base_role === 'owner';
                          return (
                            <div
                              key={e.business_user_id}
                              className="rounded-md bg-bg-secondary px-3 py-2"
                            >
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="font-semibold text-text-primary">
                                  {e.name ?? e.email ?? 'Member'}
                                </span>
                                <span className="text-[11px] text-text-secondary">
                                  {e.base_role}
                                </span>
                              </div>
                              {isOwnerRow ? (
                                <p className="text-[11px] text-text-secondary">
                                  Owner has full access and does not use custom roles.
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {customRoles.map((r) => {
                                    const checked = selectedIds.includes(r.id);
                                    return (
                                      <label
                                        key={r.id}
                                        className="inline-flex items-center gap-1 rounded-full bg-bg-primary px-2 py-1"
                                      >
                                        <input
                                          type="checkbox"
                                          className="h-3 w-3 rounded border-border-color"
                                          checked={checked}
                                          disabled={!canManageRoles}
                                          onChange={(ev) => {
                                            const nextIds = ev.target.checked
                                              ? Array.from(
                                                  new Set([...selectedIds, r.id]),
                                                )
                                              : selectedIds.filter((id) => id !== r.id);
                                            void handleChangeAssignment(
                                              e.business_user_id,
                                              nextIds,
                                            );
                                          }}
                                        />
                                        <span className="text-[11px] text-text-primary">
                                          {r.name}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-4 rounded-2xl border border-border-color bg-card-bg p-5">
              <h3 className="text-base font-semibold text-text-primary">
                Notification preferences
              </h3>
              <p className="text-xs text-text-secondary">
                These preferences are currently stored on this device only. In a future update they
                will sync with your account.
              </p>
              <div className="mt-3 space-y-3 text-base">
                <label className="flex items-center justify-between gap-4">
                  <span className="text-text-primary">Daily summary email</span>
                  <input type="checkbox" className="h-4 w-4 rounded border-border-color" />
                </label>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-text-primary">Alert me when a new lead is created</span>
                  <input type="checkbox" className="h-4 w-4 rounded border-border-color" />
                </label>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-text-primary">Alert me when work is assigned to me</span>
                  <input type="checkbox" className="h-4 w-4 rounded border-border-color" />
                </label>
              </div>
            </div>
          )}
        </div>
    </ProtectedShell>
  );
}

