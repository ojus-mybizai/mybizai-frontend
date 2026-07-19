'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutTemplate,
  Stethoscope,
  Building2,
  ShoppingCart,
  UtensilsCrossed,
  Briefcase,
  ChevronRight,
  Check,
  Loader2,
  ArrowLeft,
  Layers,
  Users,
  Bot,
  Zap,
  Database,
  ClipboardList,
  BookOpen,
  MessageSquare,
  X,
  AlertTriangle,
  GraduationCap,
} from 'lucide-react';
import {
  listTemplates,
  getTemplate,
  applyTemplate,
  getCountLabel,
  getCountEmoji,
  type BlueprintTemplateSummary,
  type BlueprintApplyResult,
  type BlueprintJSON,
} from '@/services/blueprint';
import { useTourStore } from '@/lib/tour-store';
import { generateTourFromTemplate } from '@/lib/tour-generator';

// ── Icon mapping ────────────────────────────────────────────────────

const INDUSTRY_ICONS: Record<string, typeof Stethoscope> = {
  healthcare: Stethoscope,
  real_estate: Building2,
  ecommerce: ShoppingCart,
  restaurant: UtensilsCrossed,
  consulting: Briefcase,
};

const COUNT_ICONS: Record<string, typeof Database> = {
  datasheets: Database,
  roles: Users,
  agents: Bot,
  automations: Zap,
  pipeline_stages: Layers,
  work_templates: ClipboardList,
  processes: Layers,
  knowledge_base: BookOpen,
  followup_rules: MessageSquare,
};

// ── Page ────────────────────────────────────────────────────────────

type Step = 'gallery' | 'preview' | 'applying' | 'done';

