'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateTime } from '@/lib/format-date';
import {
  CheckCircle2, XCircle, Loader2, Copy, Check,
  ExternalLink, ChevronRight, Megaphone, Settings,
  RefreshCw, Trash2, BarChart2, Users, Zap,
  ChevronDown,
} from 'lucide-react';
import {
  getMetaIntegration,
  deleteMetaIntegration,
  listPageForms,
  listConnectedForms,
  connectMetaForm,
  updateMetaForm,
  disconnectMetaForm,
  getMetaStats,
  exchangeMetaToken,
  selectMetaPage,
  type MetaIntegration,
  type MetaLeadForm,
  type MetaPageForm,
  type MetaStats,
  type MetaFormRoutingConfig,
  type MetaOAuthPage,
} from '@/services/meta-integration';
import { listAgents, type Agent } from '@/services/agents';

// Pipeline stages were removed with the leads module. Local type kept so the
// stage selectors still render (empty) until this config UI is retired.
type LeadPipelineStage = { id: number; name: string };
import { FacebookSDKLoader } from '@/components/integrations/FacebookSDKLoader';

// ─── Meta brand colours ───────────────────────────────────────────────────────
const META_BLUE = '#1877F2';

// ─── Helper: copy to clipboard with tick feedback ─────────────────────────────
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handle}
      title="Copy"
      className="shrink-0 rounded p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

// ─── Priority badge ───────────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  high:   'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low:    'bg-gray-100 text-gray-700',
};

// ─── Main page ────────────────────────────────────────────────────────────────

type PageView = 'overview' | 'setup' | 'forms' | 'stats';

