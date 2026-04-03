'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PermissionGuard from '@/components/permission-guard';
import {
  type ColumnMappingEntry,
  type DuplicateCheckField,
  type ImportRowAction,
  type ImportRowPreview,
  type LeadImportConfirmResult,
  type LeadImportPreviewResponse,
  type LeadImportSettings,
  type LeadField,
  type OnDuplicate,
  type RowAction,
  confirmImport,
  getImportSettings,
  previewImport,
  updateImportSettings,
} from '@/services/lead-import';

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Settings', 'Upload', 'Review', 'Done'] as const;
type Step = 0 | 1 | 2 | 3;

function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  done
                    ? 'bg-green-500 text-white'
                    : active
                    ? 'bg-accent text-white'
                    : 'bg-bg-secondary border border-border-color text-text-secondary'
                }`}
              >
                {done ? (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-accent' : done ? 'text-green-500' : 'text-text-secondary'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mb-5 h-px flex-1 mx-2 ${i < current ? 'bg-green-500' : 'bg-border-color'}`} style={{ minWidth: 32 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Field label maps ─────────────────────────────────────────────────────────

const LEAD_FIELD_LABELS: Record<LeadField, string> = {
  name: 'Name',
  phone: 'Phone',
  email: 'Email',
  status: 'Status',
  priority: 'Priority',
  source: 'Source',
  notes: 'Notes',
};

const LEAD_FIELDS: LeadField[] = ['name', 'phone', 'email', 'priority', 'source', 'notes'];

// ─── Step 1 — Settings ────────────────────────────────────────────────────────

function SettingsStep({
  settings,
  onChange,
  onNext,
  saving,
}: {
  settings: LeadImportSettings | null;
  onChange: (s: Partial<LeadImportSettings>) => void;
  onNext: () => Promise<void>;
  saving: boolean;
}) {
  if (!settings) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const toggleField = (f: DuplicateCheckField) => {
    const current = settings.duplicate_check_fields;
    const next = current.includes(f) ? current.filter((x) => x !== f) : [...current, f];
    if (next.length > 0) onChange({ duplicate_check_fields: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Duplicate Detection</h3>
        <p className="text-xs text-text-secondary">
          Choose which fields to check when deciding if an incoming lead already exists.
        </p>
      </div>

      {/* Match fields */}
      <Section title="Match leads by">
        {(['phone', 'email', 'name'] as DuplicateCheckField[]).map((f) => (
          <CheckRow
            key={f}
            checked={settings.duplicate_check_fields.includes(f)}
            onChange={() => toggleField(f)}
            label={f.charAt(0).toUpperCase() + f.slice(1)}
            description={
              f === 'phone'
                ? 'Normalises numbers (ignores spaces, dashes, country codes) before comparing'
                : f === 'email'
                ? 'Case-insensitive comparison'
                : 'Exact match after lowercase trim'
            }
          />
        ))}
      </Section>

      {/* Scope */}
      <Section title="Duplicate scope">
        <RadioRow
          name="scope"
          value="business"
          current={settings.duplicate_scope}
          onChange={(v) => onChange({ duplicate_scope: v as 'business' | 'employee' })}
          label="Whole business"
          description="Check across every lead in your business regardless of who it's assigned to"
        />
        <RadioRow
          name="scope"
          value="employee"
          current={settings.duplicate_scope}
          onChange={(v) => onChange({ duplicate_scope: v as 'business' | 'employee' })}
          label="Per employee"
          description="Only check leads assigned to the person doing the import"
        />
      </Section>

      {/* Cross-employee rules */}
      <Section title="Cross-employee rules" subtitle="When the same phone / email exists under a DIFFERENT employee, should it count as a duplicate?">
        <CheckRow
          checked={!settings.allow_cross_employee_phone}
          onChange={() => onChange({ allow_cross_employee_phone: !settings.allow_cross_employee_phone })}
          label="Block same phone from different employees"
          description="If unchecked, two employees can have leads with the same phone number"
        />
        <CheckRow
          checked={!settings.allow_cross_employee_email}
          onChange={() => onChange({ allow_cross_employee_email: !settings.allow_cross_employee_email })}
          label="Block same email from different employees"
          description="If unchecked, two employees can have leads with the same email address"
        />
      </Section>

      {/* On duplicate action */}
      <Section title="When a duplicate is found">
        {(
          [
            ['skip', 'Skip row', 'Do not import the row — leave the existing lead untouched'],
            ['update', 'Update existing', 'Overwrite fields in the existing lead with data from the file'],
            ['create_anyway', 'Import anyway', 'Create a new lead even if a match is found'],
          ] as [OnDuplicate, string, string][]
        ).map(([val, label, desc]) => (
          <RadioRow
            key={val}
            name="on_duplicate"
            value={val}
            current={settings.on_duplicate}
            onChange={(v) => onChange({ on_duplicate: v as OnDuplicate })}
            label={label}
            description={desc}
          />
        ))}
        <p className="mt-2 text-[11px] text-text-secondary italic">
          You can also override the action per-row in the Review step.
        </p>
      </Section>

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          Save & Continue →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2 — Upload ──────────────────────────────────────────────────────────

function UploadStep({
  onPreview,
  loading,
}: {
  onPreview: (file: File) => Promise<void>;
  loading: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls', 'xlsm'].includes(ext ?? '')) {
      alert('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }
    onPreview(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Upload your leads file</h3>
        <p className="text-xs text-text-secondary">
          Supported formats: <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong> — max 10 MB, up to 5,000 rows.
        </p>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer py-14 transition-colors ${
          dragging
            ? 'border-accent bg-accent/5'
            : 'border-border-color bg-bg-secondary hover:border-accent/50 hover:bg-accent/[0.03]'
        }`}
      >
        {loading ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-text-secondary">Analysing file…</p>
          </>
        ) : (
          <>
            <svg className="h-10 w-10 text-text-secondary opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">Drop your file here</p>
              <p className="text-xs text-text-secondary mt-0.5">or click to browse</p>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.xlsm"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {/* Column guide */}
      <div className="rounded-lg border border-border-color bg-bg-secondary p-4">
        <p className="text-xs font-semibold text-text-primary mb-2">Recognised column names</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-text-secondary">
          {[
            ['Name', 'name, full name, customer name, lead name'],
            ['Phone', 'phone, mobile, tel, telephone, contact number'],
            ['Email', 'email, email address, e-mail'],
            ['Priority', 'priority, urgency'],
            ['Source', 'source, lead source, channel'],
            ['Notes', 'notes, comments, remarks, description'],
          ].map(([field, aliases]) => (
            <div key={field}>
              <span className="font-medium text-text-primary">{field}:</span>{' '}
              <span className="italic">{aliases}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-text-secondary">
          Column names are matched case-insensitively. You can also remap columns manually after uploading.
        </p>
      </div>
    </div>
  );
}

// ─── Step 3 — Review ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-green-500/10 text-green-600' },
  duplicate: { label: 'Duplicate', color: 'bg-amber-500/10 text-amber-600' },
  error: { label: 'Error', color: 'bg-red-500/10 text-red-600' },
};

const ACTION_LABELS: Record<RowAction, string> = {
  import: 'Import',
  update: 'Update',
  skip: 'Skip',
};

function ReviewStep({
  preview,
  rowActions,
  onActionChange,
  onMappingChange,
  onImport,
  importing,
  assignedToId,
  onAssignedToIdChange,
  defaultSource,
  onDefaultSourceChange,
}: {
  preview: LeadImportPreviewResponse;
  rowActions: RowAction[];
  onActionChange: (idx: number, action: RowAction) => void;
  onMappingChange: (mapping: ColumnMappingEntry[]) => void;
  onImport: () => void;
  importing: boolean;
  assignedToId: number | null;
  onAssignedToIdChange: (id: number | null) => void;
  defaultSource: string;
  onDefaultSourceChange: (v: string) => void;
}) {
  const [showMapping, setShowMapping] = useState(false);
  const [localMapping, setLocalMapping] = useState<ColumnMappingEntry[]>(preview.column_mapping);
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'duplicate' | 'error'>('all');

  const newCount = preview.rows.filter((r) => r.import_status === 'new').length;
  const dupCount = preview.rows.filter((r) => r.import_status === 'duplicate').length;
  const errCount = preview.rows.filter((r) => r.import_status === 'error').length;

  const willImport = rowActions.filter((a) => a === 'import').length;
  const willUpdate = rowActions.filter((a) => a === 'update').length;
  const willSkip = rowActions.filter((a) => a === 'skip').length;

  const filteredRows = filterStatus === 'all'
    ? preview.rows
    : preview.rows.filter((r) => r.import_status === filterStatus);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total rows" value={preview.total} color="text-text-primary" />
        <SummaryCard label="New leads" value={newCount} color="text-green-600" />
        <SummaryCard label="Duplicates" value={dupCount} color="text-amber-600" />
        <SummaryCard label="Errors" value={errCount} color="text-red-600" />
      </div>

      {/* Import plan */}
      <div className="rounded-lg border border-border-color bg-bg-secondary p-3 flex flex-wrap gap-4 text-xs">
        <span><span className="font-semibold text-green-600">{willImport}</span> will be imported</span>
        <span><span className="font-semibold text-blue-600">{willUpdate}</span> will be updated</span>
        <span><span className="font-semibold text-text-secondary">{willSkip}</span> will be skipped</span>
      </div>

      {/* Column mapping toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowMapping((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
        >
          <svg className={`h-3.5 w-3.5 transition-transform ${showMapping ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {showMapping ? 'Hide' : 'Edit'} column mapping
        </button>

        {showMapping && (
          <div className="mt-3 rounded-lg border border-border-color bg-card-bg p-3 space-y-2">
            <p className="text-xs text-text-secondary">Map each file column to the correct lead field (or ignore it).</p>
            <div className="grid gap-2">
              {localMapping.map((entry, i) => (
                <div key={entry.raw_column} className="flex items-center gap-3 text-xs">
                  <span className="w-40 truncate font-medium text-text-primary" title={entry.raw_column}>
                    {entry.raw_column}
                  </span>
                  <svg className="h-3.5 w-3.5 text-text-secondary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <select
                    className="flex-1 rounded-md border border-border-color bg-bg-secondary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    value={entry.lead_field ?? ''}
                    onChange={(e) => {
                      const updated = localMapping.map((m, mi) =>
                        mi === i ? { ...m, lead_field: (e.target.value || null) as LeadField | null } : m,
                      );
                      setLocalMapping(updated);
                      onMappingChange(updated);
                    }}
                  >
                    <option value="">— ignore —</option>
                    {LEAD_FIELDS.map((f) => (
                      <option key={f} value={f}>{LEAD_FIELD_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Import options */}
      <div className="rounded-lg border border-border-color bg-bg-secondary p-3 flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-primary">Default source (if blank in file)</label>
          <input
            type="text"
            placeholder="e.g. import, referral, website"
            value={defaultSource}
            onChange={(e) => onDefaultSourceChange(e.target.value)}
            className="rounded-md border border-border-color bg-card-bg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent w-44"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-border-color pb-0">
        {(['all', 'new', 'duplicate', 'error'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
              filterStatus === f
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {f === 'all' ? `All (${preview.total})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${
              f === 'new' ? newCount : f === 'duplicate' ? dupCount : errCount
            })`}
          </button>
        ))}
      </div>

      {/* Rows table */}
      <div className="rounded-xl border border-border-color overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-bg-secondary border-b border-border-color">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-secondary uppercase tracking-wide">#</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-secondary uppercase tracking-wide">Name</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-secondary uppercase tracking-wide">Phone</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-secondary uppercase tracking-wide">Email</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-secondary uppercase tracking-wide">Status</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-secondary uppercase tracking-wide">Duplicate of</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-secondary uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const action = rowActions[row.row_index];
                const statusMeta = STATUS_LABELS[row.import_status];
                return (
                  <tr
                    key={row.row_index}
                    className={`border-b border-border-color last:border-b-0 transition-colors hover:bg-bg-secondary/50 ${
                      action === 'skip' ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-text-secondary">{row.row_index + 1}</td>
                    <td className="px-3 py-2 font-medium text-text-primary max-w-[120px] truncate" title={row.data.name ?? ''}>
                      {row.data.name || <span className="italic text-text-secondary">—</span>}
                    </td>
                    <td className="px-3 py-2 text-text-primary">{row.data.phone || '—'}</td>
                    <td className="px-3 py-2 text-text-primary max-w-[140px] truncate" title={row.data.email ?? ''}>
                      {row.data.email || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                      {row.errors.length > 0 && (
                        <span className="ml-1 text-red-500 text-[10px]" title={row.errors.join('; ')}>⚠</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-text-secondary max-w-[140px]">
                      {row.duplicate_info ? (
                        <div>
                          <span className="font-medium text-text-primary">{row.duplicate_info.name || 'Lead'}</span>
                          <span className="ml-1 text-[10px]">
                            (matched {row.duplicate_info.matched_field}
                            {row.duplicate_info.assigned_to_name ? ` · ${row.duplicate_info.assigned_to_name}` : ''})
                          </span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {row.import_status === 'error' ? (
                        <span className="text-[10px] text-red-500 italic">{row.errors[0]}</span>
                      ) : (
                        <select
                          value={action}
                          onChange={(e) => onActionChange(row.row_index, e.target.value as RowAction)}
                          className="rounded-md border border-border-color bg-bg-secondary px-2 py-1 text-[11px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        >
                          <option value="import">Import</option>
                          {row.duplicate_info && <option value="update">Update</option>}
                          <option value="skip">Skip</option>
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk actions */}
      {dupCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-text-secondary font-medium">Bulk set duplicates to:</span>
          {(['skip', 'update', 'import'] as RowAction[]).map((a) => (
            <button
              key={a}
              onClick={() => preview.rows
                .filter((r) => r.import_status === 'duplicate')
                .forEach((r) => onActionChange(r.row_index, a))
              }
              className="rounded-md border border-border-color bg-bg-secondary hover:bg-card-bg px-3 py-1 font-medium text-text-primary transition-colors"
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={onImport}
          disabled={importing || (willImport + willUpdate) === 0}
          className="flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {importing && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          Import {willImport + willUpdate} lead{(willImport + willUpdate) !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

// ─── Step 4 — Done ────────────────────────────────────────────────────────────

function DoneStep({ result, onImportAnother }: { result: LeadImportConfirmResult; onImportAnother: () => void }) {
  const total = result.imported + result.updated + result.skipped + result.errors;
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
        <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-text-primary">Import complete</h3>
        <p className="mt-1 text-sm text-text-secondary">{total} rows processed</p>
      </div>

      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <ResultCard label="Imported" value={result.imported} color="text-green-600" bg="bg-green-500/10" />
        <ResultCard label="Updated" value={result.updated} color="text-blue-600" bg="bg-blue-500/10" />
        <ResultCard label="Skipped" value={result.skipped} color="text-text-secondary" bg="bg-bg-secondary" />
        <ResultCard label="Errors" value={result.errors} color="text-red-600" bg="bg-red-500/10" />
      </div>

      {result.error_details.length > 0 && (
        <div className="w-full rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-3">
          <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-2">Row errors</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {result.error_details.map((e, i) => (
              <p key={i} className="text-xs text-red-600 dark:text-red-400">
                Row {e.row_index + 1}: {e.error}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onImportAnother}
          className="rounded-lg border border-border-color bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary hover:bg-card-bg transition-colors"
        >
          Import another file
        </button>
        <Link
          href='/leads'
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 transition-colors"
        >
          View leads →
        </Link>
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
      <div className="border-b border-border-color bg-bg-secondary px-4 py-2.5">
        <p className="text-xs font-semibold text-text-primary">{title}</p>
        {subtitle && <p className="text-[11px] text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      <div className="divide-y divide-border-color">{children}</div>
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-bg-secondary/50 transition-colors">
      <div className="mt-0.5 flex-none">
        <div
          className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
            checked ? 'border-accent bg-accent' : 'border-border-color bg-bg-secondary'
          }`}
          onClick={onChange}
        >
          {checked && (
            <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-text-primary">{label}</p>
        <p className="text-[11px] text-text-secondary mt-0.5">{description}</p>
      </div>
    </label>
  );
}

function RadioRow({
  name,
  value,
  current,
  onChange,
  label,
  description,
}: {
  name: string;
  value: string;
  current: string;
  onChange: (v: string) => void;
  label: string;
  description: string;
}) {
  const active = value === current;
  return (
    <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-bg-secondary/50 transition-colors">
      <div className="mt-0.5 flex-none">
        <div
          className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
            active ? 'border-accent' : 'border-border-color bg-bg-secondary'
          }`}
          onClick={() => onChange(value)}
        >
          {active && <div className="h-2 w-2 rounded-full bg-accent" />}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-text-primary">{label}</p>
        <p className="text-[11px] text-text-secondary mt-0.5">{description}</p>
      </div>
    </label>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border-color bg-card-bg p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-text-secondary mt-0.5">{label}</p>
    </div>
  );
}

function ResultCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`rounded-lg ${bg} p-3 text-center`}>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-text-secondary mt-0.5">{label}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ImportLeadsPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);

  // Settings
  const [settings, setSettings] = useState<LeadImportSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Upload / preview
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<LeadImportPreviewResponse | null>(null);
  const [rowActions, setRowActions] = useState<RowAction[]>([]);

  // Import options
  const [defaultSource, setDefaultSource] = useState('import');
  const [assignedToId] = useState<number | null>(null);

  // Confirm
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<LeadImportConfirmResult | null>(null);

  // Error
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    getImportSettings()
      .then(setSettings)
      .catch(() => {
        // use defaults
        setSettings({
          id: 0,
          business_id: 0,
          duplicate_check_fields: ['phone', 'email'],
          duplicate_scope: 'business',
          on_duplicate: 'skip',
          allow_cross_employee_phone: false,
          allow_cross_employee_email: false,
        });
      });
  }, []);

  const handleSettingsChange = (partial: Partial<LeadImportSettings>) => {
    setSettings((prev) => prev ? { ...prev, ...partial } : prev);
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    setError(null);
    try {
      const updated = await updateImportSettings({
        duplicate_check_fields: settings.duplicate_check_fields,
        duplicate_scope: settings.duplicate_scope,
        on_duplicate: settings.on_duplicate,
        allow_cross_employee_phone: settings.allow_cross_employee_phone,
        allow_cross_employee_email: settings.allow_cross_employee_email,
      });
      setSettings(updated);
      setStep(1);
    } catch {
      setError('Failed to save settings. Please try again.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePreview = async (file: File) => {
    setLoadingPreview(true);
    setError(null);
    try {
      const result = await previewImport(file);
      setPreview(result);

      // Initialise row actions from the backend's resolved default action
      const actions: RowAction[] = result.rows.map((r) => r.row_action);
      setRowActions(actions);

      setStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyse file';
      setError(msg);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleActionChange = useCallback((idx: number, action: RowAction) => {
    setRowActions((prev) => {
      const next = [...prev];
      next[idx] = action;
      return next;
    });
  }, []);

  const handleMappingChange = useCallback((_mapping: ColumnMappingEntry[]) => {
    // Store but don't re-preview automatically — user can re-upload if needed
  }, []);

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    setError(null);
    try {
      const rows: ImportRowAction[] = preview.rows.map((r) => ({
        row_index: r.row_index,
        action: rowActions[r.row_index] ?? 'skip',
        data: r.data,
      }));

      const res = await confirmImport({
        rows,
        assigned_to_id: assignedToId,
        default_source: defaultSource || null,
      });

      setResult(res);
      setStep(3);
    } catch {
      setError('Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleImportAnother = () => {
    setStep(0);
    setPreview(null);
    setResult(null);
    setRowActions([]);
    setError(null);
  };

  return (
    <PermissionGuard permission="manage_leads">
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Import Leads</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Bulk-import contacts from a CSV or Excel file with duplicate detection.
          </p>
        </div>
        <Link
          href='/leads'
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-card-bg px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-secondary transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Leads
        </Link>
      </div>

      {/* Step bar */}
      <div className="rounded-xl border border-border-color bg-card-bg px-6 py-4">
        <StepBar current={step} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 flex items-start gap-2">
          <svg className="h-4 w-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Step content */}
      <div className="rounded-xl border border-border-color bg-card-bg p-5 md:p-6">
        {step === 0 && (
          <SettingsStep
            settings={settings}
            onChange={handleSettingsChange}
            onNext={handleSaveSettings}
            saving={savingSettings}
          />
        )}
        {step === 1 && (
          <UploadStep
            onPreview={handlePreview}
            loading={loadingPreview}
          />
        )}
        {step === 2 && preview && (
          <ReviewStep
            preview={preview}
            rowActions={rowActions}
            onActionChange={handleActionChange}
            onMappingChange={handleMappingChange}
            onImport={handleImport}
            importing={importing}
            assignedToId={assignedToId}
            onAssignedToIdChange={() => {}}
            defaultSource={defaultSource}
            onDefaultSourceChange={setDefaultSource}
          />
        )}
        {step === 3 && result && (
          <DoneStep result={result} onImportAnother={handleImportAnother} />
        )}
      </div>
    </div>
    </PermissionGuard>
  );
}
