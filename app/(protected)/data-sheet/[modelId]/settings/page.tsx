'use client';

import dynamic from 'next/dynamic';

const SettingsPage = dynamic(
  () => import('@/features/data-sheet/routes/settings-page').then(m => m.SettingsPage),
  { ssr: false }
);

export default function DataSheetSettingsPageRoute() {
  return <SettingsPage />;
}
