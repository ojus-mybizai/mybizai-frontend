'use client';

import { Clock } from 'lucide-react';

/**
 * /team/attendance — placeholder.
 *
 * The WaEmployee-backed check-in system was retired; a Member-native
 * attendance surface will replace it in a later slice.
 */
export default function AttendancePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
        <Clock className="h-6 w-6 text-accent" />
      </div>
      <h1 className="mt-4 text-xl font-semibold text-text-primary">Attendance is on the roadmap</h1>
      <p className="mt-2 max-w-md text-sm text-text-secondary">
        The previous WhatsApp check-in flow was retired with the WaEmployee subsystem. A
        Member-native attendance surface will land in a later slice.
      </p>
    </div>
  );
}
