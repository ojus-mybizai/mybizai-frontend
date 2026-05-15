'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Users, Bot, Pencil, Trash2, Loader2, FileSpreadsheet, UserCheck, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { contactGroupsService, type ContactGroup } from '@/services/contactGroups';
import { contactsService } from '@/services/contacts';
import { gmailIntegrationService } from '@/services/gmailIntegration';
import { CreateGroupModal } from './create-group-modal';
import type { Agent } from '@/services/agents';
import type { Contact } from '@/services/contacts';

interface Props {
  agents: Agent[];
  contacts: Contact[];
  onGroupsChanged: () => void;
  selectedGroupId: number | null;
  onSelectGroup: (id: number, name?: string) => void;
}

export function GroupsPanel({ agents, contacts, onGroupsChanged, selectedGroupId, onSelectGroup }: Props) {
  const [groups,       setGroups]       = useState<ContactGroup[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showCreate,   setShowCreate]   = useState(false);
  const [editGroup,    setEditGroup]    = useState<ContactGroup | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailBusy,    setGmailBusy]    = useState<number | null>(null);
  const [xlsxBusy,     setXlsxBusy]    = useState<number | null>(null);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const xlsxInputRef   = useRef<HTMLInputElement>(null);
  const pendingGroupRef = useRef<number | null>(null);

  const load = async () => {
    try {
      const [g, gs] = await Promise.all([
        contactGroupsService.list(),
        gmailIntegrationService.getStatus().catch(() => null),
      ]);
      setGroups(g);
      setGmailConnected(gs?.connected ?? false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleDelete = async (g: ContactGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${g.name}"? Contacts will not be deleted.`)) return;
    await contactGroupsService.delete(g.id);
    setGroups(prev => prev.filter(x => x.id !== g.id));
    if (selectedGroupId === g.id) onSelectGroup(g.id); // deselect
  };

  const handleGmailImport = async (g: ContactGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionMenuId(null);
    setGmailBusy(g.id);
    try {
      if (!gmailConnected) {
        const { authUrl } = await gmailIntegrationService.getAuthUrl();
        window.location.href = authUrl;
        return;
      }
      await gmailIntegrationService.sync(g.id);
      await load();
      onGroupsChanged();
    } catch { /* silently ignore */ } finally {
      setGmailBusy(null);
    }
  };

  const handleXlsxClick = (g: ContactGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionMenuId(null);
    pendingGroupRef.current = g.id;
    xlsxInputRef.current?.click();
  };

  const handleXlsxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const groupId = pendingGroupRef.current;
    if (!file || !groupId) return;
    setXlsxBusy(groupId);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const createdIds: number[] = [];
        for (const row of rows) {
          const name  = row['Name'] ?? row['name'] ?? '';
          const phone = row['Phone'] ?? row['phone'] ?? row['Mobile'] ?? row['mobile'] ?? '';
          const email = row['Email'] ?? row['email'] ?? '';
          if (!name && !phone) continue;
          try {
            const c = await contactsService.create({ name, phone, email, routing_mode: 'manual' });
            createdIds.push(c.id);
          } catch { /* skip duplicates */ }
        }
        if (createdIds.length) await contactGroupsService.addMembers(groupId, createdIds);
        await load();
        onGroupsChanged();
      } finally {
        setXlsxBusy(null);
        pendingGroupRef.current = null;
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  if (loading) return null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-secondary-text uppercase tracking-wide">Groups</span>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleXlsxFile} />

      {/* All contacts option */}
      <button
        onClick={() => selectedGroupId !== null && onSelectGroup(selectedGroupId)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
          selectedGroupId === null
            ? 'bg-accent/10 text-accent font-medium'
            : 'text-secondary-text hover:bg-bg-secondary hover:text-primary-text'
        }`}
      >
        <Users className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">All Contacts</span>
      </button>

      {/* Group list */}
      {groups.length === 0 ? (
        <p className="text-xs text-secondary-text text-center py-4 px-2">
          No groups yet. Create one to organize contacts.
        </p>
      ) : (
        <div className="space-y-0.5">
          {groups.map(g => {
            const isActive = selectedGroupId === g.id;
            const isBusy = gmailBusy === g.id || xlsxBusy === g.id;
            return (
              <div key={g.id} className="relative group/row">
                <button
                  onClick={() => onSelectGroup(g.id, g.name)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-primary-text hover:bg-bg-secondary'
                  }`}
                >
                  {/* Color dot */}
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: g.color ?? '#6366f1' }}
                  />
                  <span className="flex-1 text-left truncate">{g.name}</span>

                  {/* Member count */}
                  <span className={`text-xs flex-shrink-0 ${isActive ? 'text-accent/70' : 'text-secondary-text'}`}>
                    {g.memberCount}
                  </span>

                  {/* Active check */}
                  {isActive && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>

                {/* Hover actions */}
                <div className={`absolute right-1 top-1/2 -translate-y-1/2 items-center gap-0.5 ${isActive ? 'hidden' : 'hidden group-hover/row:flex'}`}>
                  {/* Import Google */}
                  <button
                    onClick={(e) => handleGmailImport(g, e)}
                    disabled={isBusy}
                    title={gmailConnected ? 'Sync Google into group' : 'Connect Google first'}
                    className="p-1 rounded hover:bg-bg-primary text-secondary-text hover:text-primary-text disabled:opacity-40"
                  >
                    {gmailBusy === g.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    )}
                  </button>
                  {/* Import Excel */}
                  <button
                    onClick={(e) => handleXlsxClick(g, e)}
                    disabled={isBusy}
                    title="Import Excel into group"
                    className="p-1 rounded hover:bg-bg-primary text-secondary-text hover:text-primary-text disabled:opacity-40"
                  >
                    {xlsxBusy === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                  </button>
                  {/* Edit */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditGroup(g); }}
                    title="Edit group"
                    className="p-1 rounded hover:bg-bg-primary text-secondary-text hover:text-primary-text"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {/* Delete */}
                  <button
                    onClick={(e) => handleDelete(g, e)}
                    title="Delete group"
                    className="p-1 rounded hover:bg-bg-primary text-secondary-text hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Agent summary per group (when a group is selected) */}
      {selectedGroupId !== null && (() => {
        const g = groups.find(x => x.id === selectedGroupId);
        if (!g) return null;
        return (
          <div className="mt-4 p-3 rounded-lg bg-bg-secondary border border-border-color">
            <p className="text-xs font-semibold text-primary-text mb-1">{g.name}</p>
            {g.description && <p className="text-xs text-secondary-text mb-2">{g.description}</p>}
            <div className="flex items-center gap-1.5 text-xs">
              {g.routingMode === 'ai' && g.agentName ? (
                <>
                  <Bot className="w-3.5 h-3.5 text-accent" />
                  <span className="text-accent font-medium">{g.agentName}</span>
                </>
              ) : g.routingMode === 'manual' ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-amber-700">Manual inbox</span>
                </>
              ) : (
                <span className="text-secondary-text">No agent assigned</span>
              )}
            </div>
            <p className="text-xs text-secondary-text mt-1">{g.memberCount} member{g.memberCount !== 1 ? 's' : ''}</p>
          </div>
        );
      })()}

      {/* Modals */}
      {(showCreate || editGroup) && (
        <CreateGroupModal
          agents={agents}
          group={editGroup}
          onClose={() => { setShowCreate(false); setEditGroup(null); }}
          onSaved={saved => {
            setShowCreate(false);
            setEditGroup(null);
            setGroups(prev => {
              const exists = prev.find(g => g.id === saved.id);
              return exists
                ? prev.map(g => g.id === saved.id ? { ...g, ...saved } : g)
                : [saved, ...prev];
            });
            onGroupsChanged();
          }}
        />
      )}
    </div>
  );
}
