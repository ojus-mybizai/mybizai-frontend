'use client';

/**
 * File import audience component — upload a CSV/Excel file, preview rows,
 * confirm import into Contacts, and auto-select the imported contacts as audience.
 *
 * Uses the contact import backend endpoints:
 *   POST /contacts/import/preview   → parse file + preview
 *   POST /contacts/import/confirm   → insert into contacts table
 *
 * After confirm, returns the created contact IDs so the campaign wizard can
 * plug them into audience_config as {lead_ids: [...]}.
 */

import { useCallback, useState } from 'react';
import {
  previewImport,
  confirmImport,
  type ContactImportPreviewResponse,
  type ContactImportConfirmResult,
} from '@/services/contact-import';

interface Props {
  onImported: (leadIds: number[]) => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

export function FileImportAudience({ onImported }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ContactImportPreviewResponse | null>(null);
  const [result, setResult] = useState<ContactImportConfirmResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await previewImport(file);
      setPreview(resp);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }, [file]);

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    setStep('importing');
    setError(null);
    try {
      // Build confirm rows — import all "new" rows, skip duplicates
      const rows = preview.rows.map((r) => ({
        row_index: r.row_index,
        action: (r.import_status === 'new' ? 'import' : 'skip') as 'import' | 'skip',
        data: r.data,
      }));

      const resp = await confirmImport({ rows });
      setResult(resp);
      setStep('done');

      // Return imported contact IDs to the wizard
      if (resp.contact_ids && resp.contact_ids.length > 0) {
        onImported(resp.contact_ids);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  }, [preview, onImported]);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStep('upload');
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* ── STEP 1: Upload ─────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Upload a CSV or Excel file with leads. They'll be imported into your CRM and
            automatically selected as the campaign audience.
          </p>
          <div className="border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mx-auto"
            />
            <p className="text-xs text-gray-500 mt-2">
              Supported: .csv, .xlsx, .xls — max 5,000 rows, 10 MB
            </p>
          </div>
          {file && (
            <div className="flex items-center justify-between bg-gray-50 dark:bg-neutral-950 rounded-md px-3 py-2">
              <span className="text-sm truncate">{file.name}</span>
              <button
                onClick={handleUpload}
                disabled={loading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
              >
                {loading ? 'Processing…' : 'Preview Import'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Preview ────────────────────────────────────── */}
      {step === 'preview' && preview && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-gray-200 dark:border-neutral-800 rounded-md p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{preview.new_count}</div>
              <div className="text-xs text-gray-500">New leads</div>
            </div>
            <div className="border border-gray-200 dark:border-neutral-800 rounded-md p-3 text-center">
              <div className="text-2xl font-bold text-amber-600">{preview.duplicate_count}</div>
              <div className="text-xs text-gray-500">Duplicates (skip)</div>
            </div>
            <div className="border border-gray-200 dark:border-neutral-800 rounded-md p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{preview.error_count}</div>
              <div className="text-xs text-gray-500">Errors</div>
            </div>
          </div>

          <div className="text-sm text-gray-500">
            <strong>{preview.new_count}</strong> new leads will be imported and selected as audience.
            {preview.duplicate_count > 0 && (
              <> {preview.duplicate_count} duplicate(s) will be skipped.</>
            )}
          </div>

          {/* Sample rows */}
          <div className="border border-gray-200 dark:border-neutral-800 rounded-md max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-neutral-950 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1">#</th>
                  <th className="text-left px-2 py-1">Name</th>
                  <th className="text-left px-2 py-1">Phone</th>
                  <th className="text-left px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                {preview.rows.slice(0, 50).map((r) => (
                  <tr key={r.row_index}>
                    <td className="px-2 py-1 text-gray-400">{r.row_index}</td>
                    <td className="px-2 py-1">{r.data.name || '—'}</td>
                    <td className="px-2 py-1 font-mono">{r.data.phone || '—'}</td>
                    <td className="px-2 py-1">
                      <span
                        className={
                          r.import_status === 'new'
                            ? 'text-green-600'
                            : r.import_status === 'duplicate'
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }
                      >
                        {r.import_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={reset}
              className="px-3 py-2 border border-gray-300 dark:border-neutral-700 rounded-md text-sm"
            >
              ← Upload different file
            </button>
            <button
              onClick={handleConfirm}
              disabled={preview.new_count === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
            >
              Import {preview.new_count} lead{preview.new_count !== 1 ? 's' : ''} & select as audience
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Importing ──────────────────────────────────── */}
      {step === 'importing' && (
        <div className="p-6 text-center text-gray-500">
          <div className="animate-pulse text-lg">Importing leads…</div>
        </div>
      )}

      {/* ── STEP 4: Done ───────────────────────────────────────── */}
      {step === 'done' && result && (
        <div className="space-y-3">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-800 rounded-md p-4">
            <div className="text-green-800 dark:text-green-200 font-medium">
              ✓ {result.imported} lead{result.imported !== 1 ? 's' : ''} imported and selected as audience
            </div>
            {result.skipped > 0 && (
              <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                {result.skipped} skipped (duplicates)
              </div>
            )}
          </div>
          <button
            onClick={reset}
            className="text-sm text-primary hover:underline"
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}
