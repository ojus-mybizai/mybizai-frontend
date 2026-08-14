import type { DynamicField } from '@/services/dynamic-data';
import { isUniversalToken } from '@/lib/tasks/tokens';

export type TokenSource = 'datasheet' | 'contact' | 'free' | 'universal';

export interface TextSeg {
  kind: 'text';
  text: string;
}

export interface TokenSeg {
  kind: 'token';
  source: TokenSource;
  path: string;
  fieldType?: string;
  removable: boolean;
}

export type TokenSegment = TextSeg | TokenSeg;

export interface TokenDoc {
  segments: TokenSegment[];
}

export interface ParseSchema {
  datasheetName?: string;
  fields?: DynamicField[];
}

const TOKEN_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;

export function parse(str: string, schema?: ParseSchema): TokenDoc {
  const segments: TokenSegment[] = [];
  if (!str) return { segments };

  let idx = 0;
  const re = new RegExp(TOKEN_RE);
  let match: RegExpExecArray | null;
  while ((match = re.exec(str)) !== null) {
    if (match.index > idx) {
      segments.push({ kind: 'text', text: str.slice(idx, match.index) });
    }
    const path = match[1];
    const [head, ...rest] = path.split('.');
    let source: TokenSource = 'free';
    let fieldType: string | undefined;
    if (isUniversalToken(path)) {
      source = 'universal';
    } else if (head === 'contact') {
      source = 'contact';
    } else if (schema?.datasheetName && head === schema.datasheetName && rest.length > 0) {
      source = 'datasheet';
      const fieldName = rest.join('.');
      const field = schema.fields?.find((f) => f.name === fieldName);
      fieldType = field?.field_type;
    }
    segments.push({ kind: 'token', source, path, fieldType, removable: true });
    idx = match.index + match[0].length;
  }
  if (idx < str.length) segments.push({ kind: 'text', text: str.slice(idx) });
  return { segments };
}

export function serialize(doc: TokenDoc): string {
  return doc.segments
    .map((s) => (s.kind === 'text' ? s.text : `{{${s.path}}}`))
    .join('');
}

export function isEmpty(doc: TokenDoc): boolean {
  return doc.segments.every((s) => s.kind === 'text' && !s.text);
}

export function hasNumericDatasheetToken(doc: TokenDoc): boolean {
  return doc.segments.some(
    (s) =>
      s.kind === 'token' &&
      s.source === 'datasheet' &&
      s.fieldType != null &&
      ['integer', 'decimal', 'number', 'currency'].includes(s.fieldType),
  );
}

export function insertToken(
  doc: TokenDoc,
  atIndex: number,
  token: Omit<TokenSeg, 'kind'>,
): TokenDoc {
  const segments: TokenSegment[] = [];
  let cursor = 0;
  let inserted = false;
  for (const seg of doc.segments) {
    if (seg.kind === 'text') {
      const next = cursor + seg.text.length;
      if (!inserted && atIndex >= cursor && atIndex <= next) {
        const before = seg.text.slice(0, atIndex - cursor);
        const after = seg.text.slice(atIndex - cursor);
        if (before) segments.push({ kind: 'text', text: before });
        segments.push({ kind: 'token', ...token });
        if (after) segments.push({ kind: 'text', text: after });
        inserted = true;
      } else {
        segments.push(seg);
      }
      cursor = next;
    } else {
      segments.push(seg);
    }
  }
  if (!inserted) segments.push({ kind: 'token', ...token });
  return normalize({ segments });
}

function normalize(doc: TokenDoc): TokenDoc {
  const out: TokenSegment[] = [];
  for (const seg of doc.segments) {
    const last = out[out.length - 1];
    if (seg.kind === 'text' && last && last.kind === 'text') {
      last.text += seg.text;
    } else if (seg.kind === 'text' && seg.text === '') {
      continue;
    } else {
      out.push({ ...seg });
    }
  }
  if (out.length === 0) out.push({ kind: 'text', text: '' });
  return { segments: out };
}

export function emptyDoc(): TokenDoc {
  return { segments: [{ kind: 'text', text: '' }] };
}

export function extractFreeVariables(doc: TokenDoc): string[] {
  const set = new Set<string>();
  for (const s of doc.segments) {
    if (s.kind === 'token' && s.source === 'free') set.add(s.path);
  }
  return Array.from(set);
}
