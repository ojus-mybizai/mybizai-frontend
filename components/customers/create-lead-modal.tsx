'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreateLeadForm } from './create-lead-form';
import { createLead, updateLead } from '@/services/customers';
import type { LeadCreate, LeadUpdate } from '@/services/customers';
import { checkDuplicateLead } from '@/services/lead-import';
import type { DuplicateCheckResponse, DuplicateInfo, OnDuplicate } from '@/services/lead-import';
import { createLeadEntityLink, type LeadFieldConfig } from '@/services/lead-fields';
import { type RelationValue, RELATION_ENTITY_TYPE_MAP } from './dynamic-lead-fields-input';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  fieldConfigs?: LeadFieldConfig[];
}

// ─── Duplicate Action Dialog ──────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  OnDuplicate,
  { label: string; description: string; btnClass: string }
> = {
  skip: {
    label: 'View existing lead',
    description: 'Go to the existing lead instead of creating a duplicate.',
    btnClass: 'border border-border-color bg-bg-secondary hover:bg-card-bg text-text-primary',
  },
  update: {
    label: 'Update existing lead',
    description: 'Overwrite the existing lead with the data you just entered.',
    btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  create_anyway: {
    label: 'Create anyway',
    description: 'Create a new lead even though a similar one already exists.',
    btnClass: 'bg-accent hover:bg-accent/90 text-white',
  },
};

function DuplicateDialog({
  info,
  defaultAction,
  pendingData,
  onAction,
  onCancel,
  loading,
}: {
  info: DuplicateInfo;
  defaultAction: OnDuplicate;
  pendingData: LeadCreate;
  onAction: (action: OnDuplicate) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<OnDuplicate>(defaultAction);

  const matchedOn = info.matched_field.charAt(0).toUpperCase() + info.matched_field.slice(1);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border-color bg-card-bg p-6 m-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
            <svg className="h-5 w-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Possible Duplicate</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              A lead with the same <strong>{matchedOn.toLowerCase()}</strong> already exists.
            </p>
          </div>
        </div>

        {/* Existing lead card */}
        <div className="rounded-xl border border-border-color bg-bg-secondary p-3 mb-4 space-y-1.5 text-xs">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary mb-2">Existing lead</p>
          {info.name && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Name</span>
              <span className="font-medium text-text-primary">{info.name}</span>
            </div>
          )}
          {info.phone && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Phone</span>
              <span className="font-medium text-text-primary">{info.phone}</span>
            </div>
          )}
          {info.email && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Email</span>
              <span className="font-medium text-text-primary">{info.email}</span>
            </div>
          )}
          {info.assigned_to_name && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Assigned to</span>
              <span className="font-medium text-text-primary">{info.assigned_to_name}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border-color pt-1.5 mt-1.5">
            <span className="text-text-secondary">Matched by</span>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
              {matchedOn}
            </span>
          </div>
        </div>

        {/* Action selector */}
        <p className="text-xs font-medium text-text-primary mb-2">What would you like to do?</p>
        <div className="space-y-2 mb-5">
          {(Object.entries(ACTION_CONFIG) as [OnDuplicate, typeof ACTION_CONFIG[OnDuplicate]][]).map(
            ([action, cfg]) => (
              <label
                key={action}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors ${
                  selected === action
                    ? 'border-accent bg-accent/5'
                    : 'border-border-color hover:border-accent/40'
                }`}
              >
                <div className="mt-0.5 flex-none">
                  <div
                    className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selected === action ? 'border-accent' : 'border-border-color'
                    }`}
                    onClick={() => setSelected(action)}
                  >
                    {selected === action && <div className="h-2 w-2 rounded-full bg-accent" />}
                  </div>
                </div>
                <div onClick={() => setSelected(action)}>
                  <p className="text-xs font-semibold text-text-primary">{cfg.label}</p>
                  <p className="text-[11px] text-text-secondary mt-0.5">{cfg.description}</p>
                </div>
              </label>
            ),
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-none px-4 py-2 rounded-lg border border-border-color text-xs font-medium text-text-secondary hover:bg-bg-secondary transition-colors disabled:opacity-50"
          >
            Go back
          </button>

          {selected === 'skip' ? (
            <Link
              href={`/customers/${info.lead_id}`}
              className="flex-1 text-center py-2 rounded-lg bg-bg-secondary border border-border-color hover:bg-card-bg text-xs font-semibold text-text-primary transition-colors"
              onClick={onCancel}
            >
              View existing lead →
            </Link>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => onAction(selected)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${ACTION_CONFIG[selected].btnClass}`}
            >
              {loading && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {ACTION_CONFIG[selected].label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function CreateLeadModal({ isOpen, onClose, fieldConfigs }: CreateLeadModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Duplicate state
  const [dupCheck, setDupCheck] = useState<DuplicateCheckResponse | null>(null);
  const [pendingData, setPendingData] = useState<LeadCreate | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setDupCheck(null);
    setPendingData(null);
    setError(null);
    onClose();
  };

  // ── Step 1: form submit → check duplicate ─────────────────────────────────

  const handleSubmit = async (data: LeadCreate) => {
    setIsLoading(true);
    setError(null);
    setPendingData(data);

    try {
      const check = await checkDuplicateLead({
        name: data.name || null,
        phone: data.phone || null,
        email: data.email || null,
      });

      if (check.has_duplicate && check.duplicate_info) {
        // If the business setting is "create_anyway" → skip the dialog, just create
        if (check.on_duplicate === 'create_anyway') {
          await doCreate(data);
          return;
        }
        // Otherwise show the duplicate dialog
        setDupCheck(check);
      } else {
        // No duplicate — create directly
        await doCreate(data);
      }
    } catch {
      // If duplicate check fails, proceed with creation (non-fatal)
      try {
        await doCreate(data);
      } catch (err2) {
        setError(err2 instanceof Error ? err2.message : 'Failed to create lead');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const doCreate = async (data: LeadCreate) => {
    const created = await createLead(data);

    // Create entity links for any relation fields that were filled
    if (fieldConfigs && data.extra_data) {
      const leadId = parseInt(String(created.id), 10);
      if (!isNaN(leadId)) {
        const relationFields = fieldConfigs.filter((f) => f.field_type === 'relation' && !f.is_system);
        for (const field of relationFields) {
          const val = data.extra_data[field.field_key];
          if (!val || typeof val !== 'object' || !('id' in val)) continue;
          const rv = val as RelationValue;
          const cfg = field.config as { target?: string } | undefined;
          const entityType = RELATION_ENTITY_TYPE_MAP[cfg?.target ?? ''];
          if (!entityType) continue;
          try {
            await createLeadEntityLink(leadId, { entity_type: entityType, entity_id: rv.id, field_config_id: field.id });
          } catch {
            // Non-fatal — lead was created, link just didn't attach
          }
        }
      }
    }

    handleClose();
    router.push(`/customers/${created.id}`);
  };

  // ── Step 2: user picks action from duplicate dialog ───────────────────────

  const handleDuplicateAction = async (action: OnDuplicate) => {
    if (!pendingData || !dupCheck?.duplicate_info) return;
    setActionLoading(true);
    setError(null);

    try {
      if (action === 'update') {
        // Update the existing lead with the new data
        const updatePayload: LeadUpdate = {
          name: pendingData.name || undefined,
          phone: pendingData.phone || undefined,
          email: pendingData.email || undefined,
          status: pendingData.status || undefined,
          priority: pendingData.priority || undefined,
          source: pendingData.source || undefined,
          notes: pendingData.notes || undefined,
          extra_data: pendingData.extra_data,
        };
        await updateLead(String(dupCheck.duplicate_info.lead_id), updatePayload);
        handleClose();
        router.push(`/customers/${dupCheck.duplicate_info.lead_id}`);
      } else if (action === 'create_anyway') {
        await doCreate(pendingData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDialogCancel = () => {
    setDupCheck(null);
    // Keep pendingData so user can go back and edit without losing their input
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={handleClose}>
        <div
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border-color bg-card-bg p-6 m-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-text-primary">Create New Lead</h2>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md p-2 text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
            </div>
          )}

          <CreateLeadForm
            onSubmit={handleSubmit}
            onCancel={handleClose}
            isLoading={isLoading}
            fieldConfigs={fieldConfigs}
          />
        </div>
      </div>

      {/* Duplicate action dialog — rendered above the modal */}
      {dupCheck?.has_duplicate && dupCheck.duplicate_info && pendingData && (
        <DuplicateDialog
          info={dupCheck.duplicate_info}
          defaultAction={dupCheck.on_duplicate}
          pendingData={pendingData}
          onAction={handleDuplicateAction}
          onCancel={handleDialogCancel}
          loading={actionLoading}
        />
      )}
    </>
  );
}