export default function MetaAdsIntegrationPage() {
  const router = useRouter();

  // Integration state
  const [integration, setIntegration] = useState<MetaIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<PageView>('overview');

  // Reference data
  const [stages] = useState<LeadPipelineStage[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  // OAuth flow state (set after FB.login() popup resolves)
  const [oauthPages, setOauthPages] = useState<MetaOAuthPage[]>([]);
  const [longLivedToken, setLongLivedToken] = useState<string>('');
  const [oauthExchanging, setOauthExchanging] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Forms state
  const [pageForms, setPageForms] = useState<MetaPageForm[]>([]);
  const [connectedForms, setConnectedForms] = useState<MetaLeadForm[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState<string | null>(null);

  // Stats state
  const [stats, setStats] = useState<MetaStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Form routing modal
  const [routingTarget, setRoutingTarget] = useState<MetaPageForm | MetaLeadForm | null>(null);
  const [routingConfig, setRoutingConfig] = useState<MetaFormRoutingConfig>({});
  const [routingSaving, setRoutingSaving] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);

  // ── Load initial data ──────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const [intg, agentList] = await Promise.allSettled([
          getMetaIntegration(),
          listAgents(),
        ]);
        if (intg.status === 'fulfilled') setIntegration(intg.value);
        if (agentList.status === 'fulfilled') setAgents(agentList.value);
      } finally {
        setLoading(false);
      }
    })();
  }, []);


  // ── Load forms when forms view is opened ──────────────────────────────────
  useEffect(() => {
    if (view !== 'forms' || !integration) return;
    void loadForms();
  }, [view, integration]);

  // ── Load stats when stats view is opened ──────────────────────────────────
  useEffect(() => {
    if (view !== 'stats' || !integration) return;
    void loadStats();
  }, [view, integration]);

  const loadForms = useCallback(async () => {
    setFormsLoading(true);
    setFormsError(null);
    try {
      const [page, connected] = await Promise.all([
        listPageForms(),
        listConnectedForms(),
      ]);
      setPageForms(page.forms);
      setConnectedForms(connected);
    } catch (e) {
      setFormsError(e instanceof Error ? e.message : 'Failed to load forms');
    } finally {
      setFormsLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await getMetaStats(30);
      setStats(s);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Disconnect integration ─────────────────────────────────────────────────
  const handleDisconnect = async () => {
    if (!confirm('Disconnect Meta Ads? Existing lead attribution data will be preserved.')) return;
    try {
      await deleteMetaIntegration();
      setIntegration(null);
      setView('overview');
    } catch { /* ignore */ }
  };

  // ── Open routing modal ─────────────────────────────────────────────────────
  const openRoutingModal = (form: MetaPageForm | MetaLeadForm) => {
    setRoutingTarget(form);
    const connected = connectedForms.find(
      (c) => c.form_id === ('form_id' in form ? form.form_id : (form as MetaLeadForm).form_id)
    );
    setRoutingConfig({
      source_label: connected?.source_label ?? '',
      pipeline_stage_id: connected?.pipeline_stage_id ?? null,
      agent_id: connected?.agent_id ?? null,
      priority: connected?.priority ?? 'medium',
    });
    setRoutingError(null);
  };

  const handleSaveRouting = async () => {
    if (!routingTarget) return;
    const formId = 'form_id' in routingTarget ? routingTarget.form_id : (routingTarget as MetaLeadForm).form_id;
    setRoutingSaving(true);
    setRoutingError(null);
    try {
      const isConnected = connectedForms.some((c) => c.form_id === formId);
      if (isConnected) {
        await updateMetaForm(formId, routingConfig);
      } else {
        await connectMetaForm(formId, routingConfig);
      }
      setRoutingTarget(null);
      await loadForms();
    } catch (e) {
      setRoutingError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setRoutingSaving(false);
    }
  };

  const handleDisconnectForm = async (formId: string) => {
    if (!confirm('Disconnect this form? New leads from it will no longer be tracked.')) return;
    await disconnectMetaForm(formId);
    await loadForms();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ backgroundColor: META_BLUE }}>
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Meta Ads Integration</h1>
            <p className="text-sm text-gray-500">
              Track leads from Facebook &amp; Instagram ads — CTWA and Lead Forms
            </p>
          </div>
        </div>
        {integration && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-800 border border-green-300">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Connected
          </span>
        )}
      </div>

      {/* ── Sub-nav tabs ── */}
      {integration && (
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          {([
            { id: 'overview', label: 'Overview', icon: Settings },
            { id: 'forms',    label: 'Lead Forms', icon: Users },
            { id: 'stats',    label: 'Analytics', icon: BarChart2 },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                view === id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════
          OVERVIEW / SETUP VIEW
      ════════════════════════════════════════ */}
      {(view === 'overview' || view === 'setup') && (
        <SetupPanel
          integration={integration}
          stages={stages}
          agents={agents}
          oauthPages={oauthPages}
          longLivedToken={longLivedToken}
          oauthExchanging={oauthExchanging}
          oauthError={oauthError}
          onSaved={(intg) => {
            setIntegration(intg);
            setOauthPages([]);
            setLongLivedToken('');
            setView('overview');
          }}
          onDisconnect={handleDisconnect}
          onEdit={() => setView('setup')}
          onPagesReceived={(token, pages) => {
            setLongLivedToken(token);
            setOauthPages(pages);
          }}
        />
      )}

      {/* ════════════════════════════════════════
          FORMS VIEW
      ════════════════════════════════════════ */}
      {view === 'forms' && integration && (
        <FormsPanel
          pageForms={pageForms}
          connectedForms={connectedForms}
          loading={formsLoading}
          error={formsError}
          onRefresh={loadForms}
          onOpenRouting={openRoutingModal}
          onDisconnect={handleDisconnectForm}
        />
      )}

      {/* ════════════════════════════════════════
          STATS VIEW
      ════════════════════════════════════════ */}
      {view === 'stats' && integration && (
        <StatsPanel stats={stats} loading={statsLoading} onRefresh={loadStats} />
      )}

      {/* ── Routing modal ── */}
      {routingTarget && (
        <RoutingModal
          target={routingTarget}
          config={routingConfig}
          stages={stages}
          agents={agents}
          saving={routingSaving}
          error={routingError}
          onChange={setRoutingConfig}
          onSave={handleSaveRouting}
          onClose={() => setRoutingTarget(null)}
        />
      )}

      {/* Load the Facebook JS SDK so window.FB is available for the login popup */}
      <FacebookSDKLoader />
    </div>
  );
}

// ─── Setup / Overview Panel ───────────────────────────────────────────────────

function SetupPanel({
  integration,
  stages,
  agents,
  oauthPages,
  longLivedToken,
  oauthExchanging,
  oauthError,
  onSaved,
  onDisconnect,
  onEdit,
  onPagesReceived,
}: {
  integration: MetaIntegration | null;
  stages: LeadPipelineStage[];
  agents: Agent[];
  oauthPages: MetaOAuthPage[];
  longLivedToken: string;
  oauthExchanging: boolean;
  oauthError: string | null;
  onSaved: (i: MetaIntegration) => void;
  onDisconnect: () => void;
  onEdit: () => void;
  onPagesReceived: (token: string, pages: MetaOAuthPage[]) => void;
}) {
  // ── Connected + no pending OAuth pages → show the summary ────────────────
  if (integration && oauthPages.length === 0) {
    return (
      <div className="space-y-4">
        {/* Connection card */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Connected Account</span>
            <div className="flex gap-2">
              <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">
                Reconnect
              </button>
              <span className="text-gray-300">·</span>
              <button onClick={onDisconnect} className="text-xs text-red-500 hover:underline">
                Disconnect
              </button>
            </div>
          </div>
          <div className="px-4 py-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <InfoRow label="Page Name" value={integration.page_name ?? '—'} />
            <InfoRow label="Page ID"   value={integration.page_id} />
            <InfoRow label="Default Priority" value={integration.default_priority} />
            <InfoRow
              label="Last Webhook"
              value={integration.last_webhook_at
                ? formatDateTime(integration.last_webhook_at)
                : 'Never received'}
            />
          </div>
        </div>

        {/* Webhook config */}
        <WebhookConfig integration={integration} />

        {/* Default routing */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Default Lead Routing</span>
            <p className="text-xs text-gray-400 mt-0.5">Applied when no per-form config matches</p>
          </div>
          <div className="px-4 py-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <InfoRow
              label="Pipeline Stage"
              value={stages.find(s => s.id === integration.default_pipeline_stage_id)?.name ?? 'Default stage'}
            />
            <InfoRow
              label="AI Agent"
              value={agents.find(a => Number(a.id) === integration.default_agent_id)?.name ?? 'Channel default'}
            />
            <InfoRow label="Priority" value={integration.default_priority} />
          </div>
        </div>
      </div>
    );
  }

  // ── OAuth exchanging in progress ──────────────────────────────────────────
  if (oauthExchanging) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm text-gray-500">Connecting to Facebook…</p>
      </div>
    );
  }

  // ── Page picker (after OAuth) or new setup ────────────────────────────────
  const hasPages = oauthPages.length > 0;

  return (
    <FacebookConnectFlow
      pages={oauthPages}
      longLivedToken={longLivedToken}
      hasPages={hasPages}
      oauthError={oauthError}
      stages={stages}
      agents={agents}
      existingIntegration={integration}
      onSaved={onSaved}
      onPagesReceived={onPagesReceived}
    />
  );
}

// ─── Facebook Connect Flow ────────────────────────────────────────────────────

function FacebookConnectFlow({
  pages,
  longLivedToken,
  hasPages,
  oauthError,
  stages,
  agents,
  existingIntegration,
  onSaved,
  onPagesReceived,
}: {
  pages: MetaOAuthPage[];
  longLivedToken: string;
  hasPages: boolean;
  oauthError: string | null;
  stages: LeadPipelineStage[];
  agents: Agent[];
  existingIntegration: MetaIntegration | null;
  onSaved: (i: MetaIntegration) => void;
  onPagesReceived: (token: string, pages: MetaOAuthPage[]) => void;
}) {
  const [selectedPageId, setSelectedPageId] = useState(pages[0]?.id ?? '');
  const [defaultStageId, setDefaultStageId] = useState<number | null>(
    existingIntegration?.default_pipeline_stage_id ?? null
  );
  const [defaultAgentId, setDefaultAgentId] = useState<number | null>(
    existingIntegration?.default_agent_id ?? null
  );
  const [defaultPriority, setDefaultPriority] = useState(
    existingIntegration?.default_priority ?? 'medium'
  );
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [sdkLoading, setSdkLoading] = useState(false);

  // When pages arrive after the popup (component was already mounted with []),
  // the useState initial value is stale — sync it via effect.
  useEffect(() => {
    if (pages.length > 0 && !selectedPageId) {
      setSelectedPageId(pages[0].id);
    }
  }, [pages]);

  const META_SCOPE = [
    'pages_show_list',
    'leads_retrieval',
    'pages_read_engagement',
    'pages_manage_metadata',
    'business_management',
  ].join(',');

  const handleFacebookLogin = () => {
    if (typeof window === 'undefined' || !window.FB || !window.__fbReady) {
      // SDK loads lazily — wait up to 5 s then retry automatically
      setSdkLoading(true);
      setConnectError(null);
      let waited = 0;
      const interval = setInterval(() => {
        waited += 200;
        if (window.FB && window.__fbReady) {
          clearInterval(interval);
          setSdkLoading(false);
          handleFacebookLogin();
        } else if (waited >= 5000) {
          clearInterval(interval);
          setSdkLoading(false);
          setConnectError(
            'Facebook SDK failed to load. Make sure NEXT_PUBLIC_FACEBOOK_APP_ID is set and pop-ups are not blocked, then refresh.'
          );
        }
      }, 200);
      return;
    }

    setSdkLoading(true);
    setConnectError(null);

    window.FB.login((response) => {
      (async () => {
        try {
          if (!response.authResponse?.accessToken) {
            setConnectError('Facebook login was cancelled or no access token was returned.');
            return;
          }
          const result = await exchangeMetaToken(response.authResponse.accessToken);
          // Bubble up to parent
          onPagesReceived(result.long_lived_token, result.pages);
        } catch (e) {
          setConnectError(e instanceof Error ? e.message : 'Failed to connect to Facebook.');
        } finally {
          setSdkLoading(false);
        }
      })();
    }, { scope: META_SCOPE });
  };

  const handleConnect = async () => {
    if (!selectedPageId) return;
    const page = pages.find(p => p.id === selectedPageId);
    setConnecting(true);
    setConnectError(null);
    try {
      const result = await selectMetaPage({
        long_lived_token: longLivedToken,
        page_id: selectedPageId,
        page_name: page?.name,
        default_pipeline_stage_id: defaultStageId,
        default_agent_id: defaultAgentId,
        default_priority: defaultPriority,
      });
      onSaved(result);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Failed to save integration.');
    } finally {
      setConnecting(false);
    }
  };

  // ── Step 1: Not yet authenticated → show "Connect with Facebook" ──────────
  if (!hasPages) {
    return (
      <div className="space-y-6">
        {/* What this does */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800/50 px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Connect your Facebook Page to MyBizAI
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Clicking the button below will open a Facebook login window. You'll select
              which page to connect — no copy-pasting tokens needed.
            </p>
          </div>
          <div className="px-5 py-4 space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <span>Captures leads from <strong>Lead Ad forms</strong> submitted on Facebook &amp; Instagram</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <span>Tracks <strong>Click-to-WhatsApp</strong> ad attribution on every new conversation</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <span>AI agent sees which ad the lead came from and tailors its response</span>
            </div>
          </div>
        </div>

        {/* Error from a previous attempt */}
        {(oauthError || connectError) && (
          <div className="rounded-lg bg-red-50 border border-red-300 px-4 py-3 flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{oauthError ?? connectError}</p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleFacebookLogin}
          disabled={sdkLoading}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity shadow-sm"
          style={{ backgroundColor: META_BLUE }}
        >
          {sdkLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
              </svg>
            )
          }
          {sdkLoading ? 'Connecting…' : 'Continue with Facebook'}
        </button>

        <p className="text-center text-xs text-gray-400">
          A Facebook login popup will open — no redirect needed.
          <br />Select your page and grant access to Lead Ads &amp; Messaging.
        </p>
      </div>
    );
  }

  // ── Step 2: Authenticated → pick a page + configure defaults ─────────────
  const selectedPage = pages.find(p => p.id === selectedPageId);

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-green-50 border border-green-300 px-4 py-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
        <p className="text-sm text-green-800 font-medium">
          Facebook connected! Select which page to link to MyBizAI.
        </p>
      </div>

      {/* Page picker */}
      <FormField label="Facebook Page">
        <div className="relative">
          <select
            value={selectedPageId}
            onChange={(e) => setSelectedPageId(e.target.value)}
            className={inputCls + ' pr-8 appearance-none'}
          >
            {pages.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.category ? ` — ${p.category}` : ''}{p.fan_count > 0 ? ` (${p.fan_count.toLocaleString()} followers)` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
        {selectedPage && (
          <p className="text-xs text-gray-400 mt-1">Page ID: {selectedPage.id}</p>
        )}
      </FormField>

      {/* Default routing */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Default Routing
        </p>
        <p className="text-xs text-gray-400 mb-3">
          Applied to all leads from this page unless you override it per-form.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Pipeline Stage">
            <select
              value={defaultStageId ?? ''}
              onChange={(e) => setDefaultStageId(e.target.value ? Number(e.target.value) : null)}
              className={inputCls}
            >
              <option value="">Default stage</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FormField>
          <FormField label="AI Agent">
            <select
              value={defaultAgentId ?? ''}
              onChange={(e) => setDefaultAgentId(e.target.value ? Number(e.target.value) : null)}
              className={inputCls}
            >
              <option value="">Channel default</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </FormField>
          <FormField label="Priority">
            <select
              value={defaultPriority}
              onChange={(e) => setDefaultPriority(e.target.value)}
              className={inputCls}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </FormField>
        </div>
      </div>

      {connectError && (
        <div className="rounded-lg bg-red-50 border border-red-300 px-3 py-2 text-sm text-red-800">
          {connectError}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleConnect}
          disabled={connecting || !selectedPageId}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
          style={{ backgroundColor: META_BLUE }}
        >
          {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
          {connecting ? 'Connecting…' : 'Connect Page'}
          {!connecting && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Webhook config card (shown after credentials are saved) ─────────────────

function WebhookConfig({ integration }: { integration: MetaIntegration }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Webhook Configuration</span>
        <p className="text-xs text-gray-400 mt-0.5">
          Paste these into Meta Developer Console → Webhooks → Subscribe to leadgen
        </p>
      </div>
      <div className="px-4 py-4 space-y-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Callback URL</label>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
            <code className="text-xs text-gray-800 dark:text-gray-200 flex-1 break-all">
              {integration.webhook_url}
            </code>
            <CopyButton value={integration.webhook_url} />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Verify Token</label>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
            <code className="text-xs text-gray-800 dark:text-gray-200 flex-1">
              {integration.verify_token}
            </code>
            <CopyButton value={integration.verify_token} />
          </div>
        </div>
        <a
          href="https://developers.facebook.com/docs/graph-api/webhooks/getting-started"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
        >
          View Meta webhook docs <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

// ─── Forms Panel ──────────────────────────────────────────────────────────────

function FormsPanel({
  pageForms,
  connectedForms,
  loading,
  error,
  onRefresh,
  onOpenRouting,
  onDisconnect,
}: {
  pageForms: MetaPageForm[];
  connectedForms: MetaLeadForm[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenRouting: (f: MetaPageForm | MetaLeadForm) => void;
  onDisconnect: (formId: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-400">Loading forms from Meta…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-300 px-4 py-3 flex items-start gap-3">
        <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-700">Could not load forms</p>
          <p className="text-xs text-red-600 mt-0.5">{error}</p>
          <button onClick={onRefresh} className="mt-2 text-xs text-red-600 underline">Try again</button>
        </div>
      </div>
    );
  }

  const connectedIds = new Set(connectedForms.map(f => f.form_id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {pageForms.length} lead form{pageForms.length !== 1 ? 's' : ''} found on your Facebook Page
        </p>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {pageForms.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No lead ad forms found on this page.
          <br />
          <a
            href="https://www.facebook.com/ads/leadads/"
            target="_blank"
            rel="noreferrer"
            className="text-blue-500 underline mt-1 inline-block"
          >
            Create your first lead ad →
          </a>
        </div>
      )}

      {pageForms.map((form) => {
        const connected = connectedForms.find(c => c.form_id === form.form_id);
        const isConnected = connectedIds.has(form.form_id);

        return (
          <div
            key={form.form_id}
            className={`rounded-xl border p-4 ${
              isConnected
                ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {form.form_name}
                  </span>
                  {isConnected && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-800 bg-green-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Connected
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    form.status === 'ACTIVE' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {form.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Form ID: {form.form_id} · {form.leads_count} total leads
                </p>
                {connected && (
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                    {connected.source_label && (
                      <span>Label: <strong>{connected.source_label}</strong></span>
                    )}
                    {connected.pipeline_stage_name && (
                      <span>Stage: <strong>{connected.pipeline_stage_name}</strong></span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[connected.priority] ?? ''}`}>
                      {connected.priority}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onOpenRouting(form)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 font-medium"
                >
                  {isConnected ? 'Settings' : 'Connect'}
                </button>
                {isConnected && (
                  <button
                    onClick={() => onDisconnect(form.form_id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Disconnect form"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────

function StatsPanel({
  stats,
  loading,
  onRefresh,
}: {
  stats: MetaStats | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const entryLabels: Record<string, string> = {
    text: 'Pre-filled message',
    ice_breaker: 'Quick-reply button',
    flow_response: 'WhatsApp Flow',
    organic: 'Organic / manual',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Last 30 days</p>
        <button onClick={onRefresh} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Total card */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800 px-5 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
          <Zap className="w-5 h-5 text-blue-600 dark:text-blue-300" />
        </div>
        <div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.total_meta_leads}</p>
          <p className="text-xs text-blue-500">Total Meta ad leads captured</p>
        </div>
      </div>

      {/* By campaign */}
      <StatSection title="By Campaign" rows={stats.by_campaign} nameKey="name" countKey="count" />

      {/* By form */}
      <StatSection title="By Lead Form" rows={stats.by_form} nameKey="name" countKey="count" />

      {/* By entry type */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2.5">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Entry Type (CTWA)</span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {stats.by_entry_type.map((row) => (
            <div key={row.type} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {entryLabels[row.type] ?? row.type}
              </span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{row.count}</span>
            </div>
          ))}
          {stats.by_entry_type.length === 0 && (
            <div className="px-4 py-4 text-sm text-gray-400 text-center">No CTWA entries yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatSection({
  title,
  rows,
  nameKey,
  countKey,
}: {
  title: string;
  rows: Record<string, unknown>[];
  nameKey: string;
  countKey: string;
}) {
  const maxCount = Math.max(...rows.map((r) => Number(r[countKey]) || 0), 1);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2.5">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{title}</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {rows.map((row, i) => (
          <div key={i} className="px-4 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[70%]">
                {String(row[nameKey])}
              </span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {Number(row[countKey])}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(Number(row[countKey]) / maxCount) * 100}%`,
                  backgroundColor: META_BLUE,
                  opacity: 0.7,
                }}
              />
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-4 py-4 text-sm text-gray-400 text-center">No data yet</div>
        )}
      </div>
    </div>
  );
}

// ─── Routing Modal ────────────────────────────────────────────────────────────

function RoutingModal({
  target,
  config,
  stages,
  agents,
  saving,
  error,
  onChange,
  onSave,
  onClose,
}: {
  target: MetaPageForm | MetaLeadForm;
  config: MetaFormRoutingConfig;
  stages: LeadPipelineStage[];
  agents: Agent[];
  saving: boolean;
  error: string | null;
  onChange: (c: MetaFormRoutingConfig) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const formName = target.form_name ?? target.form_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Configure Form Routing</h3>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{formName}</p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <FormField label="Source Label">
            <input
              value={config.source_label ?? ''}
              onChange={(e) => onChange({ ...config, source_label: e.target.value })}
              className={inputCls}
              placeholder="e.g. Facebook Summer Sale"
            />
            <p className="text-xs text-gray-400 mt-1">Shown on lead cards in your dashboard</p>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Pipeline Stage">
              <select
                value={config.pipeline_stage_id ?? ''}
                onChange={(e) => onChange({ ...config, pipeline_stage_id: e.target.value ? Number(e.target.value) : null })}
                className={inputCls}
              >
                <option value="">Default stage</option>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label="Priority">
              <select
                value={config.priority ?? 'medium'}
                onChange={(e) => onChange({ ...config, priority: e.target.value })}
                className={inputCls}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </FormField>
          </div>

          <FormField label="AI Agent">
            <select
              value={config.agent_id ?? ''}
              onChange={(e) => onChange({ ...config, agent_id: e.target.value ? Number(e.target.value) : null })}
              className={inputCls}
            >
              <option value="">Channel / integration default</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </FormField>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60"
            style={{ backgroundColor: META_BLUE }}
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving…' : 'Save Routing'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">{value}</p>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 ' +
  'px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-400 ' +
  'focus:ring-1 focus:ring-blue-200 transition-colors';
