'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { DynamicModel, DynamicField } from '@/services/dynamic-data';

export interface DataSheetContextValue {
  modelId: string;
  model: DynamicModel;
  fields: DynamicField[];
  refetchFields?: () => Promise<void>;
}

const DataSheetContext = createContext<DataSheetContextValue | null>(null);

export function DataSheetProvider({
  value,
  children,
}: {
  value: DataSheetContextValue;
  children: ReactNode;
}) {
  return (
    <DataSheetContext.Provider value={value}>
      {children}
    </DataSheetContext.Provider>
  );
}

export function useDataSheetContext(): DataSheetContextValue | null {
  return useContext(DataSheetContext);
}
