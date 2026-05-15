'use client';

import { useState } from 'react';
import { X, Bot } from 'lucide-react';
import { contactGroupsService, type ContactGroup } from '@/services/contactGroups';
import type { Agent } from '@/services/agents';

const PRESET_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

interface Props {
  agents: Agent[];
  group?: ContactGroup | null;
  onClose: () => void;
  onSaved: (g: ContactGroup) => void;
}

export function CreateGroupModal({ agents, group, onClose, onSaved }: Props) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [color, setColor] = useState(group?.color ?? '#6366f1');
  const [routingMode, setRoutingMode] = useState<'ai' | 'manual'>(group?.routingMode ?? 'ai');
  const [agentId, setAgentId] = useState<number | null>(group?.aiAgentId ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Group name is required.'); return; }
    if (routingMode === 'ai' && !agentId) { setError('Select an AI agent for this group.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { name: name.trim(), description: description.trim() || undefined, color, routingMode, aiAgentId: routingMode === 'ai' ? agentId : null };
      const saved = group
        ? await contactGroupsService.update(group.id, payload)
        : await contactGroupsService.create(payload);
      onSaved(saved);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save group.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-bg-primary border border-border-color rounded-2xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
          <h2 className="text-base font-semibold text-primary-text">
            {group ? 'Edit Group' : 'Create Contact Group'}
          </h2>
          <button onClick={onClose} className="text-secondary-text hover:text-primary-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Color + Name row */}
          <div>
            <label className="block text-xs font-medium text-secondary-text mb-1.5">Group Name</label>
            <div className="flex items-center gap-2">
              {/* Color dot picker */}
              <div className="relative group/color">
                <div className="w-8 h-8 rounded-lg border border-border-color cursor-pointer flex-shrink-0" style={{ backgroundColor: color }} />
                <div className="absolute top-full left-0 mt-1 z-10 hidden group-hover/color:flex flex-wrap gap-1.5 p-2 bg-bg-primary border border-border-color rounded-xl shadow-lg w-48">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${color === c ? 'border-primary-text' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Suppliers, VIP Clients, Family"
                className="flex-1 px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-accent/30 text-primary-text"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-secondary-text mb-1.5">Description <span className="text-secondary-text/60">(optional)</span></label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this group for?"
              className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-accent/30 text-primary-text"
            />
          </div>

          {/* Routing mode */}
          <div>
            <label className="block text-xs font-medium text-secondary-text mb-1.5">How to handle messages from this group</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setRoutingMode('ai')}
                className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg border text-left transition-colors ${routingMode === 'ai' ? 'border-accent bg-accent/5 text-accent' : 'border-border-color text-primary-text hover:bg-bg-secondary'}`}
              >
                <span className="text-xs font-semibold">AI Agent</span>
                <span className="text-xs text-secondary-text">Agent replies automatically</span>
              </button>
              <button
                onClick={() => setRoutingMode('manual')}
                className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg border text-left transition-colors ${routingMode === 'manual' ? 'border-accent bg-accent/5 text-accent' : 'border-border-color text-primary-text hover:bg-bg-secondary'}`}
              >
                <span className="text-xs font-semibold">Manual</span>
                <span className="text-xs text-secondary-text">Goes to your inbox only</span>
              </button>
            </div>
          </div>

          {/* Agent picker */}
          {routingMode === 'ai' && (
            <div>
              <label className="block text-xs font-medium text-secondary-text mb-1.5">Assign AI Agent</label>
              <select
                value={agentId ?? ''}
                onChange={e => setAgentId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 text-sm border border-border-color rounded-lg bg-bg-secondary text-primary-text focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="">Select agent…</option>
                {agents.filter(a => a.status === 'active').map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <p className="text-xs text-secondary-text mt-1.5 flex items-center gap-1">
                <Bot className="w-3 h-3" />
                All messages from group members will go to this agent, overriding individual settings.
              </p>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border-color">
          <button onClick={onClose} className="px-4 py-2 text-sm text-secondary-text hover:text-primary-text">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving…' : group ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
