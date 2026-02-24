'use client';

import { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { useDataSheetContext } from '@/features/data-sheet/context/data-sheet-context';
import { listFields, uploadImport, getImportJob, type DynamicField } from '@/features/data-sheet/api';
import { normalizeApiError } from '@/features/data-sheet/api/normalize-error';

type Step = 'upload' | 'mapping' | 'running' | 'summary';

const EXCEL_EXTENSIONS = ['xlsx'];
const CSV_EXTENSION = 'csv';
const ACCEPTED_EXTENSIONS = [CSV_EXTENSION, ...EXCEL_EXTENSIONS];

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuotes = !inQuotes;
      else if ((c === ',' && !inQuotes) || c === '\t') {
        row.push(current.trim());
        current = '';
      } else current += c;
    }
    row.push(current.trim());
    return row;
  });
}

function parseExcel(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array((e.target?.result as ArrayBuffer) ?? []);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error('Excel file has no sheets'));
          return;
        }
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
        const normalized = rows.map((row) =>
          Array.isArray(row) ? row.map((c) => (c != null ? String(c).trim() : '')) : []
        );
        resolve(normalized);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function ImportPage() {
  const ctx = useDataSheetContext();
  const modelId = ctx?.modelId ?? '';

  const [fields, setFields] = useState<DynamicField[]>([]);
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [job, setJob] = useState<{
    id: number;
    status: string;
    stats: Record<string, unknown>;
    error_report: Record<string, unknown>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFields = useCallback(async () => {
    if (!modelId) return;
    try {
      const data = await listFields(modelId);
      setFields(data.sort((a, b) => a.order_index - b.order_index));
    } catch (e) {
      setError(normalizeApiError(e).message);
    }
  }, [modelId]);

  useEffect(() => {
    void loadFields();
  }, [loadFields]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    const ext = (f.name.toLowerCase().split('.').pop() ?? '').toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError('Please upload a CSV or Excel file (.csv or .xlsx).');
      return;
    }
    if (ext === CSV_EXTENSION) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result);
        const parsed = parseCsv(text);
        if (parsed.length > 0) {
          setHeaders(parsed[0]);
          setRows(parsed.slice(1));
          setMapping({});
          setStep('mapping');
        } else setError('File has no rows');
      };
      reader.readAsText(f, 'utf-8');
      return;
    }
    if (EXCEL_EXTENSIONS.includes(ext)) {
      try {
        const parsed = await parseExcel(f);
        if (parsed.length > 0) {
          const rawHeaders = parsed[0];
          const headerRow = rawHeaders.map((c, i) =>
            (c === '' || c == null ? `Column ${i + 1}` : String(c))
          );
          setHeaders(headerRow);
          setRows(parsed.slice(1));
          setMapping({});
          setStep('mapping');
        } else setError('Excel file has no rows');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to read Excel file');
      }
    }
  };

  const handleStartImport = async () => {
    if (!modelId || !file || step !== 'mapping') return;
    setLoading(true);
    setError(null);
    setStep('running');
    try {
      const fieldMap: Record<string, string> = {};
      for (const [col, fieldName] of Object.entries(mapping)) {
        if (fieldName) fieldMap[col] = fieldName;
      }
      const result = await uploadImport(modelId, file, { field_map: fieldMap });
      setJob({
        id: result.id,
        status: result.status,
        stats: result.stats ?? {},
        error_report: result.error_report ?? {},
      });
      if (result.status === 'queued' || result.status === 'running') {
        const poll = setInterval(async () => {
          try {
            const updated = await getImportJob(modelId, result.id);
            setJob((prev) =>
              prev
                ? {
                    ...prev,
                    status: updated.status,
                    stats: updated.stats ?? {},
                    error_report: updated.error_report ?? {},
                  }
                : null
            );
            if (
              updated.status === 'completed' ||
              updated.status === 'completed_with_errors' ||
              updated.status === 'failed'
            ) {
              clearInterval(poll);
              setStep('summary');
            }
          } catch {
            clearInterval(poll);
          }
        }, 1500);
      } else {
        setStep('summary');
      }
    } catch (e) {
      setError(normalizeApiError(e).message);
      setStep('mapping');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setJob(null);
    setStep('upload');
    setError(null);
  };

  if (!ctx) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border-color bg-card-bg p-6">
        <h2 className="text-lg font-semibold text-text-primary">Import from Excel or CSV</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Upload an Excel (.xlsx) or CSV file, map columns to fields, and import records.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {step === 'upload' && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-text-secondary">Select Excel or CSV file</label>
            <input
              type="file"
              accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={handleFileChange}
              className="mt-2 block w-full max-w-md text-sm text-text-secondary"
            />
            <p className="mt-1 text-xs text-text-secondary">
              Excel (.xlsx) or CSV. First row should contain column headers.
            </p>
          </div>
        )}

        {step === 'mapping' && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-text-secondary">
              Map each column to a field. Leave unmapped to skip.
            </p>
            <div className="space-y-2">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-3">
                  <span className="w-40 truncate text-sm font-medium text-text-primary">{h}</span>
                  <span className="text-text-secondary">→</span>
                  <select
                    value={mapping[h] ?? ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [h]: e.target.value }))}
                    className="rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-sm text-text-primary"
                  >
                    <option value="">— Skip —</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.display_name} ({f.field_type})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-secondary">
              Preview: {rows.length} data row{rows.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-md border border-border-color px-3 py-1.5 text-sm"
              >
                Choose different file
              </button>
              <button
                type="button"
                onClick={handleStartImport}
                disabled={loading || Object.values(mapping).filter(Boolean).length === 0}
                className="rounded-md border border-border-color bg-bg-secondary px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Importing…' : 'Start import'}
              </button>
            </div>
          </div>
        )}

        {step === 'running' && (
          <div className="mt-6 py-8 text-center">
            <p className="text-text-secondary">Importing…</p>
            {job && (
              <p className="mt-2 text-sm text-text-secondary">Status: {job.status}</p>
            )}
          </div>
        )}

        {step === 'summary' && job && (
          <div className="mt-6 space-y-4">
            <h3 className="font-medium text-text-primary">Import complete</h3>
            <div className="rounded-lg border border-border-color bg-bg-primary p-4">
              <p>Succeeded: {(job.stats as Record<string, number>).succeeded ?? 0}</p>
              <p>Failed: {(job.stats as Record<string, number>).failed ?? 0}</p>
              <p>Total: {(job.stats as Record<string, number>).total ?? 0}</p>
            </div>
            {((job.error_report as Record<string, unknown[]>).rows?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                <p className="font-medium text-amber-800 dark:text-amber-400">Some rows failed</p>
                <pre className="mt-2 max-h-40 overflow-auto text-xs">
                  {JSON.stringify((job.error_report as Record<string, unknown>).rows, null, 2)}
                </pre>
              </div>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md border border-border-color bg-bg-secondary px-3 py-1.5 text-sm"
            >
              Import another file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
