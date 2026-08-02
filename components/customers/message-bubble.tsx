'use client';

import { useEffect, useState } from 'react';
import { formatTime as fmtTime, formatDateTime as fmtDateTime } from '@/lib/format-date';
import {
  AlertCircle,
  CheckCheck,
  Clock,
  Download,
  FileText,
  List,
  Loader2,
  MapPin,
  MousePointerClick,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import type {
  ButtonReplyMetadata,
  ContactsMetadata,
  InteractiveButtonsMetadata,
  ListReplyMetadata,
  LocationMetadata,
  MediaMetadata,
  Message,
  MessageMetadata,
  TemplateMetadata,
} from '@/services/customers';

function cx(...classes: Array<boolean | string | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatMessageTime(timestamp: string): string {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return fmtTime(d);
  }
  return fmtDateTime(d);
}

function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type MessageWithMeta = Message & {
  tool_called?: string | null;
  tool_status?: 'success' | 'error' | 'timeout' | 'cancelled' | null;
  intent?: string | null;
};

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document', 'sticker']);

/** "[Image]", "[Non-text message]" etc. — backend placeholder when there's no caption */
function isPlaceholderText(content: string | null | undefined): boolean {
  return /^\[[A-Za-z -]+\]$/.test((content ?? '').trim());
}

/**
 * Render a small status indicator next to the timestamp on outgoing bubbles.
 * Driven by Meta's webhook receipts (see backend/app/services/delivery_receipts.py).
 *
 *   failed       → red ⚠ with tooltip showing the Meta error
 *   read         → blue ✓✓
 *   delivered    → ✓✓
 *   pending      → clock (Meta accepted but no delivery receipt yet)
 *   undefined    → no icon (legacy/no-receipt channels)
 */
function DeliveryStatus({ message }: { message: MessageWithMeta }) {
  if (message.error_code) {
    return (
      <span
        title={message.error_detail || message.error_code}
        className="inline-flex items-center gap-0.5 text-red-200"
      >
        <AlertCircle className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Failed</span>
      </span>
    );
  }
  if (message.read) {
    return <CheckCheck className="h-3.5 w-3.5 text-sky-200" aria-label="Read" />;
  }
  if (message.delivered) {
    return <CheckCheck className="h-3.5 w-3.5 text-white/70" aria-label="Delivered" />;
  }
  if (message.delivered === false) {
    return <Clock className="h-3.5 w-3.5 text-white/70" aria-label="Pending" />;
  }
  return null;
}

/* ─── Media (image / video / audio / document / sticker) ──────────────────── */

function MediaAttachment({ meta, isAssistant }: { meta: MediaMetadata; isAssistant: boolean }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [lightboxOpen]);

  if (meta.status === 'pending') {
    return (
      <div
        className={cx(
          'flex h-40 w-56 max-w-full items-center justify-center rounded-lg',
          isAssistant ? 'bg-white/15' : 'bg-bg-secondary',
        )}
        aria-label="Media downloading"
      >
        <Loader2 className={cx('h-6 w-6 animate-spin', isAssistant ? 'text-white/70' : 'text-text-secondary')} />
      </div>
    );
  }

  if (meta.status === 'failed' || !meta.url) {
    return (
      <div
        className={cx(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
          isAssistant ? 'border-white/30 text-white/80' : 'border-border-color text-text-secondary',
        )}
        title={meta.error ?? undefined}
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{meta.type === 'image' ? 'Image' : meta.type === 'video' ? 'Video' : meta.type === 'audio' ? 'Audio' : 'File'} unavailable</span>
      </div>
    );
  }

  switch (meta.type) {
    case 'image':
    case 'sticker': {
      const isSticker = meta.type === 'sticker';
      return (
        <>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block focus:outline-none focus:ring-2 focus:ring-accent rounded-lg"
            title="View full size"
          >
            {/* eslint-disable-next-line @next/next/no-img-element — presigned S3 URLs are short-lived; next/image optimization would break/cache them */}
            <img
              src={meta.url}
              alt={meta.caption || meta.filename || 'Image'}
              loading="lazy"
              className={cx(
                'rounded-lg object-cover',
                isSticker ? 'h-28 w-28' : 'max-h-80 w-auto max-w-full',
              )}
            />
          </button>
          {lightboxOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => setLightboxOpen(false)}
              role="dialog"
              aria-modal="true"
            >
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={meta.url}
                alt={meta.caption || 'Image'}
                className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </>
      );
    }

    case 'video':
      return (
        <video
          src={meta.url}
          controls
          preload="metadata"
          className="max-h-64 w-auto max-w-full rounded-lg"
        />
      );

    case 'audio':
      return <audio src={meta.url} controls preload="metadata" className="w-60 max-w-full" />;

    case 'document':
    default: {
      const size = formatBytes(meta.size_bytes);
      return (
        <a
          href={meta.url}
          target="_blank"
          rel="noreferrer"
          className={cx(
            'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
            isAssistant
              ? 'border-white/30 hover:bg-white/10'
              : 'border-border-color bg-bg-secondary/40 hover:bg-bg-secondary',
          )}
          title="Open file"
        >
          <FileText className={cx('h-7 w-7 shrink-0', isAssistant ? 'text-white/90' : 'text-accent')} />
          <span className="min-w-0">
            <span className={cx('block truncate text-sm font-medium', isAssistant ? 'text-white' : 'text-text-primary')}>
              {meta.filename || 'Document'}
            </span>
            <span className={cx('block text-xs', isAssistant ? 'text-white/70' : 'text-text-secondary')}>
              {[meta.mime_type?.split('/')[1]?.toUpperCase(), size].filter(Boolean).join(' · ') || 'File'}
            </span>
          </span>
          <Download className={cx('ml-1 h-4 w-4 shrink-0', isAssistant ? 'text-white/70' : 'text-text-secondary')} />
        </a>
      );
    }
  }
}

