'use client';

import React, { useEffect, useState } from 'react';
import BuilderView from './builder-view';
import type { BusinessProcess, ProcessStage } from '@/services/processes';
import { Icon } from './design-system';

interface Props {
  process: BusinessProcess;
  stages: ProcessStage[];
  onReload: () => void;
}

type Section = 'stages' | 'general';

export default function SettingsView({ process, stages, onReload }: Props) {
  const [section, setSection] = useState<Section>('stages');

  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
      <nav className="space-y-1">
        <RailItem active={section === 'stages'}  onClick={() => setSection('stages')}  icon={<Icon.list size={14} />}  label="Stages & automation" />
        <RailItem active={section === 'general'} onClick={() => setSection('general')} icon={<Icon.gear size={14} />} label="General" />
      </nav>
      <div>
        {section === 'stages'  && <BuilderView process={process} stages={stages} onReload={onReload} />}
        {section === 'general' && <GeneralSettings process={process} />}
      </div>
    </div>
  );
}

function RailItem({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-quick text-left
        ${active ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function GeneralSettings({ process }: { process: BusinessProcess }) {
  return (
    <div className="rounded-xl border border-border-color bg-card-bg p-5">
      <h2 className="text-base font-semibold text-text-primary mb-2">General</h2>
      <dl className="text-sm space-y-2">
        <div className="flex justify-between border-b border-border-color pb-2">
          <dt className="text-text-secondary">Name</dt>
          <dd className="font-medium text-text-primary">{process.name}</dd>
        </div>
        <div className="flex justify-between border-b border-border-color pb-2">
          <dt className="text-text-secondary">Entity</dt>
          <dd className="font-medium text-text-primary capitalize">
            {process.entity_type === 'datasheet_record' ? process.dynamic_model_name : process.entity_type}
          </dd>
        </div>
        <div className="flex justify-between border-b border-border-color pb-2">
          <dt className="text-text-secondary">Status</dt>
          <dd className="font-medium text-text-primary capitalize">{process.status}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-secondary">Total entries</dt>
          <dd className="font-medium text-text-primary tabular-nums">{process.total_entries}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-text-secondary">
        Use <strong>Stages &amp; automation</strong> to reorder stages, set SLAs and win probabilities, and configure automation rules.
      </p>
    </div>
  );
}