export default function TemplatesPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('gallery');
  const [templates, setTemplates] = useState<BlueprintTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preview
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<BlueprintTemplateSummary | null>(null);
  const [previewData, setPreviewData] = useState<BlueprintJSON | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Apply
  const [result, setResult] = useState<BlueprintApplyResult | null>(null);

  useEffect(() => {
    listTemplates()
      .then(setTemplates)
      .catch(() => setError('Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  const handlePreview = async (tmpl: BlueprintTemplateSummary) => {
    setSelectedSlug(tmpl.slug);
    setSelectedTemplate(tmpl);
    setPreviewLoading(true);
    setError(null);
    try {
      const data = await getTemplate(tmpl.slug);
      setPreviewData(data);
      setStep('preview');
    } catch {
      setError('Failed to load template details');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApply = async () => {
    if (!selectedSlug) return;
    setStep('applying');
    setError(null);
    try {
      const res = await applyTemplate(selectedSlug);
      setResult(res);
      setStep('done');

      // Generate tour & checklist from the template data
      if (previewData && selectedTemplate) {
        const { tourSteps, checklist } = generateTourFromTemplate(selectedSlug, previewData);
        const store = useTourStore.getState();
        store.setChecklist(selectedTemplate.name, checklist);
        // Store tour steps for pending start
        store.startTour(selectedSlug, []); // init tourId
        store.endTour(); // don't start yet
        // Save steps in sessionStorage for dashboard to pick up
        try {
          sessionStorage.setItem('pending-tour', JSON.stringify({ tourId: selectedSlug, steps: tourSteps }));
        } catch {}
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply template');
      setStep('preview');
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => step === 'gallery' ? router.back() : setStep('gallery')}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 'gallery' ? 'Back' : 'Back to templates'}
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <LayoutTemplate className="h-5.5 w-5.5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Business Templates</h1>
            <p className="text-sm text-text-muted mt-0.5">
              Pre-built setups that create datasheets, AI agents, automations, roles, and more in one click
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ── Gallery Step ─────────────────────────────────────── */}
      {step === 'gallery' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-text-muted">Loading templates…</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border-color py-16 text-center">
              <LayoutTemplate className="h-12 w-12 mx-auto text-text-muted/30 mb-3" />
              <p className="text-lg font-medium text-text-secondary">No templates available yet</p>
              <p className="text-sm text-text-muted mt-1">Templates will appear here once created.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tmpl) => {
                const IconComp = INDUSTRY_ICONS[tmpl.industry || ''] || LayoutTemplate;
                const totalResources = Object.values(tmpl.counts).reduce((a, b) => a + b, 0);

                return (
                  <button
                    key={tmpl.slug}
                    onClick={() => handlePreview(tmpl)}
                    className="group text-left rounded-xl border border-border-color bg-card-bg p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors shrink-0">
                        <IconComp className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold text-text-primary group-hover:text-primary transition-colors">
                            {tmpl.name}
                          </h3>
                          <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-primary transition-colors shrink-0" />
                        </div>
                        <p className="text-xs text-text-muted mt-1 line-clamp-2">
                          {tmpl.description}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {tmpl.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-bg-secondary px-2 py-0.5 text-[10px] font-medium text-text-muted"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        {/* Resource counts */}
                        <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-text-muted">
                          {Object.entries(tmpl.counts).slice(0, 4).map(([key, count]) => (
                            <span key={key} className="flex items-center gap-1">
                              <span>{getCountEmoji(key)}</span>
                              <span>{count} {getCountLabel(key)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Preview Step ─────────────────────────────────────── */}
      {step === 'preview' && selectedTemplate && (
        <div className="space-y-6">
          {/* Template header card */}
          <div className="rounded-xl border border-border-color bg-card-bg p-6">
            <div className="flex items-start gap-4">
              {(() => {
                const IconComp = INDUSTRY_ICONS[selectedTemplate.industry || ''] || LayoutTemplate;
                return (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <IconComp className="h-7 w-7 text-primary" />
                  </div>
                );
              })()}
              <div className="flex-1">
                <h2 className="text-xl font-bold text-text-primary">{selectedTemplate.name}</h2>
                <p className="text-sm text-text-muted mt-1">{selectedTemplate.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {selectedTemplate.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-bg-secondary px-2.5 py-0.5 text-xs text-text-muted">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* What will be created — tree view */}
          <div className="rounded-xl border border-border-color bg-card-bg p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              This template will create:
            </h3>
            <div className="space-y-3">
              {Object.entries(selectedTemplate.counts).map(([key, count]) => {
                const IconComp = COUNT_ICONS[key] || Database;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 rounded-lg bg-bg-secondary/30 px-4 py-2.5"
                  >
                    <IconComp className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm text-text-primary font-medium">
                      {count} {getCountLabel(key)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Detailed preview of datasheets if available */}
            {previewData && (previewData as any).datasheets && (
              <div className="mt-5 pt-5 border-t border-border-color">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                  Datasheets Structure
                </h4>
                <div className="space-y-2 text-sm">
                  {((previewData as any).datasheets as any[]).map((ds: any) => (
                    <div key={ds.name}>
                      <div className="flex items-center gap-2 text-text-primary">
                        <Database className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">{ds.display_name}</span>
                        <span className="text-xs text-text-muted">({ds.fields?.length || 0} fields)</span>
                      </div>
                      {ds.children && ds.children.length > 0 && (
                        <div className="ml-6 mt-1 space-y-1">
                          {ds.children.map((child: any) => (
                            <div key={child.name} className="flex items-center gap-2 text-text-secondary">
                              <span className="text-text-muted">└</span>
                              <Database className="h-3 w-3 text-text-muted" />
                              <span>{child.display_name}</span>
                              <span className="text-xs text-text-muted">({child.fields?.length || 0} fields)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent preview */}
            {previewData && (previewData as any).agents && (
              <div className="mt-5 pt-5 border-t border-border-color">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                  AI Agents
                </h4>
                <div className="space-y-2 text-sm">
                  {((previewData as any).agents as any[]).map((agent: any) => (
                    <div key={agent.name} className="flex items-center gap-2 text-text-primary">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium">{agent.name}</span>
                      <span className="text-xs text-text-muted">
                        ({agent.role_type} · {agent.skills?.length || 0} skills)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Roles preview */}
            {previewData && (previewData as any).roles && (
              <div className="mt-5 pt-5 border-t border-border-color">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                  Roles & Permissions
                </h4>
                <div className="space-y-2 text-sm">
                  {((previewData as any).roles as any[]).map((role: any) => (
                    <div key={role.slug} className="flex items-center gap-2 text-text-primary">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium">{role.name}</span>
                      <span className="text-xs text-text-muted">
                        ({role.permissions?.length || 0} permissions)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Apply button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('gallery')}
              className="rounded-lg px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-secondary transition-colors"
            >
              ← Choose different template
            </button>
            <button
              onClick={handleApply}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
            >
              Apply Template
            </button>
          </div>
        </div>
      )}

      {/* ── Applying Step ────────────────────────────────────── */}
      {step === 'applying' && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <h2 className="text-lg font-semibold text-text-primary">Setting up your business…</h2>
          <p className="text-sm text-text-muted mt-2">
            Creating datasheets, agents, automations, and more. This may take a few seconds.
          </p>
        </div>
      )}

      {/* ── Done Step ────────────────────────────────────────── */}
      {step === 'done' && result && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-text-primary">Template Applied!</h2>
          <p className="text-sm text-text-muted mt-2 mb-6">
            Your business has been set up with {selectedTemplate?.name}.
          </p>

          {/* Summary */}
          <div className="rounded-xl border border-border-color bg-card-bg p-5 w-full max-w-md">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Created:</h3>
            <div className="space-y-2">
              {Object.entries(result.created).map(([key, count]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{getCountEmoji(key)} {getCountLabel(key)}</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">+{count}</span>
                </div>
              ))}
              {Object.entries(result.skipped).map(([key, count]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">{getCountLabel(key)} (already existed)</span>
                  <span className="text-text-muted">{count} skipped</span>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border-color">
                <p className="text-xs text-red-500 font-medium mb-1">Warnings:</p>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-400">{err}</p>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={() => router.push('/data-sheet')}
              className="rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors"
            >
              Go to Datasheets
            </button>
            <button
              onClick={() => {
                // Start the tour on dashboard
                try {
                  const raw = sessionStorage.getItem('pending-tour');
                  if (raw) {
                    const { tourId, steps } = JSON.parse(raw);
                    sessionStorage.removeItem('pending-tour');
                    // Small delay to let dashboard render
                    setTimeout(() => {
                      useTourStore.getState().startTour(tourId, steps);
                    }, 1000);
                  }
                } catch {}
                router.push('/dashboard');
              }}
              className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <GraduationCap className="h-4 w-4" />
              Take a Tour
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
