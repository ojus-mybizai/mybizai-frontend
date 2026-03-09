'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewModelPageRoute() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/data-sheet?create=1');
  }, [router]);
  return null;
}
