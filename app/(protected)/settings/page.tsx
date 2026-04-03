'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/permission-guard';
import { useAuthStore } from '@/lib/auth-store';
import {
  User, Building2, Users, Bell, Settings2,
  Lock, Mail, Phone, Globe, Clock, DollarSign, Shield,
  Save, AlertCircle, CheckCircle2, Eye, EyeOff,
  Briefcase, MapPin, Target, Hash, Smartphone, Monitor,
  AlertTriangle, Trash2,
} from 'lucide-react';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/services/notifications';
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
  deleteBusiness,
  deleteAccount,
} from '@/services/settings';

type TabKey =
  | 'profile'
  | 'workspace'
  | 'business'
  | 'roles'
  | 'notifications'
  | 'danger_zone';

export default function SettingsPage() {
  const router = useRouter();
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

  // Danger Zone state
  const [showDeleteBusinessModal, setShowDeleteBusinessModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteBusinessConfirm, setDeleteBusinessConfirm] = useState('');
  const [deleteBusinessPassword, setDeleteBusinessPassword] = useState('');
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('');
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    lead_assignment_lock_days: number;
  }>({
    name: '',
    timezone: '',
    default_currency: '',
    lead_assignment_lock_days: 30,
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

  const isOwner = useAuthStore((s) => s.isOwner);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const logout = useAuthStore((s) => s.logout);
  const canManageRoles = hasPermission('manage_settings') && permissions.length > 0;
  const isOwnerOrManager = isOwner || canManageRoles;

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
            lead_assignment_lock_days: w.lead_assignment_lock_days ?? 30,
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
        lead_assignment_lock_days: workspaceForm.lead_assignment_lock_days,
      });
      setWorkspace(updated);
      setSuccess('Workspace settings saved');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save workspace settings');
    } finally {
      setLoading(false);
    }
  };

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
    <PermissionGuard permission="manage_settings">
    <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                <Settings2 className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-text-primary">Settings</h2>
                <p className="text-sm text-text-secondary">
                  Manage your profile, workspace, and team preferences
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-border-color">
            <nav className="-mb-px flex flex-wrap gap-1 text-sm">
              {([
                { key: 'profile', label: 'Profile', icon: User },
                { key: 'workspace', label: 'Workspace', icon: Settings2 },
                { key: 'business', label: 'Business', icon: Building2 },
                { key: 'roles', label: 'Team & Roles', icon: Users },
                { key: 'notifications', label: 'Notifications', icon: Bell },
                { key: 'danger_zone', label: 'Danger Zone', icon: AlertTriangle },
              ] as const).map((t) => {
                const Icon = t.icon;
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setTab(t.key as TabKey);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-accent text-accent'
                        : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-color'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {success}
            </div>
          )}

          {tab === 'profile' && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Account Info Card */}
              <div className="space-y-5 rounded-2xl border border-border-color bg-card-bg p-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                    <User className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">Account Info</h3>
                    <p className="text-xs text-text-secondary">Your personal details</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">Full Name</label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Your name"
                        className="w-full rounded-lg border border-border-color bg-bg-primary py-2.5 pl-10 pr-3 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">Email Address</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                      <input
                        type="email"
                        value={profile?.email ?? ''}
                        disabled
                        className="w-full rounded-lg border border-border-color bg-bg-secondary py-2.5 pl-10 pr-3 text-sm text-text-secondary cursor-not-allowed"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-text-muted">Email cannot be changed</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">Phone Number</label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="+91 XXXXX XXXXX"
                        className="w-full rounded-lg border border-border-color bg-bg-primary py-2.5 pl-10 pr-3 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                      />
                    </div>
                  </div>

                  {/* Role & Workspace info badges */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1">
                      <Shield className="h-3 w-3 text-accent" />
                      <span className="text-xs font-medium text-accent">{profile?.current_role ?? 'No role'}</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-bg-secondary px-3 py-1">
                      <Building2 className="h-3 w-3 text-text-secondary" />
                      <span className="text-xs font-medium text-text-secondary">{profile?.current_business_name ?? '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border-color pt-4">
                  <button
                    type="button"
                    onClick={() => void handleSaveProfile()}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {loading ? 'Saving…' : 'Save Profile'}
                  </button>
                </div>
              </div>

              {/* Security Card */}
              <div className="space-y-5 rounded-2xl border border-border-color bg-card-bg p-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                    <Lock className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">Security</h3>
                    <p className="text-xs text-text-secondary">Update your password</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">Current Password</label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                      <input
                        type="password"
                        value={passwordForm.old}
                        onChange={(e) => setPasswordForm((f) => ({ ...f, old: e.target.value }))}
                        placeholder="Enter current password"
                        className="w-full rounded-lg border border-border-color bg-bg-primary py-2.5 pl-10 pr-3 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">New Password</label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                      <input
                        type="password"
                        value={passwordForm.next}
                        onChange={(e) => setPasswordForm((f) => ({ ...f, next: e.target.value }))}
                        placeholder="Enter new password"
                        className="w-full rounded-lg border border-border-color bg-bg-primary py-2.5 pl-10 pr-3 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-text-muted">Minimum 8 characters recommended</p>
                  </div>
                </div>

                <div className="border-t border-border-color pt-4">
                  <button
                    type="button"
                    onClick={() => void handleChangePassword()}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg border border-border-color bg-bg-primary px-5 py-2.5 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent disabled:opacity-60"
                  >
                    <Lock className="h-4 w-4" />
                    {loading ? 'Working…' : 'Change Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'workspace' && (
            <div className="space-y-5 rounded-2xl border border-border-color bg-card-bg p-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <Settings2 className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text-primary">Workspace Settings</h3>
                  <p className="text-xs text-text-secondary">Configure your workspace preferences</p>
                </div>
              </div>
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
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">
                        Lead Assignment Lock (days)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={workspaceForm.lead_assignment_lock_days}
                        onChange={(e) =>
                          setWorkspaceForm((f) => ({
                            ...f,
                            lead_assignment_lock_days: Number(e.target.value) || 0,
                          }))
                        }
                        disabled={!isOwnerOrManager}
                        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-base text-text-primary disabled:bg-bg-secondary disabled:text-text-secondary"
                      />
                      <p className="mt-1 text-xs text-text-muted">
                        Once assigned, a lead cannot be reassigned for this many days. Set to 0 to disable.
                      </p>
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
            <div className="space-y-5 rounded-2xl border border-border-color bg-card-bg p-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                  <Building2 className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text-primary">Business Information</h3>
                  <p className="text-xs text-text-secondary">Your company details and profile</p>
                </div>
              </div>
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
            <div className="space-y-5">
              {/* Section header */}
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                  <Users className="h-4 w-4 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text-primary">Team & Roles</h3>
                  <p className="text-xs text-text-secondary">Manage team members, roles, and permissions</p>
                </div>
              </div>

              {/* Base roles */}
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

          {tab === 'notifications' && <NotificationPreferencesTab />}


          {tab === 'danger_zone' && (
            <div className="space-y-6">
              {/* Delete Business Section — owner only */}
              {isOwner && (
                <div className="rounded-2xl border border-red-200 bg-red-50/60 p-6 dark:border-red-800 dark:bg-red-950/20">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                      <Building2 className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-red-900 dark:text-red-200">Delete Business</h3>
                      <p className="text-xs text-red-700 dark:text-red-400">
                        Permanently delete your business and all associated data
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-red-800 dark:text-red-300">
                    This will permanently delete your business
                    {workspace?.name ? <strong> &ldquo;{workspace.name}&rdquo;</strong> : ''} and all associated data
                    including leads, conversations, AI agents, channel integrations,
                    catalog items, orders, contacts, scheduled follow-ups, and team access.
                    <strong> This action cannot be undone.</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteBusinessConfirm('');
                      setDeleteBusinessPassword('');
                      setDeleteError(null);
                      setShowDeleteBusinessModal(true);
                    }}
                    className="mt-4 rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:border-red-700"
                  >
                    <span className="flex items-center gap-1.5">
                      <Trash2 className="h-4 w-4" />
                      Delete Business
                    </span>
                  </button>
                </div>
              )}

              {/* Delete Account Section — all users */}
              <div className="rounded-2xl border border-red-200 bg-red-50/60 p-6 dark:border-red-800 dark:bg-red-950/20">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                    <User className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-red-900 dark:text-red-200">Delete Account</h3>
                    <p className="text-xs text-red-700 dark:text-red-400">
                      Permanently delete your user account
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-red-800 dark:text-red-300">
                  This will permanently delete your user account and all personal data.
                  {isOwner
                    ? ' Since you are the business owner, your business and all its data will also be deleted.'
                    : ' You will lose access to any businesses you are a member of.'}
                  <strong> This action cannot be undone.</strong>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteAccountConfirm('');
                    setDeleteAccountPassword('');
                    setDeleteError(null);
                    setShowDeleteAccountModal(true);
                  }}
                  className="mt-4 rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:border-red-700"
                >
                  <span className="flex items-center gap-1.5">
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Delete Business Modal */}
          {showDeleteBusinessModal && (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
              onClick={() => !deleting && setShowDeleteBusinessModal(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-border-color bg-card-bg p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <h2 className="text-base font-semibold text-text-primary">Delete Business</h2>
                </div>
                <p className="mt-2 text-sm text-text-secondary">
                  This will permanently delete <strong className="text-text-primary">{workspace?.name || 'your business'}</strong> and
                  all associated data. This action cannot be undone.
                </p>

                {deleteError && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {deleteError}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Type <strong className="text-text-primary">{workspace?.name || 'business name'}</strong> to confirm
                    </label>
                    <input
                      type="text"
                      value={deleteBusinessConfirm}
                      onChange={(e) => setDeleteBusinessConfirm(e.target.value)}
                      placeholder={workspace?.name || 'business name'}
                      className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      autoComplete="off"
                      disabled={deleting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Enter your password
                    </label>
                    <input
                      type="password"
                      value={deleteBusinessPassword}
                      onChange={(e) => setDeleteBusinessPassword(e.target.value)}
                      placeholder="Your password"
                      className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      autoComplete="current-password"
                      disabled={deleting}
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteBusinessModal(false)}
                    disabled={deleting}
                    className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-secondary disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      deleting ||
                      !deleteBusinessPassword ||
                      deleteBusinessConfirm.trim().toLowerCase() !== (workspace?.name || '').toLowerCase()
                    }
                    onClick={async () => {
                      if (!profile?.current_business_id) return;
                      setDeleting(true);
                      setDeleteError(null);
                      try {
                        await deleteBusiness(profile.current_business_id, deleteBusinessPassword);
                        logout();
                        router.push('/login');
                      } catch (e: any) {
                        setDeleteError(e?.data?.detail || e?.message || 'Failed to delete business');
                        setDeleting(false);
                      }
                    }}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete Business'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Account Modal */}
          {showDeleteAccountModal && (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
              onClick={() => !deleting && setShowDeleteAccountModal(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-border-color bg-card-bg p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <h2 className="text-base font-semibold text-text-primary">Delete Account</h2>
                </div>
                <p className="mt-2 text-sm text-text-secondary">
                  This will permanently delete your account
                  {isOwner ? (
                    <> and your business <strong className="text-text-primary">{workspace?.name || ''}</strong> with all its data</>
                  ) : null}.
                  This action cannot be undone.
                </p>

                {deleteError && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {deleteError}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Type <strong className="text-text-primary">delete</strong> to confirm
                    </label>
                    <input
                      type="text"
                      value={deleteAccountConfirm}
                      onChange={(e) => setDeleteAccountConfirm(e.target.value)}
                      placeholder="delete"
                      className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      autoComplete="off"
                      disabled={deleting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">
                      Enter your password
                    </label>
                    <input
                      type="password"
                      value={deleteAccountPassword}
                      onChange={(e) => setDeleteAccountPassword(e.target.value)}
                      placeholder="Your password"
                      className="mt-1 block w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      autoComplete="current-password"
                      disabled={deleting}
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteAccountModal(false)}
                    disabled={deleting}
                    className="rounded-lg border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-secondary disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      deleting ||
                      !deleteAccountPassword ||
                      deleteAccountConfirm.trim().toLowerCase() !== 'delete'
                    }
                    onClick={async () => {
                      setDeleting(true);
                      setDeleteError(null);
                      try {
                        await deleteAccount(deleteAccountPassword);
                        logout();
                        router.push('/login');
                      } catch (e: any) {
                        setDeleteError(e?.data?.detail || e?.message || 'Failed to delete account');
                        setDeleting(false);
                      }
                    }}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete Account'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
    </PermissionGuard>
  );
}


const EVENT_TYPE_CONFIG: Record<string, { label: string; desc: string }> = {
  lead_assigned: { label: 'Lead Assigned', desc: 'When a lead is assigned to you' },
  lead_stage_changed: { label: 'Lead Stage Changed', desc: 'When your assigned lead stage changes' },
  work_assigned: { label: 'Work Assigned', desc: 'When new work is assigned to you' },
  work_completed: { label: 'Work Completed', desc: 'When work you created is completed' },
  work_overdue: { label: 'Work Overdue', desc: 'Reminder when work passes its due date' },
  new_conversation_message: { label: 'New Message', desc: 'When a lead sends a new message' },
};

function NotificationPreferencesTab() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    getNotificationPreferences()
      .then((data) => setPrefs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (eventType: string, channel: 'in_app' | 'email' | 'push') => {
    if (!prefs) return;
    const updated = { ...prefs };
    if (!updated[eventType]) updated[eventType] = { in_app: true, email: false, push: true };
    updated[eventType] = { ...updated[eventType], [channel]: !updated[eventType][channel] };
    setPrefs(updated);
    setSaving(true);
    setSaveMsg('');
    try {
      const result = await updateNotificationPreferences(updated);
      setPrefs(result);
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch {
      setSaveMsg('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border-color bg-card-bg p-6">
        <p className="text-sm text-text-secondary">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border-color bg-card-bg p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
            <Bell className="h-4 w-4 text-purple-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Notification Preferences</h3>
            <p className="text-xs text-text-secondary">Choose how you want to be notified for each event</p>
          </div>
        </div>
        {saveMsg && (
          <span className={`text-xs font-medium ${saveMsg === 'Saved' ? 'text-emerald-500' : 'text-red-500'}`}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* Channel headers */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-color">
              <th className="pb-3 pr-4 text-left text-xs font-medium text-text-secondary">Event</th>
              <th className="pb-3 px-4 text-center text-xs font-medium text-text-secondary">
                <div className="flex flex-col items-center gap-0.5">
                  <Monitor className="h-3.5 w-3.5" />
                  <span>In-App</span>
                </div>
              </th>
              <th className="pb-3 px-4 text-center text-xs font-medium text-text-secondary">
                <div className="flex flex-col items-center gap-0.5">
                  <Mail className="h-3.5 w-3.5" />
                  <span>Email</span>
                </div>
              </th>
              <th className="pb-3 pl-4 text-center text-xs font-medium text-text-secondary">
                <div className="flex flex-col items-center gap-0.5">
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Push</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color">
            {Object.entries(EVENT_TYPE_CONFIG).map(([key, { label, desc }]) => {
              const ep = prefs?.[key] ?? { in_app: true, email: false, push: true };
              return (
                <tr key={key}>
                  <td className="py-3.5 pr-4">
                    <span className="font-medium text-text-primary">{label}</span>
                    <p className="text-xs text-text-muted">{desc}</p>
                  </td>
                  {(['in_app', 'email', 'push'] as const).map((ch) => {
                    const isOn = ep[ch];
                    return (
                      <td key={ch} className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isOn}
                          disabled={saving}
                          onClick={() => void handleToggle(key, ch)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2 focus:ring-offset-card-bg disabled:opacity-50 ${
                            isOn ? 'bg-accent' : 'bg-bg-secondary'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
                              isOn ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
