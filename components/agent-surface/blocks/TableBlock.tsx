'use client';

import type { TableBlock } from '@/lib/agent-blocks';
import type { BlockProps } from './types';

function cell(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default function TableBlockView({ block }: BlockProps<TableBlock>) {
  return (
    <div className="rounded-2xl border border-border-color bg-card-bg p-4 shadow-sm">
      {block.title && <h3 className="mb-3 text-sm font-semibold tracking-tight text-text-primary">{block.title}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {block.columns.map((c, i) => (
                <th key={i} className="border-b border-border-color px-2.5 py-1.5 text-left font-semibold text-text-secondary">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-bg-secondary/50">
                {block.columns.map((_, ci) => (
                  <td key={ci} className="border-b border-border-color px-2.5 py-1.5 align-top text-text-primary">
                    {cell(row[ci])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {block.rows.length === 0 && <p className="px-2 py-3 text-sm text-text-secondary">No rows.</p>}
      </div>
    </div>
  );
}
