"use client";

/**
 * Campaign Wizard — 3 steps:
 *   1. Category + Template
 *   2. Audience (manual leads, manual phones, or saved segment)
 *   3. Schedule + cost summary + launch
 *
 * On submit the campaign is created as 'draft', audience is resolved,
 * total cost is estimated, and the user confirms launch.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PermissionGuard from "@/components/permission-guard";
import { listChannels, type Channel } from "@/services/channels";
import {
  listMessageTemplates,
  type MessageTemplate,
} from "@/services/message-templates";
import { AIAudienceChat } from "@/components/outbound/AIAudienceChat";
import { LeadSelector } from "@/components/outbound/LeadSelector";
import { FileImportAudience } from "@/components/outbound/FileImportAudience";
import { SegmentSelector } from "@/components/outbound/SegmentSelector";
import {
  createCampaign,
  estimateCost,
  getCampaign,
  launchCampaign,
  previewAudience,
  getWallet,
  type AudienceFilter,
  type AudiencePreview,
  type Campaign,
  type CampaignCategory,
  type ScheduleType,
  type Wallet,
} from "@/services/outbound";

const CATEGORIES: Array<{
  value: CampaignCategory;
  icon: string;
  label: string;
  description: string;
  estCost: string;
}> = [
  {
    value: "marketing",
    icon: "📢",
    label: "Marketing",
    description: "Promos, offers, announcements",
    estCost: "₹1.47",
  },
  {
    value: "utility",
    icon: "🧾",
    label: "Utility",
    description: "Confirmations, receipts, updates",
    estCost: "₹0.79",
  },
  {
    value: "reminder",
    icon: "🔔",
    label: "Reminder",
    description: "Appointments, deadlines",
    estCost: "₹0.75",
  },
  {
    value: "followup",
    icon: "⏰",
    label: "Follow-up",
    description: "Lead nurture sequences",
    estCost: "₹0.75",
  },
];

function formatMoney(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Wrapper to handle Suspense boundary for useSearchParams
export default function CampaignWizardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
      <CampaignWizardInner />
    </Suspense>
  );
}

function CampaignWizardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory =
    (searchParams?.get("category") as CampaignCategory) || "marketing";
  const repeatId = searchParams?.get("repeat") ? Number(searchParams.get("repeat")) : null;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repeatLoading, setRepeatLoading] = useState(!!repeatId);

  // Step 1
  const [category, setCategory] = useState<CampaignCategory>(initialCategory);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [channelId, setChannelId] = useState<number | null>(null);

  // Step 2
  const [audienceType, setAudienceType] = useState<
    "leads" | "import" | "manual" | "segment" | "ai_filter"
  >("leads");
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [manualPhones, setManualPhones] = useState("");
  const [segmentId, setSegmentId] = useState<number | null>(null);
  const [aiFilter, setAiFilter] = useState<AudienceFilter | null>(null);
  const [aiSuggestedName, setAiSuggestedName] = useState<string>("");
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Step 3
  const [scheduleType, setScheduleType] = useState<ScheduleType>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [throttle, setThrottle] = useState(10);
  // Drip
  const [dripPerDay, setDripPerDay] = useState(50);
  const [dripStartHour, setDripStartHour] = useState(10);
  const [dripEndHour, setDripEndHour] = useState(18);

  // Data from server
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);

  // Load base data — each call is independent so one failing doesn't block others
  useEffect(() => {
    void (async () => {
      const errors: string[] = [];

      // Templates (required)
      try {
        const tpls = await listMessageTemplates({
          channel: "whatsapp",
          meta_status: "approved",
        });
        setTemplates(tpls);
      } catch (err) {
        // Also load ALL templates if 'approved' filter gives empty (no approved yet)
        try {
          const allTpls = await listMessageTemplates({ channel: "whatsapp" });
          setTemplates(allTpls);
        } catch {
          errors.push("templates");
        }
      }

      // Channels (required)
      try {
        const chs = await listChannels();
        const whatsappChannels = chs.filter(
          (c) => c.type === "whatsapp" && c.isConnected,
        );
        setChannels(whatsappChannels);
        if (whatsappChannels.length === 1)
          setChannelId(Number(whatsappChannels[0].id));
      } catch {
        errors.push("channels");
      }

      // Wallet (optional — may not exist yet)
      try {
        const w = await getWallet();
        setWallet(w);
      } catch {
        // Silently ignore — wallet table may not exist yet
      }

      if (errors.length > 0) {
        setError(
          `Failed to load: ${errors.join(", ")}. Check that the backend is running.`,
        );
      }
    })();
  }, []);

  // ── Repeat campaign: prefill all fields from an existing campaign ──────────
  useEffect(() => {
    if (!repeatId) return;
    // Wait until templates + channels are loaded (both arrays non-empty or a tick
    // has passed), then fetch the source campaign and prefill.
    if (templates.length === 0 && channels.length === 0) return; // not ready yet

    void (async () => {
      try {
        setRepeatLoading(true);
        const src = await getCampaign(repeatId);

        // Step 1 fields
        setName(`${src.name} (repeat)`);
        setCategory(src.category as CampaignCategory);
        setTemplateId(src.template_id);
        if (src.channel_id) setChannelId(src.channel_id);

        // Step 3 fields
        setThrottle(src.throttle_per_minute ?? 10);
        // Keep schedule_type as "now" regardless of original — repeat = send fresh

        // Step 2 fields — decode audience_config
        const cfg = (src.audience_config ?? {}) as Record<string, unknown>;
        if (src.audience_type === "manual") {
          const leadIds = Array.isArray(cfg.lead_ids) ? (cfg.lead_ids as number[]) : [];
          const phones = Array.isArray(cfg.phones) ? (cfg.phones as string[]) : [];
          if (leadIds.length > 0) {
            setAudienceType("leads");
            setSelectedLeadIds(leadIds);
            // Set a preview count estimate so canProceedStep2 passes
            setPreview({ count: leadIds.length, sample_leads: [], warnings: [] });
          } else if (phones.length > 0) {
            setAudienceType("manual");
            setManualPhones(phones.join("\n"));
            setPreview({ count: phones.length, sample_leads: [], warnings: [] });
          }
        } else if (src.audience_type === "segment") {
          const sid = typeof cfg.segment_id === "number" ? cfg.segment_id : null;
          if (sid) {
            setAudienceType("segment");
            setSegmentId(sid);
            setPreview({ count: src.total_recipients, sample_leads: [], warnings: [] });
          }
        } else if (src.audience_type === "ai_filter") {
          setAudienceType("ai_filter");
          setAiFilter(cfg as AudienceFilter);
          setPreview({ count: src.total_recipients, sample_leads: [], warnings: [] });
        }

        // Jump straight to review step
        setStep(3);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load campaign for repeat");
      } finally {
        setRepeatLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatId, templates.length, channels.length]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  // Preview audience whenever inputs change (debounced-ish by user-driven click)
  const runPreview = useCallback(async () => {
    setPreviewing(true);
    setError(null);
    try {
      if (audienceType === "leads" || audienceType === "import") {
        if (selectedLeadIds.length === 0) {
          setPreview({
            count: 0,
            sample_leads: [],
            warnings: ["Select at least one lead"],
          });
        } else {
          const res = await previewAudience({
            audience_type: "manual",
            lead_ids: selectedLeadIds,
          });
          setPreview(res);
        }
      } else if (audienceType === "manual") {
        const phones = manualPhones
          .split(/[\s,;\n]+/)
          .map((p) => p.trim())
          .filter(Boolean);
        if (phones.length === 0) {
          setPreview({
            count: 0,
            sample_leads: [],
            warnings: ["Add at least one phone number"],
          });
        } else {
          const res = await previewAudience({
            audience_type: "manual",
            phones,
          });
          setPreview(res);
        }
      } else if (audienceType === "segment" && segmentId) {
        const res = await previewAudience({
          audience_type: "segment",
          segment_id: segmentId,
        });
        setPreview(res);
      } else if (audienceType === "ai_filter" && aiFilter) {
        const res = await previewAudience({
          audience_type: "ai_filter",
          filter: aiFilter,
        });
        setPreview(res);
      } else {
        setPreview(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }, [audienceType, selectedLeadIds, manualPhones, segmentId, aiFilter]);

  // When file import finishes, auto-select the imported leads and preview
  const handleFileImported = useCallback((leadIds: number[]) => {
    setSelectedLeadIds((prev) => {
      const set = new Set([...prev, ...leadIds]);
      return Array.from(set);
    });
    // Auto-preview by setting a fake preview (count = imported leads)
    setPreview({
      count: leadIds.length,
      sample_leads: [],
      warnings: [],
    });
  }, []);

  // When AI commits a filter, auto-populate preview so user sees the count
  const handleAICommit = useCallback(
    (filter: AudienceFilter, count: number, suggestedName: string) => {
      setAiFilter(filter);
      setAiSuggestedName(suggestedName);
      setPreview({
        count,
        sample_leads: [],
        warnings: [],
      });
      if (!name) setName(suggestedName);
    },
    [name],
  );

  // Cost estimate for step 3
  const [costEstimate, setCostEstimate] = useState<{
    total: string;
    perMessage: string;
    walletAfter: string;
    sufficient: boolean;
  } | null>(null);

  useEffect(() => {
    if (step !== 3 || !preview || preview.count === 0) return;
    void (async () => {
      try {
        const est = await estimateCost(category, preview.count);
        setCostEstimate({
          total: est.total_cost,
          perMessage: est.cost_per_message,
          walletAfter: est.wallet_after_send,
          sufficient: est.has_sufficient_balance,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cost estimate failed");
      }
    })();
  }, [step, preview, category]);

  // ── Step handlers ─────────────────────────────────────────────────────

  const canProceedStep1 = !!name && !!templateId && !!channelId;
  const canProceedStep2 =
    (!!preview && preview.count > 0) ||
    ((audienceType === "leads" || audienceType === "import") &&
      selectedLeadIds.length > 0);
  // Allow launch if step 1 + step 2 are valid.
  // If cost estimate loaded and balance is insufficient, warn but still allow
  // (backend will reject if wallet is truly empty).
  const canLaunch = canProceedStep1 && canProceedStep2;

  const handleLaunch = async () => {
    if (!templateId || !channelId) return;
    // For leads/import audience, we may not have preview but have selectedLeadIds
    if (!preview && selectedLeadIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      // Build audience_config
      let audience_config: Record<string, unknown> = {};
      let effectiveAudienceType = audienceType as string;
      if (audienceType === "leads" || audienceType === "import") {
        audience_config = { lead_ids: selectedLeadIds };
        effectiveAudienceType = "manual";
      } else if (audienceType === "manual") {
        const phones = manualPhones
          .split(/[\s,;\n]+/)
          .map((p) => p.trim())
          .filter(Boolean);
        audience_config = { phones };
      } else if (audienceType === "segment" && segmentId) {
        audience_config = { segment_id: segmentId };
      } else if (audienceType === "ai_filter" && aiFilter) {
        audience_config = aiFilter as Record<string, unknown>;
      }

      const campaign: Campaign = await createCampaign({
        name,
        category,
        template_id: templateId,
        channel_id: channelId,
        audience_type: effectiveAudienceType as
          | "manual"
          | "segment"
          | "ai_filter",
        audience_config,
        schedule_type: scheduleType,
        scheduled_at:
          scheduleType === "scheduled" || scheduleType === "drip"
            ? scheduledAt || undefined
            : undefined,
        drip_config:
          scheduleType === "drip"
            ? {
                per_day: dripPerDay,
                start_hour: dripStartHour,
                end_hour: dripEndHour,
                spread: "even",
              }
            : undefined,
        throttle_per_minute: throttle,
      });

      // Try to launch — if it fails, still navigate to the campaign page
      try {
        await launchCampaign(campaign.id);
      } catch (launchErr) {
        console.warn(
          "Launch failed (campaign still created as draft):",
          launchErr,
        );
      }
      router.push(`/outbound/${campaign.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create campaign",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────

  return (
    <PermissionGuard permission="manage_channels">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <Link
            href="/outbound"
            className="text-sm text-gray-500 hover:text-primary"
          >
            ← Back to Outbound Hub
          </Link>
          <h1 className="text-2xl font-semibold mt-2">
            {repeatId ? "Repeat Campaign" : "New Campaign"}
          </h1>
          {repeatId && (
            <p className="text-sm text-gray-500 mt-1">
              Pre-filled from the original campaign — review the settings and launch.
            </p>
          )}
        </div>

        {/* Loading overlay while fetching repeat campaign data */}
        {repeatLoading && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-800 rounded-lg mb-4 text-sm text-blue-800 dark:text-blue-300">
            <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading campaign details…
          </div>
        )}

        {/* Stepper */}
        <div className="flex items-center gap-3 mb-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= (n as 1 | 2 | 3)
                    ? "bg-primary text-primary-foreground"
                    : "bg-gray-200 text-gray-600 dark:bg-neutral-800"
                }`}
              >
                {n}
              </div>
              <span className="text-sm hidden sm:inline">
                {n === 1 && "Template"}
                {n === 2 && "Audience"}
                {n === 3 && "Review"}
              </span>
              {n !== 3 && (
                <div className="w-10 h-px bg-gray-300 dark:bg-neutral-700" />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6 text-foreground">
          {/* ────── STEP 1 ──────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Campaign Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Diwali Offer — Mumbai"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={`text-left border rounded-md p-3 transition ${
                        category === c.value
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl">{c.icon}</span>
                        <span className="text-xs font-medium text-gray-500">
                          {c.estCost}/msg
                        </span>
                      </div>
                      <div className="font-medium mt-1">{c.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {c.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Template (approved WhatsApp templates only)
                </label>
                <select
                  value={templateId ?? ""}
                  onChange={(e) =>
                    setTemplateId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
                >
                  <option value="">— Select a template —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.meta_template_name})
                    </option>
                  ))}
                </select>
                {selectedTemplate &&
                  (selectedTemplate.parameter_mapping?.length ?? 0) > 0 && (
                    <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-3 rounded-md text-xs">
                      ⚠️ This template has{" "}
                      <strong>
                        {selectedTemplate.parameter_mapping!.length}{" "}
                        parameter(s)
                      </strong>
                      . Variables will be auto-filled from lead data (name,
                      phone, linked records). Manual phone numbers without a
                      lead will cause Meta to reject the send.
                    </div>
                  )}
                {templates.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    No approved templates yet.{" "}
                    <Link href="/message-templates" className="underline">
                      Create one
                    </Link>{" "}
                    and submit it to Meta for approval.
                  </p>
                )}
                {selectedTemplate && (
                  <div className="mt-3 border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 rounded-md p-3 text-sm">
                    <div className="font-medium text-xs text-gray-500 mb-1">
                      Preview
                    </div>
                    <div className="whitespace-pre-wrap">
                      {selectedTemplate.body}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  WhatsApp Channel
                </label>
                <select
                  value={channelId ?? ""}
                  onChange={(e) =>
                    setChannelId(e.target.value ? Number(e.target.value) : null)
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
                >
                  <option value="">— Select a channel —</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {channels.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    No connected WhatsApp channels.{" "}
                    <Link href="/channels" className="underline">
                      Connect one
                    </Link>
                    .
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                >
                  Next: Audience →
                </button>
              </div>
            </div>
          )}

          {/* ────── STEP 2 ──────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Audience Type
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(
                    [
                      { key: "leads", icon: "👥", label: "Contacts" },
                      { key: "import", icon: "📄", label: "Import File" },
                      { key: "ai_filter", icon: "🤖", label: "AI Filter" },
                      { key: "segment", icon: "📑", label: "Segment" },
                      { key: "manual", icon: "📋", label: "Phones" },
                    ] as const
                  ).map(({ key, icon, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAudienceType(key)}
                      className={`px-2 py-2 border rounded-md text-xs text-center ${
                        audienceType === key
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-gray-300 dark:border-neutral-700"
                      }`}
                    >
                      <div>{icon}</div>
                      <div className="mt-0.5">{label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Select Contacts from CRM ─────────────────────── */}
              {audienceType === "leads" && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Select contacts from your CRM
                  </label>
                  <LeadSelector
                    selectedLeadIds={selectedLeadIds}
                    onChange={setSelectedLeadIds}
                  />
                </div>
              )}

              {/* ── Import from File ──────────────────────────────── */}
              {audienceType === "import" && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Import contacts from Excel / CSV
                  </label>
                  <FileImportAudience onImported={handleFileImported} />
                  {selectedLeadIds.length > 0 && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-md text-sm text-green-800 dark:text-green-200">
                      ✓ {selectedLeadIds.length} contact
                      {selectedLeadIds.length !== 1 ? "s" : ""} imported and
                      selected
                    </div>
                  )}
                </div>
              )}

              {/* ── AI Filter ─────────────────────────────────────── */}
              {audienceType === "ai_filter" && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Chat with AI to find your audience
                  </label>
                  <AIAudienceChat onCommit={handleAICommit} />
                </div>
              )}

              {audienceType === "manual" && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Phone Numbers
                    <span className="text-xs text-gray-500 ml-1">
                      (one per line or comma-separated, include country code)
                    </span>
                  </label>
                  <textarea
                    value={manualPhones}
                    onChange={(e) => setManualPhones(e.target.value)}
                    rows={6}
                    placeholder={"+919876543210\n+919123456789"}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 font-mono text-sm"
                  />
                </div>
              )}

              {audienceType === "segment" && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Saved Segment
                  </label>
                  <SegmentSelector
                    selectedId={segmentId}
                    onChange={setSegmentId}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={runPreview}
                disabled={previewing}
                className="flex items-center gap-2 px-4 py-2 border border-border-color rounded-lg text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
              >
                {previewing ? "Checking…" : "🔍 Preview Audience"}
              </button>

              {preview && (
                <div className="bg-bg-secondary border border-border-color rounded-xl p-4 space-y-2">
                  <div className="text-2xl font-bold text-text-primary">
                    {preview.count.toLocaleString()} contact{preview.count !== 1 ? "s" : ""}
                  </div>
                  {preview.warnings.length > 0 && (
                    <ul className="text-xs text-amber-600 dark:text-amber-400 list-disc list-inside space-y-0.5">
                      {preview.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                  {preview.sample_leads.length > 0 && (
                    <div className="pt-1">
                      <div className="text-xs font-medium text-text-secondary mb-1">
                        Sample:
                      </div>
                      <ul className="space-y-0.5">
                        {preview.sample_leads.slice(0, 5).map((l, i) => (
                          <li key={i} className="font-mono text-xs text-text-secondary">
                            {l.name ? `${l.name} — ` : ""}
                            {l.phone}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-md"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                >
                  Next: Review →
                </button>
              </div>
            </div>
          )}

          {/* ────── STEP 3 ──────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">
                  When to Send
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={scheduleType === "now"}
                      onChange={() => setScheduleType("now")}
                    />
                    <span>Send now</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={scheduleType === "scheduled"}
                      onChange={() => setScheduleType("scheduled")}
                    />
                    <span>Schedule for later</span>
                  </label>
                  {scheduleType === "scheduled" && (
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="ml-6 px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
                    />
                  )}
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={scheduleType === "drip"}
                      onChange={() => setScheduleType("drip")}
                    />
                    <span>Drip over multiple days</span>
                  </label>
                  {scheduleType === "drip" && (
                    <div className="ml-6 space-y-2 border-l-2 border-gray-200 dark:border-neutral-700 pl-4 py-2">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Per day
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={1000}
                            value={dripPerDay}
                            onChange={(e) =>
                              setDripPerDay(Math.max(1, Number(e.target.value)))
                            }
                            className="w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Start hour
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={23}
                            value={dripStartHour}
                            onChange={(e) =>
                              setDripStartHour(
                                Math.max(
                                  0,
                                  Math.min(23, Number(e.target.value)),
                                ),
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            End hour
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={dripEndHour}
                            onChange={(e) =>
                              setDripEndHour(
                                Math.max(
                                  1,
                                  Math.min(24, Number(e.target.value)),
                                ),
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Sends up to {dripPerDay} messages per day, spread
                        between {dripStartHour}:00 and {dripEndHour}:00. Start
                        from:
                      </p>
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-sm"
                      />
                      {preview && (preview.count ?? 0) > 0 && (
                        <p className="text-xs text-gray-500">
                          Estimated duration:{" "}
                          <span className="font-medium">
                            {Math.ceil((preview.count ?? 0) / dripPerDay)}{" "}
                            day(s)
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Throttle (messages per minute)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={throttle}
                  onChange={(e) =>
                    setThrottle(
                      Math.max(1, Math.min(60, Number(e.target.value))),
                    )
                  }
                  className="px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lower values are safer for Meta rate limits.
                </p>
              </div>

              {/* Summary */}
              <div className="border border-gray-200 dark:border-neutral-800 rounded-md p-4 space-y-2 bg-gray-50 dark:bg-neutral-950">
                <h3 className="font-semibold">Campaign Summary</h3>
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Name</dt>
                    <dd>{name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Category</dt>
                    <dd className="capitalize">{category}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Template</dt>
                    <dd>{selectedTemplate?.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Recipients</dt>
                    <dd>{preview?.count ?? 0}</dd>
                  </div>
                  {costEstimate && (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Cost per message</dt>
                        <dd>{formatMoney(costEstimate.perMessage)}</dd>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <dt>Total cost</dt>
                        <dd>{formatMoney(costEstimate.total)}</dd>
                      </div>
                      <div className="flex justify-between text-xs pt-1 border-t border-gray-200 dark:border-neutral-800 mt-1">
                        <dt className="text-gray-500">Wallet balance</dt>
                        <dd>{formatMoney(wallet?.balance ?? "0")}</dd>
                      </div>
                      <div className="flex justify-between text-xs">
                        <dt className="text-gray-500">Wallet after send</dt>
                        <dd
                          className={
                            costEstimate.sufficient ? "" : "text-red-600"
                          }
                        >
                          {formatMoney(costEstimate.walletAfter)}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
                {costEstimate && !costEstimate.sufficient && (
                  <div className="bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded-md text-xs mt-2">
                    Insufficient balance. Please top up before launching.{" "}
                    <Link href="/outbound" className="underline">
                      Go to wallet →
                    </Link>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 border border-gray-300 dark:border-neutral-700 rounded-md"
                >
                  ← Back
                </button>
                <button
                  onClick={handleLaunch}
                  disabled={!canLaunch || submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                >
                  {submitting
                    ? "Launching…"
                    : scheduleType === "scheduled"
                      ? "🗓️ Schedule Campaign"
                      : repeatId
                        ? "🔁 Repeat Campaign"
                        : "🚀 Launch Campaign"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
}
