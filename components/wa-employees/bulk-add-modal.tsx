'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, Upload, CheckCircle, AlertCircle, AlertTriangle, Trash2,
  Users, FileText, Plus,
} from 'lucide-react';
import { addEmployeesBulk, type WaEmployee } from '@/services/waEmployees';

/* ─── Types ─────────────────────────────────────────────────────────────── */

type RowError = 'name' | 'number' | 'duplicate_existing' | 'duplicate_list';

interface Row {
  id: string;
  name: string;
  number: string;
  errors: RowError[];
}

interface Props {
  open: boolean;
  existingEmployees: WaEmployee[];
  onClose: () => void;
  onSuccess: (created: number, skipped: number) => void;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function normaliseNumber(raw: string) {
  return raw.replace(/\D/g, '');
}

function validateRows(rows: Row[], existingNumbers: Set<string>): Row[] {
  // Count occurrences within this list (for duplicate_list detection)
  const listCount = new Map<string, number>();
  for (const r of rows) {
    const n = normaliseNumber(r.number);
    if (n) listCount.set(n, (listCount.get(n) || 0) + 1);
  }

  return rows.map((row) => {
    const n = normaliseNumber(row.number);
    const errors: RowError[] = [];

    if (!row.name.trim()) errors.push('name');

    if (!n || n.length < 7 || n.length > 15) {
      errors.push('number');
    } else if (existingNumbers.has(n)) {
      errors.push('duplicate_existing');
    } else if ((listCount.get(n) || 0) > 1) {
      errors.push('duplicate_list');
    }

    return { ...row, number: n || row.number, errors };
  });
}

function parseText(text: string): Omit<Row, 'errors'>[] {
  return text
    .split('\n')
    .map((line, i) => {
      const parts = line.split(/,|\t/).map((s) => s.trim());
      return {
        id: `row-${i}`,
        name:   parts[0] || '',
        number: normaliseNumber(parts[1] || ''),
      };
    })
    .filter((r) => r.name || r.number);
}

const ERROR_LABELS: Record<RowError, string> = {
  name:               'Missing name',
  number:             'Invalid number',
  duplicate_existing: 'Already a member',
  duplicate_list:     'Duplicate in list',
};

const ERROR_COLOR: Record<RowError, string> = {
  name:               'text-red-600',
  number:             'text-red-600',
  duplicate_existing: 'text-orange-500',
  duplicate_list:     'text-orange-500',
};

/* ─── Component ──────────────────────────────────────────────────────────── */

export function BulkAddModal({ open, existingEmployees, onClose, onSuccess }: Props) {
  const [rawText,    setRawText]    = useState('');
  const [rows,       setRows]       = useState<Row[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingNumbers = new Set(existingEmployees.map((e) => e.whatsapp_number));

  // Re-parse whenever rawText changes
  useEffect(() => {
    const parsed = parseText(rawText);
    setRows(validateRows(
      parsed.map((r) => ({ ...r, errors: [] })),
      existingNumbers,
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawText]);

  // Re-validate rows when existingEmployees changes (e.g. after add)
  const revalidate = useCallback((current: Row[]) => {
    setRows(validateRows(current, existingNumbers));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingEmployees]);

  // Reset on close
  useEffect(() => {
    if (!open) { setRawText(''); setRows([]); setSubmitError(null); }
  }, [open]);

  function handleCellChange(id: string, field: 'name' | 'number', value: string) {
    setRows((prev) => {
      const updated = prev.map((r) =>
        r.id === id ? { ...r, [field]: field === 'number' ? normaliseNumber(value) : value } : r
      );
      return validateRows(updated, existingNumbers);
    });
  }

  function handleDeleteRow(id: string) {
    setRows((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      return validateRows(updated, existingNumbers);
    });
  }

  function handleAddRow() {
    setRows((prev) => {
      const updated = [...prev, { id: `row-manual-${Date.now()}`, name: '', number: '', errors: [] }];
      return validateRows(updated, existingNumbers);
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRawText(ev.target?.result as string || '');
    reader.readAsText(file);
    // Reset file input so same file can be re-uploaded
    e.target.value = '';
  }

  async function handleSubmit() {
    const valid = rows.filter((r) => r.errors.length === 0);
    if (!valid.length) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await addEmployeesBulk(
        valid.map((r) => ({ name: r.name.trim(), whatsapp_number: r.number }))
      );
      onSuccess(result.created, result.skipped.length);
      onClose();
    } catch (e: unknown) {
      setSubmitError((e as Error).message || 'Failed to add employees');
    } finally {
      setSubmitting(false);
    }
  }

  const validCount   = rows.filter((r) => r.errors.length === 0).length;
  const errorCount   = rows.filter((r) => r.errors.length > 0).length;
  const hasRows      = rows.length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-16 overflow-y-auto">
      <div className="bg-bg-primary rounded-2xl shadow-2xl w-full max-w-2xl border border-border-color flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-text-primary text-sm">Bulk Add Employees</h2>
              <p className="text-xs text-text-secondary">Paste a list or upload a CSV file</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">

          {/* Input area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Paste list
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">or</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-border-color rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
                >
                  <Upload className="w-3 h-3" /> Upload CSV
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={4}
              placeholder={"Rahul Sharma, 919876543210\nPriya Singh, 918765432109\nArjun Mehta, 917654321098"}
              className="w-full border border-border-color rounded-xl px-3.5 py-3 text-sm font-mono text-text-primary bg-bg-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
            />
            <p className="text-xs text-text-secondary">
              Format: <code className="bg-bg-secondary px-1.5 py-0.5 rounded text-text-primary">Name, WhatsApp Number</code> — one per line. Tabs also work.
            </p>
          </div>

          {/* Preview table */}
          {hasRows && (
            <div className="space-y-2">
              {/* Summary bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Preview</span>
                  <div className="flex items-center gap-2">
                    {validCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-800 text-xs rounded-full border border-green-300">
                        <CheckCircle className="w-3 h-3" /> {validCount} valid
                      </span>
                    )}
                    {errorCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded-full border border-red-300">
                        <AlertCircle className="w-3 h-3" /> {errorCount} {errorCount === 1 ? 'error' : 'errors'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleAddRow}
                  className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add row
                </button>
              </div>

              {/* Table */}
              <div className="border border-border-color rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-bg-secondary border-b border-border-color sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary w-8">#</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary">WhatsApp Number</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary w-40">Status</th>
                        <th className="px-2 py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color">
                      {rows.map((row, idx) => {
                        const isValid = row.errors.length === 0;
                        return (
                          <tr key={row.id} className={`transition-colors ${isValid ? '' : 'bg-red-50/40 dark:bg-red-950/10'}`}>
                            {/* Row number */}
                            <td className="px-3 py-2 text-xs text-text-secondary tabular-nums">{idx + 1}</td>

                            {/* Name cell */}
                            <td className="px-3 py-2">
                              <input
                                value={row.name}
                                onChange={(e) => handleCellChange(row.id, 'name', e.target.value)}
                                placeholder="Full name"
                                className={`w-full min-w-[120px] px-2 py-1 text-sm rounded-lg border bg-bg-primary text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent/40
                                  ${row.errors.includes('name') ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : 'border-border-color'}`}
                              />
                            </td>

                            {/* Number cell */}
                            <td className="px-3 py-2">
                              <input
                                value={row.number}
                                onChange={(e) => handleCellChange(row.id, 'number', e.target.value)}
                                placeholder="e.g. 919876543210"
                                className={`w-full min-w-[140px] px-2 py-1 text-sm rounded-lg border font-mono bg-bg-primary text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent/40
                                  ${row.errors.includes('number') || row.errors.includes('duplicate_existing') || row.errors.includes('duplicate_list')
                                    ? 'border-red-400 bg-red-50 dark:bg-red-950/20'
                                    : 'border-border-color'}`}
                              />
                            </td>

                            {/* Status */}
                            <td className="px-3 py-2">
                              {isValid ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                  <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Ready
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  {row.errors.map((err) => (
                                    <span key={err} className={`flex items-center gap-1 text-xs ${ERROR_COLOR[err]}`}>
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      {ERROR_LABELS[err]}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Delete */}
                            <td className="px-2 py-2">
                              <button
                                onClick={() => handleDeleteRow(row.id)}
                                className="p-1 rounded text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                title="Remove row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Error guidance */}
              {errorCount > 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Fix the highlighted rows above, or they will be skipped.
                    Only <strong>{validCount} valid row{validCount !== 1 ? 's' : ''}</strong> will be submitted.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Submit error */}
          {submitError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-300 rounded-xl text-sm text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-color shrink-0 bg-bg-primary rounded-b-2xl">
          <p className="text-xs text-text-secondary">
            {hasRows
              ? `${rows.length} row${rows.length !== 1 ? 's' : ''} · ${validCount} valid${errorCount ? ` · ${errorCount} will be skipped` : ''}`
              : 'No data yet'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border-color rounded-lg text-text-secondary hover:bg-bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || validCount === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {submitting ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Adding…
                </>
              ) : (
                <>📨 Add {validCount > 0 ? validCount : ''} employee{validCount !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
