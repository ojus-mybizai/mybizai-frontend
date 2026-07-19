'use client';

import { useEffect, useState } from 'react';
import {
  Bot, UserCheck, Ban, ChevronDown, Layers, MessageSquare,
  RefreshCw, Check, Loader2,
} from 'lucide-react';
import {
  contactsService,
  updateLeadRouting,
  getLeadChannels,
  updateLeadChannelRouting,
  type RoutingMode,
  type ContactChannelConfig,
} from '@/services/contacts';
import type { Agent } from '@/services/agents';

// ── Shared constants ───────────────────────────────────────────

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp:  '📱',
  instagram: '📸',
  messenger: '💬',
  telegram:  '✈️',
  webchat:   '🌐',
};

const ROUTING_LABELS: Record<RoutingMode, string> = {
  ai: 'AI Agent', manual: 'Manual', blocked: 'Blocked',
};

const ROUTING_COLORS: Record<RoutingMode, string> = {
  ai:      'text-green-800 bg-green-50 border-green-300',
  manual:  'text-amber-800 bg-amber-50 border-amber-300',
  blocked: 'text-red-600  bg-red-50   border-red-300',
};

function RoutingIcon({ mode }: { mode: RoutingMode }) {
  if (mode === 'ai')      return <Bot       className="w-3.5 h-3.5" />;
  if (mode === 'blocked') return <Ban       className="w-3.5 h-3.5" />;
  return                         <UserCheck className="w-3.5 h-3.5" />;
}

// ── Props ──────────────────────────────────────────────────────

interface Props {
  leadId: number;
  ownerType?: 'contact' | 'lead';    // which set of endpoints to use
  ownerLabel?: string;               // display label: "Contact" | "Lead" | custom type name
  currentRoutingMode: RoutingMode;
  currentAgentId: number | null;
  agents: Agent[];
  onUpdated?: (routingMode: RoutingMode, agentId: number | null) => void;
}

// ── Main widget ────────────────────────────────────────────────

