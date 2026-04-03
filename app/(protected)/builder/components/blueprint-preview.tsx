'use client';

import { useState } from 'react';
import {
  X,
  ChevronDown,
  ChevronRight,
  Database,
  GitBranch,
  Bot,
  Zap,
  Users,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface Props {
  blueprint: Record<string, unknown> | null;
  applyResult: {
    success: boolean;
    created: Record<string, number>;
    skipped: Record<string, number>;
    errors: string[];
  } | null;
  phase: string;
  onClose: () => void;
}

export default function BlueprintPreview({ blueprint, applyResult, phase, onClose }: Props) {
  const [showRawJson, setShowRawJson] = useState(false);

  // Show apply result if complete
  if (applyResult) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Setup Result
          </h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={14} />
          </button>
        </div>

        <div
          className={`rounded-lg p-3 ${
            applyResult.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {applyResult.success ? (
              <CheckCircle2 size={16} className="text-green-500" />
            ) : (
              <AlertCircle size={16} className="text-red-400" />
            )}
            <span className="text-xs font-semibold text-text-primary">
              {applyResult.success ? 'Setup Complete' : 'Setup Completed with Issues'}
            </span>
          </div>

          <div className="space-y-1">
            {Object.entries(applyResult.created)
              .filter(([, v]) => v > 0)
              .map(([key, count]) => (
                <div key={key} className="flex items-center justify-between text-xs text-text-secondary">
                  <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-medium text-text-primary">{count}</span>
                </div>
              ))}
          </div>

          {applyResult.errors.length > 0 && (
            <div className="mt-3 border-t border-border-color pt-2">
              <p className="text-xs font-medium text-red-400 mb-1">Warnings:</p>
              {applyResult.errors.slice(0, 3).map((err, i) => (
                <p key={i} className="text-xs text-text-secondary truncate">
                  {err}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show loading during generation
  if (phase === 'generating') {
    return (
      <div className="p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Generating Blueprint
        </h3>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  // No blueprint yet
  if (!blueprint) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Blueprint Preview
          </h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-text-secondary/60">
          Your blueprint will appear here once generated during the review phase.
        </p>
      </div>
    );
  }

  // Show blueprint sections
  const datasheets = (blueprint.datasheets as Array<Record<string, unknown>>) || [];
  const stages = (blueprint.pipeline_stages as Array<Record<string, unknown>>) || [];
  const agents = (blueprint.agents as Array<Record<string, unknown>>) || [];
  const automations = (blueprint.automations as Array<Record<string, unknown>>) || [];
  const roles = (blueprint.roles as Array<Record<string, unknown>>) || [];
  const workTypes = (blueprint.work_types as Array<Record<string, unknown>>) || [];
  const followups = (blueprint.followup_rules as Array<Record<string, unknown>>) || [];

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Blueprint Preview
        </h3>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
          <X size={14} />
        </button>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-2 gap-2">
        <CountBadge icon={Database} label="Datasheets" count={datasheets.length} />
        <CountBadge icon={GitBranch} label="Pipeline" count={stages.length} />
        <CountBadge icon={Bot} label="AI Agents" count={agents.length} />
        <CountBadge icon={Zap} label="Automations" count={automations.length} />
        <CountBadge icon={Users} label="Roles" count={roles.length} />
        <CountBadge icon={MessageSquare} label="Follow-ups" count={followups.length} />
      </div>

      {/* Section details */}
      {datasheets.length > 0 && (
        <CollapsibleSection title="Datasheets" icon={Database} defaultOpen>
          {datasheets.map((ds, i) => (
            <div key={i} className="text-xs text-text-secondary py-1">
              <span className="font-medium text-text-primary">
                {(ds.display_name as string) || (ds.name as string)}
              </span>
              <span className="text-text-secondary/60 ml-1">
                ({((ds.fields as unknown[]) || []).length} fields)
              </span>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {stages.length > 0 && (
        <CollapsibleSection title="Pipeline Stages" icon={GitBranch}>
          <div className="flex flex-wrap gap-1.5">
            {stages.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: ((s.color as string) || '#3B82F6') + '20',
                  color: (s.color as string) || '#3B82F6',
                }}
              >
                {s.name as string}
              </span>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {agents.length > 0 && (
        <CollapsibleSection title="AI Agents" icon={Bot}>
          {agents.map((a, i) => (
            <div key={i} className="text-xs py-1">
              <span className="font-medium text-text-primary">{a.name as string}</span>
              <span className="text-text-secondary/60 ml-1">({a.tone as string})</span>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {automations.length > 0 && (
        <CollapsibleSection title="Automations" icon={Zap}>
          {automations.map((a, i) => (
            <div key={i} className="text-xs text-text-secondary py-0.5">
              {a.name as string}
            </div>
          ))}
        </CollapsibleSection>
      )}

      {roles.length > 0 && (
        <CollapsibleSection title="Team Roles" icon={Users}>
          {roles.map((r, i) => (
            <div key={i} className="text-xs text-text-secondary py-0.5">
              {r.name as string}
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* Raw JSON toggle */}
      <div className="border-t border-border-color pt-2">
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="text-[10px] text-text-secondary/50 hover:text-text-secondary transition-colors"
        >
          {showRawJson ? 'Hide' : 'Show'} raw JSON
        </button>
        {showRawJson && (
          <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-black/20 p-2 text-[10px] text-text-secondary/70">
            {JSON.stringify(blueprint, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function CountBadge({
  icon: Icon,
  label,
  count,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
}) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5">
      <Icon size={12} className="text-text-secondary/60" />
      <div className="text-[10px]">
        <span className="font-semibold text-text-primary">{count}</span>{' '}
        <span className="text-text-secondary/60">{label}</span>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border-color overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/5 transition-colors"
      >
        <Icon size={12} className="text-text-secondary/60" />
        <span className="flex-1 text-left">{title}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && <div className="border-t border-border-color px-3 py-2">{children}</div>}
    </div>
  );
}
