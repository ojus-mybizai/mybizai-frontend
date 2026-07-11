'use client';

/**
 * The ONE block registry. This single switch on block.type is the only place
 * that maps a block to its renderer — adding a widget = one renderer file + one
 * case here. Everything (AgentSurface, tabs, saved-view previews) renders blocks
 * through <BlockRenderer>.
 */
import type { Block, Callback } from '@/lib/agent-blocks';
import MarkdownBlockView from './MarkdownBlock';
import ChartBlockView from './ChartBlock';
import StatBlockView from './StatBlock';
import TableBlockView from './TableBlock';
import TabsBlockView from './TabsBlock';
import ChoiceBlockView from './ChoiceBlock';
import FormBlockView from './FormBlock';
import ProposalBlockView from './ProposalBlock';
import SectionBlockView from './SectionBlock';
import GridBlockView from './GridBlock';
import CardBlockView from './CardBlock';
import MediaBlockView from './MediaBlock';

export interface BlockRendererProps {
  block: Block;
  /** Called when an interactive block (choice/form/proposal) is acted on. */
  onCallback?: (cb: Callback) => void;
  /** When true, interactive blocks render read-only (older turns, saved views). */
  disabled?: boolean;
}

export function BlockRenderer({ block, onCallback, disabled = false }: BlockRendererProps) {
  const cb = onCallback ?? (() => {});
  switch (block.type) {
    case 'markdown':
      return <MarkdownBlockView block={block} onCallback={cb} disabled={disabled} />;
    case 'chart':
      return <ChartBlockView block={block} onCallback={cb} disabled={disabled} />;
    case 'stat':
      return <StatBlockView block={block} onCallback={cb} disabled={disabled} />;
    case 'table':
      return <TableBlockView block={block} onCallback={cb} disabled={disabled} />;
    case 'tabs':
      return <TabsBlockView block={block} onCallback={cb} disabled={disabled} />;
    case 'choice':
      return <ChoiceBlockView block={block} onCallback={cb} disabled={disabled} />;
    case 'form':
      return <FormBlockView block={block} onCallback={cb} disabled={disabled} />;
    case 'proposal':
      return <ProposalBlockView block={block} onCallback={cb} disabled={disabled} />;
    case 'section':
      return <SectionBlockView block={block} onCallback={cb} disabled={disabled} />;
    case 'grid':
      return <GridBlockView block={block} onCallback={cb} disabled={disabled} />;
    case 'card':
      return <CardBlockView block={block} onCallback={cb} disabled={disabled} />;
    case 'media':
      return <MediaBlockView block={block} onCallback={cb} disabled={disabled} />;
    default: {
      // Unknown future block type — fail soft so one bad block never blanks the thread.
      const unknown = block as { type?: string };
      return (
        <div className="rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-xs text-text-secondary">
          Unsupported block type: {String(unknown.type)}
        </div>
      );
    }
  }
}

/** Render an ordered list of blocks with spacing. Used by messages, tabs, saved views. */
export function BlockList({
  blocks,
  onCallback,
  disabled = false,
}: {
  blocks: Block[];
  onCallback?: (cb: Callback) => void;
  disabled?: boolean;
}) {
  if (!blocks?.length) return null;
  return (
    <div className="space-y-3">
      {blocks.map((b) => (
        <BlockRenderer key={b.id} block={b} onCallback={onCallback} disabled={disabled} />
      ))}
    </div>
  );
}