/* ─── Location ─────────────────────────────────────────────────────────────── */

function LocationCard({ meta, isAssistant }: { meta: LocationMetadata; isAssistant: boolean }) {
  const hasCoords = meta.latitude != null && meta.longitude != null;
  const mapsUrl = hasCoords ? `https://www.google.com/maps?q=${meta.latitude},${meta.longitude}` : null;
  const card = (
    <div
      className={cx(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
        isAssistant ? 'border-white/30' : 'border-border-color bg-bg-secondary/40',
        mapsUrl && 'transition-colors',
        mapsUrl && (isAssistant ? 'hover:bg-white/10' : 'hover:bg-bg-secondary'),
      )}
    >
      <MapPin className={cx('mt-0.5 h-5 w-5 shrink-0', isAssistant ? 'text-white/90' : 'text-red-500')} />
      <span className="min-w-0">
        <span className={cx('block text-sm font-medium', isAssistant ? 'text-white' : 'text-text-primary')}>
          {meta.name || 'Shared location'}
        </span>
        {meta.address && (
          <span className={cx('block text-xs', isAssistant ? 'text-white/70' : 'text-text-secondary')}>
            {meta.address}
          </span>
        )}
        {mapsUrl && (
          <span className={cx('block text-xs underline mt-0.5', isAssistant ? 'text-white/80' : 'text-accent')}>
            Open in Google Maps
          </span>
        )}
      </span>
    </div>
  );
  if (!mapsUrl) return card;
  return (
    <a href={mapsUrl} target="_blank" rel="noreferrer" className="block">
      {card}
    </a>
  );
}

/* ─── Button / list replies (inbound quick-reply taps) ─────────────────────── */

