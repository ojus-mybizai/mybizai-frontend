'use client';

import type { UIBlock } from '@/types/ui-protocol';
import TableRenderer from './TableRenderer';
import FormRenderer from './FormRenderer';
import dynamic from 'next/dynamic';
const ChartRenderer = dynamic(() => import('./ChartRenderer'), { ssr: false });
import CardRenderer from './CardRenderer';
import ModalRenderer from './ModalRenderer';
import ConfirmationRenderer from './ConfirmationRenderer';

export interface DynamicRendererProps {
  blocks: UIBlock[];
}

export default function DynamicRenderer({ blocks }: DynamicRendererProps) {
  if (!blocks?.length) return null;

  return (
    <div className="mt-3 space-y-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'text':
            return (
              <div key={i} className="text-base text-text-primary whitespace-pre-wrap">
                {block.content}
              </div>
            );
          case 'table':
            return <TableRenderer key={i} block={block} />;
          case 'form':
            return <FormRenderer key={i} block={block} />;
          case 'chart':
            return <ChartRenderer key={i} block={block} />;
          case 'card':
            return <CardRenderer key={i} block={block} />;
          case 'modal':
            return <ModalRenderer key={i} block={block} />;
          case 'confirmation':
            return <ConfirmationRenderer key={i} block={block} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
