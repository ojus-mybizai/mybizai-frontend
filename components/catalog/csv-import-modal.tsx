'use client';

import { useState, type ChangeEvent } from 'react';

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CsvImportModal({ open, onClose }: CsvImportModalProps) {
  const [fileName, setFileName] = useState<string | null>(null);

  if (!open) return null;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFileName(file ? file.name : null);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border-color bg-card-bg p-5 shadow-lg space-y-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Import catalog from CSV</h2>
          <p className="text-sm text-text-secondary mt-1">
            Select a CSV file to import catalog items. Header mapping and preview will be added in a later step.
          </p>
        </div>

        <div className="space-y-2">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-text-secondary"
          />
          {fileName && (
            <div className="text-xs text-text-secondary">Selected file: {fileName}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 text-sm pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border-color bg-bg-primary px-3 py-1.5 text-text-secondary hover:text-text-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
