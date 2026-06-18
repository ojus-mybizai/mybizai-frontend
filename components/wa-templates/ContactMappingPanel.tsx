'use client';

import { useEffect, useState } from 'react';
import { UserPlus, AlertTriangle } from 'lucide-react';
import { contactGroupsService, type ContactGroup } from '@/services/contactGroups';
import { listProcesses, type BusinessProcessListItem } from '@/services/processes';
import {
  getContactFieldTargets,
  type ContactFieldMap,
  type ContactFieldTarget,
  type ContactTarget,
} from '@/services/waTemplates';
import type { FormBuilderField } from '@/components/wa-templates/DatasheetMappingPanel';

interface Props {
  flowFields: FormBuilderField[];
  groupId: number | null;
  processId: number | null;
  pipelineInForm: boolean;
  mapping: ContactFieldMap | null;
  onChange: (next: {
    groupId: number | null;
    processId: number | null;
    pipelineInForm: boolean;
    mapping: ContactFieldMap | null;
  }) => void;
}

// Encode a select option value as "attribute:name" or "custom:<defId>".
function targetValue(t: ContactFieldTarget): string {
  return t.kind === 'custom' ? `custom:${t.custom_field_def_id}` : `attribute:${t.target}`;
}

export default function ContactMappingPanel({
  flowFields, groupId, processId, pipelineInForm, mapping, onChange,
}: Props) {
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [processes, setProcesses] = useState<BusinessProcessListItem[]>([]);
  const [core, setCore] = useState<ContactFieldTarget[]>([]);
  const [custom, setCustom] = useState<ContactFieldTarget[]>([]);
  const [loading, setLoading] = useState(false);

  // Groups + processes load once.
  useEffect(() => {
    contactGroupsService.list().then(setGroups).catch(() => {});
    listProcesses('active').then(setProcesses).catch(() => {});
  }, []);

  // Mappable targets reload when the group changes (group-scoped custom fields).
  useEffect(() => {
    setLoading(true);
    getContactFieldTargets(groupId ?? undefined)
      .then((r) => { setCore(r.core); setCustom(r.custom); })
      .catch(() => { setCore([]); setCustom([]); })
      .finally(() => setLoading(false));
  }, [groupId]);

  const mappings = mapping?.mappings ?? [];

  function currentValueFor(fieldName: string): string {
    const m = mappings.find((x) => x.flow_field_name === fieldName);
    if (!m) return '';
    return m.target === 'custom' ? `custom:${m.custom_field_def_id}` : `attribute:${m.target}`;
  }

  function setMappingFor(fieldName: string, value: string) {
    const next = mappings.filter((m) => m.flow_field_name !== fieldName);
    if (value) {
      const [kind, rest] = value.split(':');
      if (kind === 'custom') {
        next.push({ flow_field_name: fieldName, target: 'custom', custom_field_def_id: Number(rest) });
      } else {
        next.push({ flow_field_name: fieldName, target: rest as ContactTarget });
      }
    }
    onChange({ groupId, processId, pipelineInForm, mapping: { version: 1, mappings: next } });
  }

  return (
    <div className="border border-border-color rounded-xl bg-card-bg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-accent" />
        <span className="font-medium text-sm text-text-primary">Save submissions as a Contact</span>
      </div>

      {/* Group + pipeline */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Add to group</label>
          <select
            value={groupId ?? ''}
            onChange={(e) => onChange({ groupId: e.target.value ? Number(e.target.value) : null, processId, pipelineInForm, mapping })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">— No group —</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <p className="text-[11px] text-text-secondary mt-1">Determines which group custom fields you can map below.</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-text-secondary">Add to pipeline</label>
            <label className="inline-flex items-center gap-1 text-[11px] text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={pipelineInForm}
                onChange={(e) => onChange({ groupId, processId, pipelineInForm: e.target.checked, mapping })}
                className="accent-accent"
              />
              Staff picks on form
            </label>
          </div>
          <select
            value={processId ?? ''}
            disabled={pipelineInForm}
            onChange={(e) => onChange({ groupId, processId: e.target.value ? Number(e.target.value) : null, pipelineInForm, mapping })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
          >
            <option value="">— No pipeline —</option>
            {processes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <p className="text-[11px] text-text-secondary mt-1">
            {pipelineInForm
              ? 'A pipeline dropdown is added to the form for staff to choose.'
              : 'New contacts enter the chosen pipeline at its first stage.'}
          </p>
        </div>
      </div>

      {/* Field mapping */}
      <div>
        <div className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-2">
          Map form fields → contact fields
        </div>
        {flowFields.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-text-secondary bg-bg-secondary rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Add form fields above first, then map them here.
          </div>
        ) : (
          <div className="space-y-2">
            {flowFields.map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate text-sm text-text-primary">
                  {f.label || f.name}
                  {f.required && <span className="text-red-500 ml-0.5">*</span>}
                </span>
                <span className="text-text-secondary text-xs">→</span>
                <select
                  value={currentValueFor(f.name)}
                  onChange={(e) => setMappingFor(f.name, e.target.value)}
                  disabled={loading}
                  className="w-48 px-2 py-1.5 text-sm rounded-lg border border-border-color bg-bg-secondary text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">— Don&apos;t save —</option>
                  <optgroup label="Contact fields">
                    {core.map((t) => (
                      <option key={t.target} value={targetValue(t)}>{t.label}</option>
                    ))}
                  </optgroup>
                  {custom.length > 0 && (
                    <optgroup label="Custom fields">
                      {custom.map((t) => (
                        <option key={`c-${t.custom_field_def_id}`} value={targetValue(t)}>
                          {t.label}{t.group_id ? ' (group)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-text-secondary mt-2">
          At least map a field to <strong>Phone</strong> or <strong>Name</strong> so the contact can be created.
        </p>
      </div>
    </div>
  );
}
