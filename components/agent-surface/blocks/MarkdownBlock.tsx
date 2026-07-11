'use client';

import type { MarkdownBlock } from '@/lib/agent-blocks';
import Markdown from '../Markdown';
import type { BlockProps } from './types';

export default function MarkdownBlockView({ block }: BlockProps<MarkdownBlock>) {
  return <Markdown text={block.text} />;
}
