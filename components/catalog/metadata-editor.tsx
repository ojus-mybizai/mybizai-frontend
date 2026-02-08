'use client';

import { useEffect, useState, type ChangeEvent } from 'react';

interface MetadataEditorProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  templateKeys?: string[];
  // Used to know when we should re-initialize rows from an external change
  // such as loading a different catalog item.
  contextKey?: string | number;
}

interface Row {
  key: string;
  value: string;
}

export default function MetadataEditor({ value, onChange, templateKeys, contextKey }: MetadataEditorProps) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const existingKeys = Object.keys(value || {});
    const mergedKeys = new Set<string>([...existingKeys, ...(templateKeys ?? [])]);
    const nextRows: Row[] = [];
    mergedKeys.forEach((key) => {
      const current = value && typeof value[key] === 'string' ? String(value[key]) : '';
      nextRows.push({ key, value: current });
    });
    if (nextRows.length === 0) {
      nextRows.push({ key: '', value: '' });
    }
    setRows(nextRows);
  }, [contextKey, templateKeys]);

  const syncBack = (rowsToSync: Row[]) => {
    const result: Record<string, unknown> = {};
    for (const row of rowsToSync) {
      const key = row.key.trim();
      const val = row.value.trim();
      if (!key || !val) continue;
      result[key] = val;
    }
    onChange(result);
  };

  const handleRowChange = (index: number, field: 'key' | 'value', event: ChangeEvent<HTMLInputElement>) => {
    const next = rows.map((row, i) =>
      i === index
        ? {
            ...row,
            [field]: event.target.value,
          }
        : row,
    );
    setRows(next);
    syncBack(next);
  };

  const handleAddRow = () => {
    const next = [...rows, { key: '', value: '' }];
    setRows(next);
  };

  const handleRemoveRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    setRows(next.length ? next : [{ key: '', value: '' }]);
    syncBack(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          Store additional searchable attributes such as brand, material, or collection.
        </p>
        <button
          type="button"
          onClick={handleAddRow}
          className="text-[11px] font-medium text-accent hover:underline"
        >
          Add field
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={row.key}
              onChange={(e) => handleRowChange(index, 'key', e)}
              placeholder="Key (e.g. brand)"
              className="w-32 rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <input
              type="text"
              value={row.value}
              onChange={(e) => handleRowChange(index, 'value', e)}
              placeholder="Value"
              className="flex-1 rounded-md border border-border-color bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              onClick={() => handleRemoveRow(index)}
              className="text-[11px] text-text-secondary hover:text-text-primary"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
