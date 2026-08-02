'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';
import ModuleGuard from '@/components/module-guard';
import { useAuthStore } from '@/lib/auth-store';
import SystemComposer from '@/components/system-builder/SystemComposer';
import { getSystem, deleteSystem, type SystemDetail, type SystemComponent } from '@/services/system-builder';

const STEP_TITLE: Record<string, string> = {
  contacts: '👥 Contacts',
  datasheets: '📇 Datasheets',
  process: '🧭 Pipeline',
  dashboard: '📊 Dashboard',
  agent: '🤖 WhatsApp Agent',
};

/** Deep-link for a component, when we know a stable route for its type. */
function hrefFor(c: SystemComponent): string | null {
  switch (c.type) {
    case 'datasheet_model':
      return `/data-sheet/${c.component_id}`;
    case 'agent':
      return `/agents/${c.component_id}`;
    case 'dashboard_layout':
      return `/dashboard?layout=${c.component_id}`;
    case 'dashboard_widget':
      return '/dashboard';
    default:
      return null;
  }
}

export default function SystemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const canManage = useAuthStore((s) => s.hasPermission('manage_settings'));
  const [sys, setSys] = useState<SystemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const reload = () => {
    getSystem(Number(id))
      .then(setSys)
      .catch((e) => setError((e as Error).message || 'Could not load system.'));
  };
  useEffect(reload, [id]);

  const datasheetCount = (sys?.components ?? []).filter((c) => c.type === 'datasheet_model').length;

  const grouped: Record<string, SystemComponent[]> = {};
  for (const c of sys?.components ?? []) {
    const step = c.step || 'other';
    (grouped[step] ??= []).push(c);
  }
  const outcomes = (sys?.outcomes ?? []).filter((o) => o && o.trim());

  return (
    <ModuleGuard module="lms">
      <div className="flex flex-col gap-5">
        <Link
          href="/systems"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to systems
        </Link>

        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        {!sys && !error && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {sys && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-text-primary">{sys.name}</h1>
                {sys.goal && <p className="mt-1 text-sm text-text-secondary">{sys.goal}</p>}
                <div className="mt-2 flex items-center gap-2 text-[12px]">
                  <span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent">{sys.kind}</span>
                  <span className="rounded-full bg-card-bg px-2 py-0.5 font-semibold text-text-secondary">{sys.status}</span>
                  <span className="text-text-secondary">{sys.components.length} components</span>
                </div>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-danger/40 bg-danger-soft px-3 py-1.5 text-[13px] font-medium text-danger hover:bg-danger/10"
                >
                  <Trash2 className="h-4 w-4" /> Delete system
                </button>
              )}
            </div>

            {/* Outcomes */}
            {outcomes.length > 0 && (
              <div className="rounded-2xl border border-border-color bg-card-bg p-4">
                <h2 className="text-sm font-semibold text-text-primary">✨ What you'll be able to do</h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] text-text-secondary">
                  {outcomes.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Manual composition editor (managers only) */}
            {canManage && (
              <SystemComposer
                systemId={sys.id}
                initialComponents={sys.components}
                onChanged={reload}
              />
            )}

            {/* Components by step */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Object.entries(grouped).map(([step, comps]) => (
                <div key={step} className="rounded-2xl border border-border-color bg-card-bg p-4">
                  <h3 className="text-sm font-semibold text-text-primary">{STEP_TITLE[step] ?? step}</h3>
                  <ul className="mt-2 space-y-1.5">
                    {comps.map((c) => {
                      const href = hrefFor(c);
                      return (
                        <li key={c.id} className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="min-w-0 truncate text-text-secondary">
                            <span className="text-text-primary">{c.ref_key || c.type}</span>
                            <span className="ml-1.5 text-[11px] text-text-secondary">({c.type})</span>
                          </span>
                          {href && (
                            <Link
                              href={href}
                              className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-accent hover:underline"
                            >
                              Open <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}

        {confirmOpen && sys && (
          <DeleteSystemModal
            system={sys}
            datasheetCount={datasheetCount}
            onClose={() => setConfirmOpen(false)}
            onDeleted={() => router.push('/systems')}
          />
        )}
      </div>
    </ModuleGuard>
  );
}

function DeleteSystemModal({
  system,
  datasheetCount,
  onClose,
  onDeleted,
}: {
  system: SystemDetail;
  datasheetCount: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const armed = confirmText.trim().toLowerCase() === 'delete';

  async function handleDelete() {
    if (!armed || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteSystem(system.id);
      onDeleted();
    } catch (e) {
      setErr((e as Error).message || 'Could not delete the system.');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border-color bg-bg-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary">Delete “{system.name}”?</h2>
            <p className="mt-1 text-[13px] text-text-secondary">
              This permanently removes the whole system configuration and cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border-color bg-card-bg p-3 text-[13px] text-text-secondary">
          <p className="font-medium text-text-primary">What gets deleted</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            <li>Its pipeline, dashboard and WhatsApp agent</li>
            <li>Its contact groups &amp; tags (definitions only)</li>
            {datasheetCount > 0 && (
              <li className="text-danger">
                {datasheetCount} datasheet{datasheetCount > 1 ? 's' : ''} — including all rows/records inside{' '}
                {datasheetCount > 1 ? 'them' : 'it'}
              </li>
            )}
          </ul>
          <p className="mt-2 font-medium text-text-primary">What stays</p>
          <p className="mt-1">
            Your contacts are kept — only the group and tag labels are removed from them.
          </p>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger">
            {err}
          </div>
        )}

        <label className="mt-4 block text-[13px] text-text-secondary">
          Type <span className="font-semibold text-text-primary">delete</span> to confirm
          <input
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
            className="mt-1.5 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            placeholder="delete"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-border-color px-3 py-1.5 text-[13px] font-medium text-text-secondary hover:bg-card-bg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!armed || busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-danger/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete system
          </button>
        </div>
      </div>
    </div>
  );
}
