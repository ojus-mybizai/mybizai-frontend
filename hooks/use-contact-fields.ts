'use client';

/**
 * useContactFields — schema-aware data hook for Contact custom fields.
 *
 * Returns the business's ContactFieldDefs re-shaped into the same
 * {name, display_name, field_type, config} form as DynamicField so the
 * ConditionBuilder can share its value-input switch across entity kinds.
 */

import { useQuery } from '@tanstack/react-query';
import { listFieldDefs, type ContactFieldDef } from '@/services/contact-field-defs';

export interface ContactFieldOption {
  name: string;
  display_name: string;
  field_type: string;
  config: Record<string, unknown>;
  id: number;
}

function toOption(f: ContactFieldDef): ContactFieldOption {
  return {
    id: f.id,
    name: f.name,
    display_name: f.name,
    field_type: f.field_type,
    config: f.options ? { options: f.options } : {},
  };
}

export function useContactFields() {
  return useQuery<ContactFieldOption[]>({
    queryKey: ['contact-field-defs', 'all'],
    queryFn: async () => (await listFieldDefs()).map(toOption),
    staleTime: 60_000,
  });
}
