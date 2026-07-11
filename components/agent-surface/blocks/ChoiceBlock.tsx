'use client';

import type { ChoiceBlock } from '@/lib/agent-blocks';
import OptionSelect from './OptionSelect';
import type { BlockProps } from './types';

/**
 * Renders the dedicated `OptionSelect` (Phase 1 look). OptionSelect works in
 * option VALUES directly, so we just forward the picked value(s) into the select
 * callback — single-select emits `{ value }`, multi emits `{ values }`.
 * (Custom free-text answers go through the main composer.)
 */
export default function ChoiceBlockView({ block, onCallback, disabled }: BlockProps<ChoiceBlock>) {
  const handleSelect = (picked: string[]) => {
    if (block.multi) {
      onCallback({ block_id: block.id, action: 'select', values: { values: picked } });
    } else {
      onCallback({ block_id: block.id, action: 'select', values: { value: picked[0] } });
    }
  };

  return (
    <OptionSelect
      prompt={block.prompt}
      options={block.options}
      multi={block.multi}
      allowCustom={block.allow_custom}
      disabled={disabled}
      onSelect={handleSelect}
    />
  );
}
