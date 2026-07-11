'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Home, GraduationCap, HeartPulse, ShoppingBag, Wrench,
  ChevronRight, Check, Loader2, Database, ClipboardList, Users, Sparkles,
  ArrowLeft, LayoutGrid,
} from 'lucide-react';
import {
  listBlueprints,
  previewBlueprint,
  applyBlueprint,
  type BlueprintListItem,
  type BlueprintPreview,
} from '@/services/blueprints';

const INDUSTRY_ICONS: Record<string, typeof Building2> = {
  real_estate: Home,
  education: GraduationCap,
  healthcare: HeartPulse,
  retail: ShoppingBag,
  services: Wrench,
};

type Step = 'select' | 'preview' | 'applying' | 'done';

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('select');
  const [blueprints, setBlueprints] = useState<BlueprintListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<BlueprintPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ datasheets: number; templates: number } | null>(null);

  useEffect(() => {
    listBlueprints()
      .then(setBlueprints)
      .catch(() => setError('Failed to load blueprints'))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (key: string) => {
    setSelected(key);
    setPreviewLoading(true);
    setError(null);
    try {
      const p = await previewBlueprint(key);
      setPreview(p);
      setStep('preview');
    } catch {
      setError('Failed to load blueprint details');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApply = async () => {
    if (!selected) return;
    setStep('applying');
    setError(null);
    try {
      const res = await applyBlueprint(selected);
      setResult({ datasheets: res.datasheets_created, templates: res.work_templates_created });
      setStep('done');
      // Reload page after 2s to pick up new navigation config in sidebar
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply blueprint');
      setStep('preview');
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
          <Sparkles className="h-7 w-7 text-accent" />
        </div>
        <h1 className="text-3xl font-bold text-text-primary">Set Up Your Business System</h1>
        <p className="mt-2 text-text-secondary">
          Choose your industry and we&apos;ll create everything you need — datasheets, workflows, and navigation — ready to use.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[
          { key: 'select', label: 'Choose Industry' },
          { key: 'preview', label: 'Preview' },
          { key: 'done', label: 'Done' },
        ].map((s, i) => {
          const isActive = s.key === step || (s.key === 'preview' && step === 'applying');
          const isDone = (s.key === 'select' && step !== 'select') ||
                         (s.key === 'preview' && (step === 'applying' || step === 'done'));
          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-8 ${isDone || isActive ? 'bg-accent' : 'bg-border-color'}`} />}
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                isActive ? 'bg-accent text-white' :
                isDone ? 'bg-accent/10 text-accent' :
                'bg-bg-secondary text-text-secondary'
              }`}>
                {isDone ? <Check className="h-3.5 w-3.5" /> : null}
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Step 1: Select Industry */}
      {step === 'select' && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : blueprints.length === 0 ? (
            <div className="rounded-2xl border border-border-color bg-card-bg p-12 text-center">
              <Building2 className="mx-auto mb-3 h-12 w-12 text-text-secondary/40" />
              <p className="text-text-secondary">No industry templates available yet.</p>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="mt-4 rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {blueprints.map((bp) => {
                const Icon = INDUSTRY_ICONS[bp.key] || Building2;
                return (
                  <button
                    key={bp.key}
                    type="button"
                    onClick={() => void handleSelect(bp.key)}
                    disabled={previewLoading}
                    className={`group flex items-start gap-4 rounded-2xl border border-border-color bg-card-bg p-5 text-left transition-all hover:border-accent hover:shadow-lg ${
                      selected === bp.key && previewLoading ? 'border-accent opacity-70' : ''
                    } ${previewLoading ? 'cursor-wait' : ''}`}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 transition-colors group-hover:bg-accent/20">
                      <Icon className="h-6 w-6 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text-primary">{bp.name}</h3>
                      <p className="mt-1 text-sm text-text-secondary line-clamp-2">{bp.description}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
                        <span className="flex items-center gap-1"><Database className="h-3 w-3" /> {bp.systems_count} systems</span>
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-text-secondary transition-transform group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="text-sm text-text-secondary hover:text-text-primary"
            >
              Skip for now — I&apos;ll set things up manually
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && preview && (
        <div>
          <button
            type="button"
            onClick={() => { setStep('select'); setPreview(null); }}
            className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to industries
          </button>

          <div className="rounded-2xl border border-border-color bg-card-bg overflow-hidden">
            {/* Preview header */}
            <div className="border-b border-border-color bg-bg-secondary/30 px-6 py-4">
              <h2 className="text-xl font-bold text-text-primary">{preview.name}</h2>
              <p className="mt-1 text-sm text-text-secondary">{preview.description}</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Datasheets */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
                  <Database className="h-4 w-4 text-accent" />
                  Data Tables ({preview.datasheets.length})
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {preview.datasheets.map((ds) => (
                    <div key={ds.key} className="flex items-center gap-3 rounded-lg border border-border-color bg-bg-primary px-4 py-3">
                      <LayoutGrid className="h-4 w-4 shrink-0 text-accent" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{ds.display_name}</p>
                        <p className="text-xs text-text-muted">{ds.fields_count} fields</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Work Templates */}
              {preview.work_templates.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
                    <ClipboardList className="h-4 w-4 text-accent" />
                    Workflows ({preview.work_templates.length})
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {preview.work_templates.map((t) => (
                      <div key={t.key} className="flex items-center gap-3 rounded-lg border border-border-color bg-bg-primary px-4 py-3">
                        <ClipboardList className="h-4 w-4 shrink-0 text-blue-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{t.name}</p>
                          <p className="text-xs text-text-muted capitalize">{t.type} workflow</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation preview */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
                  <Users className="h-4 w-4 text-accent" />
                  Sidebar Navigation
                </h3>
                <div className="rounded-lg border border-border-color bg-bg-primary p-4">
                  {preview.navigation.map((group) => (
                    <div key={group.group} className="mb-3 last:mb-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">{group.group}</p>
                      <div className="space-y-0.5">
                        {group.items.map((item) => (
                          <p key={item.label} className="text-sm text-text-secondary pl-2">
                            {item.label}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roles */}
              {preview.roles && preview.roles.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-3">
                    <Users className="h-4 w-4 text-accent" />
                    Suggested Roles
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {preview.roles.map((r, i) => (
                      <span key={i} className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                        {String(r.name)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Apply button */}
            <div className="border-t border-border-color bg-bg-secondary/30 px-6 py-4 flex items-center justify-between">
              <p className="text-xs text-text-muted">
                This will create {preview.datasheets.length} data tables and {preview.work_templates.length} workflows.
              </p>
              <button
                type="button"
                onClick={() => void handleApply()}
                className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Apply to My Business
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Applying */}
      {step === 'applying' && (
        <div className="rounded-2xl border border-border-color bg-card-bg p-12 text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-accent" />
          <h3 className="text-lg font-semibold text-text-primary">Setting up your business...</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Creating data tables, workflows, and navigation. This takes a few seconds.
          </p>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && result && (
        <div className="rounded-2xl border border-border-color bg-card-bg p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-text-primary">Your system is ready!</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Created {result.datasheets} data tables and {result.templates} workflows.
            Your sidebar has been updated with your new navigation.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                // Force refresh to reload sidebar with new nav config
                window.location.href = '/dashboard';
              }}
              className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Go to Dashboard
            </button>
          </div>
          <p className="mt-4 text-xs text-text-muted">
            You can always modify your data tables and workflows in Settings.
          </p>
        </div>
      )}
    </div>
  );
}
