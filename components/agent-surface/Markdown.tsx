'use client';

/**
 * P3b — the single markdown renderer, used everywhere agent prose is shown
 * (markdown blocks, memory preview). react-markdown v9 does NOT render raw HTML
 * unless rehype-raw is added, so untrusted agent output is safe by default.
 * GitHub-flavoured markdown (tables, strikethrough, task lists) via remark-gfm.
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const COMPONENTS: Components = {
  a: ({ ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" className="text-accent underline" />
  ),
  table: ({ ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table {...props} className="w-full border-collapse text-sm" />
    </div>
  ),
  th: ({ ...props }) => (
    <th {...props} className="border border-border-color bg-bg-secondary px-2 py-1 text-left font-semibold" />
  ),
  td: ({ ...props }) => <td {...props} className="border border-border-color px-2 py-1 align-top" />,
  code: ({ className, children, ...props }) => {
    const inline = !className;
    return inline ? (
      <code {...props} className="rounded bg-bg-secondary px-1 py-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    ) : (
      <code {...props} className={`${className ?? ''} font-mono`}>
        {children}
      </code>
    );
  },
  pre: ({ ...props }) => (
    <pre {...props} className="my-2 overflow-x-auto rounded-lg bg-bg-secondary p-3 text-[0.85em]" />
  ),
  // Drop images with an empty/missing src (agents sometimes emit `![alt]()`);
  // an empty `src` makes the browser re-fetch the page. Constrain real images.
  img: ({ src, alt, ...props }) => {
    if (!src || (typeof src === 'string' && !src.trim())) return null;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} src={src} alt={alt ?? ''} className="my-2 max-h-64 max-w-full rounded-lg" />;
  },
};

export default function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-chat space-y-2 break-words text-[16px] leading-relaxed text-text-primary [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_strong]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-border-color [&_blockquote]:pl-3 [&_blockquote]:text-text-secondary">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {text || ''}
      </ReactMarkdown>
    </div>
  );
}
