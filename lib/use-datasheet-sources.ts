'use client';

import { useEffect, useRef, useState } from 'react';
import { getTemplateDatasheetSources, type DatasheetSource } from '@/services/message-templates';
import { queryRecords } from '@/services/dynamic-data';

/** One row option for the Default Row picker. */
export interface DatasheetRowOption {
  id: number;
  label: string;
}

export interface UseDatasheetSourcesResult {
  /** All active datasheets with field metadata + lead-relation info. */
  sources: DatasheetSource[];
  /**
   * For non-lead-linked datasheets only: map of model_id → row options
   * suitable for rendering a "Default Row" picker.
   * Populated lazily after sources are fetched.
   */
  rowsByModel: Record<number, DatasheetRowOption[]>;
  loading: boolean;
}

/**
 * Fetches all datasheet sources for the template variable picker in one call,
 * then pre-loads the first 50 records for every non-lead-linked datasheet so
 * the Default Row picker is immediately populated without extra round-trips.
 */
export function useDatasheetSources(): UseDatasheetSourcesResult {
  const [sources, setSources] = useState<DatasheetSource[]>([]);
  const [rowsByModel, setRowsByModel] = useState<Record<number, DatasheetRowOption[]>>({});
  const [loading, setLoading] = useState(true);
  // Guard against double-fetch in StrictMode
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const srcs = await getTemplateDatasheetSources();
        if (cancelled) return;
        setSources(srcs);

        // Pre-load row options for non-lead-linked datasheets only.
        // Lead-linked sheets resolve per-recipient at send time — no picker needed.
        const staticSheets = srcs.filter((s) => !s.has_lead_relation);
        if (!staticSheets.length) return;

        const entries = await Promise.all(
          staticSheets.map(async (s) => {
            try {
              const res = await queryRecords(s.model_id, { per_page: 50 });
              // Pick the first text-like field as the display label
              const labelField = s.fields.find((f) =>
                ['text', 'short_text', 'long_text', 'number', 'currency', 'phone'].includes(f.field_type)
              );
              const rows: DatasheetRowOption[] = (res.items ?? []).map((rec, idx) => {
                const id = typeof rec.id === 'number' ? rec.id : idx + 1;
                const labelVal = labelField ? rec[labelField.name] : undefined;
                return {
                  id,
                  label: labelVal != null ? String(labelVal) : `Row #${id}`,
                };
              });
              return { model_id: s.model_id, rows };
            } catch {
              return { model_id: s.model_id, rows: [] };
            }
          }),
        );

        if (cancelled) return;
        const map: Record<number, DatasheetRowOption[]> = {};
        for (const { model_id, rows } of entries) {
          map[model_id] = rows;
        }
        setRowsByModel(map);
      } catch {
        // Silently degrade — variable picker will still show lead.* and business.* sources
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { sources, rowsByModel, loading };
}