function ReplyChip({ meta, isAssistant }: { meta: ButtonReplyMetadata | ListReplyMetadata; isAssistant: boolean }) {
  const isList = meta.type === 'list_reply';
  return (
    <div
      className={cx(
        'mb-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        isAssistant ? 'border-white/40 text-white/90' : 'border-accent/40 bg-accent/10 text-accent',
      )}
      title={isList ? 'Selected from a list' : 'Tapped a quick-reply button'}
    >
      {isList ? <List className="h-3 w-3" /> : <MousePointerClick className="h-3 w-3" />}
      {isList ? 'List selection' : 'Button reply'}
    </div>
  );
}

/* ─── Shared contacts ──────────────────────────────────────────────────────── */

function ContactsCard({ meta, isAssistant }: { meta: ContactsMetadata; isAssistant: boolean }) {
  const contacts = meta.contacts ?? [];
  if (contacts.length === 0) return null;
  return (
    <div
      className={cx(
        'rounded-lg border px-3 py-2.5 space-y-1.5',
        isAssistant ? 'border-white/30' : 'border-border-color bg-bg-secondary/40',
      )}
    >
      {contacts.map((c, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <UserRound className={cx('h-5 w-5 shrink-0', isAssistant ? 'text-white/90' : 'text-text-secondary')} />
          <span className="min-w-0">
            <span className={cx('block truncate text-sm font-medium', isAssistant ? 'text-white' : 'text-text-primary')}>
              {c.name?.formatted_name || 'Contact'}
            </span>
            {c.phones?.[0]?.phone && (
              <span className={cx('block text-xs', isAssistant ? 'text-white/70' : 'text-text-secondary')}>
                {c.phones[0].phone}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Outbound template card (WhatsApp-style) ──────────────────────────────── */

function TemplateCard({ meta, isAssistant }: { meta: TemplateMetadata; isAssistant: boolean }) {
  const headerUrl = meta.header?.url;
  const headerFormat = (meta.header?.format || '').toLowerCase();
  return (
    <div className={cx('overflow-hidden rounded-lg border', isAssistant ? 'border-white/30' : 'border-border-color')}>
      {headerUrl && headerFormat === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={headerUrl} alt="Template header" className="max-h-44 w-full object-cover" loading="lazy" />
      )}
      {headerUrl && headerFormat === 'video' && (
        <video src={headerUrl} controls preload="metadata" className="max-h-44 w-full" />
      )}
      <div className="px-3 py-2 space-y-1">
        {meta.template_name && (
          <p className={cx('text-[10px] font-semibold uppercase tracking-wide', isAssistant ? 'text-white/60' : 'text-text-secondary')}>
            Template · {meta.template_name}
          </p>
        )}
        {meta.body && (
          <p className={cx('whitespace-pre-wrap text-sm', isAssistant ? 'text-white' : 'text-text-primary')}>{meta.body}</p>
        )}
        {meta.footer && (
          <p className={cx('text-xs', isAssistant ? 'text-white/60' : 'text-text-secondary')}>{meta.footer}</p>
        )}
      </div>
      {(meta.buttons?.length ?? 0) > 0 && (
        <div className={cx('border-t', isAssistant ? 'border-white/30' : 'border-border-color')}>
          {meta.buttons!.map((b, i) => (
            <div
              key={i}
              className={cx(
                'px-3 py-1.5 text-center text-sm font-medium',
                i > 0 && (isAssistant ? 'border-t border-white/30' : 'border-t border-border-color'),
                isAssistant ? 'text-white/90' : 'text-accent',
              )}
            >
              {b.text || b.type || 'Button'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InteractiveButtonsCard({ meta, isAssistant }: { meta: InteractiveButtonsMetadata; isAssistant: boolean }) {
  return (
    <div className={cx('overflow-hidden rounded-lg border', isAssistant ? 'border-white/30' : 'border-border-color')}>
      {meta.body && (
        <p className={cx('whitespace-pre-wrap px-3 py-2 text-sm', isAssistant ? 'text-white' : 'text-text-primary')}>
          {meta.body}
        </p>
      )}
      {(meta.buttons?.length ?? 0) > 0 && (
        <div className={cx('border-t', isAssistant ? 'border-white/30' : 'border-border-color')}>
          {meta.buttons!.map((b, i) => (
            <div
              key={b.id ?? i}
              className={cx(
                'px-3 py-1.5 text-center text-sm font-medium',
                i > 0 && (isAssistant ? 'border-t border-white/30' : 'border-t border-border-color'),
                isAssistant ? 'text-white/90' : 'text-accent',
              )}
            >
              {b.title || 'Button'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Metadata dispatcher ──────────────────────────────────────────────────── */

function MetadataContent({ meta, isAssistant }: { meta: MessageMetadata; isAssistant: boolean }) {
  switch (meta.type) {
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
    case 'sticker':
      return <MediaAttachment meta={meta} isAssistant={isAssistant} />;
    case 'location':
      return <LocationCard meta={meta} isAssistant={isAssistant} />;
    case 'button_reply':
    case 'list_reply':
      return <ReplyChip meta={meta} isAssistant={isAssistant} />;
    case 'contacts':
      return <ContactsCard meta={meta} isAssistant={isAssistant} />;
    case 'template':
      return <TemplateCard meta={meta} isAssistant={isAssistant} />;
    case 'interactive_buttons':
      return <InteractiveButtonsCard meta={meta} isAssistant={isAssistant} />;
    default:
      return null;
  }
}

/**
 * Decide whether the plain `content` text should render under the rich
 * attachment. The backend mirrors captions/titles into content, so:
 *  - media: content === caption (show) or "[Image]" placeholder (hide)
 *  - location: name/address already on the card → hide
 *  - template: body already on the card → hide
 *  - button/list reply: content is the tapped title → show
 */
function shouldShowText(meta: MessageMetadata | null | undefined, content: string): boolean {
  if (!content?.trim()) return false;
  if (!meta) return true;
  if (MEDIA_TYPES.has(meta.type)) return !isPlaceholderText(content);
  if (meta.type === 'location' || meta.type === 'template' || meta.type === 'interactive_buttons') return false;
  if (meta.type === 'contacts') return !isPlaceholderText(content);
  return true;
}

export function MessageBubble({
  message,
  isFirstInGroup = true,
  isLastInGroup = true,
  avatarInitial,
}: {
  message: MessageWithMeta;
  /** First of a run of same-sender messages — controls top spacing. */
  isFirstInGroup?: boolean;
  /** Last of a run — controls the tail corner, avatar, and timestamp row. */
  isLastInGroup?: boolean;
  /** Initial shown in the incoming-side avatar (last bubble of a group). */
  avatarInitial?: string;
}) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isTool = message.role === 'tool';
  const isSystem = isTool || message.role === 'system';
  const meta = message.metadata ?? null;
  const showText = shouldShowText(meta, message.content);

  // ── AI-agent action → centered "action" pill with a wrench icon ──────────
  // The brain engine writes a `tool`-role Message per non-message action it
  // takes (update contact, qualify lead, create record, …) so the owner can
  // see exactly what the agent did inline in the thread.
  if (isTool) {
    const failed = message.tool_status === 'error' || message.tool_status === 'timeout';
    return (
      <div className={cx('flex justify-center', isLastInGroup ? 'mb-3' : 'mb-1', isFirstInGroup ? 'mt-3' : '')}>
        <div
          className={cx(
            'inline-flex max-w-[85%] items-center gap-1.5 break-words [overflow-wrap:anywhere] rounded-full border px-3 py-1 text-center text-[11px] font-medium',
            failed
              ? 'border-red-300 bg-red-50 text-red-600'
              : 'border-border-color bg-bg-secondary/80 text-text-secondary',
          )}
          title={message.tool_called ? `AI action · ${message.tool_called}` : 'AI action'}
        >
          <Wrench className="h-3 w-3 shrink-0 opacity-70" />
          <span>{showText ? message.content : message.tool_called || 'AI action'}</span>
        </div>
      </div>
    );
  }

  // ── System → centered status pill ────────────────────────────────────────
  if (isSystem) {
    return (
      <div className={cx('flex justify-center', isLastInGroup ? 'mb-3' : 'mb-1', isFirstInGroup ? 'mt-3' : '')}>
        <div className="max-w-[85%] break-words [overflow-wrap:anywhere] rounded-full border border-border-color bg-bg-secondary/80 px-3 py-1 text-center text-[11px] text-text-secondary">
          {showText ? message.content : 'System event'}
        </div>
      </div>
    );
  }

  const gapClass = isLastInGroup ? 'mb-2.5' : 'mb-0.5';

  // Visual media with no caption/extras → render edge-to-edge inside a slim
  // frame instead of padded text, like a photo message.
  const isVisualMediaOnly =
    !!meta &&
    (meta.type === 'image' || meta.type === 'sticker' || meta.type === 'video') &&
    !showText &&
    !message.tool_called &&
    !message.intent &&
    !(isAssistant && message.error_code);

  return (
    <div
      className={cx(
        'flex items-end gap-2 animate-in fade-in duration-200',
        isUser ? 'justify-start' : 'justify-end',
        gapClass,
      )}
    >
      {/* Incoming avatar — rendered only on the last bubble of a group;
          a fixed-width gutter keeps earlier bubbles aligned. */}
      {isUser && (
        <div className="w-7 shrink-0 self-end">
          {isLastInGroup && (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent ring-1 ring-border-color">
              {avatarInitial || '·'}
            </div>
          )}
        </div>
      )}

      <div
        className={cx(
          'relative min-w-0 max-w-[82%] sm:max-w-[66%] shadow-sm',
          'rounded-2xl',
          isVisualMediaOnly ? 'p-1' : 'px-3.5 py-2',
          // tail tucks toward the sender on the last bubble of a group
          isAssistant && isLastInGroup && 'rounded-br-md',
          isUser && isLastInGroup && 'rounded-bl-md',
          isAssistant && 'bg-accent text-white',
          isUser && 'border border-border-color bg-card-bg text-text-primary',
        )}
      >
        {meta && (
          <div className={cx(showText && 'mb-1.5')}>
            <MetadataContent meta={meta} isAssistant={isAssistant} />
          </div>
        )}
        {showText && (
          <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed">
            {message.content}
          </div>
        )}
        {(message.tool_called || message.intent) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.tool_called && (
              <span className={cx('rounded border px-2 py-0.5 text-[11px] font-medium', isAssistant ? 'border-white/40 text-white/90' : 'border-border-color bg-bg-secondary/60 text-text-secondary')}>
                Used: {message.tool_called}
              </span>
            )}
            {message.intent && (
              <span className={cx('rounded border px-2 py-0.5 text-[11px] font-medium', isAssistant ? 'border-white/40 text-white/90' : 'border-border-color bg-bg-secondary/60 text-text-secondary')}>
                Intent: {message.intent}
              </span>
            )}
          </div>
        )}
        {isAssistant && message.error_code && message.error_detail && (
          <div className="mt-1.5 break-words [overflow-wrap:anywhere] rounded-lg bg-black/20 px-2 py-1.5 text-[11px] leading-snug text-white/90">
            {message.error_detail}
          </div>
        )}
        {/* Timestamp + delivery — only on the last bubble of a group */}
        {isLastInGroup && (
          <div
            className={cx(
              'flex items-center justify-end gap-1 text-[10px] tabular-nums',
              isVisualMediaOnly ? 'px-1.5 pt-1 pb-0.5' : 'mt-0.5',
              isAssistant ? 'text-white/70' : 'text-text-secondary/80',
            )}
          >
            <span>{formatMessageTime(message.timestamp)}</span>
            {isAssistant && <DeliveryStatus message={message} />}
          </div>
        )}
      </div>
    </div>
  );
}
