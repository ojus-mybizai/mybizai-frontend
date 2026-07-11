'use client';

/**
 * Media: an image, an icon, or a badge. Rendered standalone (the `media` block)
 * and inside cards (card.media reuses <MediaView>). Images render an <img>;
 * icon/badge render a compact labeled pill (no dynamic icon-font import — the
 * AI emits a name/label, not arbitrary markup).
 */
import type { Media, MediaBlock } from '@/lib/agent-blocks';
import { useAttachmentUrl } from '@/lib/use-attachment-url';
import type { BlockProps } from './types';

export function MediaView({ media }: { media: Media }) {
  // Resolve a datasheet attachment id to a fresh signed URL (hook is no-op when absent).
  const resolved = useAttachmentUrl(media.attachment_id);
  if (media.kind === 'image') {
    const src = media.src ?? resolved;
    if (!src) {
      // Still resolving (or no source) — a neutral placeholder, not a broken img.
      return <div className="h-32 w-full animate-pulse rounded-lg bg-bg-secondary" />;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={media.alt ?? media.name ?? ''}
        className="max-h-48 w-full rounded-lg object-cover"
      />
    );
  }
  const label = media.name ?? media.alt ?? '';
  if (!label) return null;
  if (media.kind === 'badge') {
    return (
      <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
        {label}
      </span>
    );
  }
  // icon
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-bg-secondary text-xs font-semibold text-text-secondary">
      {label.slice(0, 2)}
    </span>
  );
}

export default function MediaBlockView({ block }: BlockProps<MediaBlock>) {
  const { kind, src, name, alt } = block;
  return <MediaView media={{ kind, src, name, alt }} />;
}
