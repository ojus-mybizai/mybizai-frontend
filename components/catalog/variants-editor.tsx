'use client';

import { useEffect, useState, type ChangeEvent } from 'react';

interface VariantsEditorProps {
  value: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown> | null) => void;
}

export default function VariantsEditor({ value, onChange }: VariantsEditorProps) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (value && Object.keys(value).length > 0) {
      try {
        setRaw(JSON.stringify(value, null, 2));
      } catch {
        setRaw('');
      }
    } else {
      setRaw('');
    }
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    setRaw(text);
    if (!text.trim()) {
      setError(null);
      onChange(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setError(null);
        onChange(parsed as Record<string, unknown>);
      } else {
        setError('Variants must be a JSON object (e.g. { "size": ["S", "M"] }).');
      }
    } catch {
      setError('Invalid JSON.');
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-secondary">
        Optional structured variant data, stored as JSON. Example:{' "size": ["S", "M", "L"]'}.
      </p>
      <textarea
        rows={5}
        value={raw}
        onChange={handleChange}
        placeholder='e.g. {"size": ["S", "M", "L"]}'
        className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
