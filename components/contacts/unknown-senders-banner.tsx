'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, UserPlus, UserCheck, Ban, X, Bot } from 'lucide-react';
import { unknownSendersService, type UnknownSender, type RoutingMode } from '@/services/contacts';
import type { Agent } from '@/services/agents';

interface Props {
  onResolved: () => void;
  agents: Agent[];
}

export function UnknownSendersBanner({ onResolved, agents }: Props) {
  const [count, setCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [senders, setSenders] = useState<UnknownSender[]>([]);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [contactModal, setContactModal] = useState<{ sender: UnknownSender } | null>(null);

  const loadCount = useCallback(async () => {
    const c = await unknownSendersService.count();
    setCount(c);
  }, []);

  const loadSenders = useCallback(async () => {
    setLoadingSenders(true);
    try {
      const data = await unknownSendersService.list({ limit: 50 });
      setSenders(data);
    } finally {
      setLoadingSenders(false);
    }
  }, []);

  useEffect(() => { void loadCount(); }, [loadCount]);

  const handleExpand = () => {
    setExpanded(e => !e);
    if (!expanded) void loadSenders();
  };

  const resolve = async (sender: UnknownSender, action: 'add_as_lead' | 'block' | 'ignore') => {
    setResolvingId(sender.id);
    try {
      await unknownSendersService.resolve(sender.id, { action });
      setSenders(prev => prev.filter(s => s.id !== sender.id));
      setCount(c => Math.max(0, c - 1));
      onResolved();
    } finally {
      setResolvingId(null);
    }
  };

  const handleAddAsContact = async (sender: UnknownSender, routingMode: RoutingMode, agentId?: number | null, name?: string) => {
    setResolvingId(sender.id);
    try {
      await unknownSendersService.resolve(sender.id, {
        action: 'add_as_contact',
        name,
        routingMode,
        aiAgentId: agentId,
      });
      setSenders(prev => prev.filter(s => s.id !== sender.id));
      setCount(c => Math.max(0, c - 1));
      setContactModal(null);
      onResolved();
    } finally {
      setResolvingId(null);
    }
  };

  if (count === 0) return null;

  return (
    <div className="border-b border-yellow-200 bg-yellow-50">
      {/* Banner row */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-yellow-100/60 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
        <span className="text-sm font-medium text-yellow-800">
          {count} message{count !== 1 ? 's' : ''} from unknown senders waiting for review
        </span>
        <span className="ml-auto text-yellow-600">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {/* Expanded sender list */}
      {expanded && (
        <div className="px-6 pb-4 space-y-2">
          {loadingSenders ? (
            <p className="text-sm text-yellow-700 py-2">Loading…</p>
          ) : senders.length === 0 ? (
            <p className="text-sm text-yellow-700 py-2">All resolved.</p>
          ) : (
            senders.map(sender => (
              <SenderRow
                key={sender.id}
                sender={sender}
                agents={agents}
                resolving={resolvingId === sender.id}
                onAddAsLead={() => resolve(sender, 'add_as_lead')}
                onAddAsContact={() => setContactModal({ sender })}
                onBlock={() => resolve(sender, 'block')}
                onIgnore={() => resolve(sender, 'ignore')}
              />
            ))
          )}
        </div>
      )}

      {/* Add as contact modal */}
      {contactModal && (
        <AddAsContactModal
          sender={contactModal.sender}
          agents={agents}
          onConfirm={(mode, agentId, name) => handleAddAsContact(contactModal.sender, mode, agentId, name)}
          onClose={() => setContactModal(null)}
        />
      )}
    </div>
  );
}

function SenderRow({
  sender,
  agents,
  resolving,
  onAddAsLead,
  onAddAsContact,
  onBlock,
  onIgnore,
}: {
  sender: UnknownSender;
  agents: Agent[];
  resolving: boolean;
  onAddAsLead: () => void;
  onAddAsContact: () => void;
  onBlock: () => void;
  onIgnore: () => void;
}) {
  const label = sender.displayName
    ? `${sender.displayName} (${sender.senderId})`
    : sender.senderId;

  return (
    <div className="flex items-start gap-3 bg-white border border-yellow-200 rounded-lg p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary-text truncate">{label}</p>
        {sender.firstMessage && (
          <p className="text-xs text-secondary-text truncate mt-0.5">"{sender.firstMessage}"</p>
        )}
        <p className="text-xs text-secondary-text/60 mt-0.5 capitalize">{sender.channelType}</p>
      </div>
      {resolving ? (
        <span className="text-xs text-secondary-text">Saving…</span>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onAddAsLead}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 font-medium"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add as Lead
          </button>
          <button
            onClick={onAddAsContact}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-border-color text-primary-text rounded-lg hover:bg-bg-secondary"
          >
            <UserCheck className="w-3.5 h-3.5" /> Save as Contact
          </button>
          <button
            onClick={onBlock}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
          >
            <Ban className="w-3.5 h-3.5" /> Block
          </button>
          <button
            onClick={onIgnore}
            className="p-1.5 text-secondary-text hover:bg-bg-secondary rounded-lg"
            title="Ignore"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function AddAsContactModal({
  sender,
  agents,
  onConfirm,
  onClose,
}: {
  sender: UnknownSender;
  agents: Agent[];
  onConfirm: (mode: RoutingMode, agentId: number | null, name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(sender.displayName ?? '');
  const [mode, setMode] = useState<RoutingMode>('manual');
  const [agentId, setAgentId] = useState<number | null>(null);
  const activeAgents = agents.filter(a => a.status === 'active');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-bg-primary border border-border-color rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
        <h2 className="text-base font-semibold text-primary-text mb-1">Save as Contact</h2>
        <p className="text-sm text-secondary-text mb-4">{sender.senderId}</p>

        <label className="block text-xs font-medium text-secondary-text mb-1">Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Contact name"
          className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-secondary text-primary-text mb-4 focus:outline-none focus:ring-2 focus:ring-accent/30"
        />

        <label className="block text-xs font-medium text-secondary-text mb-1">When they message you</label>
        <div className="flex gap-2 mb-4">
          {(['manual', 'ai'] as RoutingMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${mode === m ? 'border-accent bg-accent/5 text-accent font-medium' : 'border-border-color text-primary-text hover:bg-bg-secondary'}`}
            >
              {m === 'manual' ? 'Manual (you reply)' : 'AI Agent'}
            </button>
          ))}
        </div>

        {mode === 'ai' && activeAgents.length > 0 && (
          <>
            <label className="block text-xs font-medium text-secondary-text mb-1">Assign Agent</label>
            <select
              value={agentId ?? ''}
              onChange={e => setAgentId(Number(e.target.value) || null)}
              className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-secondary text-primary-text mb-4 focus:outline-none"
            >
              <option value="">Select an agent…</option>
              {activeAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </>
        )}

        <div className="flex gap-3 mt-2">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-border-color rounded-lg text-primary-text hover:bg-bg-secondary">Cancel</button>
          <button
            onClick={() => onConfirm(mode, mode === 'ai' ? agentId : null, name)}
            className="flex-1 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 font-medium"
          >
            Save Contact
          </button>
        </div>
      </div>
    </div>
  );
}
