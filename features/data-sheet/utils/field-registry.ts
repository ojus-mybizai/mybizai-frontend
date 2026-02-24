/**
 * Field type to display label and editor hints. Used by grid and settings.
 */
export const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  long_text: 'Long text',
  number: 'Number',
  currency: 'Currency',
  boolean: 'Boolean',
  date: 'Date',
  enum: 'Dropdown (enum)',
  image: 'Image',
  file: 'File',
  relation: 'Relation',
};

export const FIELD_TYPES = [
  'text',
  'long_text',
  'number',
  'currency',
  'boolean',
  'date',
  'enum',
  'image',
  'file',
  'relation',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export function getFieldTypeLabel(type: string): string {
  return FIELD_TYPE_LABELS[type] ?? type;
}

export function isEditableFieldType(type: string): boolean {
  return ['text', 'long_text', 'number', 'currency', 'boolean', 'date', 'enum', 'relation'].includes(type);
}
