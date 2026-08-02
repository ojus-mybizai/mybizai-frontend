'use client';

import { useCallback, useEffect, useState } from 'react';
import { Table2, AlertCircle } from 'lucide-react';
import {
  getContactData,
  updateRecord,
  deleteRecord,
  type ContactDataSection,
  type LinkedRecordItem,
} from '@/services/dynamic-data';
import { useAuthStore } from '@/lib/auth-store';

import { DataSection } from './data-section';
import { RecordDrawer } from './record-drawer';

interface DrawerTarget {
  sectionIdx: number;
  recordId: number;
}

/** Title = the value of the server-picked title_field, else empty (row falls back to record_key). */
function computeTitle(section: ContactDataSection, data: Record<string, unknown>): string {
  const name = section.title_field;
  if (name) {
    const v = data[name];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v !== null && v !== undefined && v !== '') return String(v);
  }
  return '';
}

export function DataTab({ contactId }: { contactId: number }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('manage_work');

  const [sections, setSections] = useState<ContactDataSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getContactData(contactId)
      .then((res) => {
        if (!cancelled) setSections(res.sections);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  // ── State patches ──────────────────────────────────────────────
  const prependRecord = useCallback((sectionIdx: number, rec: LinkedRecordItem) => {
    setSections((prev) =>
      prev.map((s, i) => (i === sectionIdx ? { ...s, records: [rec, ...s.records] } : s)),
    );
  }, []);

  const patchRecord = useCallback(
    (sectionIdx: number, recordId: number, patch: Partial<LinkedRecordItem>) => {
      setSections((prev) =>
        prev.map((s, i) =>
          i === sectionIdx
            ? { ...s, records: s.records.map((r) => (r.id === recordId ? { ...r, ...patch } : r)) }
            : s,
        ),
      );
    },
    [],
  );

  const removeRecordFromState = useCallback((sectionIdx: number, recordId: number) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIdx ? { ...s, records: s.records.filter((r) => r.id !== recordId) } : s,
      ),
    );
  }, []);

  // ── Mutations (API + state) ────────────────────────────────────
  const handleCreated = (sectionIdx: number) => (rec: LinkedRecordItem) => {
    const section = sections[sectionIdx];
    prependRecord(sectionIdx, { ...rec, title: computeTitle(section, rec.data) });
  };

  const handleSaveField =
    (sectionIdx: number, recordId: number) => async (fieldName: string, value: unknown) => {
      const section = sections[sectionIdx];
      const updated = await updateRecord(section.model_id, recordId, {
        data: { [fieldName]: value },
        mode: 'merge',
      });
      const newData = updated.data ?? {};
      patchRecord(sectionIdx, recordId, {
        data: newData,
        title: computeTitle(section, newData),
      });
    };

  const handleUnlink = (sectionIdx: number) => async (record: LinkedRecordItem) => {
    const section = sections[sectionIdx];
    const name = section.relation_field_name;
    const kind = section.relation_kind;
    let newValue: unknown = null;
    if (kind === 'many_to_many' || kind === 'one_to_many') {
      const cur = record.data[name];
      const arr = Array.isArray(cur)
        ? cur.map(Number)
        : cur !== null && cur !== undefined
          ? [Number(cur)]
          : [];
      newValue = arr.filter((id) => id !== Number(contactId));
    }
    await updateRecord(section.model_id, record.id, {
      data: { [name]: newValue },
      mode: 'merge',
    });
    removeRecordFromState(sectionIdx, record.id);
  };

  const handleDelete = (sectionIdx: number) => async (record: LinkedRecordItem) => {
    const section = sections[sectionIdx];
    await deleteRecord(section.model_id, record.id);
    removeRecordFromState(sectionIdx, record.id);
  };

  // ── Render ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-2xl border border-border-color bg-card-bg p-4 shadow-sm">
        <div className="h-4 w-32 animate-pulse rounded bg-bg-primary" />
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-bg-primary" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-bg-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-border-color bg-card-bg p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      </section>
    );
  }

  if (sections.length === 0) {
    return (
      <section className="rounded-2xl border border-border-color bg-card-bg p-4 shadow-sm">
        <header className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-bg-primary text-text-secondary">
            <Table2 className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold text-text-primary">Data</h2>
        </header>
        <p className="text-sm text-text-secondary">
          No datasheets are linked to contacts yet. Create a datasheet with a
          Contact relation field to start capturing records here.
        </p>
      </section>
    );
  }

  const drawerSection = drawer ? sections[drawer.sectionIdx] : null;
  const drawerRecord =
    drawerSection?.records.find((r) => r.id === drawer!.recordId) ?? null;

  return (
    <div className="space-y-4">
      {sections.map((section, idx) => (
        <DataSection
          key={`${section.model_id}-${section.relation_field_id}`}
          section={section}
          contactId={contactId}
          canManage={canManage}
          onOpenDrawer={(recordId) => setDrawer({ sectionIdx: idx, recordId })}
          onCreated={handleCreated(idx)}
          onUnlink={handleUnlink(idx)}
          onDelete={handleDelete(idx)}
        />
      ))}

      {drawer && drawerSection && drawerRecord && (
        <RecordDrawer
          section={drawerSection}
          record={drawerRecord}
          canManage={canManage}
          onClose={() => setDrawer(null)}
          onSaveField={handleSaveField(drawer.sectionIdx, drawer.recordId)}
          onUnlink={async () => {
            await handleUnlink(drawer.sectionIdx)(drawerRecord);
            setDrawer(null);
          }}
          onDelete={async () => {
            await handleDelete(drawer.sectionIdx)(drawerRecord);
            setDrawer(null);
          }}
        />
      )}
    </div>
  );
}
