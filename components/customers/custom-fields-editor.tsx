'use client';

import { useState, useEffect } from 'react';

interface KeyValuePair {
  id: string;
  key: string;
  value: any;
  type: 'text' | 'number' | 'boolean' | 'date';
}

interface CustomFieldsEditorProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
  onSave?: () => void;
  onCancel?: () => void;
  className?: string;
  placeholder?: {
    key?: string;
    value?: string;
  };
}

const typeOptions = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
];

// System fields that should be excluded from custom fields editor
const SYSTEM_FIELDS = ['lead_level_score', 'last_score_update'];

export function CustomFieldsEditor({
  data,
  onChange,
  onSave,
  onCancel,
  className = '',
  placeholder = { key: 'Field name (e.g., budget, location)', value: 'Field value' },
}: CustomFieldsEditorProps) {
  // Filter out system fields
  const customData = Object.entries(data || {})
    .filter(([key]) => !SYSTEM_FIELDS.includes(key))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

  const [pairs, setPairs] = useState<KeyValuePair[]>(() => {
    return Object.entries(customData).map(([key, value]) => ({
      id: crypto.randomUUID(),
      key,
      value,
      type: inferType(value),
    }));
  });

  // Use a ref to track if we should update from props
  const [initialDataHash, setInitialDataHash] = useState(() => JSON.stringify(data));
  
  useEffect(() => {
    // Only update if data prop changed externally (e.g., after save)
    const currentDataHash = JSON.stringify(data);
    if (currentDataHash !== initialDataHash) {
      const customData = Object.entries(data || {})
        .filter(([key]) => !SYSTEM_FIELDS.includes(key))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
      
      const newPairs = Object.entries(customData).map(([key, value]) => ({
        id: crypto.randomUUID(),
        key,
        value,
        type: inferType(value),
      }));
      setPairs(newPairs);
      setInitialDataHash(currentDataHash);
    }
  }, [data, initialDataHash]);

  function inferType(value: any): 'text' | 'number' | 'boolean' | 'date' {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('-')) return 'date';
    return 'text';
  }

  function convertValue(value: string, type: 'text' | 'number' | 'boolean' | 'date'): any {
    switch (type) {
      case 'number':
        return value === '' ? null : Number(value);
      case 'boolean':
        return value === 'true';
      case 'date':
        return value;
      default:
        return value;
    }
  }

  function formatValueForInput(value: any, type: 'text' | 'number' | 'boolean' | 'date'): string {
    if (value === null || value === undefined) return '';
    if (type === 'boolean') return String(value);
    if (type === 'date' && typeof value === 'string') {
      // Format date for input field
      return value.split('T')[0];
    }
    return String(value);
  }

  const getDataFromPairs = (pairsToConvert: KeyValuePair[]): Record<string, any> => {
    const newData: Record<string, any> = {};
    pairsToConvert.forEach((pair) => {
      if (pair.key.trim() && !SYSTEM_FIELDS.includes(pair.key)) {
        newData[pair.key] = convertValue(String(pair.value), pair.type);
      }
    });
    return newData;
  };

  const handleSave = () => {
    const newData = getDataFromPairs(pairs);
    onChange(newData);
    if (onSave) {
      onSave();
    }
  };

  const addPair = () => {
    const newPair: KeyValuePair = {
      id: crypto.randomUUID(),
      key: '',
      value: '',
      type: 'text',
    };
    const newPairs = [...pairs, newPair];
    setPairs(newPairs);
  };

  const removePair = (id: string) => {
    const newPairs = pairs.filter((pair) => pair.id !== id);
    setPairs(newPairs);
  };

  const updatePair = (id: string, updates: Partial<KeyValuePair>) => {
    const newPairs = pairs.map((pair) => (pair.id === id ? { ...pair, ...updates } : pair));
    setPairs(newPairs);
  };

  const handleKeyChange = (id: string, key: string) => {
    updatePair(id, { key });
  };

  const handleValueChange = (id: string, value: string) => {
    updatePair(id, { value });
  };

  const handleTypeChange = (id: string, type: 'text' | 'number' | 'boolean' | 'date') => {
    const pair = pairs.find((p) => p.id === id);
    if (pair) {
      let newValue = pair.value;
      if (type === 'boolean') {
        newValue = false;
      } else if (type === 'number') {
        newValue = 0;
      } else if (type === 'date') {
        newValue = new Date().toISOString().split('T')[0];
      } else {
        newValue = String(pair.value || '');
      }
      updatePair(id, { type, value: newValue });
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {pairs.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-border-color rounded-lg">
          <div className="text-text-secondary mb-4">No custom fields added yet</div>
          <button
            type="button"
            onClick={addPair}
            className="rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm font-semibold text-text-primary hover:border-accent"
          >
            + Add Field
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-text-secondary mb-2 px-1">
              <div className="col-span-4">Field Name</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-5">Value</div>
              <div className="col-span-1"></div>
            </div>
            {pairs.map((pair) => (
              <div
                key={pair.id}
                className="grid grid-cols-12 gap-2 items-center p-3 border border-border-color rounded-lg bg-bg-primary"
              >
                {/* Key Input */}
                <div className="col-span-4">
                  <input
                    type="text"
                    value={pair.key}
                    onChange={(e) => handleKeyChange(pair.id, e.target.value)}
                    placeholder="e.g., budget, location"
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                {/* Type Selector */}
                <div className="col-span-2">
                  <select
                    value={pair.type}
                    onChange={(e) => handleTypeChange(pair.id, e.target.value as any)}
                    className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {typeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Value Input */}
                <div className="col-span-5">
                  {pair.type === 'boolean' ? (
                    <select
                      value={String(pair.value)}
                      onChange={(e) => handleValueChange(pair.id, e.target.value)}
                      className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : (
                    <input
                      type={pair.type === 'date' ? 'date' : pair.type === 'number' ? 'number' : 'text'}
                      value={formatValueForInput(pair.value, pair.type)}
                      onChange={(e) => handleValueChange(pair.id, e.target.value)}
                      placeholder="Enter value"
                      className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  )}
                </div>

                {/* Remove Button */}
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={() => removePair(pair.id)}
                    className="w-full rounded-md border border-red-300 bg-red-50 px-2 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                    title="Remove field"
                    aria-label="Remove field"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={addPair}
              className="flex-1 rounded-md border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
            >
              + Add Field
            </button>
            {onSave && (
              <>
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-md border border-border-color bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary hover:border-accent"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Save
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}