export function LeadRoutingWidget({
  leadId, ownerType = 'contact', ownerLabel = 'Contact',
  currentRoutingMode, currentAgentId, agents, onUpdated,
}: Props) {
  const [mode,    setMode]    = useState<RoutingMode>(currentRoutingMode);
  const [agentId, setAgentId] = useState<number | null>(currentAgentId);
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);
  const [open,    setOpen]    = useState(false);

  // Per-channel state
  const [channels,        setChannels]        = useState<ContactChannelConfig[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [updatingCh,      setUpdatingCh]      = useState<number | null>(null);

  const activeAgents = agents.filter(a => a.status === 'active');

  // Load per-channel configs on mount
  useEffect(() => {
    setChannelsLoading(true);
    const fetchFn = ownerType === 'lead'
      ? getLeadChannels(leadId)
      : contactsService.getChannels(leadId);
    fetchFn
      .then(setChannels)
      .catch(() => setChannels([]))
      .finally(() => setChannelsLoading(false));
  }, [leadId, ownerType]);

  // ── Apply-to-all save ────────────────────────────────────────
  const handleModeChange = (m: RoutingMode) => {
    setMode(m);
    if (m !== 'ai') setAgentId(null);
    setDirty(true);
    setOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateLeadRouting(leadId, mode, agentId);
      // Refresh channel list so per-channel rows reflect the new values
      const fetchFn = ownerType === 'lead'
        ? getLeadChannels(leadId)
        : contactsService.getChannels(leadId);
      setChannels(await fetchFn);
      setDirty(false);
      onUpdated?.(mode, agentId);
    } finally {
      setSaving(false);
    }
  };

  // ── Per-channel routing update ───────────────────────────────
  const handleChannelRouting = async (
    ch: ContactChannelConfig,
    newMode: RoutingMode | null,
    newAgentId?: number | null,
  ) => {
    setUpdatingCh(ch.channelId);
    try {
      if (ownerType === 'lead') {
        await updateLeadChannelRouting(leadId, ch.channelId, newMode, newAgentId);
      } else {
        await contactsService.updateChannelRouting(leadId, ch.channelId, newMode, newAgentId);
      }
      setChannels(prev => prev.map(c =>
        c.channelId === ch.channelId
          ? {
              ...c,
              routingMode: newMode,
              agentId: newMode === 'ai' ? (newAgentId ?? null) : null,
              agentName: newMode === 'ai'
                ? (agents.find(a => a.id === String(newAgentId))?.name ?? null)
                : null,
            }
          : c
      ));
    } finally {
      setUpdatingCh(null);
    }
  };

  return (
    <div className="border border-border-color rounded-xl overflow-hidden bg-bg-secondary/30">

      {/* ── Per-channel routing section ────────────────────── */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-3.5 h-3.5 text-secondary-text" />
          <p className="text-xs font-semibold text-secondary-text uppercase tracking-wide">
            Per-Channel Routing
          </p>
        </div>
        <p className="text-xs text-secondary-text mb-3 ml-5">
          Each channel routes independently. Unset channels use their channel&apos;s default AI agent.
        </p>

        {channelsLoading ? (
          <div className="flex items-center justify-center py-5">
            <Loader2 className="w-4 h-4 animate-spin text-secondary-text" />
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-5 text-center">
            <MessageSquare className="w-6 h-6 text-secondary-text/30" />
            <p className="text-xs text-secondary-text">
              No channel activity yet. Per-channel settings appear once this{' '}
              {ownerLabel.toLowerCase()} sends a message.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {channels.map(ch => (
              <ChannelRow
                key={ch.channelId}
                ch={ch}
                agents={activeAgents}
                updating={updatingCh === ch.channelId}
                onChange={handleChannelRouting}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Apply to all channels section ──────────────────── */}
      <div className="px-4 pt-3 pb-4 border-t border-border-color">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="w-3.5 h-3.5 text-secondary-text" />
          <p className="text-xs font-semibold text-secondary-text uppercase tracking-wide">
            Apply to All Channels
          </p>
          <span className="ml-auto text-xs text-secondary-text capitalize bg-bg-secondary px-2 py-0.5 rounded-full border border-border-color">
            {ownerLabel}
          </span>
        </div>
        <p className="text-xs text-secondary-text mb-3 ml-5">
          Set the same routing on every channel at once.
        </p>

        {/* Mode dropdown */}
        <div className="relative mb-2">
          <button
            onClick={() => setOpen(o => !o)}
            className={`w-full flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${ROUTING_COLORS[mode]}`}
          >
            <RoutingIcon mode={mode} />
            <span className="flex-1 text-left">{ROUTING_LABELS[mode]}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-bg-primary border border-border-color rounded-lg shadow-lg overflow-hidden">
                {(['ai', 'manual', 'blocked'] as RoutingMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => handleModeChange(m)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-bg-secondary transition-colors ${mode === m ? 'bg-bg-secondary font-semibold text-accent' : 'text-primary-text'}`}
                  >
                    <RoutingIcon mode={m} />
                    {ROUTING_LABELS[m]}
                    {mode === m && <Check className="w-3.5 h-3.5 ml-auto" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Agent picker — only for AI mode */}
        {mode === 'ai' && (
          <div className="mb-2">
            <label className="block text-xs text-secondary-text mb-1">Agent</label>
            {activeAgents.length === 0 ? (
              <p className="text-xs text-secondary-text">No active agents available.</p>
            ) : (
              <select
                value={agentId ?? ''}
                onChange={e => { setAgentId(Number(e.target.value) || null); setDirty(true); }}
                className="w-full px-2.5 py-1.5 text-sm border border-border-color rounded-lg bg-bg-secondary text-primary-text focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="">Channel default</option>
                {activeAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Apply button */}
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 font-medium disabled:opacity-60 transition-colors"
          >
            {saving ? 'Applying…' : 'Apply to All Channels'}
          </button>
        )}
      </div>
    </div>
  );
}


// ── Per-channel row ────────────────────────────────────────────

function ChannelRow({
  ch, agents, updating, onChange,
}: {
  ch: ContactChannelConfig;
  agents: Agent[];
  updating: boolean;
  onChange: (ch: ContactChannelConfig, mode: RoutingMode | null, agentId?: number | null) => void;
}) {
  const [open,      setOpen]      = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  // null = channel default (AI with channel's configured agent)
  const effectiveMode = ch.routingMode ?? 'ai';
  const isDefault     = ch.routingMode === null;

  const handleMode = (m: RoutingMode | 'default') => {
    setOpen(false);
    if (m === 'default') {
      onChange(ch, null);        // clear override → channel default AI
    } else if (m === 'ai') {
      setAgentOpen(true);
    } else {
      onChange(ch, m, null);
    }
  };

  // Which agent name to show
  const agentDisplay = ch.agentId
    ? (ch.agentName ?? `Agent #${ch.agentId}`)
    : ch.channelDefaultAgentName ?? null;

  return (
    <div className="rounded-lg border border-border-color bg-bg-secondary/40 p-2.5">
      {/* Channel header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm leading-none">{CHANNEL_ICONS[ch.channelType] ?? '📡'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-primary-text truncate">{ch.channelName}</p>
          <p className="text-xs text-secondary-text truncate">{ch.channelIdentifier}</p>
        </div>
        {updating && <Loader2 className="w-3.5 h-3.5 animate-spin text-secondary-text flex-shrink-0" />}
      </div>

      {/* Routing pill + dropdown */}
      <div className="relative flex items-center gap-2 flex-wrap">
        <button
          disabled={updating}
          onClick={() => setOpen(o => !o)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors
            ${ROUTING_COLORS[effectiveMode]}
            ${isDefault ? 'opacity-70 border-dashed' : ''}
            ${updating ? 'cursor-wait' : 'hover:opacity-80'}`}
        >
          <RoutingIcon mode={effectiveMode} />
          {isDefault ? 'Channel default' : ROUTING_LABELS[effectiveMode]}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        {/* Agent name */}
        {effectiveMode === 'ai' && (
          <span className="text-xs text-secondary-text truncate max-w-[120px]">
            {agentDisplay
              ? agentDisplay
              : <span className="italic text-amber-600">No agent set</span>
            }
          </span>
        )}

        {/* Mode dropdown */}
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full mt-1 z-30 bg-bg-primary border border-border-color rounded-xl shadow-lg py-1.5 min-w-52">
              {/* Clear override → channel default */}
              <button
                onClick={() => handleMode('default')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-bg-secondary transition-colors ${isDefault ? 'font-semibold text-accent' : 'text-primary-text'}`}
              >
                <RefreshCw className="w-3.5 h-3.5 text-secondary-text" />
                Channel default (AI)
                {isDefault && <Check className="w-3.5 h-3.5 ml-auto" />}
              </button>
              <div className="border-t border-border-color my-1" />
              {(['ai', 'manual', 'blocked'] as RoutingMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => handleMode(m)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-bg-secondary transition-colors ${!isDefault && ch.routingMode === m ? 'font-semibold text-accent' : 'text-primary-text'}`}
                >
                  <RoutingIcon mode={m} />
                  {ROUTING_LABELS[m]}
                  {!isDefault && ch.routingMode === m && <Check className="w-3.5 h-3.5 ml-auto" />}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Agent picker */}
        {agentOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setAgentOpen(false)} />
            <div className="absolute left-0 top-full mt-1 z-30 bg-bg-primary border border-border-color rounded-xl shadow-lg py-1.5 min-w-52 max-h-48 overflow-y-auto">
              <p className="px-3.5 py-2 text-xs text-secondary-text font-semibold uppercase tracking-wide border-b border-border-color">
                Assign agent for this channel
              </p>
              {agents.length === 0
                ? <p className="px-3.5 py-3 text-xs text-secondary-text">No active agents</p>
                : agents.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { setAgentOpen(false); onChange(ch, 'ai', Number(a.id)); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-primary-text hover:bg-bg-secondary text-left transition-colors"
                  >
                    <Bot className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                    {a.name}
                    {ch.agentId === Number(a.id) && <Check className="w-3.5 h-3.5 ml-auto text-accent" />}
                  </button>
                ))
              }
              <button
                onClick={() => setAgentOpen(false)}
                className="w-full px-3.5 py-2 text-xs text-secondary-text hover:bg-bg-secondary text-left border-t border-border-color"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
